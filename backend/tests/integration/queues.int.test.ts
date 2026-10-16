import { randomUUID } from 'node:crypto';
import type { PgBoss } from 'pg-boss';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createPool, type Pool } from '../../src/infrastructure/db/pool';
import { createBoss, PgBossImportQueue, QUEUES, startBoss } from '../../src/infrastructure/queue/pg-boss-queues';

let pool: Pool;
let boss: PgBoss;

beforeAll(async () => {
  pool = createPool(inject('databaseUrl'));
  boss = createBoss(inject('databaseUrl'));
  await startBoss(boss);
});
afterAll(async () => {
  await boss.stop({ graceful: false });
  await pool.end();
});

describe('colas sobre PostgreSQL (pg-boss)', () => {
  it('encolar dos veces la misma importación crea un único job (idempotencia por id)', async () => {
    const queue = new PgBossImportQueue(boss);
    const jobId = randomUUID();

    await queue.enqueue(jobId);
    await queue.enqueue(jobId);

    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM pgboss.job WHERE name = $1 AND id = $2`, [
      QUEUES.imports,
      jobId,
    ]);
    expect(rows[0].n).toBe(1);
  });
});
