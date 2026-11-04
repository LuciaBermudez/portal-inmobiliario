import type { ImportStatus } from '@portal/shared';
import type {
  ImportBatch,
  ImportBatchResult,
  ImportJob,
  ImportJobRepository,
  ImportRowError,
  NewImportJob,
} from '../../domain/import/import-job';
import { ConflictError, NotFoundError } from '../../domain/shared/errors';
import { withTransaction, type Pool, type PoolClient } from '../db/pool';

interface ImportJobRow {
  id: string;
  user_id: string;
  agency_id: string;
  idempotency_key: string;
  file_key: string;
  original_name: string;
  status: ImportStatus;
  total_rows: number | null;
  processed_rows: number;
  inserted_rows: number;
  updated_rows: number;
  failed_rows: number;
  last_committed_row: number;
  error_message: string | null;
  created_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
}

const toJob = (r: ImportJobRow): ImportJob => ({
  id: r.id,
  userId: r.user_id,
  agencyId: r.agency_id,
  idempotencyKey: r.idempotency_key,
  fileKey: r.file_key,
  originalName: r.original_name,
  status: r.status,
  totalRows: r.total_rows,
  processedRows: r.processed_rows,
  insertedRows: r.inserted_rows,
  updatedRows: r.updated_rows,
  failedRows: r.failed_rows,
  lastCommittedRow: r.last_committed_row,
  errorMessage: r.error_message,
  createdAt: r.created_at,
  startedAt: r.started_at,
  finishedAt: r.finished_at,
});

export class PgImportJobRepository implements ImportJobRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<ImportJob | null> {
    const { rows } = await this.pool.query<ImportJobRow>('SELECT * FROM import_jobs WHERE id = $1', [id]);
    return rows[0] ? toJob(rows[0]) : null;
  }

  async findByIdempotencyKey(userId: string, key: string): Promise<ImportJob | null> {
    const { rows } = await this.pool.query<ImportJobRow>(
      'SELECT * FROM import_jobs WHERE user_id = $1 AND idempotency_key = $2',
      [userId, key],
    );
    return rows[0] ? toJob(rows[0]) : null;
  }

  async createIfAbsent(job: NewImportJob): Promise<{ job: ImportJob; created: boolean }> {
    const { rows } = await this.pool.query<ImportJobRow>(
      `INSERT INTO import_jobs (user_id, agency_id, idempotency_key, file_key, original_name)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ON CONSTRAINT import_jobs_idempotency DO NOTHING
       RETURNING *`,
      [job.userId, job.agencyId, job.idempotencyKey, job.fileKey, job.originalName],
    );
    if (rows[0]) return { job: toJob(rows[0]), created: true };
    const existing = await this.findByIdempotencyKey(job.userId, job.idempotencyKey);
    if (!existing) throw new ConflictError('No se pudo crear la importación');
    return { job: existing, created: false };
  }

  async listRecent(agencyId: string | null, limit: number): Promise<ImportJob[]> {
    const { rows } = await this.pool.query<ImportJobRow>(
      `SELECT * FROM import_jobs
       WHERE ($1::uuid IS NULL OR agency_id = $1)
       ORDER BY created_at DESC LIMIT $2`,
      [agencyId, limit],
    );
    return rows.map(toJob);
  }

  async listErrors(jobId: string, limit: number): Promise<ImportRowError[]> {
    const { rows } = await this.pool.query<{ row_number: number; message: string; raw: Record<string, unknown> }>(
      'SELECT row_number, message, raw FROM import_row_errors WHERE job_id = $1 ORDER BY row_number LIMIT $2',
      [jobId, limit],
    );
    return rows.map((r) => ({ rowNumber: r.row_number, message: r.message, raw: r.raw }));
  }

  async markProcessing(id: string): Promise<ImportJob> {
    return this.updateOne(
      `UPDATE import_jobs SET status = 'processing', started_at = COALESCE(started_at, now()), error_message = NULL
       WHERE id = $1 RETURNING *`,
      [id],
    );
  }

  async markCompleted(id: string): Promise<ImportJob> {
    return this.updateOne(
      `UPDATE import_jobs SET status = 'completed', total_rows = last_committed_row, finished_at = now()
       WHERE id = $1 RETURNING *`,
      [id],
    );
  }

  async markFailed(id: string, message: string): Promise<ImportJob> {
    return this.updateOne(
      `UPDATE import_jobs SET status = 'failed', error_message = $2, finished_at = now()
       WHERE id = $1 RETURNING *`,
      [id, message.slice(0, 1000)],
    );
  }

  async commitBatch(job: ImportJob, batch: ImportBatch): Promise<ImportBatchResult> {
    return withTransaction(this.pool, async (client) => {
      const { insertedIds, updatedIds } = await this.upsertListings(client, job, batch);

      if (batch.errors.length > 0) {
        await client.query(
          `INSERT INTO import_row_errors (job_id, row_number, message, raw)
           SELECT $1, t.row_number, t.message, t.raw
           FROM unnest($2::int[], $3::text[], $4::jsonb[]) AS t(row_number, message, raw)
           ON CONFLICT (job_id, row_number) DO NOTHING`,
          [
            job.id,
            batch.errors.map((e) => e.rowNumber),
            batch.errors.map((e) => e.message.slice(0, 1000)),
            batch.errors.map((e) => JSON.stringify(e.raw)),
          ],
        );
      }

      // Guarda optimista: si otro worker ya avanzó este job, no coincide y se hace ROLLBACK de todo el lote.
      const { rows } = await client.query<ImportJobRow>(
        `UPDATE import_jobs SET
           processed_rows = processed_rows + $3,
           inserted_rows = inserted_rows + $4,
           updated_rows = updated_rows + $5,
           failed_rows = failed_rows + $6,
           last_committed_row = $7
         WHERE id = $1 AND last_committed_row = $2
         RETURNING *`,
        [
          job.id,
          job.lastCommittedRow,
          batch.rows.length + batch.errors.length,
          insertedIds.length,
          updatedIds.length,
          batch.errors.length,
          batch.lastRowNumber,
        ],
      );
      if (!rows[0]) throw new ConflictError(`La importación ${job.id} fue avanzada por otro proceso`);
      return { job: toJob(rows[0]), insertedIds, updatedIds };
    });
  }

  /** Upsert masivo con unnest: una sola sentencia por lote. `xmax = 0` distingue INSERT de UPDATE. */
  private async upsertListings(
    client: PoolClient,
    job: ImportJob,
    batch: ImportBatch,
  ): Promise<{ insertedIds: string[]; updatedIds: string[] }> {
    if (batch.rows.length === 0) return { insertedIds: [], updatedIds: [] };
    const d = batch.rows.map((r) => r.draft);
    const { rows } = await client.query<{ id: string; inserted: boolean }>(
      `INSERT INTO listings (agency_id, external_id, title, description, operation, property_type, price, currency,
                             bedrooms, bathrooms, area_m2, address, geom, import_job_id)
       SELECT $1::uuid, t.external_id, t.title, t.description, t.operation, t.property_type, t.price, t.currency,
              t.bedrooms, t.bathrooms, t.area_m2, t.address, ST_SetSRID(ST_MakePoint(t.lng, t.lat), 4326), $2::uuid
       FROM unnest($3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::numeric[], $9::text[],
                   $10::int[], $11::int[], $12::numeric[], $13::text[], $14::float8[], $15::float8[])
         AS t(external_id, title, description, operation, property_type, price, currency,
              bedrooms, bathrooms, area_m2, address, lng, lat)
       ON CONFLICT ON CONSTRAINT listings_agency_external DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         operation = EXCLUDED.operation,
         property_type = EXCLUDED.property_type,
         price = EXCLUDED.price,
         currency = EXCLUDED.currency,
         bedrooms = EXCLUDED.bedrooms,
         bathrooms = EXCLUDED.bathrooms,
         area_m2 = EXCLUDED.area_m2,
         address = EXCLUDED.address,
         geom = EXCLUDED.geom,
         import_job_id = EXCLUDED.import_job_id,
         status = 'active',
         version = listings.version + 1,
         updated_at = now()
       RETURNING id, (xmax = 0) AS inserted`,
      [
        job.agencyId,
        job.id,
        d.map((x) => x.externalId),
        d.map((x) => x.title),
        d.map((x) => x.description),
        d.map((x) => x.operation),
        d.map((x) => x.propertyType),
        d.map((x) => x.price),
        d.map((x) => x.currency),
        d.map((x) => x.bedrooms),
        d.map((x) => x.bathrooms),
        d.map((x) => x.areaM2),
        d.map((x) => x.address),
        d.map((x) => x.location.lng),
        d.map((x) => x.location.lat),
      ],
    );
    return {
      insertedIds: rows.filter((r) => r.inserted).map((r) => r.id),
      updatedIds: rows.filter((r) => !r.inserted).map((r) => r.id),
    };
  }

  private async updateOne(sql: string, params: unknown[]): Promise<ImportJob> {
    const { rows } = await this.pool.query<ImportJobRow>(sql, params);
    if (!rows[0]) throw new NotFoundError('Importación no encontrada');
    return toJob(rows[0]);
  }
}
