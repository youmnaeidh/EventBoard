import { describe, expect, it } from "vitest";
import { dateRange, distanceLabel, priceLabel, seatsLabel, whenLabel } from "./format";

describe("format", () => {
  it("formats prices and distances", () => {
    expect(priceLabel(0)).toBe("مجاني");
    expect(priceLabel(45)).toBe("45 ر.س");
    expect(distanceLabel(0.4)).toBe("400 م");
    expect(distanceLabel(3.26)).toBe("3.3 كم");
    expect(distanceLabel(null)).toBeNull();
  });

  it("uses Riyadh time and the Gregorian calendar with Latin digits", () => {
    // 2026-10-11T15:30Z is 18:30 in Riyadh
    const text = dateRange({ startsAt: "2026-10-11T15:30:00Z", endsAt: "2026-10-11T18:00:00Z" });
    expect(text).toContain("6:30 م");
    expect(text).toContain("9:00 م");
    expect(text).toMatch(/أكتوبر/);
    expect(text).not.toMatch(/[٠-٩]/);
  });

  it("describes multi-day ranges", () => {
    expect(dateRange({ startsAt: "2026-10-12T13:00:00Z", endsAt: "2026-10-18T20:00:00Z" })).toMatch(/12 – 18 أكتوبر/);
  });

  it("labels time relative to now", () => {
    const now = new Date("2026-10-11T15:30:00Z"); // Sunday 18:30 Riyadh
    const ev = (startsAt: string, status: "upcoming" | "live" | "ended" = "upcoming") => ({ startsAt, endsAt: startsAt, status });
    expect(whenLabel(ev("2026-10-11T18:00:00Z"), now)).toBe("الليلة");
    expect(whenLabel(ev("2026-10-12T14:00:00Z"), now)).toBe("بكرة");
    expect(whenLabel(ev("2026-10-14T14:00:00Z"), now)).toBe("بعد 3 أيام");
    expect(whenLabel(ev("2026-10-11T12:00:00Z", "live"), now)).toBe("جارية الحين");
  });

  it("flags low seat counts", () => {
    expect(seatsLabel({ capacity: 100, seatsLeft: 0 })).toBe("اكتمل العدد");
    expect(seatsLabel({ capacity: 100, seatsLeft: 7 })).toBe("باقي 7 مقعد");
    expect(seatsLabel({ capacity: 100, seatsLeft: 60 })).toBe("60 مقعد متاح");
    expect(seatsLabel({ capacity: null, seatsLeft: null })).toBeNull();
  });
});
