import { lazy, Suspense, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EventCard, EventRow, EventRowSkeleton } from "../components/EventRow";
import { Icon } from "../components/Icon";
import { SmartSearch } from "../components/SmartSearch";
import { Empty, ErrorBox } from "../components/ui";
import { useUserLocation } from "../context/LocationContext";
import { api } from "../lib/api";
import { getSessionId } from "../lib/session";
import { useDocTitle } from "../lib/useDocTitle";
import type { EventItem, SearchResponse } from "../types";

const MapView = lazy(() => import("../components/MapView"));

const WHEN = [
  ["", "الكل"],
  ["today", "اليوم"],
  ["tomorrow", "بكرة"],
  ["weekend", "نهاية الأسبوع"],
  ["week", "هذا الأسبوع"]
] as const;
const SORTS = [
  ["soonest", "الأقرب موعدًا"],
  ["nearest", "الأقرب مسافة"],
  ["popular", "الأكثر إقبالًا"],
  ["newest", "الأحدث"],
  ["rating", "الأعلى تقييمًا"]
] as const;
const PAGE = 12;

export default function Events() {
  const [sp, setSp] = useSearchParams();
  const loc = useUserLocation();
  const [visible, setVisible] = useState(PAGE);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const q = sp.get("q")?.trim() ?? "";
  const category = sp.get("category") ?? "";
  const district = sp.get("district") ?? "";
  const price = sp.get("price") ?? "";
  const when = sp.get("when") === "tonight" ? "today" : sp.get("when") ?? "";
  const sort = sp.get("sort") ?? "soonest";
  const view = sp.get("view") === "map" ? "map" : sp.get("view") === "cards" ? "cards" : "list";
  const booking = sp.get("booking") ?? "";

  useDocTitle(q ? `نتائج «${q}»` : "الفعاليات");

  function set(patch: Record<string, string>) {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setSp(next, { replace: true });
    setVisible(PAGE);
  }

  const coords = loc.coords;
  const effectiveSort = sort === "nearest" && !coords ? "soonest" : sort;

  const browse = useQuery({
    enabled: !q,
    queryKey: ["events", "browse", { category, district, price, when, effectiveSort, booking, c: coords && `${coords.lat},${coords.lng}` }],
    queryFn: () =>
      api.get<{ events: EventItem[]; total: number }>("/events", {
        category, district, price, when, booking, sort: effectiveSort, limit: 100, lat: coords?.lat, lng: coords?.lng
      })
  });
  const search = useQuery({
    enabled: !!q,
    queryKey: ["search", { q, category, district, price, c: coords && `${coords.lat},${coords.lng}` }],
    queryFn: () => api.get<SearchResponse>("/search", { q, category, district, price, sessionId: getSessionId(), lat: coords?.lat, lng: coords?.lng, limit: 50 })
  });

  const active = q ? search : browse;
  const items: { event: EventItem; reasons?: string[] }[] = useMemo(() => {
    if (q) return (search.data?.results ?? []).map((r) => ({ event: r.event, reasons: r.reasons }));
    return (browse.data?.events ?? []).map((event) => ({ event }));
  }, [q, search.data, browse.data]);

  const shown = items.slice(0, visible);
  const filtersActive = !!(category || district || price || when || booking);

  return (
    <div className="container events-page">
      <div className="events-head">
        <h1>{q ? "نتائج البحث" : "الفعاليات"}</h1>
        <SmartSearch key={q} initial={q} onSubmit={(v) => set({ q: v, when: "", sort: "" })} />
        {q && (
          <div className="interp" aria-live="polite">
            {search.data && search.data.chips.length > 0 && (
              <>
                <span className="interp-label"><Icon name="sparkle" size={15} />فهمت من كلامك:</span>
                {search.data.chips.map((c) => <span key={c} className="chip chip-soft">{c}</span>)}
              </>
            )}
            {search.data?.mode === "basic" && <span className="hint hint-warn">البحث الذكي غير متاح الحين، نعرض تطابق الكلمات فقط.</span>}
            <button type="button" className="link-btn" onClick={() => set({ q: "" })}>مسح البحث</button>
          </div>
        )}
      </div>

      <div className="toolbar">
        {!q && (
          <div className="pill-group" role="group" aria-label="الوقت">
            {WHEN.map(([v, label]) => (
              <button key={v} type="button" className={`pill ${when === v ? "is-on" : ""}`} aria-pressed={when === v} onClick={() => set({ when: v })}>{label}</button>
            ))}
          </div>
        )}
        <div className="selects">
          <select value={category} onChange={(e) => set({ category: e.target.value })} aria-label="الفئة">
            <option value="">كل الفئات</option>
            {loc.meta?.categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={district} onChange={(e) => set({ district: e.target.value })} aria-label="الحي">
            <option value="">كل الأحياء</option>
            {loc.meta?.districts.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
          </select>
          <select value={price} onChange={(e) => set({ price: e.target.value })} aria-label="السعر">
            <option value="">أي سعر</option>
            <option value="free">مجانية</option>
            <option value="paid">مدفوعة</option>
          </select>
          {!q && (
            <select value={effectiveSort} onChange={(e) => set({ sort: e.target.value })} aria-label="الترتيب">
              {SORTS.map(([v, label]) => <option key={v} value={v} disabled={v === "nearest" && !coords}>{label}{v === "nearest" && !coords ? " (حدد موقعك)" : ""}</option>)}
            </select>
          )}
        </div>
        <div className="view-toggle" role="group" aria-label="طريقة العرض">
          <button type="button" className={view === "list" ? "is-on" : ""} aria-pressed={view === "list"} onClick={() => set({ view: "" })}><Icon name="list" size={17} />قائمة</button>
          <button type="button" className={view === "cards" ? "is-on" : ""} aria-pressed={view === "cards"} onClick={() => set({ view: "cards" })}>بطاقات</button>
          <button type="button" className={view === "map" ? "is-on" : ""} aria-pressed={view === "map"} onClick={() => set({ view: "map" })}><Icon name="map" size={17} />خريطة</button>
        </div>
      </div>

      {q && search.data?.relaxed && items.length > 0 && (
        <p className="notice"><Icon name="info" size={18} />ما لقينا تطابق كامل مع كل شروطك، فخفّفنا بعضها وهذي أقرب النتائج.</p>
      )}

      <p className="result-count" aria-live="polite">
        {active.isLoading ? "جاري التحميل…" : <><b className="num">{items.length}</b> {items.length === 1 ? "فعالية" : "فعالية"}</>}
        {filtersActive && <button type="button" className="link-btn" onClick={() => set({ category: "", district: "", price: "", when: "", booking: "" })}>إزالة الفلاتر</button>}
      </p>

      {active.isError ? (
        <ErrorBox onRetry={() => active.refetch()} />
      ) : view === "map" ? (
        <div className="map-layout"><Suspense fallback={<div className="map skel" />}><MapView events={items.map((i) => i.event)} user={coords} selectedId={selectedId} onSelect={setSelectedId} /></Suspense>
          <div className="map-event-list" aria-label="فعاليات الخريطة">{items.map(({event})=><button key={event.id} type="button" aria-pressed={selectedId===event.id} className={selectedId===event.id?'is-on':''} onClick={()=>setSelectedId(event.id)}>{event.title}<small>{event.venue}</small></button>)}</div>
        </div>
      ) : active.isLoading ? (
        <div className="rows"><EventRowSkeleton /><EventRowSkeleton /><EventRowSkeleton /></div>
      ) : items.length === 0 ? (
        <Empty title={q ? `ما لقينا شي يطابق «${q}»` : "ما فيه فعاليات بهذه الفلاتر"}>
          <p>{q ? "جرّب كلمات أبسط، أو تصفّح كل الفعاليات. بحثك يوصل للمنظّمين كفرصة لفعاليات جديدة." : "جرّب تخفيف الفلاتر."}</p>
          <button type="button" className="btn btn-soft" onClick={() => set({ q: "", category: "", district: "", price: "", when: "", booking: "" })}>تصفّح الكل</button>
        </Empty>
      ) : (
        <>
          <div className={view === "cards" ? "event-card-grid" : "rows"}>
            {shown.map((i) => view === "cards" ? <EventCard key={i.event.id} event={i.event} reasons={i.reasons} source={q ? "search" : "list"} /> : <EventRow key={i.event.id} event={i.event} reasons={i.reasons} source={q ? "search" : "list"} />)}
          </div>
          {items.length > shown.length && (
            <div className="more-wrap"><button type="button" className="btn btn-soft" onClick={() => setVisible((v) => v + PAGE)}>عرض المزيد ({items.length - shown.length})</button></div>
          )}
        </>
      )}
    </div>
  );
}
