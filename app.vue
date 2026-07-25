<script setup lang="ts">
const { records, pickTrack, pickGif, pickLabelColor } = useBreakbeats()
const {
  play,
  stop,
  setVolume,
  setPitch,
  setReverb,
  setCompression,
  setOverdrive,
  setLowGain,
  setMidGain,
  setHighGain,
  setFilter,
  beginScratch,
  scratchBy,
  endScratch,
  renderMix,
} = useLoopPlayer()

const playing = ref(false)
const activeRecord = ref(records[0])
const currentTrack = ref<string | null>(null)
const currentGif = ref<string | null>(null)
const labelColor = ref(pickLabelColor(activeRecord.value))
const errorMessage = ref('')
const volume = ref(0.8)
const pitch = ref(0)
const reverb = ref(0)
const compression = ref(0)
const overdrive = ref(0)
const low = ref(0)
const mid = ref(0)
const high = ref(0)
const filter = ref(0)
const downloading = ref(false)

const filterLabel = computed(() => {
  if (filter.value === 0) return 'OFF'
  const pct = Math.round(Math.abs(filter.value) * 100)
  return filter.value > 0 ? `HP ${pct}%` : `LP ${pct}%`
})

const tvScreen = ref<InstanceType<typeof TvScreen> | null>(null)
const turntableHeight = ref<number | null>(null)
let tvResizeObserver: ResizeObserver | null = null

function updateTurntableHeight() {
  const tvEl = tvScreen.value?.$el as HTMLElement | undefined
  if (tvEl) {
    turntableHeight.value = tvEl.offsetHeight
  }
}

function onVolumeInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  volume.value = value
  setVolume(value)
}

function onPitchInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  pitch.value = value
  setPitch(value)
}

function onReverbInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  reverb.value = value
  setReverb(value)
}

function onCompressionInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  compression.value = value
  setCompression(value)
}

function onOverdriveInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  overdrive.value = value
  setOverdrive(value)
}

function onLowInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  low.value = value
  setLowGain(value)
}

function onMidInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  mid.value = value
  setMidGain(value)
}

function onHighInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  high.value = value
  setHighGain(value)
}

function onFilterInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  filter.value = value
  setFilter(value)
}

// Double-clicking a slider's knob snaps it back to its default - lets you
// quickly clear one effect without dragging it back by hand.
function onVolumeReset() {
  volume.value = 0.8
  setVolume(0.8)
}

function onPitchReset() {
  pitch.value = 0
  setPitch(0)
}

function onReverbReset() {
  reverb.value = 0
  setReverb(0)
}

function onCompressionReset() {
  compression.value = 0
  setCompression(0)
}

function onOverdriveReset() {
  overdrive.value = 0
  setOverdrive(0)
}

function onLowReset() {
  low.value = 0
  setLowGain(0)
}

function onMidReset() {
  mid.value = 0
  setMidGain(0)
}

function onHighReset() {
  high.value = 0
  setHighGain(0)
}

function onFilterReset() {
  filter.value = 0
  setFilter(0)
}

async function startPlaying(track: string, gif: string) {
  errorMessage.value = ''
  currentTrack.value = track
  currentGif.value = gif
  try {
    await play(track)
    playing.value = true
  } catch (err) {
    playing.value = false
    errorMessage.value = "Couldn't play that breakbeat, try again."
    console.error(err)
  }
}

function onPlay() {
  if (!activeRecord.value.tracks.length || !activeRecord.value.gifs.length) {
    errorMessage.value = `${activeRecord.value.name} doesn't have any breaks loaded yet.`
    return
  }
  // Exclude the last-played track/gif so replaying after a stop
  // doesn't repeat the same combo back to back.
  const track = pickTrack(activeRecord.value, currentTrack.value ?? undefined)
  const gif = pickGif(activeRecord.value, currentGif.value ?? undefined)
  labelColor.value = pickLabelColor(activeRecord.value, labelColor.value)
  startPlaying(track, gif)
}

function onHitMe() {
  if (!playing.value) return
  onPlay()
}

function onSelectRecord(id: string) {
  if (id === activeRecord.value.id) return
  const record = records.find(r => r.id === id)
  if (!record) return

  if (playing.value) onStop()

  activeRecord.value = record
  currentTrack.value = null
  currentGif.value = null
  labelColor.value = pickLabelColor(record)
  errorMessage.value = ''
}

function onScratchStart() {
  beginScratch()
}

function onScratchMove(payload: { deltaSeconds: number, speed: number }) {
  scratchBy(payload.deltaSeconds, payload.speed)
}

function onScratchEnd() {
  endScratch()
}

function onStop() {
  stop()
  playing.value = false
}

async function onDownload() {
  if (!currentTrack.value || downloading.value) return
  downloading.value = true
  errorMessage.value = ''
  try {
    const buffer = await renderMix(currentTrack.value)
    const blob = audioBufferToWav(buffer)
    const trackName = currentTrack.value.split('/').pop()?.replace(/\.\w+$/, '') ?? 'breakbeat'
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${trackName}-breakbeat-mix.wav`
    link.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    errorMessage.value = "Couldn't render that download, try again."
    console.error(err)
  } finally {
    downloading.value = false
  }
}

onMounted(() => {
  updateTurntableHeight()
  tvResizeObserver = new ResizeObserver(updateTurntableHeight)
  if (tvScreen.value?.$el) {
    tvResizeObserver.observe(tvScreen.value.$el as HTMLElement)
  }
})

onBeforeUnmount(() => {
  stop()
  tvResizeObserver?.disconnect()
})
</script>

<template>
  <div class="page">
    <h1 class="title" :style="{ color: labelColor }">
      {{ activeRecord.title }}
    </h1>
    <p class="intro">
A free browser-based breakbeat generator. Instantly generate classic breaks, scratch them on a virtual turntable, and add reverb, tape saturation, compression, and pitch effects that shape both the audio and the video, then export your finished break.    </p>

    <div class="stage">
      <TvScreen ref="tvScreen" :gif="currentGif" :playing="playing" :record-name="activeRecord.name" :pitch="pitch" :reverb="reverb" :overdrive="overdrive" :filter="filter" :low="low" :mid="mid" :high="high" />
      <Turntable
        :playing="playing"
        :label-color="labelColor"
        :height="turntableHeight"
        @hit-me="onHitMe"
        @scratch-start="onScratchStart"
        @scratch-move="onScratchMove"
        @scratch-end="onScratchEnd"
      />
      <RecordCrate :records="records" :active-id="activeRecord.id" @select="onSelectRecord" />
    </div>

    <div class="controls">
      <button v-if="!playing" class="play-button" type="button" @click="onPlay">
        ▶ PLAY
      </button>
      <template v-else>
        <p class="hint">
          Click <strong>HIT MEH!</strong> for another break
        </p>
        <div class="playing-actions">
          <button class="stop-button" type="button" @click="onStop">
            ■ STOP
          </button>
          <button
            class="download-button"
            type="button"
            :disabled="downloading"
            @click="onDownload"
          >
            {{ downloading ? 'RENDERING…' : '⬇ DOWNLOAD' }}
          </button>
        </div>
      </template>

      <fieldset class="effects">
        <legend>EFFECTS</legend>
        <div class="sliders">
          <div class="volume">
            <label for="volume">VOLUME</label>
            <input
              id="volume"
              class="fx-slider"
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="volume"
              title="Double-click to reset"
              @input="onVolumeInput"
              @dblclick="onVolumeReset"
            >
            <span class="effect-value">{{ Math.round(volume * 100) }}%</span>
          </div>

          <div class="pitch">
            <label for="pitch">PITCH</label>
            <input
              id="pitch"
              class="fx-slider"
              type="range"
              min="-5"
              max="5"
              step="0.1"
              :value="pitch"
              title="Double-click to reset"
              @input="onPitchInput"
              @dblclick="onPitchReset"
            >
            <span class="pitch-value">{{ pitch > 0 ? '+' : '' }}{{ pitch.toFixed(1) }}</span>
          </div>

          <div class="reverb">
            <label for="reverb">REVERB</label>
            <input
              id="reverb"
              class="fx-slider"
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="reverb"
              title="Double-click to reset"
              @input="onReverbInput"
              @dblclick="onReverbReset"
            >
            <span class="effect-value">{{ Math.round(reverb * 100) }}%</span>
          </div>

          <div class="compression">
            <label for="compression">COMP</label>
            <input
              id="compression"
              class="fx-slider"
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="compression"
              title="Double-click to reset"
              @input="onCompressionInput"
              @dblclick="onCompressionReset"
            >
            <span class="effect-value">{{ Math.round(compression * 100) }}%</span>
          </div>

          <div class="overdrive">
            <label for="overdrive">DRIVE</label>
            <input
              id="overdrive"
              class="fx-slider"
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="overdrive"
              title="Double-click to reset"
              @input="onOverdriveInput"
              @dblclick="onOverdriveReset"
            >
            <span class="effect-value">{{ Math.round(overdrive * 100) }}%</span>
          </div>

          <div class="low">
            <label for="low">LOW</label>
            <input
              id="low"
              class="fx-slider"
              type="range"
              min="-12"
              max="12"
              step="1"
              :value="low"
              title="Double-click to reset"
              @input="onLowInput"
              @dblclick="onLowReset"
            >
            <span class="effect-value">{{ low > 0 ? '+' : '' }}{{ low }}dB</span>
          </div>

          <div class="mid">
            <label for="mid">MID</label>
            <input
              id="mid"
              class="fx-slider"
              type="range"
              min="-12"
              max="12"
              step="1"
              :value="mid"
              title="Double-click to reset"
              @input="onMidInput"
              @dblclick="onMidReset"
            >
            <span class="effect-value">{{ mid > 0 ? '+' : '' }}{{ mid }}dB</span>
          </div>

          <div class="high">
            <label for="high">HIGH</label>
            <input
              id="high"
              class="fx-slider"
              type="range"
              min="-12"
              max="12"
              step="1"
              :value="high"
              title="Double-click to reset"
              @input="onHighInput"
              @dblclick="onHighReset"
            >
            <span class="effect-value">{{ high > 0 ? '+' : '' }}{{ high }}dB</span>
          </div>

          <div class="filter">
            <label for="filter">FILTER</label>
            <input
              id="filter"
              class="fx-slider"
              type="range"
              min="-1"
              max="1"
              step="0.01"
              :value="filter"
              title="Double-click to reset"
              @input="onFilterInput"
              @dblclick="onFilterReset"
            >
            <span class="filter-value">{{ filterLabel }}</span>
          </div>
        </div>
      </fieldset>
    </div>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

    <p class="credit">
      created with &#x2665; by
      <a href="http://davebokil.com/" target="_blank" rel="noopener">dave bokil</a>
    </p>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2.5rem;
  padding: 3rem 1.5rem 2rem;
  text-align: center;
}

.title {
  font-size: clamp(1.5rem, 5vw, 2.75rem);
  font-weight: 900;
  max-width: 900px;
  margin: 0;
  animation: flash 1.6s infinite;
  transition: color 0.3s;
}

.intro {
  max-width: 560px;
  margin: -1.5rem 0 0;
  color: #aaa;
  font-size: 0.95rem;
  line-height: 1.5;
}

.stage {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 2.5rem;
  width: 100%;
}

.controls {
  min-height: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.play-button {
  font-size: 1.5rem;
  font-weight: bold;
  padding: 1rem 2rem;
  border: none;
  border-radius: 50px;
  background: #e8e8e8;
  color: #111;
  cursor: pointer;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.4);
  transition: transform 0.15s, filter 0.15s;
}

.play-button:hover {
  filter: brightness(1.08);
  transform: translateY(-2px);
}

.play-button:focus-visible {
  outline: 3px solid #fff;
  outline-offset: 3px;
}

.hint {
  color: #eee;
  font-size: 1.1rem;
  margin: 0;
}

.stop-button {
  font-size: 1.1rem;
  font-weight: bold;
  padding: 0.6rem 1.6rem;
  border: none;
  border-radius: 50px;
  background: #c0392b;
  color: #fff;
  cursor: pointer;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.4);
  transition: transform 0.15s, filter 0.15s;
}

.stop-button:hover {
  filter: brightness(1.1);
  transform: translateY(-2px);
}

.stop-button:focus-visible {
  outline: 3px solid #fff;
  outline-offset: 3px;
}

.playing-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  justify-content: center;
}

.download-button {
  font-size: 1.1rem;
  font-weight: bold;
  padding: 0.6rem 1.6rem;
  border: 2px solid #e8e8e8;
  border-radius: 50px;
  background: transparent;
  color: #e8e8e8;
  cursor: pointer;
  transition: transform 0.15s, filter 0.15s;
}

.download-button:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-2px);
}

.download-button:disabled {
  opacity: 0.6;
  cursor: wait;
}

.download-button:focus-visible {
  outline: 3px solid #fff;
  outline-offset: 3px;
}

.effects {
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 12px;
  padding: 1.2rem 1.5rem 0.8rem;
}

.effects legend {
  padding: 0 0.6rem;
  color: #eee;
  font-size: 0.8rem;
  font-weight: bold;
  letter-spacing: 0.1em;
}

.sliders {
  display: grid;
  grid-template-columns: auto auto auto;
  align-items: center;
  justify-content: center;
  row-gap: 0.7rem;
  column-gap: 0.6rem;
}

.volume,
.pitch,
.reverb,
.compression,
.overdrive,
.low,
.mid,
.high,
.filter {
  display: contents;
}

.volume label,
.pitch label,
.reverb label,
.compression label,
.overdrive label,
.low label,
.mid label,
.high label,
.filter label {
  justify-self: end;
  color: #eee;
  font-size: 0.85rem;
  font-weight: bold;
  letter-spacing: 0.05em;
}

.fx-slider {
  width: 160px;
  height: 32px;
  margin: 0;
  background: transparent;
  accent-color: #e8e8e8;
  cursor: pointer;
  touch-action: none;
  -webkit-appearance: none;
  appearance: none;
}

.fx-slider::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 2px;
  background: #555;
}

.fx-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 28px;
  height: 28px;
  margin-top: -12px;
  border: none;
  border-radius: 50%;
  background: #e8e8e8;
}

.fx-slider::-moz-range-track {
  height: 4px;
  border-radius: 2px;
  background: #555;
}

.fx-slider::-moz-range-thumb {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: #e8e8e8;
}

.pitch-value,
.effect-value,
.filter-value {
  font-variant-numeric: tabular-nums;
  color: #eee;
  min-width: 3.2em;
  text-align: left;
}

.filter-value {
  min-width: 4.2em;
}

.error {
  color: #ff6b6b;
  font-weight: bold;
}

.credit {
  color: #aaa;
  font-size: 0.9rem;
  margin-top: auto;
}

.credit a {
  color: #ddd;
}
</style>
