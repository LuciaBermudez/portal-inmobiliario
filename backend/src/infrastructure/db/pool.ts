import pg from 'pg';

export function createPool(connectionString: string): pg.Pool {
  if (!connectionString) {
    throw new Error('Falta la variable DATABASE_URL en la configuración del backend');
  }

  const pool = new pg.Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  pool.on('error', (error) => {
    console.error('Error inesperado en el pool de PostgreSQL:', error.message);
  });

  return pool;
}