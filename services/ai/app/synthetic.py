"""Synthetic history of past Madinah events with registrations.

Used to train the attendance-forecast model. It is generated (deterministically) because the
platform has no real booking history yet, so the *effects* below are assumptions encoded on purpose
(weekend peaks, evening peaks, price sensitivity, promotion lead time, capacity caps). What the
project demonstrates is the pipeline: feature engineering, cross-validated evaluation, prediction
intervals, interpretable what-if drivers, and the ability to retrain on real bookings.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

CATEGORIES = ["عائلي", "تراث", "ثقافة", "فن", "رياضة", "ورش", "طعام وقهوة", "تقنية"]
DISTRICTS = ["المنطقة المركزية", "قباء", "حي العزيزية", "حي العريض", "حي الخالدية", "حي الهجرة", "منطقة أحد", "حي العوالي"]

CATEGORY_BASE = {"عائلي": 85, "تراث": 75, "ثقافة": 42, "فن": 52, "رياضة": 38, "ورش": 24, "طعام وقهوة": 34, "تقنية": 48}
PRICE_SENSITIVITY = {"عائلي": 0.020, "تراث": 0.016, "ثقافة": 0.014, "فن": 0.012, "رياضة": 0.010, "ورش": 0.006,
                     "طعام وقهوة": 0.011, "تقنية": 0.015}
WEEKDAY_FACTOR = [0.72, 0.66, 0.72, 0.90, 1.25, 1.45, 1.35]  # Sunday..Saturday (Fri/Sat = weekend)
DISTRICT_FACTOR = {"المنطقة المركزية": 1.2, "قباء": 1.1, "حي العزيزية": 1.0, "حي العريض": 1.0, "حي الخالدية": 0.95,
                   "حي الهجرة": 0.9, "منطقة أحد": 0.8, "حي العوالي": 0.85}
# preferred start-hour peaks per category: list of (centre, width)
HOUR_PEAKS = {"عائلي": [(19, 2.6)], "تراث": [(19.5, 2.5)], "ثقافة": [(20, 2.5)], "فن": [(20, 2.4)],
              "رياضة": [(6, 1.2), (17, 1.8)], "ورش": [(17.5, 3.0)], "طعام وقهوة": [(19, 2.5)], "تقنية": [(9.5, 2.5)]}

FEATURES_CAT = ["category", "district"]
FEATURES_NUM = ["price_sar", "log_capacity", "weekday", "start_hour", "duration_hours", "lead_days", "featured"]


def hour_factor(category: str, hour: float) -> float:
    peak = max(np.exp(-0.5 * ((hour - c) / w) ** 2) for c, w in HOUR_PEAKS[category])
    return 0.35 + 0.65 * peak


def expected_demand(category, district, price, capacity, weekday, hour, duration, lead, featured) -> float:
    lam = CATEGORY_BASE[category]
    lam *= WEEKDAY_FACTOR[weekday] * hour_factor(category, hour) * DISTRICT_FACTOR[district]
    lam *= np.exp(-PRICE_SENSITIVITY[category] * price) * (1.12 if price == 0 else 1.0)
    lam *= 0.35 + 0.65 * (1 - np.exp(-lead / 6))
    lam *= 1 / (1 + 0.05 * max(0.0, duration - 4))
    lam *= (capacity / 100) ** 0.12
    lam *= 1.25 if featured else 1.0
    return float(lam)


def generate(n: int = 800, seed: int = 7) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    rows = []
    cat_share = np.array([0.16, 0.12, 0.12, 0.13, 0.12, 0.15, 0.10, 0.10])
    for i in range(n):
        category = str(rng.choice(CATEGORIES, p=cat_share))
        district = str(rng.choice(DISTRICTS))
        free = rng.random() < (0.55 if category in ("تراث", "تقنية", "ثقافة") else 0.3)
        price = 0.0 if free else float(np.round(rng.choice([10, 15, 20, 25, 30, 35, 45, 55, 60, 80, 120]), 0))
        cap_scale = {"عائلي": 200, "تراث": 220, "ثقافة": 90, "فن": 110, "رياضة": 60, "ورش": 25, "طعام وقهوة": 60, "تقنية": 120}[category]
        capacity = int(max(10, np.round(rng.lognormal(np.log(cap_scale), 0.45) / 5) * 5))
        weekday = int(rng.choice(7, p=[0.10, 0.08, 0.10, 0.14, 0.20, 0.20, 0.18]))
        if category == "تقنية":
            hour = float(rng.choice([8, 9, 9.5, 10, 14, 16]))
        elif category == "رياضة":
            hour = float(rng.choice([5.5, 6, 6.5, 16, 17, 18, 20.5]))
        else:
            hour = float(rng.choice([9, 10, 16, 16.5, 17, 17.5, 18, 18.5, 19, 19.5, 20, 20.5, 21]))
        duration = float(np.round(rng.uniform(6, 8) if category == "تقنية" else rng.uniform(1.5, 5), 1))
        lead = float(np.round(rng.gamma(3.0, 4.0) + 1, 0))
        lead = min(lead, 45.0)
        featured = int(rng.random() < 0.12)
        lam = expected_demand(category, district, price, capacity, weekday, hour, duration, lead, featured)
        demand = rng.poisson(rng.gamma(shape=12, scale=lam / 12))  # over-dispersed counts
        bookings = int(min(capacity, demand))
        rows.append({
            "event_id": i + 1, "category": category, "district": district, "price_sar": price, "capacity": capacity,
            "weekday": weekday, "start_hour": hour, "duration_hours": duration, "lead_days": lead,
            "featured": featured, "bookings": bookings, "sold_out": int(demand >= capacity),
        })
    return pd.DataFrame(rows)
