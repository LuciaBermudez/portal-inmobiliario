import pg from 'pg';

// numeric e int8 llegan como string por defecto; en este dominio caben en un number sin pérdida relevante.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) => Number(value));
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number(value));

export type Pool = pg.Pool;
export type PoolClient = pg.PoolClient;

export function createPool(connectionString: string): pg.Pool {
  return new pg.Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 });
}

/** Ejecuta `fn` en una transacción: COMMIT si resuelve, ROLLBACK si lanza. */
export async function withTransaction<T>(pool: pg.Pool, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function pgCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined;
}

export const isUniqueViolation = (error: unknown): boolean => pgCode(error) === '23505';
export const isCheckViolation = (error: unknown): boolean => pgCode(error) === '23514';
/** Error de PostGIS al parsear/operar con geometrías inválidas. */
export const isGeometryError = (error: unknown): boolean => pgCode(error) === 'XX000' || pgCode(error) === '22023';
