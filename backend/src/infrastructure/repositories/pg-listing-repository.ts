import type {
  Listing,
  ListingPatch,
  ListingRepository,
  ListingSearchCriteria,
  ListingSearchResult,
  ListingTileSource,
} from '../../domain/listing/listing';
import { ConflictError, NotFoundError, ValidationError } from '../../domain/shared/errors';
import { isGeometryError, type Pool } from '../db/pool';
import { LISTING_COLUMNS, toListing, type ListingRow } from './listing-row';

/** Campos editables → columna SQL (lista blanca: nunca se interpola input del usuario). */
const PATCH_COLUMNS: Record<keyof ListingPatch, string> = {
  title: 'title',
  description: 'description',
  price: 'price',
  status: 'status',
  bedrooms: 'bedrooms',
  bathrooms: 'bathrooms',
  areaM2: 'area_m2',
};

export class PgListingRepository implements ListingRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<Listing | null> {
    const { rows } = await this.pool.query<ListingRow>(`SELECT ${LISTING_COLUMNS} FROM listings l WHERE l.id = $1`, [
      id,
    ]);
    return rows[0] ? toListing(rows[0]) : null;
  }

  async search(c: ListingSearchCriteria): Promise<ListingSearchResult> {
    const params: unknown[] = [];
    const p = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };
    const where = [`l.status = 'active'`];

    if (c.polygon) {
      // ST_MakeValid tolera polígonos dibujados con auto-intersecciones; el índice GIST se usa igual.
      where.push(`ST_Intersects(l.geom, ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(${p(JSON.stringify(c.polygon))}), 4326)))`);
    }
    if (c.operation) where.push(`l.operation = ${p(c.operation)}`);
    if (c.propertyType) where.push(`l.property_type = ${p(c.propertyType)}`);
    if (c.minPrice !== undefined) where.push(`l.price >= ${p(c.minPrice)}`);
    if (c.maxPrice !== undefined) where.push(`l.price <= ${p(c.maxPrice)}`);
    if (c.minBedrooms !== undefined) where.push(`l.bedrooms >= ${p(c.minBedrooms)}`);
    if (c.cursor) {
      // Paginación keyset: estable aunque entren avisos nuevos, y O(log n) en cualquier página.
      where.push(`(l.created_at, l.id) < (${p(c.cursor.createdAt)}::timestamptz, ${p(c.cursor.id)}::uuid)`);
    }

    const sql = `
      SELECT ${LISTING_COLUMNS}
      FROM listings l
      WHERE ${where.join(' AND ')}
      ORDER BY l.created_at DESC, l.id DESC
      LIMIT ${p(c.limit + 1)}`;

    try {
      const { rows } = await this.pool.query<ListingRow>(sql, params);
      const page = rows.slice(0, c.limit);
      const last = page[page.length - 1];
      return {
        items: page.map(toListing),
        next: rows.length > c.limit && last ? { createdAt: last.cursor_ts, id: last.id } : null,
      };
    } catch (error) {
      if (isGeometryError(error)) throw new ValidationError('El polígono de búsqueda no es válido');
      throw error;
    }
  }

  async update(id: string, patch: ListingPatch, expectedVersion: number): Promise<Listing> {
    const params: unknown[] = [id, expectedVersion];
    const sets: string[] = [];
    for (const [key, column] of Object.entries(PATCH_COLUMNS) as Array<[keyof ListingPatch, string]>) {
      if (patch[key] !== undefined) {
        params.push(patch[key]);
        sets.push(`${column} = $${params.length}`);
      }
    }
    sets.push('version = l.version + 1', 'updated_at = now()');

    // Bloqueo optimista: el WHERE por versión hace que de dos escrituras concurrentes solo una gane.
    const { rows } = await this.pool.query<ListingRow>(
      `UPDATE listings l SET ${sets.join(', ')}
       WHERE l.id = $1 AND l.version = $2
       RETURNING ${LISTING_COLUMNS}`,
      params,
    );
    if (rows[0]) return toListing(rows[0]);

    const current = await this.findById(id);
    if (!current) throw new NotFoundError('Aviso no encontrado');
    throw new ConflictError('El aviso fue modificado por otra persona. Recarga para ver la última versión.', {
      currentVersion: current.version,
    });
  }
}

export class PgListingTileSource implements ListingTileSource {
  constructor(private readonly pool: Pool) {}

  /** Genera la tesela MVT directamente en PostGIS (ST_AsMVT): sin servidor de teselas extra. */
  async getTile(z: number, x: number, y: number): Promise<Buffer> {
    const { rows } = await this.pool.query<{ mvt: Buffer | null }>(
      `WITH bounds AS (
         SELECT ST_TileEnvelope($1, $2, $3) AS geom
       ),
       mvtgeom AS (
         SELECT ST_AsMVTGeom(ST_Transform(l.geom, 3857), bounds.geom, 4096, 64, true) AS geom,
                l.id::text AS id, l.price::float8 AS price, l.currency, l.operation, l.property_type
         FROM listings l, bounds
         WHERE l.status = 'active' AND l.geom && ST_Transform(bounds.geom, 4326)
       )
       SELECT ST_AsMVT(mvtgeom.*, 'listings', 4096, 'geom') AS mvt FROM mvtgeom`,
      [z, x, y],
    );
    return rows[0]?.mvt ?? Buffer.alloc(0);
  }
}
