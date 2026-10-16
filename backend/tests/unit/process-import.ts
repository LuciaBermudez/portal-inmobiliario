import { describe, expect, it } from 'vitest';
import { ProcessImport } from '../../src/application/imports/process-import';
import {
  ArrayReader,
  csvRow,
  emptyStorage,
  InMemoryImportJobRepository,
  makeJob,
  RecordingAlertQueue,
  RecordingEvents,
  silentLogger,
} from './fakes';

function setup(rows: Array<Record<string, string>>, batchSize = 3, job = makeJob()) {
  const jobs = new InMemoryImportJobRepository(job);
  const events = new RecordingEvents();
  const alerts = new RecordingAlertQueue();
  const useCase = new ProcessImport({
    jobs,
    storage: emptyStorage,
    reader: new ArrayReader(rows),
    events,
    alerts,
    logger: silentLogger,
    batchSize,
  });
  return { jobs, events, alerts, useCase };
}

describe('ProcessImport (pipeline de carga masiva)', () => {
  it('procesa en lotes, registra filas inválidas y completa el job', async () => {
    const rows = [csvRow(1), csvRow(2, { price: '-5' }), csvRow(3), csvRow(4), csvRow(5, { lat: '999' }), csvRow(6), csvRow(7)];
    const { jobs, useCase } = setup(rows, 3);

    const job = await useCase.execute(jobs.job.id);

    expect(job.status).toBe('completed');
    expect(job.totalRows).toBe(7);
    expect(job.processedRows).toBe(7);
    expect(job.insertedRows).toBe(5);
    expect(job.failedRows).toBe(2);
    expect(jobs.batches.map((b) => b.lastRowNumber)).toEqual([3, 6, 7]);
    expect(jobs.errors.map((e) => e.rowNumber)).toEqual([2, 5]);
    expect(jobs.errors[0]!.message).toContain('price');
  });

  it('dentro de un lote, un external_id duplicado conserva la última fila', async () => {
    const rows = [csvRow(1, { title: 'Primera' }), csvRow(1, { title: 'Segunda' })];
    const { jobs, useCase } = setup(rows, 10);

    await useCase.execute(jobs.job.id);

    const batch = jobs.batches[0]!;
    expect(batch.rows).toHaveLength(1);
    expect(batch.rows[0]!.draft.title).toBe('Segunda');
    expect(batch.errors[0]).toMatchObject({ rowNumber: 1 });
  });

  it('solo los avisos nuevos disparan alertas por zona', async () => {
    const { jobs, alerts, useCase } = setup([csvRow(1), csvRow(2)], 10);
    jobs.existing.add('EXT-1');

    await useCase.execute(jobs.job.id);

    expect(alerts.calls).toEqual([['listing-EXT-2']]);
  });

  it('emite progreso en vivo hasta el estado final', async () => {
    const { jobs, events, useCase } = setup([csvRow(1), csvRow(2), csvRow(3), csvRow(4)], 2);

    await useCase.execute(jobs.job.id);

    const statuses = events.events.map((e) => (e.event.name === 'import:progress' ? e.event.payload.status : null));
    expect(statuses[0]).toBe('processing');
    expect(statuses.at(-1)).toBe('completed');
    expect(events.events.every((e) => e.userId === jobs.job.userId)).toBe(true);
  });

  it('reanuda desde la última fila confirmada tras una caída', async () => {
    const rows = [1, 2, 3, 4, 5].map((i) => csvRow(i));
    const { jobs, useCase } = setup(rows, 2, makeJob({ status: 'processing', lastCommittedRow: 4, processedRows: 4 }));

    const job = await useCase.execute(jobs.job.id);

    expect(jobs.batches).toHaveLength(1);
    expect(jobs.batches[0]!.rows.map((r) => r.rowNumber)).toEqual([5]);
    expect(job.processedRows).toBe(5);
  });

  it('es idempotente: un job ya completado no se reprocesa', async () => {
    const { jobs, useCase } = setup([csvRow(1)], 10, makeJob({ status: 'completed' }));

    await useCase.execute(jobs.job.id);

    expect(jobs.batches).toHaveLength(0);
  });

  it('solo marca fallido en el último intento; antes deja reintentar', async () => {
    const { jobs, useCase } = setup([csvRow(1), csvRow(2), csvRow(3)], 1);
    jobs.failOnBatch = 1;

    await expect(useCase.execute(jobs.job.id, { isFinalAttempt: false })).rejects.toThrow('fallo simulado');
    expect(jobs.job.status).toBe('processing');
    expect(jobs.job.lastCommittedRow).toBe(1); // el primer lote quedó confirmado

    await expect(useCase.execute(jobs.job.id, { isFinalAttempt: true })).rejects.toThrow('fallo simulado');
    expect(jobs.job.status).toBe('failed');
  });
});
