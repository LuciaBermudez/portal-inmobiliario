import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { Role } from '@portal/shared';
import type { ListingDraft } from '../../../src/domain/listing/listing';
import type { Pool } from '../../../src/infrastructure/db/pool';

export const MIGRATIONS_DIR = fileURLToPath(new URL('../../../migrations', import.meta.url));

export async function createAgency(pool: Pool): Promise<string> {
  const { rows } = await pool.query<{ id: string }>('INSERT INTO agencies (name) VALUES ($1) RETURNING id', [
    `Agencia ${randomUUID()}`,
  ]);
  return rows[0]!.id;
}

export async function createUser(pool: Pool, role: Role, agencyId: string | null): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (email, name, password_hash, role, agency_id) VALUES ($1, 'Test', 'x', $2, $3) RETURNING id`,
    [`${randomUUID()}@test.local`, role, agencyId],
  );
  return rows[0]!.id;
}

export function draft(externalId: string, lng: number, lat: number, overrides: Partial<ListingDraft> = {}): ListingDraft {
  return {
    externalId,
    title: `Aviso ${externalId}`,
    description: '',
    operation: 'rent',
    propertyType: 'apartment',
    price: 2_500_000,
    currency: 'COP',
    bedrooms: 2,
    bathrooms: 1,
    areaM2: 60,
    address: '',
    location: { lng, lat },
    ...overrides,
  };
}

/** Crea una inmobiliaria con un agente e inserta avisos directamente (sin pasar por la ingesta). */
export async function seedListings(pool: Pool, drafts: ListingDraft[]) {
  const agencyId = await createAgency(pool);
  const userId = await createUser(pool, 'agent', agencyId);
  const ids: string[] = [];
  for (const d of drafts) {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO listings (agency_id, external_id, title, description, operation, property_type, price, currency,
                             bedrooms, bathrooms, area_m2, address, geom)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, ST_SetSRID(ST_MakePoint($13, $14), 4326))
       RETURNING id`,
      [
        agencyId,
        d.externalId,
        d.title,
        d.description,
        d.operation,
        d.propertyType,
        d.price,
        d.currency,
        d.bedrooms,
        d.bathrooms,
        d.areaM2,
        d.address,
        d.location.lng,
        d.location.lat,
      ],
    );
    ids.push(rows[0]!.id);
  }
  return { agencyId, userId, ids };
}

/** Cuadrado [lng0,lat0]-[lng1,lat1] como polígono GeoJSON. */
export function box(lng0: number, lat0: number, lng1: number, lat1: number) {
  return {
    type: 'Polygon' as const,
    coordinates: [
      [
        [lng0, lat0],
        [lng1, lat0],
        [lng1, lat1],
        [lng0, lat1],
        [lng0, lat0],
      ] as [number, number][],
    ],
  };
}
