/** Riyadh has a fixed UTC+03 offset. Unknown multi-day hours are never called open now. */
export function isOpenNow(startsAt: Date, endsAt: Date, details: Record<string, unknown>, now = new Date()): boolean | null {
  const start = startsAt.getTime(), end = endsAt.getTime(), at = now.getTime();
  if (at < start || at > end) return false;
  const from = details.dailyStart, to = details.dailyEnd;
  if (typeof from !== 'string' || typeof to !== 'string' || !from || !to) return end - start <= 18 * 3_600_000 ? true : null;
  const local = new Date(at + 3 * 3_600_000).toISOString().slice(11, 16);
  return from < to ? local >= from && local < to : local >= from || local < to;
}
