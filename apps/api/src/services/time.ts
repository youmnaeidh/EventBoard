// Riyadh has no daylight-saving time (UTC+3 all year), so a fixed offset is exact.
export const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight (00:00) in Riyadh of the calendar day containing `date`, as a UTC Date. */
export function riyadhMidnight(date: Date): Date {
  const local = date.getTime() + RIYADH_OFFSET_MS;
  const midnightLocal = Math.floor(local / DAY_MS) * DAY_MS;
  return new Date(midnightLocal - RIYADH_OFFSET_MS);
}

/** Day of week in Riyadh: 0 = Sunday ... 6 = Saturday. */
export function riyadhWeekday(date: Date): number {
  return new Date(date.getTime() + RIYADH_OFFSET_MS).getUTCDay();
}

export function riyadhHour(date: Date): number {
  const d = new Date(date.getTime() + RIYADH_OFFSET_MS);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

export interface TimeWindow {
  from: Date;
  to: Date;
}

/**
 * Named windows used by the `when` filter. An event matches a window when it overlaps it
 * (starts before the window ends and ends after the window starts).
 */
export function timeWindow(name: "today" | "tonight" | "tomorrow" | "weekend" | "week", now: Date): TimeWindow {
  const today = riyadhMidnight(now);
  const at = (days: number, hour = 0) => new Date(today.getTime() + days * DAY_MS + hour * 3_600_000);
  switch (name) {
    case "today":
      return { from: now, to: at(1) };
    case "tonight":
      // 5pm today until 4am tomorrow
      return { from: new Date(Math.max(now.getTime(), at(0, 17).getTime())), to: at(1, 4) };
    case "tomorrow":
      return { from: at(1), to: at(2) };
    case "weekend": {
      // Saudi weekend = Friday + Saturday. Find the next Friday (or today if it is Fri/Sat).
      const weekday = riyadhWeekday(now);
      const toFriday = weekday === 6 ? -1 : (5 - weekday + 7) % 7;
      const friday = at(toFriday);
      return { from: new Date(Math.max(now.getTime(), friday.getTime())), to: new Date(friday.getTime() + 2 * DAY_MS) };
    }
    case "week":
      return { from: now, to: at(7) };
  }
}
