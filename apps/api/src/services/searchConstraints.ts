import { timeWindow } from "./time.js";

export function normaliseSearch(text: string): string {
  return text.toLowerCase().replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632)).replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");
}

export function searchConstraints(query: string) {
  const q = normaliseSearch(query);
  const paid = /(?:غير مجاني|مو مجاني|مدفوع|بفلوس)/.test(q);
  const free = !paid && /(?:مجان|ببلاش|بلاش|بدون رسوم)/.test(q);
  const budget = q.match(/(?:اقل من|تحت|بحد|ميزانيتي|ما يتجاوز|لحد|حد اقصى)\s*(\d+(?:\.\d+)?)/) ?? q.match(/(\d+(?:\.\d+)?)\s*(?:ريال|ر\.س)/);
  const when = /نهايه الاسبوع|ويكند/.test(q) ? "weekend" : /بكره|غدا/.test(q) ? "tomorrow" : /الليله/.test(q) ? "tonight" : /اليوم/.test(q) ? "today" : /هذا الاسبوع/.test(q) ? "week" : undefined;
  return { free, paid, maxPrice: free ? 0 : budget ? Number(budget[1]) : undefined, priceExclusive: !free && !!budget && /اقل من|تحت/.test(q), when } as { free: boolean; paid: boolean; maxPrice?: number; priceExclusive: boolean; when?: "weekend" | "tomorrow" | "tonight" | "today" | "week" };
}

export function withinConstraints(event: { price: number; startsAt: string; endsAt: string }, constraints: ReturnType<typeof searchConstraints>, now = new Date()) {
  if (constraints.free && event.price !== 0) return false;
  if (constraints.paid && event.price <= 0) return false;
  if (constraints.maxPrice !== undefined && (constraints.priceExclusive ? event.price >= constraints.maxPrice : event.price > constraints.maxPrice)) return false;
  if (constraints.when) {
    const w = timeWindow(constraints.when, now);
    if (new Date(event.startsAt) >= w.to || new Date(event.endsAt) <= w.from) return false;
  }
  return true;
}

const stop = new Set("ابغي ابي ابغى ودي شي شيء فعاليه فعاليات مجاني مجانيه مجانا بلاش ببلاش بدون رسوم غير مو مدفوع مدفوعه بفلوس الليله اليوم بكره غدا نهايه الاسبوع ويكند هذا اقل من تحت بحد ميزانيتي ما يتجاوز لحد حد اقصى ريال ر س في عن و عندي لي انا اريد".split(" "));
export function fallbackSearch<T extends { title: string; summary: string; eventType: string; venue: string; district: string; audience: string; price: number; startsAt: string; endsAt: string }>(query: string, events: T[], now = new Date()) {
  const constraints = searchConstraints(query);
  const tokens = normaliseSearch(query).split(/\s+/).filter(t => t.length > 1 && !stop.has(t) && !/^\d/.test(t));
  return events.filter(e => withinConstraints(e, constraints, now)).map(event => {
    const hay = normaliseSearch([event.title, event.summary, event.eventType, event.venue, event.district, event.audience].join(" "));
    const hits = tokens.filter(t => hay.includes(t)).length;
    return { event, score: tokens.length ? hits / tokens.length : 1, reasons: ["تطابق مع البحث والقيود المحددة"] };
  }).filter(r => r.score > 0).sort((a,b) => b.score - a.score);
}
