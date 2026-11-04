import { PgBoss } from 'pg-boss';
import type { AlertQueue } from '../../domain/alert/zone';
import type { ImportQueue } from '../../domain/import/import-job';

/**
 * Colas sobre PostgreSQL (pg-boss): los jobs viven en tablas del esquema `pgboss` y los workers
 * los toman con `FOR UPDATE SKIP LOCKED`. Sin Redis: un único servicio de datos que operar.
 */
export const QUEUES = {
  imports: 'imports',
  alertMatch: 'alerts-match',
  alertDigest: 'alerts-digest',
} as const;

const QUEUE_OPTIONS = {
  [QUEUES.imports]: { retryLimit: 2, retryDelay: 5, retryBackoff: true, expireInSeconds: 60 * 60 },
  [QUEUES.alertMatch]: { retryLimit: 4, retryDelay: 2, retryBackoff: true },
  [QUEUES.alertDigest]: { retryLimit: 1, retryDelay: 60 },
} as const;

export function createBoss(connectionString: string): PgBoss {
  return new PgBoss({ connectionString, application_name: 'portal-jobs' });
}

/** Arranca pg-boss (crea/migra su esquema) y asegura que existan las colas. Idempotente. */
export async function startBoss(boss: PgBoss): Promise<void> {
  await boss.start();
  for (const [name, options] of Object.entries(QUEUE_OPTIONS)) {
    if (!(await boss.getQueue(name))) await boss.createQueue(name, options);
  }
}

export class PgBossImportQueue implements ImportQueue {
  constructor(private readonly boss: PgBoss) {}

  async enqueue(jobId: string): Promise<void> {
    // id del job de cola = id de la importación: un segundo envío es ignorado (ON CONFLICT DO NOTHING).
    await this.boss.send(QUEUES.imports, { jobId }, { id: jobId });
  }
}

export class PgBossAlertQueue implements AlertQueue {
  constructor(private readonly boss: PgBoss) {}

  async enqueueMatch(listingIds: string[]): Promise<void> {
    await this.boss.send(QUEUES.alertMatch, { listingIds });
  }
}
