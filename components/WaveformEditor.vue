<script setup lang="ts">
const props = defineProps<{
  peaks: Float32Array | null
  duration: number
  candidateOnsets: number[]
  boundaries: number[]
  analyzing: boolean
}>()

const emit = defineEmits<{
  (e: 'set-boundaries', times: number[]): void
}>()

const containerEl = ref<HTMLElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
let resizeObserver: ResizeObserver | null = null

// Numbered chronologically to match the pad grid's own numbering.
const sortedBoundaries = computed(() => [...props.boundaries].sort((a, b) => a - b))
// Candidates already promoted to a boundary aren't shown again as a tick.
const unusedCandidates = computed(() => props.candidateOnsets.filter(time => !props.boundaries.includes(time)))

function pct(time: number) {
  if (!props.duration) return 0
  return (time / props.duration) * 100
}

function draw() {
  const canvas = canvasEl.value
  const container = containerEl.value
  const peaks = props.peaks
  if (!canvas || !container) return

  const width = container.clientWidth
  const height = container.clientHeight
  const dpr = window.devicePixelRatio || 1
  canvas.width = width * dpr
  canvas.height = height * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  if (!peaks) return

  const points = peaks.length / 2
  const midY = height / 2
  ctx.strokeStyle = '#e8e8e8'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let p = 0; p < points; p++) {
    const x = (p / Math.max(1, points - 1)) * width
    const min = peaks[p * 2]
    const max = peaks[p * 2 + 1]
    ctx.moveTo(x, midY - max * midY)
    ctx.lineTo(x, midY - min * midY)
  }
  ctx.stroke()
}

watch(() => props.peaks, () => draw())

function addBoundary(time: number) {
  if (props.boundaries.length >= 8) return // ignore at capacity - remove one first
  emit('set-boundaries', [...props.boundaries, time])
}

function removeBoundary(time: number) {
  emit('set-boundaries', props.boundaries.filter(t => t !== time))
}

// Only reachable when a click doesn't land on a tick/boundary button, since
// those stop propagation - so this is always "add a custom split point here".
function onContainerClick(event: MouseEvent) {
  if (props.analyzing || !props.duration) return
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const time = ((event.clientX - rect.left) / rect.width) * props.duration
  addBoundary(time)
}

onMounted(() => {
  draw()
  if (containerEl.value) {
    resizeObserver = new ResizeObserver(() => draw())
    resizeObserver.observe(containerEl.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})
</script>

<template>
  <div class="waveform-editor">
    <div
      ref="containerEl"
      class="waveform"
      :class="{ disabled: analyzing }"
      @click="onContainerClick"
    >
      <canvas ref="canvasEl" class="waveform-canvas" />
      <button
        v-for="time in unusedCandidates"
        :key="`c-${time}`"
        type="button"
        class="tick"
        :style="{ left: pct(time) + '%' }"
        :aria-label="`Use the transient at ${time.toFixed(2)}s as a pad boundary`"
        @click.stop="addBoundary(time)"
      />
      <button
        v-for="(time, i) in sortedBoundaries"
        :key="`b-${time}`"
        type="button"
        class="boundary"
        :style="{ left: pct(time) + '%' }"
        :aria-label="`Remove pad ${i + 1}'s boundary`"
        @click.stop="removeBoundary(time)"
      >
        {{ i + 1 }}
      </button>
      <div v-if="analyzing" class="analyzing-overlay">ANALYZING…</div>
    </div>
    <p class="hint">
      Click a tick to use that hit as a pad boundary. Click a numbered marker to remove it. Click empty space for a custom split point.
    </p>
  </div>
</template>

<style scoped>
.waveform-editor {
  width: min(100%, 820px);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.waveform {
  position: relative;
  height: 140px;
  border-radius: 10px;
  background: #141414;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
  cursor: pointer;
  touch-action: none;
  overflow: hidden;
}

.waveform.disabled {
  cursor: wait;
  pointer-events: none;
}

.waveform-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.tick {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 14px;
  margin-left: -7px;
  border: none;
  padding: 0;
  background: transparent;
  cursor: pointer;
}

.tick::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 2px;
  transform: translateX(-50%);
  background: rgba(232, 232, 232, 0.35);
}

.tick:hover::before,
.tick:focus-visible::before {
  background: rgba(232, 232, 232, 0.7);
}

.boundary {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 20px;
  margin-left: -10px;
  display: flex;
  justify-content: center;
  padding: 3px 0 0;
  border: none;
  background: transparent;
  color: #ff8a4c;
  font-size: 0.7rem;
  font-weight: 900;
  line-height: 1;
  cursor: pointer;
}

.boundary::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 2px;
  transform: translateX(-50%);
  background: #ff8a4c;
}

.boundary:hover,
.boundary:focus-visible {
  color: #ffb385;
}

.boundary:hover::before,
.boundary:focus-visible::before {
  background: #ffb385;
}

.analyzing-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  color: #e8e8e8;
  font-weight: bold;
  letter-spacing: 0.1em;
  font-size: 0.9rem;
}

.hint {
  margin: 0;
  color: #999;
  font-size: 0.8rem;
  text-align: center;
}
</style>
