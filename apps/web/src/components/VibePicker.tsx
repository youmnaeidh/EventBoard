import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { getSessionId } from "../lib/session";
import { useUserLocation } from "../context/LocationContext";
import { EventCard } from "./EventRow";
import { Icon } from "./Icon";
import type { SearchResponse } from "../types";

interface Vibe {
  key: string;
  label: string;
  hint: string;
  /** Plain-Arabic query sent to the same smart search the search box uses. */
  query: string;
  bg: string;
  fg: string;
}

export const VIBES: Vibe[] = [
  { key: "learn", label: "أتعلّم شي بيدي", hint: "ورش ودورات قصيرة", query: "ورشة اتعلم فيها", bg: "#ab88fc", fg: "#25122f" },
  { key: "out", label: "طلعة وهواء", hint: "جبال وغروب ومشي", query: "رحلة طلعة جبل", bg: "#63cc9c", fg: "#25122f" },
  { key: "coffee", label: "قهوة وسوالف", hint: "هادي وقريب", query: "قهوة وسوالف هادية", bg: "#feb96c", fg: "#25122f" },
  { key: "art", label: "فن وأمسيات", hint: "معارض وثقافة", query: "فن وثقافة ومعارض", bg: "#fd84b4", fg: "#25122f" },
  { key: "family", label: "طلعة عيلة", hint: "للصغار والكبار", query: "نشاط للعائلة والاطفال", bg: "#ff8f5a", fg: "#25122f" },
  { key: "heritage", label: "تراث وأصالة", hint: "أسواق ومهرجانات", query: "تراث واصالة المدينة", bg: "#72abfe", fg: "#25122f" }
];

const WHEN = [
  { key: "any", label: "أي وقت", word: "" },
  { key: "tonight", label: "الليلة", word: " الليلة" },
  { key: "weekend", label: "نهاية الأسبوع", word: " نهاية الاسبوع" }
] as const;

/**
 * "What's your vibe?" — one tap on a mood and one on a time window sends a plain-Arabic query to the real
 * smart-search endpoint; the posters below are its ranked results, each with the reason it matched.
 */
export function VibePicker() {
  const loc = useUserLocation();
  const [vibe, setVibe] = useState<Vibe | null>(null);
  const [when, setWhen] = useState<(typeof WHEN)[number]["key"]>("any");
  const word = WHEN.find((w) => w.key === when)?.word ?? "";
  const q = vibe ? `${vibe.query}${word}` : "";

  const result = useQuery({
    enabled: !!vibe,
    queryKey: ["vibe", q, loc.coords && `${loc.coords.lat},${loc.coords.lng}`],
    queryFn: () => api.get<SearchResponse>("/search", { q, sessionId: getSessionId(), lat: loc.coords?.lat, lng: loc.coords?.lng, limit: 4 })
  });

  const items = result.data?.results ?? [];

  return (
    <section className="vibe" id="vibe" style={{ ["--vibe-bg" as string]: vibe?.bg ?? "#25122f", ["--vibe-fg" as string]: vibe ? vibe.fg : "#fff7ec" }} aria-labelledby="vibe-h">
      <div className="container vibe-inner">
        <header className="vibe-head">
          <h2 id="vibe-h">وش مزاجك؟</h2>
          <p>اختر اللي تحس فيه، ونطلع لك فعاليات تناسبه من اللي موجود فعلًا.</p>
        </header>

        <div className="vibe-grid" role="group" aria-label="المزاج">
          {VIBES.map((v) => (
            <button
              key={v.key}
              type="button"
              className={`vibe-tile ${vibe?.key === v.key ? "is-on" : ""}`}
              style={{ ["--tile" as string]: v.bg }}
              aria-pressed={vibe?.key === v.key}
              onClick={() => setVibe(vibe?.key === v.key ? null : v)}
            >
              <strong>{v.label}</strong>
              <span>{v.hint}</span>
            </button>
          ))}
        </div>

        <div className="vibe-when" role="group" aria-label="الوقت">
          <span>متى؟</span>
          {WHEN.map((w) => (
            <button key={w.key} type="button" className={`vibe-chip ${when === w.key ? "is-on" : ""}`} aria-pressed={when === w.key} onClick={() => setWhen(w.key)}>{w.label}</button>
          ))}
        </div>

        <div className="vibe-out" aria-live="polite">
          {!vibe ? null : result.isLoading ? (
            <div className="vibe-posters">{[0, 1, 2, 3].map((i) => <i key={i} className="skel ecard-skel" />)}</div>
          ) : result.isError ? (
            <p className="vibe-note">تعذّر تحميل النتائج. جرّب مرة ثانية.</p>
          ) : items.length === 0 ? (
            <p className="vibe-note">ما لقينا شي يطابق هذا المزاج في هذا الوقت. جرّب «أي وقت».</p>
          ) : (
            <>
              {result.data?.relaxed && <p className="vibe-note"><Icon name="info" size={17} />ما فيه تطابق كامل مع الوقت، فخفّفنا الشرط وهذي أقرب النتائج.</p>}
              <div className="vibe-posters">
                {items.map((r) => <EventCard key={r.event.id} event={r.event} reasons={r.reasons} source="search" />)}
              </div>
              <Link to={`/events?q=${encodeURIComponent(q)}`} className="vibe-more">كل النتائج<Icon name="arrow" size={18} /></Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
