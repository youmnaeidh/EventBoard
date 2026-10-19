import { api } from "./api";
import { getSessionId } from "./session";

type Source = "home" | "search" | "list" | "map" | "recommendation" | "assistant" | "shared";

const seen = new Set<string>();

/** Fire-and-forget behavioural tracking (views once per session per event, shares). */
export function trackView(eventId: number, source: Source = "list") {
  const key = `v${eventId}`;
  if (seen.has(key)) return;
  seen.add(key);
  api.post("/track", { type: "view", sessionId: getSessionId(), eventId, source }).catch(() => undefined);
}

export function trackShare(eventId: number) {
  api.post("/track", { type: "share", sessionId: getSessionId(), eventId }).catch(() => undefined);
}
