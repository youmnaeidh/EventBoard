import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CATEGORY_STYLES } from "../lib/categories";
import { EXAMPLES, SmartSearch } from "../components/SmartSearch";
import { EventCard, EventRow, catVars } from "../components/EventRow";
import { EventCover } from "../components/EventCover";
import { Icon } from "../components/Icon";
import { Stars } from "../components/Stars";
import { Empty, ErrorBox, SectionHead } from "../components/ui";
import { VibePicker } from "../components/VibePicker";
import { useUserLocation } from "../context/LocationContext";
import { useAuth } from "../context/AuthContext";
import { assetUrl } from "../lib/assets";
import { useCatalogue, useLatestReviews, useRecommendations } from "../lib/queries";
import { whenLabel } from "../lib/format";
import { useDocTitle } from "../lib/useDocTitle";
import type { EventItem } from "../types";

function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [still, setStill] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      setStill(q.matches);
      if (q.matches) ref.current?.pause();
    };
    apply();
    q.addEventListener("change", apply);
    return () => q.removeEventListener("change", apply);
  }, []);
  return (
    <div className="hero-media" aria-hidden="true">
      <video ref={ref} autoPlay={!still} muted loop playsInline preload="metadata" poster={assetUrl("/assets/branding/hero-poster.jpg")}>
        <source src={assetUrl("/assets/video/madinah-intro.mp4")} type="video/mp4" />
      </video>
    </div>
  );
}

export default function Home() {
  useDocTitle();
  const { user } = useAuth();
  const loc = useUserLocation();
  const catalogue = useCatalogue();
  const recs = useRecommendations(5);
  const reviews = useLatestReviews(3);

  const events = catalogue.data?.events ?? [];
  const derived = useMemo(() => {
    const active = events.filter((e) => e.status !== "ended");
    const tonight = active.filter((e) => e.status === "live" || ["الليلة", "اليوم"].includes(whenLabel(e)));
    const popular = [...active].sort((a, b) => b.popularity - a.popularity).slice(0, 4);
    const newest = [...active].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 4);
    const nearest = loc.coords ? [...active].filter((e) => e.distanceKm !== null).sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0)).slice(0, 4) : [];
    const counts = new Map<string, number>();
    active.forEach((e) => counts.set(e.category, (counts.get(e.category) ?? 0) + 1));
    return { active, tonight, popular, newest, nearest, counts };
  }, [events, loc.coords]);

  const tonightList: EventItem[] = (derived.tonight.length ? derived.tonight : derived.active).slice(0, 5);

  return (
    <>
      <section className="hero">
        <HeroVideo />
        <div className="hero-veil" />
        <div className="container hero-inner">
          <h1 className="hero-title">
            <span className="ht-1">كل فعاليات</span>
            <span className="ht-2">المدينة المنورة</span>
            <span className="ht-3">في مكان واحد</span>
          </h1>
          <div className="hero-search">
            <SmartSearch size="hero" />
            <p className="hero-sub">اكتب اللي تبغاه بكلامك العادي، ونفهمه: الوقت، السعر، لمن، وقد إيش قريب منك.</p>
            <div className="hero-examples" aria-label="أمثلة للبحث">
              {EXAMPLES.map((ex) => (
                <Link key={ex} to={`/events?q=${encodeURIComponent(ex)}`}>{ex}</Link>
              ))}
            </div>
          </div>
        </div>
        {!catalogue.isLoading && derived.active.length > 0 && (
          <div className="hero-strip">
            <dl className="container">
              <div><dt>فعالية قادمة</dt><dd className="num">{derived.active.length}</dd></div>
              <div><dt>{derived.tonight.length === 1 ? "فعالية" : "فعاليات"} اليوم</dt><dd className="num">{derived.tonight.length}</dd></div>
              <div><dt>مجانية</dt><dd className="num">{derived.active.filter((e) => e.isFree).length}</dd></div>
            </dl>
          </div>
        )}
      </section>

      <section className="section container lineup">
        <SectionHead
          title={catalogue.isLoading ? "نحمّل فعاليات المدينة" : derived.tonight.length ? "الليلة في المدينة" : "الأقرب موعدًا"}
          sub={catalogue.isLoading || catalogue.isError ? undefined : derived.tonight.length ? "فعاليات اليوم والبرامج المستمرة — راجع ساعات الزيارة" : "هذي أقرب الفعاليات القادمة"}
          action={{ to: "/events?when=tonight", label: "كل فعاليات اليوم" }}
        />
        {catalogue.isError ? <ErrorBox onRetry={() => catalogue.refetch()} /> : catalogue.isLoading ? <div className="rows rows-lineup"><i className="skel lineup-skel" /><i className="skel lineup-skel" /><i className="skel lineup-skel" /></div>
          : tonightList.length === 0 ? <Empty icon="calendar" title="ما فيه فعاليات قادمة حاليًا" />
          : <div className="rows rows-lineup">{tonightList.map((e) => <EventRow key={e.id} event={e} />)}</div>}
      </section>

      <VibePicker />

      <section className="section container">
        <SectionHead title="الأقرب لك" sub={loc.coords ? `مرتّبة حسب المسافة من ${loc.label}` : "حدد موقعك عشان نرتّب لك الفعاليات حسب المسافة"} action={{ to: "/events?sort=nearest", label: "عرض الكل" }} />
        {loc.coords ? (
          <div className="rows rows-lineup">{derived.nearest.map((e) => <EventRow key={e.id} event={e} />)}</div>
        ) : (
          <div className="locate-card">
            <Icon name="navigation" size={26} />
            <div>
              <h3>وين أنت الحين؟</h3>
              <p>الاختيار محفوظ في متصفحك خلال الجلسة، ونرسل إحداثيات تقريبية للخدمة لحساب المسافة بخط مستقيم.</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={loc.requestGps} disabled={loc.status === "asking"}>{loc.status === "asking" ? "نحدد موقعك…" : "استخدم موقعي"}</button>
            <div className="locate-districts">
              {loc.meta?.districts.slice(0, 5).map((d) => (
                <button key={d.name} type="button" onClick={() => loc.chooseDistrict(d.name)}>{d.name}</button>
              ))}
            </div>
            {loc.status === "denied" && <p className="hint hint-warn">ما قدرنا نوصل لموقعك، اختر حيّك.</p>}
          </div>
        )}
      </section>

      <section className="section container">
        <SectionHead
          title={recs.data?.strategy === "personalized" ? (user ? "مقترحة لك" : "مقترحة بحسب تصفّحك") : "ترشيحاتنا"}
          sub="كل ترشيح يوضّح سببه، عشان تعرف ليش ظهر لك"
        />
        {recs.isLoading ? <div className="shelf"><i className="skel ecard-skel" /><i className="skel ecard-skel" /><i className="skel ecard-skel" /></div>
          : recs.data && recs.data.items.length > 0 ? (
            <div className="mosaic">{recs.data.items.slice(0, 5).map((r, i) => <EventCard key={r.event.id} event={r.event} reasons={r.reasons} source="recommendation" feature={i === 0 && recs.data.items.length >= 5} />)}</div>
          ) : <Empty icon="sparkle" title="ما عندنا ترشيحات الحين" />}
        <details className="how">
          <summary>كيف نرتّب الترشيحات؟</summary>
          <p>
            نمزج خمس إشارات: تشابه المحتوى مع اللي اهتممت فيه ({user ? "وفئاتك المفضّلة" : "أو فئات تختارها عند التسجيل"})، وما يفضّله من اهتموا بنفس الفعاليات،
            والإقبال خلال آخر أسبوعين، والقرب منك، وقرب الموعد. بعدها ننوّع الفئات عشان ما تتكرر. إذا ما عندنا سجلّ كافٍ عنك نعتمد على الإقبال والقرب فقط.
          </p>
        </details>
      </section>

      <section className="section container lineup">
        <SectionHead title="الأكثر إقبالًا" sub="حسب التفاعل في آخر 14 يومًا" action={{ to: "/events?sort=popular", label: "الترتيب الكامل" }} />
        <div className="rows rows-lineup">{derived.popular.map((e, i) => <EventRow key={e.id} event={e} rank={i + 1} />)}</div>
      </section>

      <section className="section container">
        <SectionHead title="وصل حديثًا" sub="أضيفت للمنصة مؤخرًا" action={{ to: "/events?sort=newest", label: "كل الجديد" }} />
        <div className="shelf">{derived.newest.map((e) => <EventCard key={e.id} event={e} />)}</div>
      </section>

      <section className="section container">
        <SectionHead title="تصفّح حسب الاهتمام" sub="كل لون فئة، وكل فئة فيها فعاليات قادمة" />
        <div className="cat-grid">
          {Object.keys(CATEGORY_STYLES).map((c) => {
            return (
              <Link key={c} to={`/events?category=${encodeURIComponent(c)}`} className="cat-tile" style={catVars(c)}>
                <EventCover event={{ image: null, category: c, title: c }} />
                <span className="cat-tile-label"><strong>{c}</strong><span className="num">{catalogue.isLoading || catalogue.isError ? "—" : `${derived.counts.get(c) ?? 0} قادمة`}</span></span>
              </Link>
            );
          })}
        </div>
      </section>

      {reviews.data && reviews.data.reviews.length > 0 && (
        <section className="section container">
          <SectionHead title="وش يقول الحضور" sub="آخر التقييمات المكتوبة على المنصة" />
          <div className="quotes">
            {reviews.data.reviews.map((r) => (
              <figure key={r.id} className="quote">
                <Stars value={r.rating} size={15} />
                <blockquote>«{r.comment}»</blockquote>
                <figcaption>
                  <b>{r.authorName}</b>
                  {r.verified && <span className="verified"><Icon name="check" size={13} />حجز موثّق</span>}
                  <Link to={`/events/${r.eventSlug}`}>{r.eventTitle}</Link>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <section className="section container">
        <div className="cta-band">
          <div>
            <h2>عندك فعالية؟ اعرف الإقبال قبل ما تنشر</h2>
            <p>لوحة المنظّم تتوقع عدد الحجوزات المتوقع مع نطاق الثقة، وتقترح أنسب يوم ووقت، وتوضح وش يطلبه الناس وما لقوه.</p>
          </div>
          <Link to="/register?role=organizer" className="btn btn-light">سجّل كمنظّم<Icon name="arrow" size={18} /></Link>
        </div>
      </section>
    </>
  );
}
