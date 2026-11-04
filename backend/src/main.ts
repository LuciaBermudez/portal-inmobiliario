import { loadEnv } from './config/env';
import { createContainer } from './container';
import { startBoss } from './infrastructure/queue/pg-boss-queues';
import { PgEventListener } from './infrastructure/realtime/pg-event-bus';
import { buildServer } from './interfaces/http/server';
import { attachRealtime } from './interfaces/ws/socket-server';

const env = loadEnv();
const container = createContainer(env, 'api');
// La API encola importaciones: asegura el esquema de pg-boss y las colas aunque el worker aún no arranque.
container.boss.on('error', (error) => container.logger.error('pg-boss', { error: error.message }));
await startBoss(container.boss);
const app = await buildServer(container);
const realtime = attachRealtime(app.server, { tokens: container.tokens, corsOrigin: env.CORS_ORIGIN });
const listener = new PgEventListener(env.DATABASE_URL, realtime.deliver, container.logger);
await listener.start();

await app.listen({ host: '0.0.0.0', port: env.PORT });

let closing = false;
async function shutdown(signal: string): Promise<void> {
  if (closing) return;
  closing = true;
  app.log.info({ signal }, 'cerrando API');
  realtime.io.disconnectSockets(true);
  await app.close();
  await listener.stop();
  await container.boss.stop({ graceful: true });
  await container.close();
  process.exit(0);
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));
