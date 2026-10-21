<script setup lang="ts">
import type { AsyncStatus, Listing } from '@portal/shared';
import { useVirtualizer } from '@tanstack/vue-virtual';
import { computed, ref, watch } from 'vue';
import ListingCard from './ListingCard.vue';

const props = defineProps<{
  items: Listing[];
  status: AsyncStatus;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  isFavorite: (id: string) => boolean;
}>();

const emit = defineEmits<{ loadMore: []; retry: []; open: [id: string]; toggleFavorite: [id: string] }>();

const ROW_HEIGHT = 132;
const scroller = ref<HTMLElement | null>(null);

// Virtualización: solo se montan en el DOM las ~10 tarjetas visibles, aunque haya miles cargadas.
const virtualizer = useVirtualizer(
  computed(() => ({
    count: props.items.length,
    getScrollElement: () => scroller.value,
    estimateSize: () => ROW_HEIGHT,
    overscan: 6,
  })),
);
const rows = computed(() => virtualizer.value.getVirtualItems());
const totalSize = computed(() => virtualizer.value.getTotalSize());

// Scroll infinito: al acercarse al final se pide la siguiente página (cursor).
watch(rows, (visible) => {
  const last = visible[visible.length - 1];
  if (last && last.index >= props.items.length - 5 && props.hasMore && !props.loadingMore) emit('loadMore');
});
</script>

<template>
  <div v-if="status === 'loading' && items.length === 0" class="list-state" aria-busy="true">
    <div v-for="n in 5" :key="n" class="skeleton skeleton--card" />
  </div>

  <div v-else-if="status === 'error'" class="list-state list-state--error" role="alert">
    <p>{{ error }}</p>
    <button class="btn" type="button" @click="emit('retry')">Reintentar</button>
  </div>

  <div v-else-if="status === 'success' && items.length === 0" class="list-state">
    <p>No hay propiedades con estos filtros.</p>
    <p class="muted">Prueba a ampliar el polígono o quitar filtros.</p>
  </div>

  <div v-else ref="scroller" class="virtual-list" :aria-busy="status === 'loading'">
    <div class="virtual-list__inner" :style="{ height: `${totalSize}px` }">
      <div
        v-for="row in rows"
        :key="String(row.key)"
        class="virtual-list__row"
        :style="{ transform: `translateY(${row.start}px)`, height: `${ROW_HEIGHT}px` }"
      >
        <ListingCard
          v-if="items[row.index]"
          :listing="items[row.index]!"
          :favorite="isFavorite(items[row.index]!.id)"
          @open="emit('open', items[row.index]!.id)"
          @toggle-favorite="emit('toggleFavorite', items[row.index]!.id)"
        />
      </div>
    </div>
    <p v-if="loadingMore" class="muted list-footer">Cargando más…</p>
  </div>
</template>
