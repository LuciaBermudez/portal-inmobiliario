import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Container } from '../../container';
import { errorHandler } from './error-handler';
import { notificationRoutes, zoneRoutes } from './routes/alerts.routes';
import { authRoutes } from './routes/auth.routes';
import { importRoutes } from './routes/imports.routes';
import { listingRoutes, tileRoutes } from './routes/listings.routes';

export async function buildServer(c: Container): Promise<FastifyInstance> {
  const { env } = c;
  const app = Fastify({
    logger: env.NODE_ENV === 'test' ? false : { level: env.NODE_ENV === 'production' ? 'info' : 'debug' },
    trustProxy: true,
    bodyLimit: 1024 * 1024,
  });

  app.decorateRequest('actor', null);
  app.setErrorHandler(errorHandler);

  // Las teselas se piden desde otro origen en algunos despliegues: CORP cross-origin.
  await app.register(helmet, { crossOriginResourcePolicy: { policy: 'cross-origin' } });
  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['content-type', 'authorization', 'idempotency-key'],
  });
  await app.register(cookie);
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });
  await app.register(multipart, { limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 } });

  app.get('/api/health', async () => {
    await c.pool.query('SELECT 1');
    return { status: 'ok' };
  });

  await app.register(authRoutes(c), { prefix: '/api/auth' });
  await app.register(listingRoutes(c), { prefix: '/api/listings' });
  await app.register(tileRoutes(c), { prefix: '/api/tiles' });
  await app.register(importRoutes(c), { prefix: '/api/imports' });
  await app.register(zoneRoutes(c), { prefix: '/api/zones' });
  await app.register(notificationRoutes(c), { prefix: '/api/notifications' });

  return app;
}
