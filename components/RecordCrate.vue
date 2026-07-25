<script setup lang="ts">
import type { BreakbeatRecord } from '~/composables/useBreakbeats'

defineProps<{
  records: BreakbeatRecord[]
  activeId: string
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
}>()

function onSelect(record: BreakbeatRecord, activeId: string) {
  if (record.id === activeId) return
  emit('select', record.id)
}
</script>

<template>
  <div class="crate">
    <span class="crate-label">CRATE</span>
    <ul class="sleeves">
      <li v-for="record in records" :key="record.id">
        <button
          type="button"
          class="sleeve"
          :class="{ active: record.id === activeId }"
          :aria-pressed="record.id === activeId"
          @click="onSelect(record, activeId)"
        >
          <span class="swatch" :style="{ backgroundColor: record.labelColors[0] }" />
          <span class="name">{{ record.name }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.crate {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 1rem 1.2rem;
  background: linear-gradient(160deg, #5a3a24, #3b2415);
  border-radius: 14px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.6), inset 0 0 0 4px rgba(0, 0, 0, 0.3);
}

.crate-label {
  color: #e8c896;
  font-size: 0.7rem;
  font-weight: bold;
  letter-spacing: 0.15em;
}

.sleeves {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.sleeve {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.5rem 0.8rem;
  border: 2px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  background: #1c1c1c;
  color: #e8e8e8;
  font-size: 0.8rem;
  font-weight: bold;
  text-align: left;
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s, filter 0.15s;
}

.sleeve:hover:not(.active) {
  filter: brightness(1.15);
  transform: translateX(2px);
}

.sleeve:focus-visible {
  outline: 3px solid #fff;
  outline-offset: 2px;
}

.sleeve.active {
  border-color: #fff;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.25);
  cursor: default;
}

.swatch {
  flex: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.4);
}

.name {
  line-height: 1.2;
}
</style>
