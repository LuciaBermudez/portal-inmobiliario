import type { Role } from '@portal/shared';
import { loadEnv } from '../config/env';
import { createPool } from '../infrastructure/db/pool';
import { Argon2PasswordHasher } from '../infrastructure/security/argon2-password-hasher';

const env = loadEnv();
if (env.NODE_ENV === 'production') throw new Error('El seed no se ejecuta en producción');

const password = process.env['SEED_PASSWORD'] ?? 'Demo12345!';
const pool = createPool(env.DATABASE_URL);
const hasher = new Argon2PasswordHasher();

try {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO agencies (name) VALUES ('Inmobiliaria Demo')
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
  );
  const agencyId = rows[0]!.id;
  const passwordHash = await hasher.hash(password);

  const users: Array<{ email: string; name: string; role: Role; agencyId: string | null }> = [
    { email: 'admin@demo.test', name: 'Admin Demo', role: 'admin', agencyId },
    { email: 'agente@demo.test', name: 'Agente Demo', role: 'agent', agencyId },
    { email: 'cliente@demo.test', name: 'Cliente Demo', role: 'client', agencyId: null },
  ];
  for (const u of users) {
    await pool.query(
      `INSERT INTO users (email, name, password_hash, role, agency_id) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO NOTHING`,
      [u.email, u.name, passwordHash, u.role, u.agencyId],
    );
  }
  console.log(`Seed listo: ${users.map((u) => u.email).join(', ')} (contraseña = SEED_PASSWORD)`);
} finally {
  await pool.end();
}
