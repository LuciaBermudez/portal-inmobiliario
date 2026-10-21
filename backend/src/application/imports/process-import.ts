import { CsvListingRowSchema, type CsvListingRow } from '@portal/shared';
import type { AlertQueue } from '../../domain/alert/zone';
import {
  isFinished,
  type ImportBatch,
  type ImportJob,
  type ImportJobRepository,
  type ImportRowError,
  type TabularReader,
} from '../../domain/import/import-job';
import type { ListingDraft } from '../../domain/listing/listing';
import { NotFoundError } from '../../domain/shared/errors';
import type { EventPublisher, Logger, ObjectStorage } from '../../domain/shared/ports';
import { toImportJobDto } from './import-use-cases';

export interface ProcessImportDeps {
  jobs: ImportJobRepository;
  storage: ObjectStorage;
  reader: TabularReader;
  events: EventPublisher;
  alerts: AlertQueue;
  logger: Logger;
  batchSize: number;
}

export interface ProcessImportOptions {
  isFinalAttempt: boolean;
}

const toDraft = (row: CsvListingRow): ListingDraft => ({
  externalId: row.external_id,
  title: row.title,
  description: row.description,
  operation: row.operation,
  propertyType: row.property_type,
  price: row.price,
  currency: row.currency,
  bedrooms: row.bedrooms,
  bathrooms: row.bathrooms,
  areaM2: row.area_m2,
  address: row.address,
  location: { lng: row.lng, lat: row.lat },
});

class BatchBuilder {
  private readonly rows = new Map<string, { rowNumber: number; draft: ListingDraft; raw: Record<string, string> }>();
  private readonly errors: ImportRowError[] = [];

  get size(): number {
    return this.rows.size + this.errors.length;
  }

  add(rowNumber: number, raw: Record<string, string>): void {
    const parsed = CsvListingRowSchema.safeParse(raw);
    if (!parsed.success) {
      const message = parsed.error.issues
        .map((issue) => `${issue.path.map(String).join('.') || 'fila'}: ${issue.message}`)
        .join('; ');
      this.errors.push({ rowNumber, message, raw });
      return;
    }

    const previous = this.rows.get(parsed.data.external_id);
    if (previous) {
      this.errors.push({
        rowNumber: previous.rowNumber,
        message: `external_id duplicado; se conserva la fila ${rowNumber}`,
        raw: previous.raw,
      });
      this.rows.delete(parsed.data.external_id);
    }
    this.rows.set(parsed.data.external_id, { rowNumber, draft: toDraft(parsed.data), raw });
  }

  build(lastRowNumber: number): ImportBatch {
    return {
      rows: [...this.rows.values()].map(({ rowNumber, draft }) => ({ rowNumber, draft })),
      errors: this.errors,
      lastRowNumber,
    };
  }
}



export class ProcessImport {
  constructor(private readonly deps: ProcessImportDeps) {}

  async execute(jobId: string, options: ProcessImportOptions = { isFinalAttempt: true }): Promise<ImportJob> {
    const { jobs, logger } = this.deps;
    const found = await jobs.findById(jobId);
    if (!found) throw new NotFoundError(`La importación ${jobId} no existe`);
    if (isFinished(found)) return found; 

    let job = await jobs.markProcessing(jobId);
    await this.publish(job);
    try {
      job = await this.consume(job);
      job = await jobs.markCompleted(job.id);
      await this.publish(job);
      logger.info('importación completada', { jobId, rows: job.processedRows });
      return job;
    } catch (error) {
      logger.error('importación con error', { jobId, error: String(error), final: options.isFinalAttempt });
      if (options.isFinalAttempt) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        await this.publish(await jobs.markFailed(jobId, message));
      }
      throw error;
    }
  }

  private async consume(initial: ImportJob): Promise<ImportJob> {
    let job = initial;
    const resumeAfter = job.lastCommittedRow;
    const source = await this.deps.storage.get(job.fileKey);

    let batch = new BatchBuilder();
    let rowNumber = 0;
    for await (const raw of this.deps.reader.read(source)) {
      rowNumber += 1;
      if (rowNumber <= resumeAfter) continue;
      batch.add(rowNumber, raw);
      if (batch.size >= this.deps.batchSize) {
        job = await this.flush(job, batch.build(rowNumber));
        batch = new BatchBuilder();
      }
    }
    if (rowNumber > job.lastCommittedRow) job = await this.flush(job, batch.build(rowNumber));
    return job;
  }

  private async flush(job: ImportJob, batch: ImportBatch): Promise<ImportJob> {
    const result = await this.deps.jobs.commitBatch(job, batch);
    if (result.insertedIds.length > 0) await this.deps.alerts.enqueueMatch(result.insertedIds);
    await this.publish(result.job);
    return result.job;
  }

  private async publish(job: ImportJob): Promise<void> {
    try {
      await this.deps.events.publishToUser(job.userId, { name: 'import:progress', payload: toImportJobDto(job) });
    } catch (error) {
        this.deps.logger.warn('no se pudo publicar el progreso', { jobId: job.id, error: String(error) });
    }
  }
}
