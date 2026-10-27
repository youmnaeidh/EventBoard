import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { EventCard, catVars } from "../components/EventRow";
import { EventCover } from "../components/EventCover";
import { FavButton } from "../components/FavButton";
import { Icon } from "../components/Icon";
import { Stars } from "../components/Stars";
import { Empty, ErrorBox } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useUserLocation } from "../context/LocationContext";
import { api, ApiError } from "../lib/api";
import { dateRange, dayNumber, distanceLabel, monthName, priceLabel, seatsLabel, weekdayName, whenLabel } from "../lib/format";
import { trackShare, trackView } from "../lib/track";
import { useDocTitle } from "../lib/useDocTitle";
import { downloadCalendar } from '../lib/calendar';
import {useEventMetadata} from '../lib/useEventMetadata';
import type { EventDetailResponse, EventItem, Review } from "../types";

function BookingPanel({ event, myBooking }: { event: EventItem; myBooking: EventDetailResponse["myBooking"] }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const qc = useQueryClient();
  const { notify } = useToast();
  const [seats, setSeats] = useState(1);
  const maxSeats = Math.max(1, Math.min(6, event.seatsLeft ?? 6));

  const book = useMutation({
    mutationFn: () => api.post("/events/" + event.id + "/bookings", { seats }),
    onSuccess: async () => {
      notify("تم تأكيد حجزك، تذكرتك تحت", "success");
      await qc.invalidateQueries({ queryKey: ["event", event.slug] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["recommendations"] });
    },
    onError: (e) => {
      notify(e instanceof ApiError ? e.message : "تعذّر الحجز", "error");
      qc.invalidateQueries({ queryKey: ["event", event.slug] });
    }
  });
  const cancel = useMutation({
    mutationFn: () => api.del(`/me/bookings/${myBooking!.id}`),
    onSuccess: async () => {
      notify("تم إلغاء الحجز", "info");
      await qc.invalidateQueries({ queryKey: ["event", event.slug] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (e) => notify(e instanceof ApiError ? e.message : "تعذّر الإلغاء", "error")
  });

  const ended = event.status === "ended";
  const soldOut = event.seatsLeft === 0;
  const seatsText = seatsLabel(event);
  const fill = event.capacity && event.seatsLeft !== null ? Math.round(((event.capacity - event.seatsLeft) / event.capacity) * 100) : null;

  return (
    <aside className="ticket" id="booking" tabIndex={-1} aria-label="الحجز">
      <div className="ticket-top">
        <span className="ticket-label">{event.isFree ? "الدخول" : "سعر التذكرة"}</span>
        <b className="ticket-price">{priceLabel(event.price)}</b>
        {event.requiresBooking && fill !== null && !ended && (
          <div className="meter" role="img" aria-label={`ممتلئة بنسبة ${fill}%`}>
            <i style={{ width: `${fill}%` }} />
          </div>
        )}
        {seatsText && !ended && <span className={`ticket-seats ${soldOut ? "is-full" : ""}`}>{seatsText}</span>}
      </div>
      <div className="ticket-tear" aria-hidden="true" />
      <div className="ticket-bottom">
        <p className="demo-notice">نسخة تجريبية: لا يتم تحصيل مبالغ، وهذه التذكرة ليست تصريح دخول لفعالية حقيقية.</p>
        {ended ? (
          <p className="ticket-note">انتهت هذي الفعالية. شاركنا رأيك فيها من قسم التقييمات.</p>
        ) : !event.requiresBooking ? (
          <p className="ticket-note"><Icon name="check" size={18} />الدخول مفتوح، ما يحتاج حجز. تعال في الموعد.</p>
        ) : myBooking ? (
          <div className="mybooking">
            <p className="ticket-note ok"><Icon name="check" size={18} />حجزك مؤكد: <b className="num">{myBooking.seats}</b> {myBooking.seats === 1 ? "مقعد" : "مقاعد"}</p>
            <div className="qr"><QRCodeSVG title="رمز QR لتذكرتك" value={myBooking.ticketCode} size={132} level="M" bgColor="transparent" fgColor="#24172c" /></div>
            <code className="ticket-code num">{myBooking.ticketCode}</code>
            {event.status === "upcoming" ? (
              <button type="button" className="btn btn-ghost btn-sm" disabled={cancel.isPending} onClick={() => confirm("تأكيد إلغاء الحجز؟") && cancel.mutate()}>إلغاء الحجز</button>
            ) : <p className="hint">بدأت الفعالية، ما تقدر تلغي الحجز.</p>}
          </div>
        ) : soldOut ? (
          <p className="ticket-note warn">اكتمل العدد. احفظ الفعالية وراقب الفعاليات المشابهة.</p>
        ) : (
          <>
            <div className="stepper-row">
              <span id="seats-label">عدد المقاعد</span>
              <div className="stepper" role="group" aria-labelledby="seats-label">
                <button type="button" onClick={() => setSeats((s) => Math.max(1, s - 1))} disabled={seats <= 1} aria-label="أنقص"><Icon name="minus" size={16} /></button>
                <output className="num" aria-live="polite">{seats}</output>
                <button type="button" onClick={() => setSeats((s) => Math.min(maxSeats, s + 1))} disabled={seats >= maxSeats} aria-label="زد"><Icon name="plus" size={16} /></button>
              </div>
            </div>
            {!event.isFree && <p className="ticket-total"><span>الإجمالي</span><b className="num">{priceLabel(event.price * seats)}</b></p>}
            <button
              type="button"
              className="btn btn-primary btn-block btn-lg"
              disabled={book.isPending}
              onClick={() => {
                if (!user) {
                  notify("سجّل دخولك لإتمام الحجز", "info");
                  nav("/login", { state: { from: loc.pathname } });
                } else book.mutate();
              }}
            >
              <Icon name="ticket" size={20} />{book.isPending ? "جاري الحجز…" : user ? "احجز الآن" : "سجّل دخولك واحجز"}
            </button>
            <p className="hint">الحجز مجاني الإلغاء قبل بداية الفعالية.</p>
          </>
        )}
      </div>
    </aside>
  );
}

function ReviewsSection({ event, detail }: { event: EventItem; detail: EventDetailResponse }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { notify } = useToast();
  const reviews = useQuery({ queryKey: ["reviews", event.id], queryFn: () => api.get<{ reviews: Review[] }>(`/events/${event.id}/reviews`) });
  const [rating, setRating] = useState(detail.myReview?.rating ?? 0);
  const [comment, setComment] = useState(detail.myReview?.comment ?? "");
  const started = new Date(event.startsAt).getTime() <= Date.now();

  const submit = useMutation({
    mutationFn: () => api.post(`/events/${event.id}/reviews`, { rating, comment }),
    onSuccess: async () => {
      notify("شكرًا، وصل تقييمك", "success");
      await Promise.all([qc.invalidateQueries({ queryKey: ["reviews", event.id] }), qc.invalidateQueries({ queryKey: ["event", event.slug] })]);
    },
    onError: (e) => notify(e instanceof ApiError ? e.message : "تعذّر إرسال التقييم", "error")
  });

  const dist = detail.ratingDistribution;
  const total = Object.values(dist).reduce((a, b) => a + b, 0);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (rating < 1) return notify("اختر عدد النجوم أولًا", "error");
    submit.mutate();
  }

  return (
    <section className="reviews" aria-labelledby="reviews-h">
      <h2 id="reviews-h">آراء الحضور</h2>
      {total > 0 && event.avgRating ? (
        <div className="rating-summary">
          <div className="rating-big"><b className="num">{event.avgRating.toFixed(1)}</b><Stars value={event.avgRating} size={18} /><span className="muted-sm num">{total} تقييم</span></div>
          <ul className="dist">
            {[5, 4, 3, 2, 1].map((n) => (
              <li key={n}><span className="num">{n}<Icon name="star" size={11} filled /></span><i><b style={{ width: `${total ? ((dist[String(n)] ?? 0) / total) * 100 : 0}%` }} /></i><span className="num muted-sm">{dist[String(n)] ?? 0}</span></li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="muted">ما فيه تقييمات للحين.</p>
      )}

      {user ? (
        started ? (
          <form className="review-form" onSubmit={onSubmit}>
            <h3>{detail.myReview ? "عدّل تقييمك" : "شاركنا رأيك"}</h3>
            <div className="star-input" role="radiogroup" aria-label="التقييم">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} من 5`} className={n <= rating ? "on" : ""} onClick={() => setRating(n)}>
                  <Icon name="star" size={28} filled={n <= rating} />
                </button>
              ))}
            </div>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={600} placeholder="وش أعجبك؟ وش كان ممكن يكون أفضل؟ (اختياري)" aria-label="تعليقك" />
            <div className="form-foot"><span className="hint num">{comment.length}/600</span><button type="submit" className="btn btn-primary" disabled={submit.isPending}>{submit.isPending ? "جاري الإرسال…" : "إرسال التقييم"}</button></div>
          </form>
        ) : (
          <p className="notice"><Icon name="clock" size={18} />يفتح التقييم بعد ما تبدأ الفعالية.</p>
        )
      ) : (
        <p className="notice"><Icon name="user" size={18} /><span><Link to="/login" state={{ from: `/events/${event.slug}` }}>سجّل دخولك</Link> عشان تقيّم الفعالية.</span></p>
      )}

      <ul className="review-list">
        {reviews.data?.reviews.filter((r) => r.comment).map((r) => (
          <li key={r.id} className="review">
            <div className="review-top"><b>{r.authorName}</b>{r.verified && <span className="verified"><Icon name="check" size={13} />حجز موثّق</span>}<Stars value={r.rating} size={14} /></div>
            <p>{r.comment}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function EventDetail() {
  const { slug = "" } = useParams();
  const { coords } = useUserLocation();
  const { notify } = useToast();
  const q = useQuery({
    queryKey: ["event", slug, coords && `${coords.lat},${coords.lng}`],
    queryFn: () => api.get<EventDetailResponse>(`/events/${slug}`, { lat: coords?.lat, lng: coords?.lng })
  });
  const event = q.data?.event;
  useEventMetadata(event);
  useDocTitle(event?.title);

  useEffect(() => {
    if (event) trackView(event.id, "shared");
  }, [event]);

  if (q.isLoading) return <div className="container detail" style={{ paddingTop: 40 }}><i className="skel" style={{ height: 380 }} /></div>;
  if (q.isError || !event || !q.data) {
    const notFound = q.error instanceof ApiError && q.error.status === 404;
    return (
      <div className="container detail" style={{ paddingTop: 40 }}>
        {notFound ? <Empty icon="calendar" title="هذي الفعالية غير موجودة"><Link to="/events" className="btn btn-soft">تصفّح الفعاليات</Link></Empty> : <ErrorBox onRetry={() => q.refetch()} />}
      </div>
    );
  }

  const dist = distanceLabel(event.distanceKm);

  async function share() {
    trackShare(event!.id);
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: event!.title, url });
      else {
        await navigator.clipboard.writeText(url);
        notify("نسخنا رابط الفعالية", "success");
      }
    } catch {
      /* user dismissed the share sheet */
    }
  }

  return (
    <div className="detail" style={catVars(event.category)}>
      <header className="detail-hero">
        <div className="container detail-hero-inner">
          <div className="detail-hero-text">
            <nav className="crumbs" aria-label="مسار التنقل"><Link to="/">الرئيسية</Link><Icon name="chevron" size={14} /><Link to="/events">الفعاليات</Link><Icon name="chevron" size={14} /><span>{event.title}</span></nav>
            <div className="detail-tags">
              <span className="chip chip-cat">{event.category}</span>
              <span className="chip chip-soft">{event.eventType}</span>
              {event.status === "live" && <span className="badge badge-live"><i className="live-dot" />{whenLabel(event)}</span>}
              {event.status === "upcoming" && ["الليلة", "اليوم"].includes(whenLabel(event)) && <span className="badge badge-tonight">{whenLabel(event)}</span>}
            </div>
            <h1 className="detail-title">{event.title}</h1>
            {event.publicationStatus === 'draft' && <p className="notice">مسودة — هذه المعاينة خاصة بالمنظّم، ولن تظهر للزوار.</p>}
            <p className="detail-summary">{event.summary}</p>
            <div className="detail-actions">
              <FavButton eventId={event.id} initial={event.isFavorite} label />
              <button type="button" className="fav fav-labeled" onClick={share}><Icon name="share" size={20} /><span>مشاركة</span></button>
              <button type="button" className="fav fav-labeled" onClick={() => downloadCalendar(event)}><Icon name="calendar" size={20} /><span>أضف للتقويم</span></button>
            </div>
          </div>
          <div className="detail-poster">
            <EventCover event={event} eager />
            <div className="detail-date" aria-hidden="true"><b className="num">{dayNumber(event.startsAt)}</b><span>{monthName(event.startsAt)}</span><small>{weekdayName(event.startsAt)}</small></div>
          </div>
        </div>
      </header>

      <div className="container detail-grid">
        <div className="detail-main">
          <dl className="facts">
            {event.details?.imageCredit && <div><dt>الصورة</dt><dd>{event.details.imageIllustrative && <b>صورة توضيحية — </b>}{event.details.imageCaption}<br /><a href={event.details.imageSource} target="_blank" rel="noopener noreferrer">{event.details.imageCredit}</a> · {event.details.imageLicense}</dd></div>}
            <div><dt><Icon name="calendar" size={18} />الموعد</dt><dd>{dateRange(event)}</dd></div>
            {event.details?.dailyStart && <div><dt>ساعات الزيارة يوميًا</dt><dd dir="ltr">{event.details.dailyStart} – {event.details.dailyEnd} (UTC+03)</dd></div>}
            {event.status === 'live' && <div><dt>الحالة الآن</dt><dd>{event.openNow === true ? 'مفتوحة حسب الساعات المعلنة' : event.openNow === false ? 'مغلقة الآن، راجع ساعات الزيارة' : 'برنامج مستمر؛ ساعات الزيارة غير محددة'}</dd></div>}
            {event.details?.locationAccuracy !== 'exact' && <div><dt>دقة الموقع</dt><dd>{event.details?.locationAccuracy === 'illustrative' ? 'موقع تجريبي توضيحي، وليس عنوان دخول فعلي' : 'موقع تقريبي؛ تأكد من العنوان مع المنظّم'}{dist && ' · المسافة خط مستقيم وليست مسافة قيادة'}</dd></div>}
            <div><dt><Icon name="pin" size={18} />المكان</dt><dd>{event.venue} · {event.district}{dist ? <> · <b className="num">{dist}</b> منك</> : null}<br /><a href={`https://www.google.com/maps?q=${event.lat},${event.lng}`} target="_blank" rel="noopener noreferrer">افتح في الخرائط <Icon name="external" size={14} /></a></dd></div>
            <div><dt><Icon name="users" size={18} />الفئة المستهدفة</dt><dd>{event.audience}</dd></div>
            <div><dt><Icon name="tag" size={18} />الحضور</dt><dd>{event.format}</dd></div>
            <div><dt><Icon name="user" size={18} />المنظّم</dt><dd>{event.organizerName}</dd></div>
          </dl>

          <section className="about">
            {event.details?.posterUrl && <p><a className="btn btn-soft" href={event.details.posterUrl} target="_blank" rel="noopener noreferrer">افتح الملصق كاملًا</a></p>}
            <h2>عن الفعالية</h2>
            <p>{event.description}</p>
            {event.highlights.length > 0 && (
              <ul className="highlights">{event.highlights.map((h) => <li key={h}><Icon name="check" size={17} />{h}</li>)}</ul>
            )}
          </section>
          <section className="about"><h2>قبل ما تروح</h2><dl className="facts">{([['included','السعر يشمل'],['parking','المواقف'],['accessibility','سهولة الوصول'],['preparation','التجهيزات المطلوبة'],['cancellation','سياسة الإلغاء']] as const).map(([key,label]) => <div key={key}><dt>{label}</dt><dd>{event.details?.[key] || 'غير محدد — استفسر من المنظّم'}</dd></div>)}</dl></section>

          <ReviewsSection event={event} detail={q.data} />
        </div>
        <div className="detail-side">{event.publicationStatus==='draft'?<p className="notice">الحجز متاح بعد نشر الفعالية.</p>:<BookingPanel event={event} myBooking={q.data.myBooking} />}</div>
      </div>
      {event.publicationStatus!=='draft' && event.requiresBooking && event.status !== "ended" && !q.data.myBooking && event.seatsLeft !== 0 && (
        <div className="mobile-cta">
          <span><small>{event.isFree ? "الدخول" : "التذكرة"}</small><b>{priceLabel(event.price)}</b></span>
          <a href="#booking" className="btn btn-primary" onClick={(e) => {
            e.preventDefault();
            const panel = document.getElementById("booking");
            panel?.scrollIntoView({ behavior: "smooth", block: "start" });
            panel?.focus({ preventScroll: true });
          }}><Icon name="ticket" size={18} />احجز مكانك</a>
        </div>
      )}

      {q.data.similar.length > 0 && (
        <section className="section container">
          <div className="section-head"><div><h2>فعاليات مشابهة</h2></div></div>
          <div className="shelf">{q.data.similar.map((e) => <EventCard key={e.id} event={e} />)}</div>
        </section>
      )}
    </div>
  );
}
