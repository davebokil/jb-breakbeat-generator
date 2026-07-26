import { deriveEqualSlices, deriveSlices, detectOnsets, slicesFromTimes, type Slice, type SliceMode } from '~/utils/transientDetection'
import { computePeaks } from '~/utils/waveformPeaks'

const VOICE_STEAL_FADE_SECONDS = 0.005
const WAVEFORM_POINTS = 600

type LoopPlayer = ReturnType<typeof useLoopPlayer>
type SliceVoice = NonNullable<ReturnType<LoopPlayer['triggerSlice']>>

// Chop/pad-mode orchestration built on top of an existing useLoopPlayer
// instance - deliberately takes it as a parameter rather than calling
// useLoopPlayer() again, since that would create a second closure (a second
// AudioContext and effects graph) instead of reusing the app's one shared
// engine.
export function useChopPad(loopPlayer: LoopPlayer) {
  const slices = ref<Slice[]>([])
  const analyzing = ref(false)
  const sliceMode = ref<SliceMode>('transient')
  // All detected onset candidates, before deriveSlices' top-8-by-strength cut -
  // what the waveform editor offers to promote into a boundary. Independent
  // of sliceMode: it's always "what the detector found", not what's active.
  const candidateOnsets = ref<number[]>([])
  const peaks = ref<Float32Array | null>(null)
  const duration = ref(0)

  // Keyed by `${uri}::${mode}` so switching slicing strategy doesn't require
  // re-detecting transients every time the user flips back.
  const sliceCache = new Map<string, Slice[]>()
  const candidateCache = new Map<string, number[]>()
  const peaksCache = new Map<string, Float32Array>()
  // Chop mode plays one voice at a time - triggering any pad cuts whatever
  // else is still sounding, rather than letting pads overlap.
  const activeVoices = new Map<number, SliceVoice>()

  let currentUri: string | null = null
  let forwardBuffer: AudioBuffer | null = null
  let reversedBuffer: AudioBuffer | null = null

  function computeSlices(uri: string, buffer: AudioBuffer, mode: SliceMode): Slice[] {
    const cacheKey = `${uri}::${mode}`
    const cached = sliceCache.get(cacheKey)
    if (cached) return cached
    const derived = mode === 'equal' ? deriveEqualSlices(buffer) : deriveSlices(buffer, detectOnsets(buffer))
    sliceCache.set(cacheKey, derived)
    return derived
  }

  function computeCandidates(uri: string, buffer: AudioBuffer): number[] {
    const cached = candidateCache.get(uri)
    if (cached) return cached
    const onsets = detectOnsets(buffer)
    candidateCache.set(uri, onsets)
    return onsets
  }

  function computeWaveformPeaks(uri: string, buffer: AudioBuffer): Float32Array {
    const cached = peaksCache.get(uri)
    if (cached) return cached
    const computed = computePeaks(buffer, WAVEFORM_POINTS)
    peaksCache.set(uri, computed)
    return computed
  }

  async function analyzeTrack(uri: string) {
    analyzing.value = true
    try {
      const { forward, reversed } = await loopPlayer.loadBuffers(uri)
      currentUri = uri
      forwardBuffer = forward
      reversedBuffer = reversed
      duration.value = forward.duration
      candidateOnsets.value = computeCandidates(uri, forward)
      peaks.value = computeWaveformPeaks(uri, forward)
      slices.value = computeSlices(uri, forward, sliceMode.value)
    } finally {
      analyzing.value = false
    }
  }

  // Re-slices the already-decoded current track under a different strategy,
  // without re-fetching/re-decoding it. Always recomputes (even re-clicking
  // the already-active mode) so this doubles as "discard my manual edits".
  function setSliceMode(mode: SliceMode) {
    sliceMode.value = mode
    if (currentUri && forwardBuffer) {
      slices.value = computeSlices(currentUri, forwardBuffer, mode)
    }
  }

  // Applies a hand-picked set of boundary times from the waveform editor.
  // Doesn't touch sliceMode or the slice cache - it's a one-off override,
  // discarded the next time setSliceMode runs.
  function setManualBoundaries(times: number[]) {
    if (!forwardBuffer) return
    slices.value = slicesFromTimes(forwardBuffer, times)
  }

  function stopAllVoices(fadeSeconds: number) {
    for (const [padIndex, voice] of activeVoices) {
      activeVoices.delete(padIndex)
      voice.stop(fadeSeconds)
    }
  }

  // Plays from the slice's start point through to the natural end of the
  // sample (or the start of the track, when reversed) - a slice's `end` is
  // just the next pad's boundary for display purposes, not a playback limit.
  // The only thing that cuts a pad's audio short is another pad stealing the
  // voice (stopAllVoices above).
  function triggerPad(padIndex: number) {
    const slice = slices.value[padIndex]
    if (!slice || !forwardBuffer) return

    stopAllVoices(VOICE_STEAL_FADE_SECONDS)

    const buffer = slice.reversed ? reversedBuffer : forwardBuffer
    if (!buffer) return
    const offset = slice.reversed ? forwardBuffer.duration - slice.end : slice.start

    const voice = loopPlayer.triggerSlice(buffer, offset, undefined, {
      detuneSemitones: slice.pitchSemitones,
      gainValue: slice.gain,
      onEnded: () => {
        if (activeVoices.get(padIndex) === voice) activeVoices.delete(padIndex)
      },
    })
    if (voice) activeVoices.set(padIndex, voice)
  }

  function reset() {
    stopAllVoices(0)
    slices.value = []
    candidateOnsets.value = []
    peaks.value = null
    duration.value = 0
    currentUri = null
    forwardBuffer = null
    reversedBuffer = null
  }

  return {
    slices,
    analyzing,
    sliceMode,
    candidateOnsets,
    peaks,
    duration,
    analyzeTrack,
    setSliceMode,
    setManualBoundaries,
    triggerPad,
    reset,
  }
}
