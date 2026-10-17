import {
  Argon2PasswordHasher
} from "./chunk-RLUFD6GR.js";
import {
  createPool,
  loadEnv
} from "./chunk-VVXHO5AN.js";

// src/cli/seed.ts
var env = loadEnv();
if (env.NODE_ENV === "production") throw new Error("El seed no se ejecuta en producci\xF3n");
var password = process.env["SEED_PASSWORD"] ?? "Demo12345!";
var pool = createPool(env.DATABASE_URL);
var hasher = new Argon2PasswordHasher();
try {
  const { rows } = await pool.query(
    `INSERT INTO agencies (name) VALUES ('Inmobiliaria Demo')
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`
  );
  const agencyId = rows[0].id;
  const passwordHash = await hasher.hash(password);
  const users = [
    { email: "admin@demo.test", name: "Admin Demo", role: "admin", agencyId },
    { email: "agente@demo.test", name: "Agente Demo", role: "agent", agencyId },
    { email: "cliente@demo.test", name: "Cliente Demo", role: "client", agencyId: null }
  ];
  for (const u of users) {
    await pool.query(
      `INSERT INTO users (email, name, password_hash, role, agency_id) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO NOTHING`,
      [u.email, u.name, passwordHash, u.role, u.agencyId]
    );
  }
  console.log(`Seed listo: ${users.map((u) => u.email).join(", ")} (contrase\xF1a = SEED_PASSWORD)`);
} finally {
  await pool.end();
}
//# sourceMappingURL=seed.js.map