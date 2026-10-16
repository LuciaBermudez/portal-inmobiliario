import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { ConflictError } from '../../src/domain/shared/errors';
import { createPool, type Pool } from '../../src/infrastructure/db/pool';
import { PgListingRepository, PgListingTileSource } from '../../src/infrastructure/repositories/pg-listing-repository';
import { box, draft, seedListings } from './support/db';

let pool: Pool;
let listings: PgListingRepository;

beforeAll(() => {
  pool = createPool(inject('databaseUrl'));
  listings = new PgListingRepository(pool);
});
afterAll(() => pool.end());

describe('búsqueda espacial', () => {
  it('filtra por polígono y pagina por cursor sin duplicados', async () => {
    // Zona aislada para no chocar con otros tests: alrededor de (10, 10).
    const inside = Array.from({ length: 5 }, (_, i) => draft(`IN-${i}`, 10 + i * 0.001, 10));
    const outside = [draft('OUT-1', 11, 11)];
    await seedListings(pool, [...inside, ...outside]);
    const polygon = box(9.9, 9.9, 10.1, 10.1);

    const page1 = await listings.search({ polygon, limit: 3 });
    const page2 = await listings.search({ polygon, limit: 3, cursor: page1.next ?? undefined });

    expect(page1.items).toHaveLength(3);
    expect(page1.next).not.toBeNull();
    expect(page2.items).toHaveLength(2);
    expect(page2.next).toBeNull();
    const ids = [...page1.items, ...page2.items].map((l) => l.externalId).sort();
    expect(ids).toEqual(['IN-0', 'IN-1', 'IN-2', 'IN-3', 'IN-4']);
  });

  it('genera teselas vectoriales MVT no vacías donde hay avisos', async () => {
    await seedListings(pool, [draft('T-1', 20, 20)]);
    // Tesela z=4 que contiene lng 20 / lat 20.
    const tile = await new PgListingTileSource(pool).getTile(4, 8, 7);
    expect(tile.length).toBeGreaterThan(0);
  });
});

describe('concurrencia: bloqueo optimista', () => {
  it('de dos ediciones simultáneas con la misma versión, exactamente una gana', async () => {
    const { ids } = await seedListings(pool, [draft('C-1', -76.53, 3.45)]);
    const id = ids[0]!;

    const results = await Promise.allSettled([
      listings.update(id, { price: 111 }, 1),
      listings.update(id, { price: 222 }, 1),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);
    expect((await listings.findById(id))!.version).toBe(2);
  });
});
