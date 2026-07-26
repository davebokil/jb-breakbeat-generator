// Downsamples a decoded buffer to (min, max) pairs for waveform rendering -
// drawing every sample would be both wasted work and a solid black smear at
// typical container widths, so canvas waveform views always render peak data
// instead of raw samples.
export function computePeaks(buffer: AudioBuffer, points = 600): Float32Array {
  const channelCount = buffer.numberOfChannels
  const length = buffer.length
  const peaks = new Float32Array(points * 2)
  const samplesPerPoint = Math.max(1, Math.floor(length / points))

  for (let p = 0; p < points; p++) {
    const start = p * samplesPerPoint
    const end = Math.min(length, start + samplesPerPoint)
    let min = 0
    let max = 0
    for (let c = 0; c < channelCount; c++) {
      const data = buffer.getChannelData(c)
      for (let i = start; i < end; i++) {
        const value = data[i]
        if (value < min) min = value
        if (value > max) max = value
      }
    }
    peaks[p * 2] = min
    peaks[p * 2 + 1] = max
  }

  return peaks
}
