import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { categoryStyle } from "../lib/categories";
import { dayNumber, distanceLabel, monthShort, priceLabel, seatsLabel, timeOfDay, weekdayName, whenLabel, fullDate, sameLocalDay } from "../lib/format";
import { trackView } from "../lib/track";
import type { EventItem } from "../types";
import { EventCover } from "./EventCover";
import { FavButton } from "./FavButton";
import { Icon } from "./Icon";
import { RatingBadge } from "./Stars";

type Source = Parameters<typeof trackView>[1];

/** CSS variables that colour a card, row or page section from its category. */
export function catVars(category: string): CSSProperties {
  const c = categoryStyle(category);
  return {
    ["--cat" as string]: c.color,
    ["--cat-soft" as string]: c.soft,
    ["--cat-ink" as string]: c.ink,
    ["--poster-bg" as string]: c.poster.bg,
    ["--poster-a" as string]: c.poster.a,
    ["--poster-b" as string]: c.poster.b,
    ["--poster-fg" as string]: c.poster.dark ? "#fff7ec" : "#25122f"
  };
}

function badges(event: EventItem) {
  const out: { text: string; tone: "live" | "tonight" | "free" | "price" | "low" | "full" | "ended" }[] = [];
  const when = whenLabel(event);
  if (event.status === "live") out.push({ text: sameLocalDay(event.startsAt, event.endsAt) ? "جارية الحين" : "مستمرة", tone: "live" });
  else if (event.status === "ended") out.push({ text: "انتهت", tone: "ended" });
  else if (when === "الليلة" || when === "اليوم") out.push({ text: when, tone: "tonight" });
  const seats = seatsLabel(event);
  if (seats && event.seatsLeft === 0) out.push({ text: seats, tone: "full" });
  else if (seats && event.seatsLeft !== null && event.capacity !== null && event.seatsLeft <= Math.max(5, event.capacity * 0.1)) {
    out.push({ text: seats, tone: "low" });
  }
  return out;
}

/** The signature element: an event shown as a ticket, with a day-numeral stub and a perforated edge. */
export function EventRow({ event, reasons, source = "list", rank }: { event: EventItem; reasons?: string[]; source?: Source; rank?: number }) {
  const multi = !sameLocalDay(event.startsAt, event.endsAt);
  const dist = distanceLabel(event.distanceKm);
  return (
    <article className="row" style={catVars(event.category)}>
      <div className="stub" aria-hidden="true">
        {rank ? <span className="stub-rank num">{rank}</span> : null}
        <span className="stub-month">{monthShort(event.startsAt)}</span>
        <span className="stub-day num">{dayNumber(event.startsAt)}</span>
        <span className="stub-wd">{weekdayName(event.startsAt)}</span>
      </div>
      <div className="row-body">
        <div className="row-tags">
          <span className="chip chip-cat">{event.category}</span>
          {badges(event).map((b) => (
            <span key={b.text} className={`badge badge-${b.tone}`}>{b.tone === "live" && <i className="live-dot" />}{b.text}</span>
          ))}
          <span className={`badge ${event.isFree ? "badge-free" : "badge-price"}`}>{priceLabel(event.price)}</span>
        </div>
        <h3 className="row-title">
          <Link to={`/events/${event.slug}`} onClick={() => trackView(event.id, source)}>{event.title}</Link>
        </h3>
        <p className="row-meta">
          <span><Icon name="clock" size={15} />{multi ? `${fullDate(event.startsAt)} إلى ${fullDate(event.endsAt)}` : `${timeOfDay(event.startsAt)} – ${timeOfDay(event.endsAt)}`}</span>
          <span><Icon name="pin" size={15} />{event.venue} · {event.district}{dist ? <> · <b className="num">{dist}</b></> : null}</span>
        </p>
        {reasons && reasons.length > 0 && (
          <p className="row-reason"><Icon name="sparkle" size={15} />{reasons.join(" · ")}</p>
        )}
        <div className="row-foot">
          <RatingBadge value={event.avgRating} count={event.reviewCount} />
          {event.requiresBooking && event.status !== "ended" && <span className="muted-sm"><Icon name="ticket" size={14} /> يحتاج حجز</span>}
        </div>
      </div>
      <div className="row-media"><EventCover event={event} /></div>
      <div className="row-fav"><FavButton eventId={event.id} initial={event.isFavorite} /></div>
    </article>
  );
}

/** A miniature event poster: art or photo, a date flag, a title set in the display face, and why it was suggested. */
export function EventCard({ event, reasons, source = "home", feature = false }: { event: EventItem; reasons?: string[]; source?: Source; feature?: boolean }) {
  const dist = distanceLabel(event.distanceKm);
  const b = badges(event)[0];
  return (
    <article className={`ecard ${feature ? "ecard-feature" : ""}`} style={catVars(event.category)}>
      <div className="ecard-media">
        <EventCover event={event} />
        <div className="ecard-date" aria-hidden="true"><b className="num">{dayNumber(event.startsAt)}</b><span>{monthShort(event.startsAt)}</span></div>
        {b && <span className={`badge badge-${b.tone} ecard-badge`}>{b.tone === "live" && <i className="live-dot" />}{b.text}</span>}
        <div className="ecard-fav"><FavButton eventId={event.id} initial={event.isFavorite} /></div>
      </div>
      <div className="ecard-body">
        <span className="ecard-cat"><i aria-hidden="true" />{event.category}</span>
        <h3 className="ecard-title"><Link to={`/events/${event.slug}`} onClick={() => trackView(event.id, source)}>{event.title}</Link></h3>
        <p className="ecard-meta"><Icon name="pin" size={15} />{event.district}{dist ? <> · <b className="num">{dist}</b></> : null}</p>
        {reasons && reasons.length > 0 ? (
          <p className="row-reason"><Icon name="sparkle" size={15} />{reasons[0]}</p>
        ) : (
          <p className="ecard-meta"><Icon name="clock" size={15} />{whenLabel(event)} · {timeOfDay(event.startsAt)}</p>
        )}
        <div className="ecard-foot">
          <RatingBadge value={event.avgRating} count={event.reviewCount} />
          <b className={event.isFree ? "price free" : "price"}>{priceLabel(event.price)}</b>
        </div>
      </div>
    </article>
  );
}

export function EventRowSkeleton() {
  return <div className="row row-skel" aria-hidden="true"><div className="stub" /><div className="row-body"><i className="skel w40" /><i className="skel w80 h22" /><i className="skel w60" /></div><div className="row-media skel" /></div>;
}
