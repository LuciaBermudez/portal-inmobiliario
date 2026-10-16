import { defineStore } from 'pinia';
import { ref } from 'vue';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}

export const useToastStore = defineStore('toasts', () => {
  const toasts = ref<Toast[]>([]);
  let nextId = 1;

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  function push(kind: ToastKind, text: string, timeoutMs = 5000) {
    const id = nextId++;
    toasts.value = [...toasts.value.slice(-4), { id, kind, text }];
    setTimeout(() => dismiss(id), timeoutMs);
  }

  return { toasts, push, dismiss };
});
