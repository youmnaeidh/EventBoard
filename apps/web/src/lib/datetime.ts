const OFFSET_MS = 3 * 3_600_000; // Asia/Riyadh, no DST

/** ISO instant -> value for <input type="datetime-local"> in Riyadh time. */
export function toLocalInput(iso: string): string {
  return new Date(new Date(iso).getTime() + OFFSET_MS).toISOString().slice(0, 16);
}

/** <input type="datetime-local"> value (Riyadh wall clock) -> ISO instant. */
export function fromLocalInput(value: string): string {
  return new Date(`${value}:00+03:00`).toISOString();
}

export function localNowInput(plusHours = 0): string {
  return toLocalInput(new Date(Date.now() + plusHours * 3_600_000).toISOString());
}

/** Move a local start so it lands on the next occurrence (weekday 0=Sunday) at `hour`, never earlier than `from`. */
export function nextSlot(fromLocal: string, weekday: number, hour: number): string {
  const base = new Date(`${fromLocal}:00Z`); // treat as UTC fields = Riyadh wall clock
  const day = base.getUTCDay();
  let delta = (weekday - day + 7) % 7;
  const candidate = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + delta, Math.floor(hour), Math.round((hour % 1) * 60)));
  if (candidate <= new Date(Date.now() + OFFSET_MS)) delta += 7;
  const out = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + delta, Math.floor(hour), Math.round((hour % 1) * 60)));
  return out.toISOString().slice(0, 16);
}

export function hoursBetween(startIso: string, endIso: string): number {
  return Math.max(0.5, (new Date(endIso).getTime() - new Date(startIso).getTime()) / 3_600_000);
}
