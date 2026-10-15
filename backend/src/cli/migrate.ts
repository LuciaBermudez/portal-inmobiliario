import { resolve } from 'node:path';
import { loadEnv } from '../config/env';
import { runMigrations } from '../infrastructure/db/migrator';
import { createPool } from '../infrastructure/db/pool';

const env = loadEnv();
const pool = createPool(env.DATABASE_URL);
try {
  const applied = await runMigrations(pool, resolve(process.cwd(), 'migrations'));
  console.log(applied.length ? `Migraciones aplicadas: ${applied.join(', ')}` : 'Base de datos al día');
} finally {
  await pool.end();
}
