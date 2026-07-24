<script setup lang="ts">
const props = withDefaults(defineProps<{
  gif: string | null
  playing: boolean
  pitch?: number
  reverb?: number
  overdrive?: number
}>(), {
  pitch: 0,
  reverb: 0,
  overdrive: 0,
})

const canvasEl = ref<HTMLCanvasElement | null>(null)
const showScreen = computed(() => props.playing && !!props.gif)

const player = useGifPlayer(() => canvasEl.value)

// Pitch doubles/halves playback speed per +/-2.5 semitones, echoing the
// classic "speeding up tape raises pitch" association rather than a literal
// audio-rate link (pitch only detunes the audio, it doesn't change tempo).
const speed = computed(() => 2 ** (props.pitch / 2.5))

watch(speed, value => player.setSpeed(value), { immediate: true })
watch(() => props.reverb, value => player.setEcho(value), { immediate: true })
watch(() => props.overdrive, value => player.setGrain(value), { immediate: true })

watch(
  [() => props.playing, () => props.gif],
  ([isPlaying, gif]) => {
    if (isPlaying && gif) {
      player.load(gif)
    } else {
      player.stop()
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => player.stop())
</script>

<template>
  <div class="tv">
    <div class="antenna">
      <span class="rod left" />
      <span class="rod right" />
    </div>

    <div class="cabinet">
      <div class="screen">
        <canvas
          v-show="showScreen"
          ref="canvasEl"
          role="img"
          aria-label="Godfather of Soul breakbeat gif"
          class="screen-gif"
        />
        <div v-if="!showScreen" class="static">
          <span class="no-signal">NO SIGNAL</span>
        </div>
        <div class="scanlines" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.tv {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: min(90vw, 480px);
}

.antenna {
  position: relative;
  width: 100%;
  height: 40px;
}

.rod {
  position: absolute;
  bottom: 0;
  width: 3px;
  height: 40px;
  background: #999;
  border-radius: 2px;
}

.rod.left {
  left: 42%;
  transform: rotate(-25deg);
  transform-origin: bottom center;
}

.rod.right {
  right: 42%;
  transform: rotate(25deg);
  transform-origin: bottom center;
}

.cabinet {
  position: relative;
  width: 100%;
  background: linear-gradient(160deg, #6b4423, #432c16);
  border-radius: 24px;
  padding: 4% 4% 6%;
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.6), inset 0 0 0 3px rgba(0, 0, 0, 0.35);
  display: flex;
  gap: 4%;
  align-items: center;
}

.screen {
  position: relative;
  flex: 1;
  aspect-ratio: 4 / 3;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: inset 0 0 12px 4px rgba(0, 0, 0, 0.8);
}

.screen-gif {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.static {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-image: repeating-linear-gradient(
      0deg,
      #222 0px,
      #222 1px,
      #444 2px,
      #111 3px
    ),
    repeating-linear-gradient(90deg, #333 0px, #111 2px);
  background-size: 3px 3px;
  animation: noise 0.2s steps(2) infinite;
}

.no-signal {
  color: #eee;
  font-weight: bold;
  letter-spacing: 0.1em;
  text-shadow: 0 0 6px rgba(0, 0, 0, 0.9);
  background: rgba(0, 0, 0, 0.5);
  padding: 4px 10px;
  border-radius: 4px;
}

.scanlines {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.15) 0px,
    rgba(0, 0, 0, 0.15) 1px,
    transparent 2px,
    transparent 3px
  );
  mix-blend-mode: multiply;
}

@media (prefers-reduced-motion: reduce) {
  .static {
    animation: none;
  }
}
</style>
