import {
  createPool,
  loadEnv
} from "./chunk-VVXHO5AN.js";


import { resolve } from "path";


import { readdir, readFile } from "fs/promises";
import { join } from "path";
var LOCK_ID = 727001;
async function runMigrations(pool2, dir) {
  const client = await pool2.connect();
  const applied = [];
  try {
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_ID]);
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
    );
    const done = new Set(
      (await client.query("SELECT name FROM schema_migrations")).rows.map((r) => r.name)
    );
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await readFile(join(dir, file), "utf8");
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        applied.push(file);
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Fall\xF3 la migraci\xF3n ${file}: ${String(error)}`, { cause: error });
      }
    }
    return applied;
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]).catch(() => void 0);
    client.release();
  }
}


var env = loadEnv();
var pool = createPool(env.DATABASE_URL);
try {
  const applied = await runMigrations(pool, resolve(process.cwd(), "migrations"));
  console.log(applied.length ? `Migraciones aplicadas: ${applied.join(", ")}` : "Base de datos al d\xEDa");
} finally {
  await pool.end();
}
