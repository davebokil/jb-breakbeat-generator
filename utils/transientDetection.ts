// Auto-chops a decoded break into up to padCount slices by detecting drum-hit
// onsets from the audio itself - energy-based onset detection, not FFT-based
// spectral flux, since breakbeat hits are broadband percussive transients and
// don't need pitch-aware analysis to find reliably.
export interface Slice {
  padIndex: number
  start: number // seconds into the buffer
  end: number // seconds into the buffer, end > start
  reversed: boolean
  pitchSemitones: number
  gain: number
}

// 'transient': detected drum-hit onsets. 'equal': the buffer divided into
// padCount equal-length slices, ignoring the audio content entirely - useful
// for comparing against transient detection, or for material without clear
// percussive hits.
export type SliceMode = 'transient' | 'equal'

const FRAME_SIZE = 1024 // ~23ms at 44.1kHz - short enough to localize a hit's attack
const HOP_SIZE = 512 // 50% overlap, ~11.6ms resolution
const SENSITIVITY = 1.5 // threshold = local mean + SENSITIVITY * local std
const LOCAL_WINDOW_FRAMES = 20 // +/-20 frames (~230ms) for the adaptive threshold
const MIN_SPACING_SECONDS = 0.08 // stops one hit's attack+decay bump registering twice
const STRENGTH_WINDOW_SECONDS = 0.05

function toMono(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0)
  const length = buffer.length
  const mono = new Float32Array(length)
  const channels: Float32Array[] = []
  for (let c = 0; c < buffer.numberOfChannels; c++) channels.push(buffer.getChannelData(c))
  for (let i = 0; i < length; i++) {
    let sum = 0
    for (let c = 0; c < channels.length; c++) sum += channels[c][i]
    mono[i] = sum / channels.length
  }
  return mono
}

function computeRmsEnvelope(mono: Float32Array): Float32Array {
  const frameCount = Math.max(1, Math.floor((mono.length - FRAME_SIZE) / HOP_SIZE) + 1)
  const rms = new Float32Array(frameCount)
  for (let f = 0; f < frameCount; f++) {
    const start = f * HOP_SIZE
    let sumSquares = 0
    for (let i = 0; i < FRAME_SIZE; i++) {
      const sample = mono[start + i] ?? 0
      sumSquares += sample * sample
    }
    rms[f] = Math.sqrt(sumSquares / FRAME_SIZE)
  }
  return rms
}

// Half-wave-rectified first difference of the RMS envelope ("energy flux") -
// the standard cheap onset-detection novelty function. Smoothed with a
// 3-frame moving average so a single noisy frame doesn't masquerade as a hit.
function computeNovelty(rms: Float32Array): Float32Array {
  const raw = new Float32Array(rms.length)
  for (let i = 1; i < rms.length; i++) {
    raw[i] = Math.max(0, rms[i] - rms[i - 1])
  }
  const smoothed = new Float32Array(raw.length)
  for (let i = 0; i < raw.length; i++) {
    const lo = Math.max(0, i - 1)
    const hi = Math.min(raw.length - 1, i + 1)
    let sum = 0
    for (let j = lo; j <= hi; j++) sum += raw[j]
    smoothed[i] = sum / (hi - lo + 1)
  }
  return smoothed
}

// Rolling local mean + standard deviation via prefix sums, so the whole
// threshold curve is O(n) rather than O(n * windowFrames). Standard deviation
// stands in for mean-absolute-deviation here - same adaptive-threshold idea,
// cheaper to compute incrementally.
function computeAdaptiveThreshold(novelty: Float32Array): Float32Array {
  const n = novelty.length
  const prefixSum = new Float64Array(n + 1)
  const prefixSumSq = new Float64Array(n + 1)
  for (let i = 0; i < n; i++) {
    prefixSum[i + 1] = prefixSum[i] + novelty[i]
    prefixSumSq[i + 1] = prefixSumSq[i] + novelty[i] * novelty[i]
  }
  const threshold = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - LOCAL_WINDOW_FRAMES)
    const hi = Math.min(n - 1, i + LOCAL_WINDOW_FRAMES)
    const count = hi - lo + 1
    const sum = prefixSum[hi + 1] - prefixSum[lo]
    const sumSq = prefixSumSq[hi + 1] - prefixSumSq[lo]
    const mean = sum / count
    const variance = Math.max(0, sumSq / count - mean * mean)
    threshold[i] = mean + SENSITIVITY * Math.sqrt(variance)
  }
  return threshold
}

function pickPeakFrames(novelty: Float32Array, threshold: Float32Array): number[] {
  const frames: number[] = []
  for (let i = 0; i < novelty.length; i++) {
    if (novelty[i] <= threshold[i]) continue
    const lo = Math.max(0, i - 2)
    const hi = Math.min(novelty.length - 1, i + 2)
    let isLocalMax = true
    for (let j = lo; j <= hi; j++) {
      if (j !== i && novelty[j] > novelty[i]) {
        isLocalMax = false
        break
      }
    }
    if (isLocalMax) frames.push(i)
  }
  return frames
}

function framesToSpacedTimes(frames: number[], sampleRate: number): number[] {
  const times: number[] = []
  let lastTime = -Infinity
  for (const frame of frames) {
    const time = (frame * HOP_SIZE) / sampleRate
    if (time - lastTime >= MIN_SPACING_SECONDS) {
      times.push(time)
      lastTime = time
    }
  }
  return times
}

// Detects drum-hit onset times (seconds) in a decoded break. May return more
// or fewer onsets than the pad grid has room for - deriveSlices handles both.
export function detectOnsets(buffer: AudioBuffer): number[] {
  const mono = toMono(buffer)
  const rms = computeRmsEnvelope(mono)
  const novelty = computeNovelty(rms)
  const threshold = computeAdaptiveThreshold(novelty)
  const peakFrames = pickPeakFrames(novelty, threshold)
  return framesToSpacedTimes(peakFrames, buffer.sampleRate)
}

// Local energy just after a candidate onset, used only to rank candidates
// when there are more of them than pads - not part of detection itself.
function estimateOnsetStrength(mono: Float32Array, sampleRate: number, time: number): number {
  const startSample = Math.round(time * sampleRate)
  const windowSamples = Math.round(STRENGTH_WINDOW_SECONDS * sampleRate)
  const endSample = Math.min(mono.length, startSample + windowSamples)
  let sumSquares = 0
  let count = 0
  for (let i = startSample; i < endSample; i++) {
    sumSquares += mono[i] * mono[i]
    count++
  }
  return count > 0 ? Math.sqrt(sumSquares / count) : 0
}

// Turns a list of boundary times into padCount-or-fewer time-ordered,
// pad-ready slices - the shared tail end for every way a set of boundaries
// can be produced (detected, evenly-spaced, or hand-picked on the waveform).
// Dedupes and caps at padCount so callers don't each have to.
export function slicesFromTimes(buffer: AudioBuffer, times: number[], padCount = 8): Slice[] {
  const sorted = Array.from(new Set(times)).sort((a, b) => a - b).slice(0, padCount)
  const slices: Slice[] = []
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i]
    const end = i + 1 < sorted.length ? sorted[i + 1] : buffer.duration
    slices.push({ padIndex: i, start, end, reversed: false, pitchSemitones: 0, gain: 1 })
  }
  return slices
}

// Turns detected onset times into exactly `padCount`-or-fewer time-ordered
// slices. Fewer onsets than pads: leave the remaining pads unfilled rather
// than fabricating boundaries. More onsets than pads: keep the strongest
// `padCount` (by local energy), so pad 0 is always "the first thing that
// happens in the loop", not "the loudest hit" - slicesFromTimes re-sorts
// chronologically regardless of the order they're passed in.
export function deriveSlices(buffer: AudioBuffer, onsets: number[], padCount = 8): Slice[] {
  let times = onsets.slice().sort((a, b) => a - b)
  if (times.length === 0) return []
  if (times[0] > 0.05) times.unshift(0)

  if (times.length > padCount) {
    const mono = toMono(buffer)
    times = times
      .map(time => ({ time, strength: estimateOnsetStrength(mono, buffer.sampleRate, time) }))
      .sort((a, b) => b.strength - a.strength)
      .slice(0, padCount)
      .map(candidate => candidate.time)
  }

  return slicesFromTimes(buffer, times, padCount)
}

// Ignores the audio content and divides the buffer into padCount equal-length
// slices - the classic "fixed division" chop mode, as a comparison point
// against transient detection.
export function deriveEqualSlices(buffer: AudioBuffer, padCount = 8): Slice[] {
  const times = Array.from({ length: padCount }, (_, i) => (i * buffer.duration) / padCount)
  return slicesFromTimes(buffer, times, padCount)
}
