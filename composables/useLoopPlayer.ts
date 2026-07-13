// Seamless looping playback via the Web Audio API, ported from the
// original loopify.js so breakbeats loop without a gap between repeats.
export function useLoopPlayer() {
  let context: AudioContext | null = null
  let source: AudioBufferSourceNode | null = null
  let gainNode: GainNode | null = null
  let distortionNode: WaveShaperNode | null = null
  let distortionToneFilter: BiquadFilterNode | null = null
  let distortionWetGain: GainNode | null = null
  let compressorNode: DynamicsCompressorNode | null = null
  let compressorMakeupGain: GainNode | null = null
  let compressionDryGain: GainNode | null = null
  let compressionWetGain: GainNode | null = null
  let compressionBus: GainNode | null = null
  let convolverNode: ConvolverNode | null = null
  let reverbWetGain: GainNode | null = null
  let playToken = 0
  let volume = 0.8
  let pitchSemitones = 0
  let reverbAmount = 0
  let compressionAmount = 0
  let overdriveAmount = 0
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

  // Tape-style saturation curve: tanh gives a smooth, rounded compression
  // of peaks instead of the hard corners a sharper waveshaper curve would
  // produce, which is what reads as "tape" rather than "fuzz pedal". A
  // small asymmetry (bias) makes the curve compress positive and negative
  // swings by different amounts, which introduces even-order harmonics on
  // top of tanh's odd ones - that even/odd mix is most of what makes tape
  // and tube saturation sound "warm" rather than just clipped. Drive scales
  // with the overdrive slider so turning it up drives the saturation
  // harder, rather than just mixing in more of one fixed curve.
  function makeSaturationCurve(drive: number) {
    const samples = 2048
    const curve = new Float32Array(samples)
    const bias = 0.08
    const zeroOffset = Math.tanh(drive * bias)
    const norm = Math.tanh(drive * (1 + bias)) - zeroOffset
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1
      curve[i] = (Math.tanh(drive * (x + bias)) - zeroOffset) / norm
    }
    return curve
  }

  // Algorithmic impulse response (exponentially-decaying noise) so reverb
  // doesn't need an external audio file to convolve against.
  function makeImpulseResponse(ctx: AudioContext, duration = 2.5, decay = 3) {
    const rate = ctx.sampleRate
    const length = Math.floor(rate * duration)
    const impulse = ctx.createBuffer(2, length, rate)
    for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
      const data = impulse.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay)
      }
    }
    return impulse
  }

  function getContext() {
    if (!context) {
      context = new (window.AudioContext || (window as any).webkitAudioContext)()

      gainNode = context.createGain()
      gainNode.gain.value = volume
      gainNode.connect(context.destination)

      // Compression is a true crossfade (dry fades out as wet fades in),
      // not a parallel add like the sends below - the compressor has an
      // internal lookahead delay, so if an untouched copy of the source
      // stayed connected straight to gainNode at full level, it would sum
      // against a time-shifted compressed copy and comb-filter (heard as
      // flanging). Everything downstream (distortion, reverb) now taps off
      // this post-compression bus instead of the raw source.
      compressionBus = context.createGain()
      compressionBus.connect(gainNode)

      compressionDryGain = context.createGain()
      compressionDryGain.connect(compressionBus)

      // Knee and attack stay fixed - attack in particular is what lets each
      // hit's transient punch through before the squash grabs the body, and
      // that shouldn't change as the knob moves. Threshold, ratio, release
      // and makeup gain are set dynamically by applyCompressionAmount below,
      // so pushing the knob up doesn't just crossfade in more of one fixed
      // amount of compression - it makes the compression itself deeper.
      compressorNode = context.createDynamicsCompressor()
      compressorNode.knee.value = 6
      compressorNode.attack.value = 0.01
      // DynamicsCompressorNode has no automatic makeup gain, so the
      // compressed signal comes out quieter than the dry signal it
      // crossfades against - without boosting it back up, full wet would
      // sound like a level drop rather than a squash.
      compressorMakeupGain = context.createGain()
      compressionWetGain = context.createGain()
      compressorNode.connect(compressorMakeupGain)
      compressorMakeupGain.connect(compressionWetGain)
      compressionWetGain.connect(compressionBus)
      applyCompressionAmount(compressionAmount)

      // Distortion and reverb stay parallel sends: an untouched copy always
      // reaches gainNode via compressionBus, and each effect mixes a
      // processed copy on top, scaled by that effect's slider (0 = no
      // effect). WaveShaper has no lookahead and reverb's diffuse tail
      // doesn't comb-filter the way a compressed transient does, so parallel
      // mixing is fine for these two.
      distortionNode = context.createWaveShaper()
      distortionNode.oversample = '4x'
      // Tape heads roll off the top end - a gentle lowpass after the
      // saturation curve tames the harmonics tanh adds up top and keeps the
      // drive sounding warm instead of fizzy/harsh as it's pushed harder.
      distortionToneFilter = context.createBiquadFilter()
      distortionToneFilter.type = 'lowpass'
      distortionToneFilter.frequency.value = 8500
      distortionToneFilter.Q.value = 0.7
      distortionWetGain = context.createGain()
      compressionBus.connect(distortionNode)
      distortionNode.connect(distortionToneFilter)
      distortionToneFilter.connect(distortionWetGain)
      distortionWetGain.connect(gainNode)
      applyOverdriveAmount(overdriveAmount)

      convolverNode = context.createConvolver()
      convolverNode.buffer = makeImpulseResponse(context)
      reverbWetGain = context.createGain()
      reverbWetGain.gain.value = reverbAmount
      compressionBus.connect(convolverNode)
      convolverNode.connect(reverbWetGain)
      reverbWetGain.connect(gainNode)
    }
    return context
  }

  function connectSourceToEffects(node: AudioBufferSourceNode) {
    if (!compressionDryGain || !compressorNode) return
    node.connect(compressionDryGain)
    node.connect(compressorNode)
  }

  function setVolume(value: number) {
    volume = Math.min(1, Math.max(0, value))
    if (gainNode) gainNode.gain.value = volume
  }

  function setPitch(semitones: number) {
    pitchSemitones = Math.min(5, Math.max(-5, semitones))
    if (source) source.detune.value = pitchSemitones * 100
  }

  function setReverb(value: number) {
    reverbAmount = Math.min(1, Math.max(0, value))
    if (reverbWetGain) reverbWetGain.gain.value = reverbAmount
  }

  // Ramps threshold down and ratio/makeup up together as the knob rises, so
  // higher settings aren't just "more of the same compression" mixed in -
  // the compression itself gets deeper the further the knob is pushed.
  function applyCompressionAmount(value: number) {
    compressionAmount = value
    const threshold = -10 - 22 * value // -10dB barely-there up to -32dB heavily squashed
    const ratio = 3 + 12 * value // 3:1 gentle up to 15:1 near-limiting
    const release = 0.22 - 0.09 * value // pumps back up faster at higher settings
    const makeup = 1.2 + 2.6 * value // more boost needed as gain reduction deepens
    if (compressorNode) {
      compressorNode.threshold.value = threshold
      compressorNode.ratio.value = ratio
      compressorNode.release.value = release
    }
    if (compressorMakeupGain) compressorMakeupGain.gain.value = makeup
    if (compressionWetGain) compressionWetGain.gain.value = value
    if (compressionDryGain) compressionDryGain.gain.value = 1 - value
  }

  function setCompression(value: number) {
    applyCompressionAmount(Math.min(1, Math.max(0, value)))
  }

  // Recomputes the saturation curve so the knob controls drive into the
  // tape-style tanh curve, not just how much of one fixed curve is blended.
  function applyOverdriveAmount(value: number) {
    overdriveAmount = value
    const drive = 1 + value * 7 // 1 = barely-there warmth, 8 = thick saturation
    if (distortionNode) distortionNode.curve = makeSaturationCurve(drive)
    if (distortionWetGain) distortionWetGain.gain.value = value
  }

  function setOverdrive(value: number) {
    applyOverdriveAmount(Math.min(1, Math.max(0, value)))
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
    connectSourceToEffects(source)
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
    connectSourceToEffects(source)
    source.start(0, offset)
  }

  function endScratch() {
    if (scratchPlayhead === null) return
    startLoopSource(scratchPlayhead)
    scratchPlayhead = null
  }

  return { play, stop, setVolume, setPitch, setReverb, setCompression, setOverdrive, beginScratch, scratchBy, endScratch }
}
