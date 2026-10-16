import { categoryStyle } from "../lib/categories";
import { assetUrl } from "../lib/assets";
import type { EventItem } from "../types";

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Event photo, or an original flat poster when the organizer did not upload one.
 * Six compositions (arches, sun, bands, arcs, minarets, quarter-tiles), picked deterministically
 * from the title and coloured from the category palette, so every imageless event still reads as a poster.
 */
export function EventCover({ event, eager = false }: { event: Pick<EventItem, "image" | "category" | "title">; eager?: boolean }) {
  if (event.image) {
    return <img className="cover-img" src={assetUrl(event.image)} alt="" loading={eager ? "eager" : "lazy"} decoding="async" />;
  }
  const { bg, a, b, dark } = categoryStyle(event.category).poster;
  const ink = dark ? "#fff7ec" : "#25122f";
  const variant = hash(event.title) % 6;
  return (
    <svg className="cover-gen" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="300" height="400" fill={bg} />
      {variant === 0 && (
        <>
          <path d="M20 400V210a130 130 0 0 1 260 0v190Z" fill={a} />
          <path d="M60 400V215a90 90 0 0 1 180 0v185Z" fill={b} />
          <path d="M105 400V222a45 45 0 0 1 90 0v178Z" fill={ink} />
        </>
      )}
      {variant === 1 && (
        <>
          <circle cx="150" cy="170" r="105" fill={b} />
          <path d="M0 300 80 215l60 70 70-95 90 110v100H0Z" fill={a} />
          <rect y="335" width="300" height="12" fill={ink} />
          <rect y="362" width="300" height="12" fill={ink} />
        </>
      )}
      {variant === 2 && (
        <>
          <path d="M-20 130 320 -40v90L-20 220Z" fill={a} />
          <path d="M-20 250 320 80v90L-20 340Z" fill={b} />
          <path d="M-20 370 320 200v90L-20 460Z" fill={ink} />
        </>
      )}
      {variant === 3 && (
        <>
          <circle cx="300" cy="400" r="300" fill={a} />
          <circle cx="300" cy="400" r="225" fill={bg} />
          <circle cx="300" cy="400" r="150" fill={b} />
          <circle cx="300" cy="400" r="75" fill={ink} />
        </>
      )}
      {variant === 4 && (
        <>
          <path d="M20 400V250a30 30 0 0 1 60 0v150Z" fill={a} />
          <path d="M95 400V130a35 35 0 0 1 70 0v270Z" fill={b} />
          <path d="M180 400V200a30 30 0 0 1 60 0v200Z" fill={ink} />
          <circle cx="262" cy="70" r="26" fill={b} />
        </>
      )}
      {variant === 5 && (
        <>
          <path d="M0 400V240a80 80 0 0 1 80 80v80Z" fill={a} />
          <path d="M150 400v-80a80 80 0 0 1 80-80h70v160Z" fill={b} />
          <circle cx="75" cy="80" r="75" fill={ink} />
          <path d="M150 155V0h150a150 150 0 0 1-150 155Z" fill={a} />
        </>
      )}
    </svg>
  );
}
