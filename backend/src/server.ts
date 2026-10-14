import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pool } from './infrastructure/database/pool.js';

const app = express();

app.disable('x-powered-by');
app.use(helmet());

app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
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

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`API disponible en el puerto ${port}`);
});
