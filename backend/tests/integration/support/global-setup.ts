import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TestProject } from 'vitest/node';
import { runMigrations } from '../../../src/infrastructure/db/migrator';
import { createPool } from '../../../src/infrastructure/db/pool';
import { MIGRATIONS_DIR } from './db';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

/**
 * Los tests de integración corren contra un PostgreSQL + PostGIS real, indicado en TEST_DATABASE_URL.
 * Debe ser una base DEDICADA a tests: se escriben datos en ella (cada test crea los suyos).
 */
export default async function setup(project: TestProject) {
  for (const file of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../.env')]) {
    if (existsSync(file)) {
      process.loadEnvFile(file);
      break;
    }
  }

  const url = process.env['TEST_DATABASE_URL'];
  if (!url) {
    throw new Error(
      'Falta TEST_DATABASE_URL: apunta a una base PostgreSQL + PostGIS dedicada a tests ' +
        '(ver backend/scripts/setup-local-db.sql, que crea "portal_test").',
    );
  }

  // La base es persistente: se vacía al inicio para que cada corrida parta limpia (aislamiento).
  // Protección: solo se permite sobre una base cuyo nombre termine en "_test".
  const database = decodeURIComponent(new URL(url).pathname.slice(1));
  if (!database.endsWith('_test')) {
    throw new Error(`TEST_DATABASE_URL apunta a "${database}": por seguridad debe ser una base cuyo nombre termine en "_test".`);
  }

  const pool = createPool(url);
  await runMigrations(pool, MIGRATIONS_DIR);
  await pool.query(
    `TRUNCATE notifications, zones, import_row_errors, listings, import_jobs, refresh_tokens, users, agencies
     RESTART IDENTITY CASCADE`,
  );
  await pool.query(`DO $$ BEGIN
     IF to_regclass('pgboss.job') IS NOT NULL THEN TRUNCATE pgboss.job; END IF;
   END $$`);
  await pool.end();
  project.provide('databaseUrl', url);
}
