import type {
  AsyncStatus,
  GeoJsonPolygon,
  Listing,
  Operation,
  PropertyType,
  SearchListingsQueryInput,
  UpdateListingRequest,
} from '@portal/shared';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { messageOf } from '@/api/http';
import { listingsApi } from '@/api/listings';
import { readJson, writeJson } from '@/utils/storage';

export interface ListingFilters {
  operation?: Operation;
  propertyType?: PropertyType;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
}

interface SearchSnapshot {
  items: Listing[];
  savedAt: string;
}

const PAGE_SIZE = 30;
const SNAPSHOT_KEY = 'portal:last-search';
const FAVORITES_KEY = 'portal:favorites';


export const useListingsStore = defineStore('listings', () => {
  const byId = ref<Record<string, Listing>>({});
  const resultIds = ref<string[]>([]);
  const nextCursor = ref<string | null>(null);
  const status = ref<AsyncStatus>('idle');
  const loadingMore = ref(false);
  const error = ref<string | null>(null);
  const fromCache = ref<string | null>(null);
  const filters = ref<ListingFilters>({});
  const polygon = ref<GeoJsonPolygon | null>(null);
  const favoriteIds = ref<string[]>(readJson<string[]>(FAVORITES_KEY, []));
  /** Descarta respuestas obsoletas si el usuario cambia filtros mientras una búsqueda está en vuelo. */
  let requestSeq = 0;

  const results = computed(() =>
    resultIds.value.map((id) => byId.value[id]).filter((l): l is Listing => l !== undefined),
  );
  const hasMore = computed(() => nextCursor.value !== null);
  const favorites = computed(() =>
    favoriteIds.value.map((id) => byId.value[id]).filter((l): l is Listing => l !== undefined),
  );

  function upsert(items: Listing[]) {
    for (const item of items) byId.value[item.id] = item;
  }

  function buildQuery(cursor?: string): SearchListingsQueryInput {
    return { ...filters.value, polygon: polygon.value ?? undefined, cursor, limit: PAGE_SIZE };
  }

  async function search(): Promise<void> {
    const seq = ++requestSeq;
    status.value = 'loading';
    error.value = null;
    try {
      const page = await listingsApi.search(buildQuery());
      if (seq !== requestSeq) return;
      upsert(page.items);
      resultIds.value = page.items.map((l) => l.id);
      nextCursor.value = page.nextCursor;
      fromCache.value = null;
      status.value = 'success';
      writeJson(SNAPSHOT_KEY, { items: page.items, savedAt: new Date().toISOString() } satisfies SearchSnapshot);
    } catch (e) {
      if (seq !== requestSeq) return;
      
      const snapshot = readJson<SearchSnapshot | null>(SNAPSHOT_KEY, null);
      if (!navigator.onLine && snapshot) {
        upsert(snapshot.items);
        resultIds.value = snapshot.items.map((l) => l.id);
        nextCursor.value = null;
        fromCache.value = snapshot.savedAt;
        status.value = 'success';
        return;
      }
      status.value = 'error';
      error.value = messageOf(e);
    }
  }

  async function loadMore(): Promise<void> {
    if (!nextCursor.value || loadingMore.value || status.value === 'loading') return;
    const seq = requestSeq;
    loadingMore.value = true;
    try {
      const page = await listingsApi.search(buildQuery(nextCursor.value));
      if (seq !== requestSeq) return;
      upsert(page.items);
      const known = new Set(resultIds.value);
      resultIds.value.push(...page.items.map((l) => l.id).filter((id) => !known.has(id)));
      nextCursor.value = page.nextCursor;
    } catch (e) {
      error.value = messageOf(e);
    } finally {
      loadingMore.value = false;
    }
  }

  async function fetchOne(id: string): Promise<Listing> {
    const listing = await listingsApi.get(id);
    upsert([listing]);
    return listing;
  }

  /** Lanza ApiError 409 si la versión quedó obsoleta: la vista ofrece recargar. */
  async function update(id: string, body: UpdateListingRequest): Promise<Listing> {
    const listing = await listingsApi.update(id, body);
    upsert([listing]);
    return listing;
  }

  function setFilters(next: ListingFilters) {
    filters.value = { ...next };
    void search();
  }

  function setPolygon(next: GeoJsonPolygon | null) {
    polygon.value = next;
    void search();
  }

  function toggleFavorite(id: string) {
    favoriteIds.value = favoriteIds.value.includes(id)
      ? favoriteIds.value.filter((f) => f !== id)
      : [...favoriteIds.value, id];
    writeJson(FAVORITES_KEY, favoriteIds.value);
  }

  const isFavorite = (id: string) => favoriteIds.value.includes(id);

  return {
    byId,
    resultIds,
    results,
    favorites,
    nextCursor,
    hasMore,
    status,
    loadingMore,
    error,
    fromCache,
    filters,
    polygon,
    search,
    loadMore,
    fetchOne,
    update,
    setFilters,
    setPolygon,
    toggleFavorite,
    isFavorite,
  };
});
