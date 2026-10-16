import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { ValidationError } from '../../src/domain/shared/errors';
import { createPool, type Pool } from '../../src/infrastructure/db/pool';
import { PgNotificationRepository } from '../../src/infrastructure/repositories/pg-notification-repository';
import { PgZoneRepository } from '../../src/infrastructure/repositories/pg-zone-repository';
import { box, createUser, draft, seedListings } from './support/db';

let pool: Pool;
let zones: PgZoneRepository;
let notifications: PgNotificationRepository;

beforeAll(() => {
  pool = createPool(inject('databaseUrl'));
  zones = new PgZoneRepository(pool);
  notifications = new PgNotificationRepository(pool);
});
afterAll(() => pool.end());

describe('alertas por zona', () => {
  it('cruza avisos nuevos con zonas respetando polígono y filtros', async () => {
    const userId = await createUser(pool, 'client', null);
    const zone = await zones.create({
      userId,
      name: 'Zona 30',
      polygon: box(29.9, 29.9, 30.1, 30.1),
      filters: { operation: 'rent', maxPrice: 3_000_000 },
      frequency: 'instant',
    });
    const { ids } = await seedListings(pool, [
      draft('Z-ok', 30, 30), // dentro, cumple filtros (2.500.000 COP)
      draft('Z-caro', 30.01, 30, { price: 9_000_000 }), // dentro, demasiado caro
      draft('Z-venta', 30.02, 30, { operation: 'sale' }), // dentro, otra operación
      draft('Z-fuera', 31, 31), // fuera del polígono
    ]);

    const matches = await zones.findMatches(ids);

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ zoneId: zone.id, userId, listingId: ids[0] });
  });

  it('nunca notifica dos veces el mismo aviso para la misma zona (reintentos)', async () => {
    const userId = await createUser(pool, 'client', null);
    await zones.create({ userId, name: 'Z', polygon: box(39.9, 39.9, 40.1, 40.1), filters: {}, frequency: 'instant' });
    const { ids } = await seedListings(pool, [draft('N-1', 40, 40)]);
    const matches = await zones.findMatches(ids);

    const first = await notifications.insertMany(matches);
    const retry = await notifications.insertMany(matches);

    expect(first).toHaveLength(1);
    expect(first[0]!.notification.zoneName).toBe('Z');
    expect(retry).toHaveLength(0);
  });

  it('dos ejecuciones concurrentes del resumen diario no reclaman la misma notificación', async () => {
    const userId = await createUser(pool, 'client', null);
    await zones.create({ userId, name: 'Diaria', polygon: box(49.9, 49.9, 50.1, 50.1), filters: {}, frequency: 'daily' });
    const { ids } = await seedListings(pool, [draft('D-1', 50, 50), draft('D-2', 50.01, 50)]);
    await notifications.insertMany(await zones.findMatches(ids));

    const [a, b] = await Promise.all([notifications.claimPendingDigests(), notifications.claimPendingDigests()]);

    const claimed = [...a, ...b].filter((d) => d.userId === userId).flatMap((d) => d.items);
    expect(claimed).toHaveLength(2);
    expect(new Set(claimed.map((n) => n.id)).size).toBe(2);
  });

  it('rechaza polígonos auto-intersectados ("moño")', async () => {
    const userId = await createUser(pool, 'client', null);
    const bowtie = {
      type: 'Polygon' as const,
      coordinates: [
        [
          [0, 0],
          [1, 1],
          [1, 0],
          [0, 1],
          [0, 0],
        ] as [number, number][],
      ],
    };
    await expect(
      zones.create({ userId, name: 'Moño', polygon: bowtie, filters: {}, frequency: 'instant' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
