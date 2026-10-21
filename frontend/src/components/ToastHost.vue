<script setup lang="ts">
import { useToastStore } from '@/stores/toasts';

const toasts = useToastStore();
</script>

<template>
  <div class="toasts" aria-live="polite">
    <TransitionGroup name="toast">
      <div v-for="toast in toasts.toasts" :key="toast.id" class="toast" :class="`toast--${toast.kind}`" role="status">
        <span>{{ toast.text }}</span>
        <button type="button" class="toast__close" aria-label="Cerrar" @click="toasts.dismiss(toast.id)">×</button>
      </div>
    </TransitionGroup>
  </div>
</template>
