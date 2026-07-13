<script setup lang="ts">
const { pickTrack, pickGif, pickLabelColor } = useBreakbeats()
const {
  play,
  stop,
  setVolume,
  setPitch,
  setReverb,
  setCompression,
  setOverdrive,
  beginScratch,
  scratchBy,
  endScratch,
} = useLoopPlayer()

const playing = ref(false)
const currentTrack = ref<string | null>(null)
const currentGif = ref<string | null>(null)
const labelColor = ref(pickLabelColor())
const errorMessage = ref('')
const volume = ref(0.8)
const pitch = ref(0)
const reverb = ref(0)
const compression = ref(0)
const overdrive = ref(0)

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
  // Exclude the last-played track/gif so replaying after a stop
  // doesn't repeat the same combo back to back.
  const track = pickTrack(currentTrack.value ?? undefined)
  const gif = pickGif(currentGif.value ?? undefined)
  labelColor.value = pickLabelColor(labelColor.value)
  startPlaying(track, gif)
}

function onHitMe() {
  if (!playing.value) return
  onPlay()
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
      THE JAMES BROWN BREAKBEAT GENERATOR
    </h1>
    <p class="intro">
      A free browser-based breakbeat sampler: spin a classic James Brown drum break,
      scratch it live on the virtual turntable, and shape it with reverb, glue
      compression, tape saturation, and pitch control.
    </p>

    <div class="stage">
      <TvScreen ref="tvScreen" :gif="currentGif" :playing="playing" />
      <Turntable
        :playing="playing"
        :label-color="labelColor"
        :height="turntableHeight"
        @hit-me="onHitMe"
        @scratch-start="onScratchStart"
        @scratch-move="onScratchMove"
        @scratch-end="onScratchEnd"
      />
    </div>

    <div class="controls">
      <button v-if="!playing" class="play-button" type="button" @click="onPlay">
        ▶ PLAY
      </button>
      <template v-else>
        <p class="hint">
          Click <strong>HIT MEH!</strong> for another break
        </p>
        <button class="stop-button" type="button" @click="onStop">
          ■ STOP
        </button>
      </template>

      <fieldset class="effects">
        <legend>EFFECTS</legend>
        <div class="sliders">
          <div class="volume">
            <label for="volume">🔈</label>
            <input
              id="volume"
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="volume"
              @input="onVolumeInput"
            >
            <span>🔊</span>
          </div>

          <div class="pitch">
            <label for="pitch">PITCH</label>
            <input
              id="pitch"
              type="range"
              min="-5"
              max="5"
              step="0.1"
              :value="pitch"
              @input="onPitchInput"
            >
            <span class="pitch-value">{{ pitch > 0 ? '+' : '' }}{{ pitch.toFixed(1) }}</span>
          </div>

          <div class="reverb">
            <label for="reverb">REVERB</label>
            <input
              id="reverb"
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="reverb"
              @input="onReverbInput"
            >
            <span class="effect-value">{{ Math.round(reverb * 100) }}%</span>
          </div>

          <div class="compression">
            <label for="compression">COMP</label>
            <input
              id="compression"
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="compression"
              @input="onCompressionInput"
            >
            <span class="effect-value">{{ Math.round(compression * 100) }}%</span>
          </div>

          <div class="overdrive">
            <label for="overdrive">DRIVE</label>
            <input
              id="overdrive"
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="overdrive"
              @input="onOverdriveInput"
            >
            <span class="effect-value">{{ Math.round(overdrive * 100) }}%</span>
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
.overdrive {
  display: contents;
}

.volume label,
.pitch label,
.reverb label,
.compression label,
.overdrive label {
  justify-self: end;
  color: #eee;
  font-size: 0.85rem;
  font-weight: bold;
  letter-spacing: 0.05em;
}

.volume label {
  font-size: 1.1rem;
  font-weight: normal;
  letter-spacing: normal;
}

.volume span {
  color: #eee;
  font-size: 1.1rem;
}

.volume input[type='range'],
.pitch input[type='range'],
.reverb input[type='range'],
.compression input[type='range'],
.overdrive input[type='range'] {
  width: 160px;
  accent-color: #e8e8e8;
  cursor: pointer;
}

.pitch-value,
.effect-value {
  font-variant-numeric: tabular-nums;
  color: #eee;
  min-width: 3.2em;
  text-align: left;
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
