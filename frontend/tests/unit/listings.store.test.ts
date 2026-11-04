import type { Listing, ListingPage } from '@portal/shared';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useListingsStore } from '@/stores/listings';

const { listingsApi } = vi.hoisted(() => ({ listingsApi: { search: vi.fn(), get: vi.fn(), update: vi.fn() } }));
vi.mock('@/api/listings', () => ({ listingsApi, listingTilesUrl: () => '' }));

function listing(id: string, title = `Aviso ${id}`): Listing {
  return {
    id,
    agencyId: 'a',
    externalId: id,
    title,
    description: '',
    operation: 'rent',
    propertyType: 'apartment',
    price: 1,
    currency: 'COP',
    bedrooms: null,
    bathrooms: null,
    areaM2: null,
    address: '',
    location: { lng: 0, lat: 0 },
    status: 'active',
    version: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.resetAllMocks();
  localStorage.clear();
});

describe('store de avisos', () => {
  it('ignora respuestas obsoletas cuando el usuario cambia filtros rápido', async () => {
    const slow = deferred<ListingPage>();
    const fast = deferred<ListingPage>();
    listingsApi.search.mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise);
    const store = useListingsStore();

    const first = store.search();
    const second = store.search();
    fast.resolve({ items: [listing('nuevo')], nextCursor: null });
    await second;
    slow.resolve({ items: [listing('viejo')], nextCursor: null });
    await first;

    expect(store.results.map((l) => l.id)).toEqual(['nuevo']);
  });

  it('normaliza: actualizar un aviso se refleja en resultados y favoritos', async () => {
    listingsApi.search.mockResolvedValue({ items: [listing('1')], nextCursor: null });
    listingsApi.update.mockResolvedValue({ ...listing('1', 'Título editado'), version: 2 });
    const store = useListingsStore();
    await store.search();
    store.toggleFavorite('1');

    await store.update('1', { version: 1, title: 'Título editado' });

    expect(store.results[0]!.title).toBe('Título editado');
    expect(store.favorites[0]!.title).toBe('Título editado');
  });

  it('pagina por cursor sin duplicar ids', async () => {
    listingsApi.search
      .mockResolvedValueOnce({ items: [listing('1'), listing('2')], nextCursor: 'c1' })
      .mockResolvedValueOnce({ items: [listing('2'), listing('3')], nextCursor: null });
    const store = useListingsStore();

    await store.search();
    await store.loadMore();

    expect(store.resultIds).toEqual(['1', '2', '3']);
    expect(store.hasMore).toBe(false);
    expect(listingsApi.search.mock.calls[1]![0]).toMatchObject({ cursor: 'c1' });
  });

  it('sin conexión muestra la última búsqueda guardada', async () => {
    listingsApi.search.mockResolvedValueOnce({ items: [listing('cache')], nextCursor: null });
    const store = useListingsStore();
    await store.search();

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    listingsApi.search.mockRejectedValueOnce(new Error('offline'));
    await store.search();

    expect(store.status).toBe('success');
    expect(store.fromCache).not.toBeNull();
    expect(store.results.map((l) => l.id)).toEqual(['cache']);
  });
});
