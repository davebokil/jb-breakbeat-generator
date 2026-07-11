<script setup lang="ts">
defineProps<{
  playing: boolean
  labelColor: string
}>()

const emit = defineEmits<{
  (e: 'hit-me'): void
}>()
</script>

<template>
  <div class="turntable">
    <div class="plinth">
      <button
        class="platter"
        :class="{ spinning: playing }"
        type="button"
        :aria-label="playing ? 'Hit me! Play another breakbeat' : 'Not playing yet'"
        :disabled="!playing"
        @click="emit('hit-me')"
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
  transition: filter 0.2s;
}

.platter:not(:disabled) {
  cursor: pointer;
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
