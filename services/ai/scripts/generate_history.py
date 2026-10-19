"""Regenerate data/historical_events.csv (deterministic)."""
from pathlib import Path

from app.synthetic import generate

out = Path(__file__).resolve().parent.parent / "data" / "historical_events.csv"
df = generate()
df.to_csv(out, index=False)
print(f"wrote {len(df)} rows to {out}")
print(df.groupby("category").bookings.agg(["count", "mean"]).round(1))
