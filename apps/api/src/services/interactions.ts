import { query } from "../db.js";

export interface InteractionInput {
  userId?: string | null;
  sessionId: string;
  eventId?: number | null;
  type: "view" | "share" | "search" | "favorite" | "unfavorite" | "book";
  meta?: Record<string, unknown>;
}

export async function recordInteraction(input: InteractionInput): Promise<void> {
  await query(
    "INSERT INTO interactions (user_id, session_id, event_id, type, meta) VALUES ($1,$2,$3,$4,$5)",
    [input.userId ?? null, input.sessionId, input.eventId ?? null, input.type, JSON.stringify(input.meta ?? {})]
  );
}
