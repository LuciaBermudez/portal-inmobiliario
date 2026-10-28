<script setup lang="ts">
import type { GeoJsonPolygon } from '@portal/shared';
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import FilterPanel from '@/components/FilterPanel.vue';
import ListingList from '@/components/ListingList.vue';
import MapView from '@/components/MapView.vue';
import { useZonesStore } from '@/stores/alerts';
import { useAuthStore } from '@/stores/auth';
import { useImportsStore } from '@/stores/imports';
import { useListingsStore } from '@/stores/listings';
import { formatDate } from '@/utils/format';

const listings = useListingsStore();
const imports = useImportsStore();
const zones = useZonesStore();
const auth = useAuthStore();
const router = useRouter();

const countLabel = computed(() => `${listings.results.length}${listings.hasMore ? '+' : ''}`);

onMounted(() => {
  if (listings.status === 'idle') void listings.search();
});

const open = (id: string) => router.push({ name: 'listing', params: { id } });

function onPolygon(polygon: GeoJsonPolygon | null) {
  listings.setPolygon(polygon);
}

function saveAsAlert() {
  zones.draftPolygon = listings.polygon;
  void router.push({ name: 'alerts' });
}
</script>

<template>
  <section>
    <h1 class="h1">
      Inmuebles <span v-if="listings.status === 'success'" class="h1__count">({{ countLabel }})</span>
    </h1>
    <FilterPanel :model-value="listings.filters" @apply="listings.setFilters" />

    <div v-if="listings.polygon" class="banner banner--info">
      Filtrando por la zona dibujada en el mapa.
      <button v-if="auth.isAuthenticated" class="btn btn--small" type="button" @click="saveAsAlert">
        Crear alerta en esta zona
      </button>
    </div>
    <div v-if="listings.fromCache" class="banner banner--warning">
      Mostrando resultados guardados el {{ formatDate(listings.fromCache) }} (sin conexión).
    </div>

    <div class="search-grid">
      <div class="search-grid__list">
        <ListingList
          :items="listings.results"
          :status="listings.status"
          :loading-more="listings.loadingMore"
          :has-more="listings.hasMore"
          :error="listings.error"
          :is-favorite="listings.isFavorite"
          @load-more="listings.loadMore"
          @retry="listings.search"
          @open="open"
          @toggle-favorite="listings.toggleFavorite"
        />
      </div>
      <div class="search-grid__map">
        <MapView
          :polygon="listings.polygon"
          :tiles-version="imports.tilesVersion"
          draw-label="Buscar dibujando una zona"
          @update:polygon="onPolygon"
          @select="open"
        />
      </div>
    </div>
  </section>
</template>
