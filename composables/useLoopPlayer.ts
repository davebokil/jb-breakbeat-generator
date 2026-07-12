// Seamless looping playback via the Web Audio API, ported from the
// original loopify.js so breakbeats loop without a gap between repeats.
export function useLoopPlayer() {
  let context: AudioContext | null = null
  let source: AudioBufferSourceNode | null = null
  let gainNode: GainNode | null = null
  let playToken = 0
  let volume = 0.8
  let pitchSemitones = 0
  const bufferCache = new Map<string, AudioBuffer>()

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
    if (source) {
      source.stop()
      source.disconnect()
      source = null
    }
  }

  async function loadBuffer(uri: string): Promise<AudioBuffer> {
    const cached = bufferCache.get(uri)
    if (cached) return cached

    const ctx = getContext()
    const response = await fetch(uri)
    const arrayBuffer = await response.arrayBuffer()
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
    bufferCache.set(uri, audioBuffer)
    return audioBuffer
  }

  async function play(uri: string) {
    stop()
    const token = ++playToken
    const ctx = getContext()
    if (ctx.state === 'suspended') await ctx.resume()

    const buffer = await loadBuffer(uri)
    if (token !== playToken) return // a newer play()/stop() happened while we were loading

    source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.detune.value = pitchSemitones * 100
    source.connect(gainNode!)
    source.start(0)
  }

  return { play, stop, setVolume, setPitch }
}
