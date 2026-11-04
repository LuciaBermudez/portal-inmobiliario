import { GeoJsonPolygonSchema, ZoneFiltersSchema, type AlertFrequency } from '@portal/shared';
import type { NewZone, Zone, ZoneMatch, ZoneRepository } from '../../domain/alert/zone';
import { ValidationError } from '../../domain/shared/errors';
import { isCheckViolation, isGeometryError, type Pool } from '../db/pool';

interface ZoneRow {
  id: string;
  user_id: string;
  name: string;
  polygon: unknown;
  filters: unknown;
  frequency: AlertFrequency;
  created_at: Date;
}

const COLUMNS = 'id, user_id, name, ST_AsGeoJSON(geom)::json AS polygon, filters, frequency, created_at';

const toZone = (r: ZoneRow): Zone => ({
  id: r.id,
  userId: r.user_id,
  name: r.name,
  polygon: GeoJsonPolygonSchema.parse(r.polygon),
  filters: ZoneFiltersSchema.parse(r.filters),
  frequency: r.frequency,
  createdAt: r.created_at,
});

export class PgZoneRepository implements ZoneRepository {
  constructor(private readonly pool: Pool) {}

  async create(zone: NewZone): Promise<Zone> {
    try {
      const { rows } = await this.pool.query<ZoneRow>(
        `INSERT INTO zones (user_id, name, geom, filters, frequency)
         VALUES ($1, $2, ST_SetSRID(ST_GeomFromGeoJSON($3), 4326), $4::jsonb, $5)
         RETURNING ${COLUMNS}`,
        [zone.userId, zone.name, JSON.stringify(zone.polygon), JSON.stringify(zone.filters), zone.frequency],
      );
      return toZone(rows[0]!);
    } catch (error) {
      if (isCheckViolation(error) || isGeometryError(error)) {
        throw new ValidationError('El polígono no es válido (¿sus lados se cruzan?)');
      }
      throw error;
    }
  }

  async findById(id: string): Promise<Zone | null> {
    const { rows } = await this.pool.query<ZoneRow>(`SELECT ${COLUMNS} FROM zones WHERE id = $1`, [id]);
    return rows[0] ? toZone(rows[0]) : null;
  }

  async listByUser(userId: string): Promise<Zone[]> {
    const { rows } = await this.pool.query<ZoneRow>(
      `SELECT ${COLUMNS} FROM zones WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );
    return rows.map(toZone);
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM zones WHERE id = $1', [id]);
  }

  async findMatches(listingIds: string[]): Promise<ZoneMatch[]> {
    const { rows } = await this.pool.query<{ zone_id: string; user_id: string; listing_id: string }>(
      `SELECT z.id AS zone_id, z.user_id, l.id AS listing_id
       FROM listings l
       JOIN zones z ON ST_Intersects(z.geom, l.geom)
       WHERE l.id = ANY($1::uuid[])
         AND l.status = 'active'
         AND (z.filters->>'operation' IS NULL OR z.filters->>'operation' = l.operation)
         AND (z.filters->>'propertyType' IS NULL OR z.filters->>'propertyType' = l.property_type)
         AND (z.filters->>'maxPrice' IS NULL OR l.price <= (z.filters->>'maxPrice')::numeric)
         AND (z.filters->>'minBedrooms' IS NULL OR l.bedrooms >= (z.filters->>'minBedrooms')::int)`,
      [listingIds],
    );
    return rows.map((r) => ({ zoneId: r.zone_id, userId: r.user_id, listingId: r.listing_id }));
  }
}
