import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import type { ListingDraft } from '../../src/domain/listing/listing';
import { ConflictError } from '../../src/domain/shared/errors';
import { createPool, type Pool } from '../../src/infrastructure/db/pool';
import { PgImportJobRepository } from '../../src/infrastructure/repositories/pg-import-job-repository';
import { createAgency, createUser, draft } from './support/db';

let pool: Pool;
let jobs: PgImportJobRepository;

beforeAll(() => {
  pool = createPool(inject('databaseUrl'));
  jobs = new PgImportJobRepository(pool);
});
afterAll(() => pool.end());

/** Crea un job de importación y confirma un primer lote con los avisos dados. */
async function importFirstBatch(drafts: ListingDraft[]) {
  const agencyId = await createAgency(pool);
  const userId = await createUser(pool, 'agent', agencyId);
  const { job } = await jobs.createIfAbsent({
    userId,
    agencyId,
    idempotencyKey: randomUUID(),
    fileKey: 'x.csv',
    originalName: 'x.csv',
  });
  const result = await jobs.commitBatch(job, {
    rows: drafts.map((d, i) => ({ rowNumber: i + 1, draft: d })),
    errors: [],
    lastRowNumber: drafts.length,
  });
  return { agencyId, job: result.job };
}

describe('ingesta: upsert transaccional', () => {
  it('re-importar el mismo lote es idempotente (actualiza, no duplica)', async () => {
    const drafts = [draft('A', -76.53, 3.45), draft('B', -76.54, 3.46)];
    const { job, agencyId } = await importFirstBatch(drafts);

    const second = await jobs.commitBatch(job, {
      rows: drafts.map((d, i) => ({ rowNumber: 3 + i, draft: { ...d, price: 999 } })),
      errors: [{ rowNumber: 5, message: 'precio inválido', raw: { price: '-1' } }],
      lastRowNumber: 5,
    });

    expect(second.insertedIds).toHaveLength(0);
    expect(second.updatedIds).toHaveLength(2);
    expect(second.job).toMatchObject({ processedRows: 5, insertedRows: 2, updatedRows: 2, failedRows: 1 });
    const { rows } = await pool.query('SELECT price, version FROM listings WHERE agency_id = $1', [agencyId]);
    expect(rows).toEqual([
      { price: 999, version: 2 },
      { price: 999, version: 2 },
    ]);
  });

  it('un lote con progreso obsoleto (otro worker avanzó) hace rollback completo', async () => {
    const { job, agencyId } = await importFirstBatch([draft('X', -76.53, 3.45)]);
    const stale = { ...job, lastCommittedRow: 0 };

    await expect(
      jobs.commitBatch(stale, { rows: [{ rowNumber: 1, draft: draft('Y', -76.53, 3.45) }], errors: [], lastRowNumber: 1 }),
    ).rejects.toBeInstanceOf(ConflictError);

    const { rows } = await pool.query('SELECT external_id FROM listings WHERE agency_id = $1', [agencyId]);
    expect(rows.map((r) => r.external_id)).toEqual(['X']); // 'Y' no quedó insertado
  });

  it('una misma clave de idempotencia crea un único job', async () => {
    const agencyId = await createAgency(pool);
    const userId = await createUser(pool, 'agent', agencyId);
    const input = { userId, agencyId, idempotencyKey: randomUUID(), fileKey: 'x.csv', originalName: 'x.csv' };

    const [a, b] = await Promise.all([jobs.createIfAbsent(input), jobs.createIfAbsent(input)]);

    expect(a.job.id).toBe(b.job.id);
    expect([a.created, b.created].filter(Boolean)).toHaveLength(1);
  });
});
