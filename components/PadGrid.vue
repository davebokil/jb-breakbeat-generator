<script setup lang="ts">
import type { Slice } from '~/utils/transientDetection'

const props = defineProps<{
  slices: Slice[]
  analyzing: boolean
  height?: number | null
}>()

const emit = defineEmits<{
  (e: 'pad-down', padIndex: number): void
}>()

// Physical key position (not printed character) so the 2x4 block stays in
// the same place on non-QWERTY layouts.
const PAD_KEY_CODES = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'KeyQ', 'KeyW', 'KeyE', 'KeyR']
const PAD_KEY_LABELS = ['1', '2', '3', '4', 'Q', 'W', 'E', 'R']
const KEY_CODE_TO_PAD = Object.fromEntries(PAD_KEY_CODES.map((code, i) => [code, i]))

const flashing = reactive(new Set<number>())

function triggerPad(padIndex: number) {
  if (props.analyzing || !props.slices[padIndex]) return
  flashing.add(padIndex)
  setTimeout(() => flashing.delete(padIndex), 120)
  emit('pad-down', padIndex)
}

function onKeydown(event: KeyboardEvent) {
  // OS key-repeat would otherwise re-trigger dozens of times while a key is
  // held - a fresh tap of the same key should still retrigger normally.
  if (event.repeat) return
  if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return
  const padIndex = KEY_CODE_TO_PAD[event.code]
  if (padIndex === undefined) return
  event.preventDefault()
  triggerPad(padIndex)
}

// Attached to window (not this component's root) so pad hits fire regardless
// of current DOM focus, like an instrument shortcut. Only mounted while chop
// mode is active (this component is swapped out via v-if in app.vue), so no
// mode guard is needed here.
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="pad-grid">
    <div class="pads" :style="height ? { width: `${height}px`, height: `${height}px` } : undefined">
      <button
        v-for="(label, i) in PAD_KEY_LABELS"
        :key="i"
        type="button"
        class="pad"
        :class="{ lit: flashing.has(i) }"
        :disabled="analyzing || !slices[i]"
        :aria-label="slices[i] ? `Pad ${i + 1}, key ${label}` : `Pad ${i + 1} (no slice detected)`"
        @pointerdown="triggerPad(i)"
      >
        <span class="pad-number">{{ i + 1 }}</span>
        <span class="pad-key">{{ label }}</span>
      </button>
      <div v-if="analyzing" class="analyzing-overlay">ANALYZING…</div>
    </div>
  </div>
</template>

<style scoped>
.pad-grid {
  display: flex;
  justify-content: center;
}

.pads {
  position: relative;
  width: min(70vw, 340px);
  aspect-ratio: 1;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 0.4rem;
  padding: 8%;
  background: linear-gradient(160deg, #3a3a3a, #1c1c1c);
  border-radius: 14px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.6), inset 0 0 0 4px rgba(0, 0, 0, 0.3);
}

.pad {
  position: relative;
  border: none;
  border-radius: 7px;
  background: linear-gradient(180deg, #eae6da, #c6c2b4);
  color: #2a2822;
  cursor: pointer;
  touch-action: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.7),
    inset 0 -3px 4px rgba(0, 0, 0, 0.15),
    0 2px 4px rgba(0, 0, 0, 0.45),
    0 0 0 1px rgba(0, 0, 0, 0.35);
  transition: filter 0.1s, transform 0.05s, box-shadow 0.1s;
}

.pad:not(:disabled):hover {
  filter: brightness(1.05);
}

.pad:not(:disabled):active,
.pad.lit {
  transform: scale(0.96);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.7),
    inset 0 -3px 4px rgba(0, 0, 0, 0.15),
    0 0 0 3px #ff5a3c,
    0 0 14px 2px rgba(255, 90, 60, 0.75);
}

.pad:not(:disabled):focus-visible {
  outline: 3px solid #fff;
  outline-offset: 2px;
}

.pad:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.pad-number {
  font-size: clamp(0.9rem, 3vw, 1.3rem);
  font-weight: 900;
}

.pad-key {
  font-size: clamp(0.6rem, 2vw, 0.8rem);
  font-weight: bold;
  letter-spacing: 0.05em;
  color: #6b6858;
}

.analyzing-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  background: rgba(0, 0, 0, 0.6);
  color: #e8e8e8;
  font-weight: bold;
  letter-spacing: 0.1em;
  font-size: clamp(0.9rem, 3vw, 1.2rem);
}
</style>
