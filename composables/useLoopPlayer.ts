// Seamless looping playback via the Web Audio API, ported from the
// original loopify.js so breakbeats loop without a gap between repeats.
export function useLoopPlayer() {
  let context: AudioContext | null = null
  let source: AudioBufferSourceNode | null = null
  let gainNode: GainNode | null = null
  let playToken = 0
  let volume = 0.8
  let pitchSemitones = 0
  let forwardBuffer: AudioBuffer | null = null
  let reversedBuffer: AudioBuffer | null = null
  // context.currentTime at which the current forward loop would have started
  // playing from offset 0 - lets us compute "where in the track are we" at
  // any moment without tracking it on every tick.
  let loopStartContextTime = 0
  // Non-null while the platter is being dragged: the position (in seconds)
  // the scratch is currently at, driven entirely by drag deltas rather than
  // real elapsed time.
  let scratchPlayhead: number | null = null

  const bufferCache = new Map<string, { forward: AudioBuffer, reversed: AudioBuffer }>()

  function getContext() {
    if (!context) {
      context = new (window.AudioContext || (window as any).webkitAudioContext)()
      gainNode = context.createGain()
      gainNode.gain.value = volume
      gainNode.connect(context.destination)
    }
    return context
  }

  function setVolume(value: number) {
    volume = Math.min(1, Math.max(0, value))
    if (gainNode) gainNode.gain.value = volume
  }

  function setPitch(semitones: number) {
    pitchSemitones = Math.min(5, Math.max(-5, semitones))
    if (source) source.detune.value = pitchSemitones * 100
  }

  function stop() {
    playToken++
    scratchPlayhead = null
    if (source) {
      source.stop()
      source.disconnect()
      source = null
    }
  }

  async function loadBuffers(uri: string) {
    const cached = bufferCache.get(uri)
    if (cached) return cached

    const ctx = getContext()
    const response = await fetch(uri)
    const arrayBuffer = await response.arrayBuffer()
    const forward = await ctx.decodeAudioData(arrayBuffer)

    // AudioBufferSourceNode has no native reverse playback (negative
    // playbackRate is silently clamped by browsers), so a real reverse
    // scratch needs an actual reversed copy of the samples to play forward.
    const reversed = ctx.createBuffer(forward.numberOfChannels, forward.length, forward.sampleRate)
    for (let channel = 0; channel < forward.numberOfChannels; channel++) {
      const src = forward.getChannelData(channel)
      const dst = reversed.getChannelData(channel)
      for (let i = 0; i < src.length; i++) {
        dst[i] = src[src.length - 1 - i]
      }
    }

    const entry = { forward, reversed }
    bufferCache.set(uri, entry)
    return entry
  }

  function startLoopSource(offset: number) {
    if (!forwardBuffer || !gainNode || !context) return
    if (source) {
      source.stop()
      source.disconnect()
    }
    source = context.createBufferSource()
    source.buffer = forwardBuffer
    source.loop = true
    source.detune.value = pitchSemitones * 100
    source.connect(gainNode)
    source.start(0, offset)
    loopStartContextTime = context.currentTime - offset
  }

  async function play(uri: string) {
    stop()
    const token = ++playToken
    const ctx = getContext()
    if (ctx.state === 'suspended') await ctx.resume()

    const { forward, reversed } = await loadBuffers(uri)
    if (token !== playToken) return // a newer play()/stop() happened while we were loading

    forwardBuffer = forward
    reversedBuffer = reversed
    startLoopSource(0)
  }

  function getPlayhead(): number {
    if (!forwardBuffer || !context) return 0
    const duration = forwardBuffer.duration
    let t = (context.currentTime - loopStartContextTime) % duration
    if (t < 0) t += duration
    return t
  }

  function beginScratch() {
    if (!forwardBuffer) return
    scratchPlayhead = getPlayhead()
  }

  // Moves the virtual playhead by deltaSeconds (negative = backward) and
  // retriggers a short burst of audio from the matching buffer/offset -
  // the classic web-audio scratch technique, since there's no native way
  // to just "play this buffer backward".
  function scratchBy(deltaSeconds: number, speed: number) {
    if (!forwardBuffer || !reversedBuffer || !gainNode || !context || scratchPlayhead === null) return

    const duration = forwardBuffer.duration
    scratchPlayhead = ((scratchPlayhead + deltaSeconds) % duration + duration) % duration

    if (source) {
      source.stop()
      source.disconnect()
    }

    const reverse = deltaSeconds < 0
    const buffer = reverse ? reversedBuffer : forwardBuffer
    const offset = Math.min(
      duration - 0.001,
      Math.max(0, reverse ? duration - scratchPlayhead : scratchPlayhead),
    )

    source = context.createBufferSource()
    source.buffer = buffer
    source.loop = false
    source.playbackRate.value = Math.min(3, Math.max(0.3, speed || 1))
    source.detune.value = pitchSemitones * 100
    source.connect(gainNode)
    source.start(0, offset)
  }

  function endScratch() {
    if (scratchPlayhead === null) return
    startLoopSource(scratchPlayhead)
    scratchPlayhead = null
  }

  return { play, stop, setVolume, setPitch, beginScratch, scratchBy, endScratch }
}
