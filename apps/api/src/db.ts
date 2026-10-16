import pg from "pg";
import { config } from "./config.js";

// Return numeric/bigint as JS numbers (safe for our value ranges) instead of strings.
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  ssl: config.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  max: 10
});

export type Queryable = Pick<pg.PoolClient, "query">;

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
  client: Queryable = pool
): Promise<T[]> {
  const result = await client.query<T>(text, params as never[]);
  return result.rows;
}

export async function one<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
  client: Queryable = pool
): Promise<T | null> {
  const rows = await query<T>(text, params, client);
  return rows[0] ?? null;
}

export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
