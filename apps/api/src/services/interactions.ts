import { query, withTransaction } from "../db.js";

export interface InteractionInput {
  userId?: string | null;
  sessionId: string;
  eventId?: number | null;
  type: "view" | "share" | "search" | "favorite" | "unfavorite" | "book";
  meta?: Record<string, unknown>;
}

export async function recordInteraction(input: InteractionInput): Promise<void> {
  // One view per event/session per rolling 30 minutes, also across refreshes and API instances.
  if (input.type === 'view' && input.eventId) {
    await withTransaction(async (client) => {
      await query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`view:${input.eventId}:${input.sessionId}`], client);
      await query(`INSERT INTO interactions (user_id, session_id, event_id, type, meta)
        SELECT $1,$2,$3,'view',$4 WHERE NOT EXISTS (
          SELECT 1 FROM interactions WHERE event_id=$3 AND session_id=$2 AND type='view'
          AND created_at > now() - interval '30 minutes')`,
        [input.userId ?? null, input.sessionId, input.eventId, JSON.stringify(input.meta ?? {})], client);
    });
    return;
  }
  await query(
    "INSERT INTO interactions (user_id, session_id, event_id, type, meta) VALUES ($1,$2,$3,$4,$5)",
    [input.userId ?? null, input.sessionId, input.eventId ?? null, input.type, JSON.stringify(input.meta ?? {})]
  );
}
