# AI & data in EventBoard v2

Five capabilities, one stateless FastAPI service (`services/ai`). The API sends everything needed in each request, so the service holds no user data
and can be scaled or replaced independently. Every capability has a non-AI fallback in the API, so an AI outage degrades features, not the site.

> **Read this first.** All activity data in this repository is **synthetic**. The numbers below show that the pipelines work and how they behave on
> data with *known, assumed* structure; they are not evidence of real-world accuracy. Where something was not verified, it says so.

| # | Capability | Method | Where |
|---|---|---|---|
| 1 | Smart search (Arabic) | BM25 + char n-gram TF-IDF (+ optional dense embeddings), intent parsing, staged filter relaxation | `app/search.py`, `intent.py`, `arabic.py`, `lexicon.py` |
| 2 | Recommendations that explain themselves | Content + item-item collaborative + popularity + proximity + freshness, diversified | `app/recommend.py` |
| 3 | Attendance forecast | Gradient boosting + conformalized quantile regression, counterfactual drivers, slot scan | `app/forecast.py`, `synthetic.py` |
| 4 | Demand gaps | Topic clustering of searches vs. estimated supply | `app/demand.py` |
| 5 | Grounded assistant | Retrieval first; LLM only phrases an answer about retrieved events | `app/assistant.py` |

## 1. Smart search

**Pipeline.** Normalise Arabic (alef/yaa/taa-marbuta variants, diacritics, tatweel) → light stemmer → dialect lexicon (e.g. «ابغى/ودي/أبي», «الليلة», «ببلاش»)
→ parse intent → score → rank.

- **Intent** (`intent.py`): free / price cap, time window (tonight, tomorrow, weekend, week), audience (family, kids), proximity («قريب مني»), category words.
  Time, price and "free" are *hard filters*; audience/category are *soft boosts*.
- **Scoring**: `0.65 · BM25 + 0.35 · char-n-gram cosine` (BM25 is field-weighted by repeating title/type tokens and scaled against an upper bound so synonym-only
  hits cannot look perfect). With dense embeddings configured: `0.45 · BM25 + 0.20 · n-gram + 0.35 · dense`. Small additive terms for popularity, rating and urgency.
- **Never an empty page for no reason**: if the hard filters leave nothing they are relaxed in stages (strict → drop time → drop all) and the UI says so.
- **Explainability**: the response carries the interpreted chips ("الليلة · للعائلة · عائلي") and a per-result reason ("مناسبة للعائلة · اليوم 9:00 م").

*Verified:* 11 search tests including dialect spellings, typos, filters, relaxation, and a regression suite for failures found during development (e.g. «يوغا» leaking
into sports, max-normalised BM25 making synonym hits look perfect).
*Not verified:* the dense-embedding path with real model weights (`EMBEDDING_MODEL`, needs `requirements-embeddings.txt`; the sandbox could not download weights).

## 2. Recommendations

Each candidate gets five components in [0, 1]:

| component | meaning | weight (personalised) | weight (cold start) |
|---|---|---|---|
| content | cosine between the user's taste vector (engaged events + declared interests) and the event | 0.34 | – |
| collaborative | item-item cosine on the user × event matrix (needs ≥ 8 users) | 0.26 | – |
| popularity | log-scaled recent engagement (`popularity` from the API, 90-day window) + small rating bonus | 0.14 | 0.45 |
| proximity | `exp(−distance / 6 km)` | 0.14 | 0.30 |
| freshness | starts soon / newly published | 0.12 | 0.25 |

Weights renormalise when a component is unavailable. A greedy re-rank penalises repeating a category (×0.85 per repeat). Events the user booked or favourited (interaction weight ≥ 3) are excluded; views and shares only add to the taste profile. The **reason text** is built from the two largest weighted contributions
("تشبه «X» اللي أبديت اهتمامك فيها", "مهتمون بـ «Y» اهتموا فيها أيضًا", "قريبة منك (2.9 كم)", …).

Interaction weights (API, last 90 days): view 1, share 2, favourite 3, booking 5, un-favourite −3.
*Not done:* offline evaluation (HitRate@k / NDCG vs. a popularity baseline). On synthetic interactions it would mostly measure my generator, so it is left until real data exists.

## 3. Attendance forecast

**Target:** confirmed registrations (log1p). **Features:** category, district, price, log capacity, weekday (Sun = 0), start hour, duration, promotion lead days, featured.

- **Mean model:** `GradientBoostingRegressor` (250 trees, depth 3).
- **Interval:** two quantile models (P10/P90) fitted on 80% of rows and **conformally calibrated** on the held-out 20% (CQR), so the stated 80% range is measured, not assumed.
  Measured coverage in the CV run: 0.805.
- **Drivers (what-if explanations):** for each factor, re-predict with it replaced by a neutral reference (average over its values) and report the % difference. Model-agnostic, so it
  works for any regressor.
- **Slot advice:** scan weekday × start-hour with everything else fixed, return the three best days.
- **Capacity advice:** compare expected and upper bound against capacity (raise capacity / add a session / capacity is generous).

**Evaluation (5-fold CV on 800 synthetic past events — `scripts/evaluate_forecast.py`):**

| metric | model | baseline: mean per category |
|---|---|---|
| MAE (registrations) | **10.23** | 18.29 |
| R² | **0.699** | – |
| WAPE | 0.32 | – |
| 80% interval coverage | 0.805 | – |

**What this does and doesn't show.** The training data is generated by `app/synthetic.py` with assumed effects (weekend peak, evening peak, price sensitivity, lead-time saturation,
capacity caps, Poisson-like noise). The model recovers that structure well, which validates the *pipeline* (features, CV, calibration, explanations). It says nothing about whether real
Madinah events behave that way. Registrations are also censored by capacity, so sold-out events understate demand. To use real data: pass a DataFrame with the same columns to `ForecastModel.fit`.

## 4. Demand gaps

1. Every search is logged with its text and result count (`interactions.meta`).
2. Queries are mapped to **topics** with the lexicon's concept groups (so «ودي بورشة فخار» and «ورشة سيراميك» land together). Broad words («ورشة») only count when nothing more specific matches.
3. **Supply** = number of upcoming events whose search relevance for the topic is ≥ 0.35.
4. Per topic: searches in 28 days, share with zero results, supply, `demandRatio = searches / (supply + 1)`, and 7-day vs previous-7-day trend (only shown when the base has ≥ 3 searches).
5. **Opportunity**: *high* if supply is zero with meaningful volume (≥ max(10, 3% of clustered searches)) or the ratio is ≥ 4× the median; *medium* if supply ≤ 1 with volume ≥ 10 or ratio ≥ 2×; otherwise *low*.

In the demo data pottery («فخار») is deliberately trending with zero supply, mirroring the story behind the project.

## 5. Grounded assistant

Retrieval first, generation second. The hybrid engine selects up to six events; Claude (if `ANTHROPIC_API_KEY` is set, model from `ANTHROPIC_MODEL`) is given only those events and must return JSON
`{answer, event_ids}`. Event text is treated as untrusted data in the prompt, returned ids are **validated against the retrieved set** (the assistant cannot cite an event that doesn't exist),
and any failure falls back to a deterministic template answer (`mode: "offline"`, which the UI labels).

*Verified:* retrieval, id validation and fallback, plus the Messages-API request/response handling against a mocked HTTP client.
*Not verified:* a live call to the API with a real key (none was available while building).

## Chart colours

Charts are hand-written SVG/HTML (no chart library). Colours were checked with a palette validator rather than by eye: categorical series use `#6f45d6` and `#eb6834`
(passed the validator's colour-blind and contrast checks), the funnel uses an ordinal one-hue ramp (`#b8a0f2 → #4a2a96`, monotone lightness; passed), and diverging driver bars use the same
pair with explicit +/− labels and direction so colour is never the only channel. Every chart has a table alternative, keyboard-reachable tooltips, and a legend whenever there are two or more series.

## Reproduce

```bash
cd services/ai
pip install -r requirements.txt -r requirements-dev.txt
python -m pytest -q                       # 27 tests
python scripts/generate_history.py        # regenerate data/historical_events.csv (deterministic)
python scripts/evaluate_forecast.py       # 5-fold CV -> data/model_metrics.json
```
