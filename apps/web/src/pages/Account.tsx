import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { EventRow } from "../components/EventRow";
import { Icon } from "../components/Icon";
import { Empty, PageTitle } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useUserLocation } from "../context/LocationContext";
import { api, ApiError } from "../lib/api";
import { categoryStyle } from "../lib/categories";
import { dateRange } from "../lib/format";
import { useDocTitle } from "../lib/useDocTitle";
import type { Booking, EventItem } from "../types";

function BookingCard({ b }: { b: Booking }) {
  const qc = useQueryClient();
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const cancel = useMutation({
    mutationFn: () => api.del(`/me/bookings/${b.id}`),
    onSuccess: () => {
      notify("تم إلغاء الحجز", "info");
      qc.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (e) => notify(e instanceof ApiError ? e.message : "تعذّر الإلغاء", "error")
  });
  const e = b.event;
  if (!e) return null;
  const canCancel = b.status === "confirmed" && e.status === "upcoming";
  return (
    <li className={`bk ${b.status === "cancelled" ? "is-cancelled" : ""}`}>
      <div className="bk-main">
        <Link to={`/events/${e.slug}`} className="bk-title">{e.title}</Link>
        <p className="muted-sm">{dateRange(e)} · {e.venue}</p>
        <p className="bk-meta">
          <span className={`badge ${b.status === "confirmed" ? (e.status === "ended" ? "badge-ended" : "badge-free") : "badge-full"}`}>{b.status === "confirmed" ? (e.status === "ended" ? "حضرتها" : "مؤكد") : "ملغي"}</span>
          <span><b className="num">{b.seats}</b> {b.seats === 1 ? "مقعد" : "مقاعد"}</span>
          <code className="num">{b.ticketCode}</code>
        </p>
      </div>
      <div className="bk-actions">
        {b.status === "confirmed" && e.status !== "ended" && <button type="button" className="btn btn-soft btn-sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}><Icon name="qr" size={16} />التذكرة</button>}
        {canCancel && <button type="button" className="btn btn-ghost btn-sm" disabled={cancel.isPending} onClick={() => confirm("تأكيد إلغاء الحجز؟") && cancel.mutate()}>إلغاء</button>}
      </div>
      {open && <div className="bk-qr"><QRCodeSVG title="رمز QR للتذكرة" value={b.ticketCode} size={150} bgColor="transparent" fgColor="#24172c" /></div>}
    </li>
  );
}

export default function Account() {
  useDocTitle("حسابي");
  const { user, loading, setInterests } = useAuth();
  const { meta } = useUserLocation();
  const { notify } = useToast();
  const bookings = useQuery({ enabled: !!user, queryKey: ["bookings"], queryFn: () => api.get<{ bookings: Booking[] }>("/me/bookings") });
  const favorites = useQuery({ enabled: !!user, queryKey: ["favorites"], queryFn: () => api.get<{ events: EventItem[] }>("/me/favorites") });
  const [saving, setSaving] = useState(false);

  if (loading) return <div className="container page"><i className="skel" style={{ height: 200 }} /></div>;
  if (!user) return <Navigate to="/login" state={{ from: "/account" }} replace />;

  const upcoming = bookings.data?.bookings.filter((b) => b.status === "confirmed" && b.event && b.event.status !== "ended") ?? [];
  const past = bookings.data?.bookings.filter((b) => !upcoming.includes(b)) ?? [];

  async function toggleInterest(c: string) {
    const current = user!.interests;
    const next = current.includes(c) ? current.filter((x) => x !== c) : current.length >= 4 ? current : [...current, c];
    if (next === current) return;
    setSaving(true);
    try {
      await setInterests(next);
    } catch {
      notify("ما قدرنا نحفظ اهتماماتك", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container page">
      <PageTitle title={`أهلًا ${user.name.split(" ")[0]}`} sub={user.email} />

      <section className="panel">
        <h2>اهتماماتي</h2>
        <p className="muted-sm">نستخدمها لترشيح فعاليات تناسبك (حتى 4 فئات).</p>
        <div className="pill-group wrap">
          {meta?.categories.map((c) => {
            const on = user.interests.includes(c);
            const s = categoryStyle(c);
            return <button key={c} type="button" disabled={saving} className={`pill ${on ? "is-on" : ""}`} aria-pressed={on} onClick={() => toggleInterest(c)} style={on ? { background: s.soft, color: s.ink, borderColor: s.color } : undefined}>{c}</button>;
          })}
        </div>
      </section>

      <section className="panel">
        <h2>حجوزاتي</h2>
        {bookings.isLoading ? <i className="skel" style={{ height: 90 }} /> : upcoming.length === 0 && past.length === 0 ? (
          <Empty icon="ticket" title="ما عندك حجوزات للحين"><Link to="/events" className="btn btn-soft">تصفّح الفعاليات</Link></Empty>
        ) : (
          <>
            {upcoming.length > 0 && <ul className="bk-list">{upcoming.map((b) => <BookingCard key={b.id} b={b} />)}</ul>}
            {past.length > 0 && (<><h3 className="sub-h">السابقة والملغاة</h3><ul className="bk-list">{past.map((b) => <BookingCard key={b.id} b={b} />)}</ul></>)}
          </>
        )}
      </section>

      <section className="panel">
        <h2>المحفوظات</h2>
        {favorites.isLoading ? <i className="skel" style={{ height: 90 }} /> : (favorites.data?.events.length ?? 0) === 0 ? (
          <Empty icon="heart" title="ما حفظت أي فعالية"><p>اضغط على القلب في أي فعالية عشان تحفظها هنا.</p></Empty>
        ) : (
          <div className="rows">{favorites.data!.events.map((e) => <EventRow key={e.id} event={e} />)}</div>
        )}
      </section>
    </div>
  );
}
