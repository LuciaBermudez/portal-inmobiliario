import { z } from 'zod';
import { loadEnv } from './config/env';
import { createContainer } from './container';
import { QUEUES, startBoss } from './infrastructure/queue/pg-boss-queues';

/**
 * Proceso worker (se despliega aparte de la API), con colas sobre PostgreSQL (pg-boss):
 *  - `imports`:       pipeline de carga masiva
 *  - `alerts-match`:  cruce de avisos nuevos con zonas
 *  - `alerts-digest`: resumen diario programado (cron)
 */
const env = loadEnv();
const container = createContainer(env, 'worker');
const { boss, useCases, logger } = container;

const ImportJobData = z.object({ jobId: z.string().uuid() });
const MatchJobData = z.object({ listingIds: z.array(z.string().uuid()) });

boss.on('error', (error) => logger.error('pg-boss', { error: error.message }));
await startBoss(boss);

await boss.work(QUEUES.imports, { includeMetadata: true, localConcurrency: 2 }, async ([job]) => {
  if (!job) return;
  const { jobId } = ImportJobData.parse(job.data);
  // retryCount empieza en 0: el último intento es cuando ya se usaron todos los reintentos.
  const isFinalAttempt = job.retryCount >= job.retryLimit;
  await useCases.processImport.execute(jobId, { isFinalAttempt });
});

await boss.work(QUEUES.alertMatch, { localConcurrency: 4 }, async ([job]) => {
  if (!job) return;
  const { listingIds } = MatchJobData.parse(job.data);
  return { notified: await useCases.matchNewListings.execute(listingIds) };
});

await boss.work(QUEUES.alertDigest, async () => ({ digests: await useCases.sendDailyDigests.execute() }));

// Alertas programadas: schedule es un upsert, seguro aunque arranquen varios workers.
await boss.schedule(QUEUES.alertDigest, env.DIGEST_CRON);

logger.info('worker listo', { queues: Object.values(QUEUES), digestCron: env.DIGEST_CRON });

let closing = false;
async function shutdown(): Promise<void> {
  if (closing) return;
  closing = true;
  // graceful: espera a que terminen los jobs en curso (cada lote es transaccional, no quedan a medias).
  await boss.stop({ graceful: true });
  await container.close();
  process.exit(0);
}

process.once('SIGTERM', () => void shutdown());
process.once('SIGINT', () => void shutdown());
