<script setup lang="ts">
import type { GeoJsonPolygon, Position } from '@portal/shared';
import type { Feature, FeatureCollection } from 'geojson';
import {
  Map as MapLibreMap,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
  type MapMouseEvent,
  type VectorTileSource,
} from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { listingTilesUrl } from '@/api/listings';

// MapLibre 6 resuelve su Web Worker con una URL dinámica que Vite no detecta: lo registramos explícitamente
// para que funcione tanto en desarrollo (deps pre-empaquetadas) como en el build de producción.
setWorkerUrl(workerUrl);

const props = withDefaults(
  defineProps<{
    polygon?: GeoJsonPolygon | null;
    overlays?: GeoJsonPolygon[];
    showListings?: boolean;
    tilesVersion?: number;
    drawLabel?: string;
  }>(),
  { polygon: null, overlays: () => [], showListings: true, tilesVersion: 0, drawLabel: 'Dibujar zona' },
);

const emit = defineEmits<{
  'update:polygon': [polygon: GeoJsonPolygon | null];
  select: [id: string];
}>();

/** Mapa base vectorial libre (sin API key). */
const BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

const container = ref<HTMLDivElement | null>(null);
// shallowRef: la instancia de MapLibre NO debe envolverse en un Proxy reactivo (rendimiento y bugs sutiles).
const map = shallowRef<MapLibreMap | null>(null);
const loaded = ref(false);
const drawing = ref(false);
const vertices = ref<Position[]>([]);
const canFinish = computed(() => vertices.value.length >= 3);

const round = (n: number) => Math.round(n * 1e6) / 1e6;
const featureCollection = (features: Feature[]): FeatureCollection => ({ type: 'FeatureCollection', features });

function render() {
  const m = map.value;
  if (!m || !loaded.value) return;
  const selection: Feature[] = [];
  if (drawing.value) {
    if (vertices.value.length >= 2) {
      selection.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: vertices.value } });
    }
    for (const v of vertices.value) {
      selection.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: v } });
    }
  } else if (props.polygon) {
    selection.push({ type: 'Feature', properties: {}, geometry: props.polygon });
  }
  m.getSource<GeoJSONSource>('selection')?.setData(featureCollection(selection));
  m.getSource<GeoJSONSource>('overlays')?.setData(
    featureCollection(props.overlays.map((p) => ({ type: 'Feature', properties: {}, geometry: p }))),
  );
}

function onMapClick(event: MapMouseEvent) {
  if (!drawing.value) return;
  vertices.value = [...vertices.value, [round(event.lngLat.lng), round(event.lngLat.lat)]];
  render();
}

function setDrawingMode(active: boolean) {
  drawing.value = active;
  const m = map.value;
  if (!m) return;
  if (active) m.doubleClickZoom.disable();
  else m.doubleClickZoom.enable();
  m.getCanvas().style.cursor = active ? 'crosshair' : '';
}

function startDrawing() {
  vertices.value = [];
  setDrawingMode(true);
  render();
}

function finishDrawing() {
  const first = vertices.value[0];
  if (!canFinish.value || !first) return;
  const ring: Position[] = [...vertices.value, first];
  setDrawingMode(false);
  vertices.value = [];
  emit('update:polygon', { type: 'Polygon', coordinates: [ring] });
}

function cancelDrawing() {
  setDrawingMode(false);
  vertices.value = [];
  render();
}

function onKey(event: KeyboardEvent) {
  if (!drawing.value) return;
  if (event.key === 'Enter') finishDrawing();
  if (event.key === 'Escape') cancelDrawing();
}

onMounted(() => {
  if (!container.value) return;
  const m = new MapLibreMap({
    container: container.value,
    style: BASEMAP_STYLE,
    center: [-76.532, 3.42], // Cali, Colombia
    zoom: 11.5,
  });
  m.addControl(new NavigationControl(), 'top-right');

  m.on('load', () => {
    m.addSource('overlays', { type: 'geojson', data: featureCollection([]) });
    m.addLayer({ id: 'overlays-fill', type: 'fill', source: 'overlays', paint: { 'fill-color': '#f59e0b', 'fill-opacity': 0.12 } });
    m.addLayer({ id: 'overlays-line', type: 'line', source: 'overlays', paint: { 'line-color': '#d97706', 'line-width': 2 } });

    if (props.showListings) {
      m.addSource('listings', { type: 'vector', tiles: [listingTilesUrl(props.tilesVersion)], minzoom: 0, maxzoom: 16 });
      m.addLayer({
        id: 'listings',
        type: 'circle',
        source: 'listings',
        'source-layer': 'listings',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 2, 13, 5, 16, 8],
          'circle-color': ['match', ['get', 'operation'], 'rent', '#16a34a', '#dc2626'],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff',
        },
      });
      m.on('click', 'listings', (event) => {
        const id = event.features?.[0]?.properties?.['id'];
        if (!drawing.value && typeof id === 'string') emit('select', id);
      });
      m.on('mouseenter', 'listings', () => {
        if (!drawing.value) m.getCanvas().style.cursor = 'pointer';
      });
      m.on('mouseleave', 'listings', () => {
        if (!drawing.value) m.getCanvas().style.cursor = '';
      });
    }

    m.addSource('selection', { type: 'geojson', data: featureCollection([]) });
    m.addLayer({
      id: 'selection-fill',
      type: 'fill',
      source: 'selection',
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.1 },
    });
    m.addLayer({ id: 'selection-line', type: 'line', source: 'selection', paint: { 'line-color': '#2563eb', 'line-width': 2 } });
    m.addLayer({
      id: 'selection-vertices',
      type: 'circle',
      source: 'selection',
      filter: ['==', ['geometry-type'], 'Point'],
      paint: { 'circle-radius': 5, 'circle-color': '#ffffff', 'circle-stroke-color': '#2563eb', 'circle-stroke-width': 2 },
    });

    loaded.value = true;
    render();
  });
  m.on('click', onMapClick);
  map.value = m;
  window.addEventListener('keydown', onKey);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  map.value?.remove();
  map.value = null;
});

watch(() => [props.polygon, props.overlays], render, { deep: true });
watch(
  () => props.tilesVersion,
  (version) => map.value?.getSource<VectorTileSource>('listings')?.setTiles([listingTilesUrl(version)]),
);
</script>

<template>
  <div class="map">
    <div ref="container" class="map__canvas" role="region" aria-label="Mapa de propiedades" />
    <div class="map__toolbar">
      <template v-if="drawing">
        <span class="map__hint" title="Haz clic en el mapa para agregar vértices">Vértices: {{ vertices.length }}</span>
        <button class="btn btn--primary btn--small" type="button" :disabled="!canFinish" title="Enter" @click="finishDrawing">Terminar</button>
        <button class="btn btn--small" type="button" title="Esc" @click="cancelDrawing">Cancelar</button>
      </template>
      <template v-else>
        <button class="btn btn--primary btn--small" type="button" @click="startDrawing">{{ drawLabel }}</button>
        <button v-if="polygon" class="btn btn--small" type="button" @click="emit('update:polygon', null)">Quitar polígono</button>
      </template>
    </div>
  </div>
</template>
