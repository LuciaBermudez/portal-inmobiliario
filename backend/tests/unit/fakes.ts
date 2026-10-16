import { Readable } from 'node:stream';
import type { AlertQueue } from '../../src/domain/alert/zone';
import type {
  ImportBatch,
  ImportBatchResult,
  ImportJob,
  ImportJobRepository,
  ImportRowError,
  NewImportJob,
  TabularReader,
} from '../../src/domain/import/import-job';
import { ConflictError } from '../../src/domain/shared/errors';
import type { EventPublisher, Logger, ObjectStorage, RealtimeEvent } from '../../src/domain/shared/ports';

export const silentLogger: Logger = { info: () => {}, warn: () => {}, error: () => {} };

export function makeJob(overrides: Partial<ImportJob> = {}): ImportJob {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    userId: '00000000-0000-4000-8000-0000000000aa',
    agencyId: '00000000-0000-4000-8000-0000000000bb',
    idempotencyKey: 'key-123456',
    fileKey: 'imports/test.csv',
    originalName: 'test.csv',
    status: 'queued',
    totalRows: null,
    processedRows: 0,
    insertedRows: 0,
    updatedRows: 0,
    failedRows: 0,
    lastCommittedRow: 0,
    errorMessage: null,
    createdAt: new Date(),
    startedAt: null,
    finishedAt: null,
    ...overrides,
  };
}

/** Repositorio en memoria con la misma semántica de guardas que el de Postgres. */
export class InMemoryImportJobRepository implements ImportJobRepository {
  readonly batches: ImportBatch[] = [];
  readonly errors: ImportRowError[] = [];
  /** externalIds ya existentes → el upsert los cuenta como "updated". */
  readonly existing = new Set<string>();
  failOnBatch: number | null = null;

  constructor(public job: ImportJob) {}

  async findById(id: string) {
    return id === this.job.id ? { ...this.job } : null;
  }
  async findByIdempotencyKey(userId: string, key: string) {
    return userId === this.job.userId && key === this.job.idempotencyKey ? { ...this.job } : null;
  }
  async createIfAbsent(_job: NewImportJob) {
    return { job: { ...this.job }, created: false };
  }
  async listRecent() {
    return [{ ...this.job }];
  }
  async listErrors() {
    return this.errors;
  }
  async markProcessing() {
    this.job = { ...this.job, status: 'processing', startedAt: new Date() };
    return { ...this.job };
  }
  async markCompleted() {
    this.job = { ...this.job, status: 'completed', totalRows: this.job.lastCommittedRow, finishedAt: new Date() };
    return { ...this.job };
  }
  async markFailed(_id: string, message: string) {
    this.job = { ...this.job, status: 'failed', errorMessage: message, finishedAt: new Date() };
    return { ...this.job };
  }
  async commitBatch(job: ImportJob, batch: ImportBatch): Promise<ImportBatchResult> {
    if (this.failOnBatch === this.batches.length) throw new Error('fallo simulado de BD');
    if (job.lastCommittedRow !== this.job.lastCommittedRow) throw new ConflictError('avanzado por otro proceso');
    this.batches.push(batch);
    this.errors.push(...batch.errors);
    const insertedIds: string[] = [];
    const updatedIds: string[] = [];
    for (const row of batch.rows) {
      const id = `listing-${row.draft.externalId}`;
      if (this.existing.has(row.draft.externalId)) updatedIds.push(id);
      else {
        this.existing.add(row.draft.externalId);
        insertedIds.push(id);
      }
    }
    this.job = {
      ...this.job,
      processedRows: this.job.processedRows + batch.rows.length + batch.errors.length,
      insertedRows: this.job.insertedRows + insertedIds.length,
      updatedRows: this.job.updatedRows + updatedIds.length,
      failedRows: this.job.failedRows + batch.errors.length,
      lastCommittedRow: batch.lastRowNumber,
    };
    return { job: { ...this.job }, insertedIds, updatedIds };
  }
}

export const emptyStorage: ObjectStorage = {
  put: async () => ({ bytes: 0 }),
  get: async () => Readable.from([]),
};

export class ArrayReader implements TabularReader {
  constructor(private readonly rows: Array<Record<string, string>>) {}
  async *read(): AsyncIterable<Record<string, string>> {
    yield* this.rows;
  }
}

export class RecordingEvents implements EventPublisher {
  readonly events: Array<{ userId: string; event: RealtimeEvent }> = [];
  async publishToUser(userId: string, event: RealtimeEvent) {
    this.events.push({ userId, event });
  }
}

export class RecordingAlertQueue implements AlertQueue {
  readonly calls: string[][] = [];
  async enqueueMatch(listingIds: string[]) {
    this.calls.push(listingIds);
  }
}

export function csvRow(i: number, overrides: Record<string, string> = {}): Record<string, string> {
  return {
    external_id: `EXT-${i}`,
    title: `Depto ${i}`,
    description: '',
    operation: 'rent',
    property_type: 'apartment',
    price: '2500000',
    currency: 'COP',
    bedrooms: '2',
    bathrooms: '1',
    area_m2: '55',
    address: 'Calle 1',
    lat: '3.45',
    lng: '-76.53',
    ...overrides,
  };
}
