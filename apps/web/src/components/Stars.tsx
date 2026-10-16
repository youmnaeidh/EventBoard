import { Icon } from "./Icon";

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="stars" role="img" aria-label={`${value.toFixed(1)} من 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= Math.round(value) ? "on" : ""}>
          <Icon name="star" size={size} filled={i <= Math.round(value)} />
        </span>
      ))}
    </span>
  );
}

export function RatingBadge({ value, count }: { value: number | null; count: number }) {
  if (!value || count === 0) return <span className="muted-sm">جديدة</span>;
  return (
    <span className="rating-badge">
      <Icon name="star" size={14} filled />
      <b className="num">{value.toFixed(1)}</b>
      <span className="muted-sm num">({count})</span>
    </span>
  );
}
