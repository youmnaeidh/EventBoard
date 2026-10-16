import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DivergingBars, IntervalBar } from "../../components/charts";
import { Icon } from "../../components/Icon";
import { ErrorBox, PageTitle } from "../../components/ui";
import { useToast } from "../../context/ToastContext";
import { useUserLocation } from "../../context/LocationContext";
import { api, ApiError } from "../../lib/api";
import { fromLocalInput, hoursBetween, localNowInput, nextSlot, toLocalInput } from "../../lib/datetime";
import { useDocTitle } from "../../lib/useDocTitle";
import type { EventItem, Forecast } from "../../types";

interface FormState {
  title: string; summary: string; description: string; category: string; eventType: string; venue: string; district: string;
  startsAt: string; endsAt: string; price: string; needsBooking: boolean; capacity: string; audience: string; highlights: string; imageUrl: string;
}

const empty = (): FormState => ({
  title: "", summary: "", description: "", category: "ثقافة", eventType: "", venue: "", district: "المنطقة المركزية",
  startsAt: `${localNowInput(24 * 7).slice(0, 10)}T19:00`, endsAt: `${localNowInput(24 * 7).slice(0, 10)}T22:00`, price: "0", needsBooking: true, capacity: "100", audience: "الجميع", highlights: "", imageUrl: ""
});

function fromEvent(e: EventItem): FormState {
  return {
    title: e.title, summary: e.summary, description: e.description, category: e.category, eventType: e.eventType, venue: e.venue, district: e.district,
    startsAt: toLocalInput(e.startsAt), endsAt: toLocalInput(e.endsAt), price: String(e.price), needsBooking: e.requiresBooking, capacity: e.capacity ? String(e.capacity) : "100",
    audience: e.audience, highlights: e.highlights.join("\n"), imageUrl: e.image && e.image.startsWith("https://") ? e.image : ""
  };
}

function ForecastPanel({ f, loading, error, onPick, capacity }: { f: Forecast | undefined; loading: boolean; error: boolean; onPick: (weekday: number, hour: number) => void; capacity: number | null }) {
  return (
    <aside className={`forecast ${loading ? "is-loading" : ""}`} aria-label="توقع الإقبال">
      <header><Icon name="sparkle" size={19} /><h2>توقّع الإقبال</h2></header>
      {error && !f ? <p className="hint hint-warn">خدمة التوقع غير متاحة الحين. تقدر تنشر الفعالية بدونها.</p> : !f ? <i className="skel" style={{ height: 160 }} /> : (
        <>
          <div className="forecast-hero">
            <b className="num">{f.expectedBookings}</b>
            <span>حجز متوقع{f.expectedFillRate !== null && <> · امتلاء <b className="num">{Math.round(f.expectedFillRate * 100)}%</b></>}</span>
          </div>
          <IntervalBar low={f.low} expected={f.expectedBookings} high={f.high} capacity={capacity} />
          <p className="hint">النطاق المرجّح (80%) من <b className="num">{f.low}</b> إلى <b className="num">{f.high}</b>.</p>
          <p className="forecast-advice">{f.capacityAdvice}</p>

          <h3>وش يأثّر على الرقم؟</h3>
          <DivergingBars rows={f.drivers} />

          <h3>أنسب مواعيد لنفس الفعالية</h3>
          <ul className="slots">
            {f.slots.map((s) => (
              <li key={s.label}>
                <span><b>{s.label}</b><small className="num">≈ {s.expectedBookings} حجز</small></span>
                <button type="button" className="btn btn-soft btn-sm" onClick={() => onPick(s.weekday, s.hour)}>جرّب</button>
              </li>
            ))}
          </ul>
          <p className="forecast-note"><Icon name="info" size={15} /><span>النموذج مدرَّب على بيانات تاريخية <b>تجريبية</b> ({f.model.trainedOn?.rows ?? "—"} فعالية)، فاعتبره مؤشرًا للمقارنة بين السيناريوهات وليس وعدًا. <Link to="/organizer/insights">التفاصيل</Link></span></p>
        </>
      )}
    </aside>
  );
}

export default function EventForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  useDocTitle(editing ? "تعديل فعالية" : "فعالية جديدة");
  const nav = useNavigate();
  const qc = useQueryClient();
  const { notify } = useToast();
  const { meta } = useUserLocation();
  const [f, setF] = useState<FormState>(empty);
  const [error, setError] = useState<ApiError | null>(null);
  const [loaded, setLoaded] = useState(!editing);

  const existing = useQuery({ enabled: editing, queryKey: ["org-event", id], queryFn: () => api.get<{ event: EventItem }>(`/events/${id}`).then((r) => r) });
  useEffect(() => {
    if (existing.data) {
      setF(fromEvent((existing.data as unknown as { event: EventItem }).event));
      setLoaded(true);
    }
  }, [existing.data]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  // Live forecast, debounced, only for the inputs the model understands.
  const inputs = useMemo(() => {
    const valid = f.startsAt && f.endsAt && new Date(f.endsAt) > new Date(f.startsAt);
    if (!valid) return null;
    const startIso = fromLocalInput(f.startsAt);
    return {
      category: f.category, district: f.district, price: Math.max(0, Number(f.price) || 0),
      capacity: f.needsBooking ? Math.max(1, Math.round(Number(f.capacity) || 0)) : null,
      startsAt: startIso, durationHours: Math.min(72, hoursBetween(startIso, fromLocalInput(f.endsAt)))
    };
  }, [f.category, f.district, f.price, f.needsBooking, f.capacity, f.startsAt, f.endsAt]);
  const [debounced, setDebounced] = useState(inputs);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(inputs), 450);
    return () => clearTimeout(t);
  }, [inputs]);
  const forecast = useQuery({
    enabled: !!debounced && loaded,
    queryKey: ["forecast", debounced],
    queryFn: () => api.post<Forecast>("/organizer/forecast", debounced),
    placeholderData: (prev) => prev,
    retry: false,
    staleTime: 5 * 60_000
  });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        title: f.title, summary: f.summary, description: f.description, category: f.category, eventType: f.eventType || "فعالية",
        venue: f.venue, district: f.district, startsAt: fromLocalInput(f.startsAt), endsAt: fromLocalInput(f.endsAt),
        price: Number(f.price) || 0, capacity: f.needsBooking ? Math.round(Number(f.capacity) || 0) : null, audience: f.audience || "الجميع",
        highlights: f.highlights.split("\n").map((h) => h.trim()).filter(Boolean).slice(0, 6), imageUrl: f.imageUrl.trim() || null
      };
      return editing ? api.put<{ event: EventItem }>(`/organizer/events/${id}`, body) : api.post<{ event: EventItem }>("/organizer/events", body);
    },
    onSuccess: ({ event }) => {
      notify(editing ? "تم حفظ التعديلات" : "تم نشر الفعالية", "success");
      for (const key of ["org-events", "org-event", "org-analytics", "events", "event", "recommendations"]) {
        qc.invalidateQueries({ queryKey: [key] });
      }
      nav(`/organizer/events/${event.id}`);
    },
    onError: (e) => setError(e instanceof ApiError ? e : new ApiError(0, "network", "تعذّر الاتصال"))
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    save.mutate();
  }
  const fieldErr = (path: string) => error?.details?.find((d) => d.path === path)?.message;

  if (editing && existing.isError) return <ErrorBox message="ما قدرنا نحمّل الفعالية" onRetry={() => existing.refetch()} />;

  const pickSlot = (weekday: number, hour: number) => {
    const hours = hoursBetween(fromLocalInput(f.startsAt), fromLocalInput(f.endsAt));
    const start = nextSlot(f.startsAt, weekday, hour);
    const end = toLocalInput(new Date(new Date(`${start}:00+03:00`).getTime() + hours * 3_600_000).toISOString());
    setF((s) => ({ ...s, startsAt: start, endsAt: end }));
    notify("غيّرنا الموعد، شوف التوقع الجديد", "info");
  };

  return (
    <>
      <PageTitle title={editing ? "تعديل الفعالية" : "فعالية جديدة"} sub="غيّر الموعد أو السعر أو السعة وشوف التوقع يتحدّث مباشرة" />
      <div className="form-grid">
        <form className="org-form" onSubmit={submit} noValidate>
          {error && !error.details?.length && <p className="form-error" role="alert">{error.message}</p>}
          <fieldset>
            <legend>الأساسيات</legend>
            <label className="field"><span>اسم الفعالية</span><input value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={120} required /><small className="field-error">{fieldErr("title")}</small></label>
            <label className="field"><span>ملخص قصير</span><input value={f.summary} onChange={(e) => set("summary", e.target.value)} maxLength={300} required /><small className="field-error">{fieldErr("summary")}</small></label>
            <label className="field"><span>الوصف</span><textarea rows={5} value={f.description} onChange={(e) => set("description", e.target.value)} maxLength={2000} required /><small className="field-error">{fieldErr("description")}</small></label>
            <div className="field-row">
              <label className="field"><span>الفئة</span><select value={f.category} onChange={(e) => set("category", e.target.value)}>{meta?.categories.map((c) => <option key={c}>{c}</option>)}</select></label>
              <label className="field"><span>نوع الفعالية</span><input value={f.eventType} onChange={(e) => set("eventType", e.target.value)} placeholder="ورشة، معرض، أمسية…" maxLength={30} /></label>
            </div>
          </fieldset>

          <fieldset>
            <legend>المكان والموعد</legend>
            <div className="field-row">
              <label className="field"><span>اسم المكان</span><input value={f.venue} onChange={(e) => set("venue", e.target.value)} maxLength={120} required /><small className="field-error">{fieldErr("venue")}</small></label>
              <label className="field"><span>الحي</span><select value={f.district} onChange={(e) => set("district", e.target.value)}>{meta?.districts.map((d) => <option key={d.name}>{d.name}</option>)}</select></label>
            </div>
            <div className="field-row">
              <label className="field"><span>تبدأ</span><input type="datetime-local" value={f.startsAt} onChange={(e) => set("startsAt", e.target.value)} required /><small className="field-error">{fieldErr("startsAt")}</small></label>
              <label className="field"><span>تنتهي</span><input type="datetime-local" value={f.endsAt} min={f.startsAt} onChange={(e) => set("endsAt", e.target.value)} required /><small className="field-error">{fieldErr("endsAt")}</small></label>
            </div>
            <p className="hint">التوقيت بتوقيت المدينة المنورة.</p>
          </fieldset>

          <fieldset>
            <legend>السعر والحجز</legend>
            <div className="field-row">
              <label className="field"><span>السعر (ر.س)، صفر = مجاني</span><input type="number" min={0} max={5000} step="1" inputMode="decimal" value={f.price} onChange={(e) => set("price", e.target.value)} /></label>
              <label className="field"><span>الفئة المستهدفة</span><input value={f.audience} onChange={(e) => set("audience", e.target.value)} maxLength={80} /></label>
            </div>
            <label className="check"><input type="checkbox" checked={f.needsBooking} onChange={(e) => set("needsBooking", e.target.checked)} />يحتاج حجز بعدد مقاعد محدد</label>
            {f.needsBooking && (
              <label className="field"><span>عدد المقاعد</span><input type="number" min={1} max={20000} value={f.capacity} onChange={(e) => set("capacity", e.target.value)} /><small className="field-error">{fieldErr("capacity")}</small></label>
            )}
          </fieldset>

          <fieldset>
            <legend>تفاصيل إضافية</legend>
            <label className="field"><span>أبرز النقاط (سطر لكل نقطة، حتى 6)</span><textarea rows={3} value={f.highlights} onChange={(e) => set("highlights", e.target.value)} /></label>
            <label className="field"><span>رابط الصورة (اختياري، https)</span><input type="url" dir="ltr" value={f.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://…" /><small className="field-error">{fieldErr("imageUrl")}</small></label>
          </fieldset>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary btn-lg" disabled={save.isPending || !f.title || !f.venue}>{save.isPending ? "جاري الحفظ…" : editing ? "حفظ التعديلات" : "نشر الفعالية"}</button>
            <Link to="/organizer" className="btn btn-ghost btn-lg">إلغاء</Link>
          </div>
        </form>
        <ForecastPanel f={forecast.data} loading={forecast.isFetching} error={forecast.isError} onPick={pickSlot} capacity={inputs?.capacity ?? null} />
      </div>
    </>
  );
}
