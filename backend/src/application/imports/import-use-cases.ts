import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import {
  canImportListings,
  canViewImport,
  type Actor,
  type ImportJob as ImportJobDto,
  type ImportRowErrorDto,
} from '@portal/shared';
import type { ImportJob, ImportJobRepository, ImportQueue } from '';
import { ForbiddenError, NotFoundError } from '';
import type { ObjectStorage } from ';

export const toImportJobDto = (job: ImportJob): ImportJobDto => ({
  id: job.id,
  originalName: job.originalName,
  status: job.status,
  totalRows: job.totalRows,
  processedRows: job.processedRows,
  insertedRows: job.insertedRows,
  updatedRows: job.updatedRows,
  failedRows: job.failedRows,
  errorMessage: job.errorMessage,
  createdAt: job.createdAt.toISOString(),
  startedAt: job.startedAt?.toISOString() ?? null,
  finishedAt: job.finishedAt?.toISOString() ?? null,
});

export interface CreateImportInput {
  actor: Actor;
  idempotencyKey: string;
  originalName: string;
  file: Readable;
}


export class CreateImport {
  constructor(
    private readonly jobs: ImportJobRepository,
    private readonly storage: ObjectStorage,
    private readonly queue: ImportQueue,
    private readonly newId: () => string = randomUUID,
  ) {}

  async execute(input: CreateImportInput): Promise<{ job: ImportJobDto; created: boolean }> {
    const { actor } = input;
    if (!canImportListings(actor) || actor.agencyId === null) {
      input.file.resume();
      throw new ForbiddenError('Necesitas ser agente o admin de una inmobiliaria para importar');
    }

    const existing = await this.jobs.findByIdempotencyKey(actor.id, input.idempotencyKey);
    if (existing) {
      input.file.resume();
      if (existing.status === 'queued') await this.queue.enqueue(existing.id);
      return { job: toImportJobDto(existing), created: false };
    }

    const fileKey = `imports/${actor.agencyId}/${this.newId()}.csv`;
    await this.storage.put(fileKey, input.file);

    const { job, created } = await this.jobs.createIfAbsent({
      userId: actor.id,
      agencyId: actor.agencyId,
      idempotencyKey: input.idempotencyKey,
      fileKey,
      originalName: input.originalName,
    });
    if (created) await this.queue.enqueue(job.id);
    return { job: toImportJobDto(job), created };
  }
}

export class ListImports {
  constructor(private readonly jobs: ImportJobRepository) {}

  async execute(actor: Actor): Promise<ImportJobDto[]> {
    if (!canImportListings(actor)) throw new ForbiddenError('Sin acceso a importaciones');
    const scope = actor.role === 'admin' ? null : actor.agencyId;
    return (await this.jobs.listRecent(scope, 50)).map(toImportJobDto);
  }
}

export class GetImport {
  constructor(private readonly jobs: ImportJobRepository) {}

  async execute(actor: Actor, id: string): Promise<ImportJobDto> {
    return toImportJobDto(await findVisibleJob(this.jobs, actor, id));
  }
}

export class ListImportErrors {
  constructor(private readonly jobs: ImportJobRepository) {}

  async execute(actor: Actor, id: string): Promise<ImportRowErrorDto[]> {
    await findVisibleJob(this.jobs, actor, id);
    const errors = await this.jobs.listErrors(id, 1000);
    return errors.map(({ rowNumber, message }) => ({ rowNumber, message }));
  }
}

async function findVisibleJob(jobs: ImportJobRepository, actor: Actor, id: string): Promise<ImportJob> {
  const job = await jobs.findById(id);
  // 404 también cuando no hay permiso: no revelamos la existencia de jobs ajenos.
  if (!job || !canViewImport(actor, job)) throw new NotFoundError('Importación no encontrada');
  return job;
}
