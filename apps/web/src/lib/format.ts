import type { EventItem } from "../types";

const LOCALE = "ar-SA-u-ca-gregory-nu-latn";
const TZ = "Asia/Riyadh";

const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, ...options });
const dayFmt = fmt({ day: "numeric" });
const monthFmt = fmt({ month: "long" });
const monthShortFmt = fmt({ month: "short" });
const weekdayFmt = fmt({ weekday: "long" });
const timeFmt = fmt({ hour: "numeric", minute: "2-digit", hour12: true });
const fullFmt = fmt({ weekday: "long", day: "numeric", month: "long" });

export const dayNumber = (iso: string) => dayFmt.format(new Date(iso));
export const monthName = (iso: string) => monthFmt.format(new Date(iso));
export const monthShort = (iso: string) => monthShortFmt.format(new Date(iso));
export const weekdayName = (iso: string) => weekdayFmt.format(new Date(iso));
export const timeOfDay = (iso: string) => timeFmt.format(new Date(iso));
export const fullDate = (iso: string) => fullFmt.format(new Date(iso));

const DAY = 86_400_000;

function localDayIndex(iso: string): number {
  // days since epoch in Riyadh local time (UTC+3, no DST)
  return Math.floor((new Date(iso).getTime() + 3 * 3_600_000) / DAY);
}

export function sameLocalDay(a: string, b: string): boolean {
  return localDayIndex(a) === localDayIndex(b);
}

/** "الجمعة 24 أكتوبر · 8:30 م – 10:00 م" or "12 – 18 أكتوبر" for multi-day events. */
export function dateRange(event: Pick<EventItem, "startsAt" | "endsAt">): string {
  if (sameLocalDay(event.startsAt, event.endsAt)) {
    return `${fullDate(event.startsAt)} · ${timeOfDay(event.startsAt)} – ${timeOfDay(event.endsAt)}`;
  }
  const sameMonth = monthName(event.startsAt) === monthName(event.endsAt);
  return sameMonth
    ? `${dayNumber(event.startsAt)} – ${dayNumber(event.endsAt)} ${monthName(event.endsAt)}`
    : `${dayNumber(event.startsAt)} ${monthShort(event.startsAt)} – ${dayNumber(event.endsAt)} ${monthShort(event.endsAt)}`;
}

export function priceLabel(price: number): string {
  return price === 0 ? "مجاني" : `${Number.isInteger(price) ? price : price.toFixed(2)} ر.س`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("ar-SA-u-nu-latn").format(n);
}

export function money(n: number): string {
  return `${formatNumber(Math.round(n))} ر.س`;
}

export function distanceLabel(km: number | null | undefined): string | null {
  if (km === null || km === undefined) return null;
  return km < 1 ? `${Math.round(km * 1000)} م` : `${km.toFixed(1)} كم`;
}

/** Short relative label used on cards: "جارية الحين", "الليلة", "بكرة", "بعد 5 أيام". */
export function whenLabel(event: Pick<EventItem, "startsAt" | "endsAt" | "status">, now = new Date()): string {
  if (event.status === "ended") return "انتهت";
  if (event.status === "live") return sameLocalDay(event.startsAt, event.endsAt) ? "جارية الحين" : "مستمرة";
  const nowIso = now.toISOString();
  const diff = localDayIndex(event.startsAt) - localDayIndex(nowIso);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(new Date(event.startsAt)));
  if (diff === 0) return hour >= 17 || hour < 4 ? "الليلة" : "اليوم";
  if (diff === 1) return "بكرة";
  if (diff < 7) return `بعد ${diff} أيام`;
  return `بعد ${Math.round(diff / 7) === 1 ? "أسبوع" : `${Math.round(diff / 7)} أسابيع`}`;
}

export function seatsLabel(event: Pick<EventItem, "seatsLeft" | "capacity">): string | null {
  if (event.capacity === null || event.seatsLeft === null) return null;
  if (event.seatsLeft === 0) return "اكتمل العدد";
  if (event.seatsLeft <= Math.max(5, event.capacity * 0.1)) return `باقي ${event.seatsLeft} مقعد`;
  return `${event.seatsLeft} مقعد متاح`;
}

export function percent(n: number | null, digits = 0): string {
  return n === null ? "—" : `${n.toFixed(digits)}%`;
}
