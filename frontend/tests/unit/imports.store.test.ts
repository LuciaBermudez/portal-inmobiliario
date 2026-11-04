import type { ImportJob } from '@portal/shared';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { isNewer, useImportsStore } from '@/stores/imports';

const job = (overrides: Partial<ImportJob> = {}): ImportJob => ({
  id: 'j1',
  originalName: 'catalogo.csv',
  status: 'processing',
  totalRows: null,
  processedRows: 0,
  insertedRows: 0,
  updatedRows: 0,
  failedRows: 0,
  errorMessage: null,
  createdAt: '2026-01-01T00:00:00Z',
  startedAt: null,
  finishedAt: null,
  ...overrides,
});

beforeEach(() => setActivePinia(createPinia()));

describe('progreso de importaciones en vivo', () => {
  it('descarta eventos WebSocket que llegan desordenados', () => {
    const store = useImportsStore();
    store.applyProgress(job({ processedRows: 4000 }));
    store.applyProgress(job({ processedRows: 2000 })); // evento atrasado

    expect(store.byId['j1']!.processedRows).toBe(4000);
  });

  it('un estado final nunca vuelve a "procesando"', () => {
    expect(isNewer(job({ status: 'processing', processedRows: 9 }), job({ status: 'completed', processedRows: 9 }))).toBe(false);
  });

  it('al completarse invalida las teselas del mapa', () => {
    const store = useImportsStore();
    store.applyProgress(job());
    const before = store.tilesVersion;

    store.applyProgress(job({ status: 'completed', processedRows: 10 }));

    expect(store.tilesVersion).toBe(before + 1);
  });
});
