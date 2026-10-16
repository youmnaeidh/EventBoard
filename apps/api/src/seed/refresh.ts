import { pool } from "../db.js";
import { riyadhMidnight } from "../services/time.js";

const DAY_MS = 24 * 3_600_000;

/**
 * Shifts every *sample* row forward by whole days so the sample calendar keeps the same shape
 * relative to today (events "tonight", "this weekend", a few that just ended...).
 * Rows created by real users are never touched. Returns the number of days shifted.
 */
export async function refreshSampleDates(now = new Date()): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(727002)");
    const row = (await client.query("SELECT value FROM app_meta WHERE key = 'sample_anchor'")).rows[0] as
      | { value: string }
      | undefined;
    const today = riyadhMidnight(now);
    if (!row) {
      await client.query("INSERT INTO app_meta (key, value) VALUES ('sample_anchor', $1)", [today.toISOString()]);
      await client.query("COMMIT");
      return 0;
    }
    const days = Math.round((today.getTime() - new Date(row.value).getTime()) / DAY_MS);
    if (days <= 0) {
      await client.query("COMMIT");
      return 0;
    }
    const interval = `${days} days`;
    await client.query(
      `UPDATE events SET starts_at = starts_at + $1::interval, ends_at = ends_at + $1::interval,
         created_at = created_at + $1::interval WHERE is_sample`,
      [interval]
    );
    await client.query("UPDATE interactions SET created_at = created_at + $1::interval WHERE is_sample", [interval]);
    await client.query(
      `UPDATE bookings SET created_at = created_at + $1::interval,
         cancelled_at = cancelled_at + $1::interval
       WHERE event_id IN (SELECT id FROM events WHERE is_sample)`,
      [interval]
    );
    await client.query(
      "UPDATE reviews SET created_at = created_at + $1::interval WHERE event_id IN (SELECT id FROM events WHERE is_sample)",
      [interval]
    );
    await client.query("UPDATE app_meta SET value = $1 WHERE key = 'sample_anchor'", [today.toISOString()]);
    await client.query("COMMIT");
    return days;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
