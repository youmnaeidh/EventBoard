import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../migrations");

export async function migrate(log: (message: string) => void = console.log): Promise<void> {
  const client = await pool.connect();
  try {
    // Advisory lock so two instances starting together do not race.
    await client.query("SELECT pg_advisory_lock(727001)");
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    const applied = new Set((await client.query("SELECT name FROM schema_migrations")).rows.map((r) => r.name as string));
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await readFile(path.join(dir, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        log(`applied ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(727001)").catch(() => undefined);
    client.release();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  migrate()
    .then(() => pool.end())
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
