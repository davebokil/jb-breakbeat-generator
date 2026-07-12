<script setup lang="ts">
const props = defineProps<{
  playing: boolean
  labelColor: string
  height?: number | null
}>()

const emit = defineEmits<{
  (e: 'hit-me'): void
  (e: 'scratch-start'): void
  (e: 'scratch-move', payload: { deltaSeconds: number, speed: number }): void
  (e: 'scratch-end'): void
}>()

// A full 360deg turn of the CSS spin animation takes 1.8s at normal
// (forward, playbackRate 1) speed - used to convert drag angle/speed into
// seconds of audio and a relative scratch speed.
const SECONDS_PER_REVOLUTION = 1.8
const DEGREES_PER_SECOND_AT_NORMAL_SPEED = 360 / SECONDS_PER_REVOLUTION

const platter = ref<HTMLElement | null>(null)
const dragging = ref(false)
const manualRotation = ref(0)
let lastAngle = 0
let lastTime = 0
let hasDragged = false

function angleFromEvent(event: PointerEvent) {
  const el = platter.value
  if (!el) return 0
  const rect = el.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  return Math.atan2(event.clientY - cy, event.clientX - cx) * (180 / Math.PI)
}

function onPointerDown(event: PointerEvent) {
  if (!props.playing) return
  dragging.value = true
  hasDragged = false
  lastAngle = angleFromEvent(event)
  lastTime = performance.now()
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  emit('scratch-start')
}

function onPointerMove(event: PointerEvent) {
  if (!dragging.value) return
  hasDragged = true

  const angle = angleFromEvent(event)
  const now = performance.now()
  let delta = angle - lastAngle
  if (delta > 180) delta -= 360
  if (delta < -180) delta += 360

  const dt = Math.max(now - lastTime, 1) / 1000
  manualRotation.value += delta

  const deltaSeconds = (delta / 360) * SECONDS_PER_REVOLUTION
  const speed = Math.abs(delta / dt) / DEGREES_PER_SECOND_AT_NORMAL_SPEED
  emit('scratch-move', { deltaSeconds, speed })

  lastAngle = angle
  lastTime = now
}

function endDrag() {
  if (!dragging.value) return
  dragging.value = false
  emit('scratch-end')
}

function onClick() {
  if (hasDragged) {
    hasDragged = false
    return
  }
  emit('hit-me')
}
</script>

<template>
  <div class="turntable">
    <div class="plinth" :style="height ? { width: `${height}px`, height: `${height}px` } : undefined">
      <button
        ref="platter"
        class="platter"
        :class="{ spinning: playing && !dragging }"
        type="button"
        :style="dragging ? { transform: `rotate(${manualRotation}deg)` } : undefined"
        :aria-label="playing ? 'Drag to scratch, click to hit me for another break' : 'Not playing yet'"
        :disabled="!playing"
        @click="onClick"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="endDrag"
        @pointercancel="endDrag"
      >
        <div class="grooves" />
        <div class="label" :style="{ backgroundColor: labelColor }">
          <span>HIT<br>MEH!</span>
        </div>
        <div class="spindle" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.turntable {
  display: flex;
  justify-content: center;
}

.plinth {
  position: relative;
  width: min(70vw, 340px);
  aspect-ratio: 1;
  background: linear-gradient(160deg, #5a3a24, #3b2415);
  border-radius: 18px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.6), inset 0 0 0 4px rgba(0, 0, 0, 0.3);
  padding: 8%;
}

.platter {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: none;
  padding: 0;
  background: radial-gradient(circle, #222 0%, #0b0b0b 70%, #000 100%);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.5);
  cursor: not-allowed;
  touch-action: none;
  transition: filter 0.2s;
}

.platter:not(:disabled) {
  cursor: grab;
}

.platter:not(:disabled):active {
  cursor: grabbing;
}

.platter:not(:disabled):hover {
  filter: brightness(1.15);
}

.platter:not(:disabled):focus-visible {
  outline: 3px solid #fff;
  outline-offset: 4px;
}

.grooves {
  position: absolute;
  inset: 6%;
  border-radius: 50%;
  background: repeating-radial-gradient(
    circle,
    #1c1c1c 0px,
    #1c1c1c 2px,
    #101010 3px,
    #101010 5px
  );
}

.label {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 40%;
  height: 40%;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.4), 0 2px 6px rgba(0, 0, 0, 0.5);
}

.label span {
  color: #fff;
  font-weight: 900;
  font-size: clamp(0.7rem, 2.2vw, 1.1rem);
  text-align: center;
  line-height: 1.1;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.6);
  letter-spacing: 0.03em;
}

.spindle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 4%;
  height: 4%;
  transform: translate(-50%, -50%);
  background: #ddd;
  border-radius: 50%;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}

.platter.spinning {
  animation: spin 1.8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .platter.spinning {
    animation: none;
  }
}
</style>
