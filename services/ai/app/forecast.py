"""Attendance (registrations) forecast for organizers.

* Model: gradient boosting on log1p(bookings) with two extra quantile models (10% / 90%) for an
  80% prediction interval.
* Explanations are counterfactual and model-agnostic: for each factor we re-predict with that factor
  replaced by a neutral reference (average over its values) and report the % difference.
* Slot advice scans weekday x start-hour combinations holding everything else fixed.
* Training data: data/historical_events.csv (synthetic, see app/synthetic.py). Swap in real bookings by
  passing a DataFrame with the same columns to ForecastModel.fit.
"""
from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import KFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from . import timeutil
from .schemas import ForecastRequest
from .synthetic import CATEGORIES, DISTRICTS, FEATURES_CAT, FEATURES_NUM, generate

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "historical_events.csv"
HOURS = [8, 9, 10, 14, 16, 17, 18, 19, 20, 21]
LEAD_REFERENCE = 7.0


def _pipeline(loss: str = "squared_error", alpha: float | None = None) -> Pipeline:
    pre = ColumnTransformer([("cat", OneHotEncoder(handle_unknown="ignore"), FEATURES_CAT)], remainder="passthrough")
    params = dict(n_estimators=250, max_depth=3, learning_rate=0.05, subsample=0.8, random_state=7, loss=loss)
    if alpha is not None:
        params["alpha"] = alpha
    return Pipeline([("pre", pre), ("gbr", GradientBoostingRegressor(**params))])


def _fit_interval(x: pd.DataFrame, y: np.ndarray, coverage: float = 0.8):
    """Conformalised quantile regression: quantile models on 80% of rows, widened by the
    (1+1/n)-corrected quantile of conformity scores measured on the remaining 20%."""
    rng = np.random.default_rng(11)
    order = rng.permutation(len(x))
    cut = int(len(x) * 0.8)
    train, calib = order[:cut], order[cut:]
    lo = _pipeline("quantile", (1 - coverage) / 2).fit(x.iloc[train], y[train])
    hi = _pipeline("quantile", 1 - (1 - coverage) / 2).fit(x.iloc[train], y[train])
    scores = np.maximum(lo.predict(x.iloc[calib]) - y[calib], y[calib] - hi.predict(x.iloc[calib]))
    level = min(1.0, coverage * (1 + 1 / len(calib)))
    q = float(np.quantile(scores, level))
    return lo, hi, q


def _prepare(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["log_capacity"] = np.log(out["capacity"].astype(float))
    return out[FEATURES_CAT + FEATURES_NUM]


@dataclass
class ForecastModel:
    mean: Pipeline | None = None
    low: Pipeline | None = None
    high: Pipeline | None = None
    card: dict = field(default_factory=dict)
    median_price: float = 0.0
    median_capacity: float = 100.0
    conformal_q: float = 0.0  # log-space widening learned on a calibration split (CQR)

    # ---- training ---------------------------------------------------------------------------------
    def fit(self, df: pd.DataFrame, *, evaluate: str = "holdout") -> "ForecastModel":
        x, y = _prepare(df), np.log1p(df["bookings"].to_numpy(dtype=float))
        metrics = self._evaluate(df, x, y, evaluate) if evaluate else self._stored_metrics()
        self.mean = _pipeline().fit(x, y)
        self.low, self.high, self.conformal_q = _fit_interval(x, y)
        self.median_price = float(df["price_sar"].median())
        self.median_capacity = float(df["capacity"].median())
        self.card = {
            "name": "EventBoard attendance forecast",
            "algorithm": "GradientBoostingRegressor (mean) + quantile models (P10/P90) with conformal calibration (CQR)",
            "target": "confirmed registrations (log1p transformed during training)",
            "trainedOn": {"rows": int(len(df)), "source": "synthetic history (see docs/ai.md)"},
            "features": FEATURES_CAT + FEATURES_NUM,
            "metrics": metrics,
            "limitations": [
                "Trained on synthetic data: effects such as weekend peaks are assumptions, not measurements.",
                "Registrations are capped by capacity, so sold-out events understate true demand.",
                "The 80% interval is conformally calibrated on this synthetic distribution; recalibrate on real data.",
            ],
        }
        return self

    def _evaluate(self, df: pd.DataFrame, x: pd.DataFrame, y: np.ndarray, mode: str) -> dict:
        bookings = df["bookings"].to_numpy(dtype=float)
        splits = list(KFold(n_splits=5, shuffle=True, random_state=7).split(x)) if mode == "cv" else None
        if splits is None:
            rng = np.random.default_rng(7)
            idx = rng.permutation(len(x))
            cut = int(len(x) * 0.8)
            splits = [(idx[:cut], idx[cut:])]
        preds, lows, highs, truth, base = [], [], [], [], []
        for train, test in splits:
            mean = _pipeline().fit(x.iloc[train], y[train])
            lo, hi, q = _fit_interval(x.iloc[train], y[train])
            preds.append(np.expm1(mean.predict(x.iloc[test])))
            lows.append(np.expm1(lo.predict(x.iloc[test]) - q))
            highs.append(np.expm1(hi.predict(x.iloc[test]) + q))
            truth.append(bookings[test])
            cat_mean = df.iloc[train].groupby("category")["bookings"].mean()
            base.append(df.iloc[test]["category"].map(cat_mean).to_numpy(dtype=float))
        p, lo, hi, t, b = map(np.concatenate, (preds, lows, highs, truth, base))
        return {
            "validation": "5-fold cross-validation" if mode == "cv" else "80/20 holdout",
            "mae": round(float(mean_absolute_error(t, p)), 2),
            "baselineMaeCategoryMean": round(float(mean_absolute_error(t, b)), 2),
            "r2": round(float(r2_score(t, p)), 3),
            "wape": round(float(np.abs(t - p).sum() / max(t.sum(), 1)), 3),
            "intervalCoverage80": round(float(np.mean((t >= lo) & (t <= hi))), 3),
        }

    @staticmethod
    def _stored_metrics() -> dict:
        path = DATA_PATH.parent / "model_metrics.json"
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
        return {}

    # ---- prediction -------------------------------------------------------------------------------
    @staticmethod
    def _row(category, district, price, capacity, weekday, hour, duration, lead, featured) -> pd.DataFrame:
        return pd.DataFrame([{
            "category": category, "district": district, "price_sar": float(price),
            "log_capacity": math.log(max(capacity, 1)), "weekday": int(weekday), "start_hour": float(hour),
            "duration_hours": float(duration), "lead_days": float(lead), "featured": int(featured),
        }])[FEATURES_CAT + FEATURES_NUM]

    def _predict_rows(self, rows: pd.DataFrame, capacity: float | None) -> np.ndarray:
        assert self.mean is not None
        values = np.expm1(self.mean.predict(rows))
        if capacity:
            values = np.minimum(values, capacity)
        return np.maximum(values, 0)

    def predict(self, req: ForecastRequest) -> dict:
        assert self.mean and self.low and self.high
        starts = timeutil.parse_iso(req.startsAt)
        weekday, hour = timeutil.weekday_sun0(starts), timeutil.to_riyadh(starts).hour + timeutil.to_riyadh(starts).minute / 60
        district = req.district if req.district in DISTRICTS else "المنطقة المركزية"
        category = req.category if req.category in CATEGORIES else "ثقافة"
        capacity = req.capacity or None
        cap_for_model = capacity or self.median_capacity

        base = dict(category=category, district=district, price=req.price, capacity=cap_for_model, weekday=weekday,
                    hour=hour, duration=req.durationHours, lead=req.leadDays, featured=req.featured)
        row = self._row(**base)
        expected = float(self._predict_rows(row, capacity)[0])
        low = float(np.expm1(self.low.predict(row) - self.conformal_q)[0])
        high = float(np.expm1(self.high.predict(row) + self.conformal_q)[0])
        if capacity:
            low, high = min(low, capacity), min(high, capacity)
        low, high = max(0.0, min(low, expected)), max(high, expected)

        return {
            "expectedBookings": int(round(expected)),
            "low": int(round(low)),
            "high": int(round(high)),
            "expectedFillRate": round(expected / capacity, 2) if capacity else None,
            "drivers": self._drivers(base, expected, capacity),
            "slots": self._slots(base, capacity),
            "capacityAdvice": self._capacity_advice(expected, high, capacity),
            "model": {k: self.card[k] for k in ("name", "algorithm", "trainedOn", "metrics")},
        }

    # ---- explanations -----------------------------------------------------------------------------
    def _avg_over(self, base: dict, key: str, values: list, capacity: float | None) -> float:
        rows = pd.concat([self._row(**{**base, key: v}) for v in values], ignore_index=True)
        return float(np.mean(self._predict_rows(rows, capacity)))

    def _drivers(self, base: dict, expected: float, capacity: float | None) -> list[dict]:
        factors = [
            ("category", "نوع الفعالية", "category", CATEGORIES),
            ("weekday", f"يوم {timeutil.WEEKDAYS_AR[base['weekday']]}", "weekday", list(range(7))),
            ("hour", "وقت البداية", "hour", HOURS),
            ("price", "السعر", "price", [0, 20, 40, 60, 90]),
            ("lead", "مدة الترويج قبل الفعالية", "lead", [LEAD_REFERENCE]),
            ("district", "الحي", "district", DISTRICTS),
            ("featured", "ظهور مميز", "featured", [0]),
        ]
        drivers = []
        for factor, label, key, values in factors:
            reference = self._avg_over(base, key, list(values), capacity)
            if reference <= 0.5:
                continue
            impact = (expected - reference) / reference
            drivers.append({"factor": factor, "label": label, "impact": round(float(impact), 3)})
        drivers.sort(key=lambda d: abs(d["impact"]), reverse=True)
        return drivers[:4]

    def _slots(self, base: dict, capacity: float | None) -> list[dict]:
        best_per_day = []
        for weekday in range(7):
            rows = pd.concat([self._row(**{**base, "weekday": weekday, "hour": h}) for h in HOURS], ignore_index=True)
            preds = self._predict_rows(rows, capacity)
            k = int(np.argmax(preds))
            best_per_day.append((float(preds[k]), weekday, HOURS[k]))
        best_per_day.sort(reverse=True)
        slots = []
        for value, weekday, hour in best_per_day[:3]:
            h12 = hour % 12 or 12
            label = f"{timeutil.WEEKDAYS_AR[weekday]} {h12}:00 {'ص' if hour < 12 else 'م'}"
            slots.append({"label": label, "weekday": weekday, "hour": hour, "expectedBookings": int(round(value))})
        return slots

    @staticmethod
    def _capacity_advice(expected: float, high: float, capacity: int | None) -> str:
        def round5(x: float) -> int:
            return int(math.ceil(x / 5.0) * 5)

        if not capacity:
            return f"السعة المقترحة حوالي {round5(high)} مقعد (تغطي الطلب المتوقع في السيناريو المتفائل)."
        fill = expected / capacity
        if high >= capacity and fill >= 0.85:
            return f"الطلب المتوقع قريب من السعة. فكّر برفع السعة إلى {round5(high * 1.1)} أو إضافة جلسة ثانية."
        if fill < 0.4:
            return f"السعة كبيرة على الطلب المتوقع. حوالي {round5(high)} مقعد تكفي وتخلي الفعالية تبدو ممتلئة."
        return "السعة مناسبة للطلب المتوقع."


_MODEL: ForecastModel | None = None


def load_training_frame() -> pd.DataFrame:
    if DATA_PATH.exists():
        return pd.read_csv(DATA_PATH)
    return generate()


def get_model() -> ForecastModel:
    global _MODEL
    if _MODEL is None:
        _MODEL = ForecastModel().fit(load_training_frame(), evaluate=None)
    return _MODEL
