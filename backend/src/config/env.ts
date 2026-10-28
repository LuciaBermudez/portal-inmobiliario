import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET debe tener al menos 32 caracteres'),
    ACCESS_TOKEN_TTL: z.string().default('15m'),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
    CORS_ORIGIN: z.string().default('http://localhost:5173'),
    COOKIE_SECURE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    COOKIE_SAMESITE: z.enum(['strict', 'lax', 'none']).default('strict'),
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    UPLOADS_DIR: z.string().default('./uploads'),
    S3_BUCKET: z.string().optional(),
    S3_REGION: z.string().default('us-east-1'),
    S3_ENDPOINT: z.string().optional(),
    MAX_UPLOAD_MB: z.coerce.number().positive().default(200),
    IMPORT_BATCH_SIZE: z.coerce.number().int().min(100).max(20_000).default(2000),
    DIGEST_CRON: z.string().default('0 8 * * *'),
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE_DRIVER === 's3' && !env.S3_BUCKET) {
      ctx.addIssue({ code: 'custom', path: ['S3_BUCKET'], message: 'S3_BUCKET es obligatorio con STORAGE_DRIVER=s3' });
    }
    if (env.COOKIE_SAMESITE === 'none' && !env.COOKIE_SECURE) {
      ctx.addIssue({ code: 'custom', path: ['COOKIE_SECURE'], message: 'SameSite=None exige COOKIE_SECURE=true' });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

/** Carga `.env` (backend/ o la raíz del repo) sin sobrescribir variables ya definidas. */
function loadDotEnv(): void {
  for (const file of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../.env')]) {
    if (existsSync(file)) {
      process.loadEnvFile(file);
      return;
    }
  }
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (source === process.env) loadDotEnv();
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuración inválida:\n${details}`);
  }
  return result.data;
}
