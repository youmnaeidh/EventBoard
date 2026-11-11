import { describe, expect, it } from "vitest";
import { fallbackSearch, searchConstraints, withinConstraints } from "../src/services/searchConstraints.js";

const now = new Date("2026-10-27T10:00:00Z");
const event = (price: number, startsAt = "2026-10-27T17:00:00Z") => ({
  title: "تجربة القهوة", summary: "تذوق قهوة مختصة", eventType: "تجربة",
  venue: "مساحة القهوة", district: "قباء", audience: "الجميع", price, startsAt,
  endsAt: new Date(new Date(startsAt).getTime() + 3600000).toISOString()
});

describe("hard search constraints during AI outages", () => {
  it("never substitutes paid coffee for free coffee", () => {
    expect(fallbackSearch("قهوة مجانية", [event(0), event(30), event(55)], now).map(r => r.event.price)).toEqual([0]);
  });
  it.each(["مجانا", "ببلاش", "بدون رسوم"])("honours %s without requiring a topic", q => {
    expect(fallbackSearch(q, [event(0),event(20)], now)).toHaveLength(1);
  });
  it("does not treat غير مجاني as free", () => {
    const c = searchConstraints("قهوة غير مجانية");
    expect(c.paid).toBe(true);
    expect(withinConstraints(event(0), c, now)).toBe(false);
  });
  it("normalises Arabic budget digits and honours an inclusive cap", () => {
    const c = searchConstraints("قهوة بحد ٥٠");
    expect(withinConstraints(event(50), c, now)).toBe(true);
    expect(withinConstraints(event(55), c, now)).toBe(false);
  });
  it("honours strict less-than wording", () => {
    expect(withinConstraints(event(50), searchConstraints("قهوة أقل من ٥٠ ريال"), now)).toBe(false);
  });
  it("honours tomorrow without relaxing the day", () => {
    const c = searchConstraints("قهوة بكرة");
    expect(withinConstraints(event(0), c, now)).toBe(false);
    expect(withinConstraints(event(0,"2026-10-28T17:00:00Z"), c, now)).toBe(true);
  });
  it("keeps both time and price constraints", () => {
    const rows = fallbackSearch("قهوة مجانية بكرة", [event(0), event(20,"2026-10-28T17:00:00Z"), event(0,"2026-10-28T17:00:00Z")], now);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.event.price).toBe(0);
  });
});
