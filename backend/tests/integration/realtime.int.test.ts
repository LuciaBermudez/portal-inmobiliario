import { randomUUID } from 'node:crypto';
import type { ImportJob } from '@portal/shared';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import type { Logger } from '../../src/domain/shared/ports';
import { createPool, type Pool } from '../../src/infrastructure/db/pool';
import {
  PgEventListener,
  PgNotifyEventPublisher,
  type EventEnvelope,
} from '../../src/infrastructure/realtime/pg-event-bus';

const silentLogger: Logger = { info: () => {}, warn: () => {}, error: () => {} };
let pool: Pool;

beforeAll(() => {
  pool = createPool(inject('databaseUrl'));
});
afterAll(() => pool.end());

describe('tiempo real con LISTEN/NOTIFY', () => {
  it('un evento publicado por el worker llega al listener de la API', async () => {
    const received: EventEnvelope[] = [];
    const listener = new PgEventListener(inject('databaseUrl'), (e) => received.push(e), silentLogger);
    await listener.start();

    const payload = { id: randomUUID(), originalName: 'x.csv', status: 'processing' } as ImportJob;
    await new PgNotifyEventPublisher(pool).publishToUser('user-1', { name: 'import:progress', payload });

    await expect.poll(() => received.length, { timeout: 5_000 }).toBe(1);
    expect(received[0]).toEqual({ room: 'user:user-1', event: { name: 'import:progress', payload } });
    await listener.stop();
  });
});
