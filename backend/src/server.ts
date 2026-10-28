
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { loadEnv } from './config/env.js';

const env = loadEnv();
const { pool } = await import('./infrastructure/database/pool.js');

const app = express();

app.disable('x-powered-by');
app.use(helmet());

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');

    res.status(200).json({
      status: 'ok',
      database: 'connected',
      message: 'Portal Inmobiliario API funcionando',
    });
  } catch (error) {
    console.error(
      'No se pudo comprobar la conexión con PostgreSQL:',
      error instanceof Error ? error.message : 'Error desconocido',
    );

    res.status(503).json({
      status: 'error',
      database: 'disconnected',
    });
  }
});

app.use((_req, res) => {
  res.status(404).json({
    error: 'Recurso no encontrado',
  });
});

app.listen(env.PORT, () => {
  console.log(`API disponible en el puerto ${env.PORT}`);
});
