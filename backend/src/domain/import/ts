import type { Readable } from 'node:stream';
import type { ImportStatus } from '@portal/shared';
import type { ListingDraft } from '../listing/listing';

export interface ImportJob {
  id: string;
  userId: string;
  agencyId: string;
  idempotencyKey: string;
  fileKey: string;
  originalName: string;
  status: ImportStatus;
  totalRows: number | null;
  processedRows: number;
  insertedRows: number;
  updatedRows: number;
  failedRows: number;
  /** Última fila del archivo confirmada en BD: permite reanudar tras una caída. */
  lastCommittedRow: number;
  errorMessage: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

export const isFinished = (job: Pick<ImportJob, 'status'>): boolean =>
  job.status === 'completed' || job.status === 'failed';

export interface ImportRowError {
  rowNumber: number;
  message: string;
  raw: Record<string, unknown>;
}

export interface ImportBatch {
  rows: Array<{ rowNumber: number; draft: ListingDraft }>;
  errors: ImportRowError[];
  /** Número de la última fila del archivo cubierta por este lote. */
  lastRowNumber: number;
}

export interface ImportBatchResult {
  job: ImportJob;
  insertedIds: string[];
  updatedIds: string[];
}

export interface NewImportJob {
  userId: string;
  agencyId: string;
  idempotencyKey: string;
  fileKey: string;
  originalName: string;
}

export interface ImportJobRepository {
  findById(id: string): Promise<ImportJob | null>;
  findByIdempotencyKey(userId: string, key: string): Promise<ImportJob | null>;
  /** INSERT ... ON CONFLICT DO NOTHING: dos peticiones simultáneas con la misma clave crean un solo job. */
  createIfAbsent(job: NewImportJob): Promise<{ job: ImportJob; created: boolean }>;
  listRecent(agencyId: string | null, limit: number): Promise<ImportJob[]>;
  listErrors(jobId: string, limit: number): Promise<ImportRowError[]>;
  markProcessing(id: string): Promise<ImportJob>;
  /**
   * Upsert de avisos + errores de fila + avance del job en UNA transacción ACID.
   * Si `job.lastCommittedRow` no coincide con la BD (otro worker avanzó), lanza ConflictError y hace rollback.
   */
  commitBatch(job: ImportJob, batch: ImportBatch): Promise<ImportBatchResult>;
  markCompleted(id: string): Promise<ImportJob>;
  markFailed(id: string, message: string): Promise<ImportJob>;
}

/** Cola de trabajos de importación (procesamiento en background). */
export interface ImportQueue {
  enqueue(jobId: string): Promise<void>;
}

/** Lector tabular en streaming: nunca carga el archivo completo en memoria. */
export interface TabularReader {
  read(source: Readable): AsyncIterable<Record<string, string>>;
}
