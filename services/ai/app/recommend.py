"""Hybrid, explainable recommender.

Components (each scaled to [0, 1]):
  content        cosine between the user's taste vector (weighted TF-IDF of events they engaged with, plus
                 declared interests) and each candidate event;
  collaborative  item-item cosine on the user x event interaction matrix ("people who engaged with X also
                 engaged with Y");
  popularity     recent engagement (log-scaled) with a small rating bonus;
  proximity      exp(-distance/6km) when a location is known;
  freshness      events starting soon / newly published.

Weights shift automatically when a component is unavailable (no history, tiny matrix, no location).
A greedy re-ranking step penalises repeating the same category so the shelf stays varied.
Every recommendation carries its components and a plain-Arabic reason.
"""
from __future__ import annotations

import math
from datetime import datetime

import numpy as np
from scipy import sparse
from sklearn.feature_extraction.text import TfidfVectorizer

from . import timeutil
from .arabic import tokens
from .schemas import AiEvent, Location, Recommendation, RecommendRequest, RecommendResponse
from .search import _distance_km

PERSONALIZED_WEIGHTS = {"content": 0.34, "collaborative": 0.26, "popularity": 0.14, "proximity": 0.14, "freshness": 0.12}
COLD_START_WEIGHTS = {"popularity": 0.45, "freshness": 0.25, "proximity": 0.30}
MIN_USERS_FOR_CF = 8
CATEGORY_PENALTY = 0.85


def _doc(event: AiEvent) -> list[str]:
    toks = tokens(" ".join([event.title, event.eventType, event.summary, " ".join(event.highlights), event.audience]))
    toks += tokens(event.title)  # title counts double
    toks += [f"cat:{event.category}"] * 3
    return toks


def _analyzer(doc):
    return doc  # documents are pre-tokenised lists


def _minmax(values: np.ndarray) -> np.ndarray:
    if len(values) == 0:
        return values
    top = float(values.max())
    return values / top if top > 0 else np.zeros_like(values)


def _item_similarity(matrix: list[tuple[int, int, float]], min_users: int):
    """Item-item cosine similarity from (user, event, weight) triples. Returns (S, event_index) or None."""
    if not matrix:
        return None
    users = {u for u, _, _ in matrix}
    if len(users) < min_users:
        return None
    event_ids = sorted({e for _, e, _ in matrix})
    e_index = {e: i for i, e in enumerate(event_ids)}
    u_index = {u: i for i, u in enumerate(sorted(users))}
    rows = [u_index[u] for u, _, _ in matrix]
    cols = [e_index[e] for _, e, _ in matrix]
    vals = [w for _, _, w in matrix]
    x = sparse.csr_matrix((vals, (rows, cols)), shape=(len(u_index), len(e_index)), dtype=float)
    norms = np.sqrt(np.asarray(x.multiply(x).sum(axis=0)).ravel())
    norms[norms == 0] = 1
    xn = x.multiply(1 / norms).tocsr()
    sim = (xn.T @ xn).toarray()
    np.fill_diagonal(sim, 0.0)
    return sim, e_index


def recommend(req: RecommendRequest) -> RecommendResponse:
    now = timeutil.parse_iso(req.now)
    # Already booked (API) or favourited/shared (weight >= 3): the user knows these, do not repeat them.
    excluded = set(req.excludeIds) | {h.eventId for h in req.user.history if h.weight >= 3}
    candidates = [e for e in req.events if e.id not in excluded and e.seatsLeft != 0]
    if not candidates:
        return RecommendResponse(recommendations=[], strategy="cold_start")

    known = {e.id: e for e in [*req.pastEvents, *req.events]}
    history = {h.eventId: h.weight for h in req.user.history}
    history_events = [known[i] for i in history if i in known]
    interests = [c for c in req.user.interests]
    personalized = bool(history_events or interests)

    n = len(candidates)
    components: dict[str, np.ndarray] = {}
    because_content: dict[int, str] = {}
    because_collab: dict[int, str] = {}

    # ---- content ---------------------------------------------------------------------------------
    if personalized:
        docs = {e.id: _doc(e) for e in known.values()}
        vectorizer = TfidfVectorizer(analyzer=_analyzer, sublinear_tf=True)
        ids = list(docs)
        matrix = vectorizer.fit_transform([docs[i] for i in ids])
        row = {i: k for k, i in enumerate(ids)}
        profile = sparse.csr_matrix((1, matrix.shape[1]))
        for event in history_events:
            profile = profile + history[event.id] * matrix[row[event.id]]
        for category in interests:
            vec = vectorizer.transform([[f"cat:{category}"] * 3])
            profile = profile + 2.0 * vec
        if profile.nnz:
            cand_rows = matrix[[row[e.id] for e in candidates]]
            sims = (cand_rows @ profile.T).toarray().ravel()
            pnorm = math.sqrt(float(profile.multiply(profile).sum())) or 1.0
            cnorm = np.sqrt(np.asarray(cand_rows.multiply(cand_rows).sum(axis=1)).ravel())
            cnorm[cnorm == 0] = 1
            content = sims / (pnorm * cnorm)
            components["content"] = _minmax(np.clip(content, 0, None))
            # nearest engaged event, used for the explanation
            if history_events:
                hist_rows = matrix[[row[e.id] for e in history_events]]
                pair = (cand_rows @ hist_rows.T).toarray()
                hn = np.sqrt(np.asarray(hist_rows.multiply(hist_rows).sum(axis=1)).ravel())
                hn[hn == 0] = 1
                pair = pair / (cnorm[:, None] * hn[None, :])
                for k, event in enumerate(candidates):
                    pair[k, [idx for idx, h in enumerate(history_events) if h.id == event.id]] = 0.0  # never "similar to itself"
                    j = int(pair[k].argmax())
                    if pair[k, j] >= 0.25:
                        because_content[event.id] = history_events[j].title

    # ---- collaborative ---------------------------------------------------------------------------
    sim = _item_similarity(req.matrix, MIN_USERS_FOR_CF) if history_events else None
    if sim is not None:
        s, e_index = sim
        collab = np.zeros(n)
        total_w = sum(w for i, w in history.items() if i in e_index) or 1.0
        for k, event in enumerate(candidates):
            if event.id not in e_index:
                continue
            best, best_title = 0.0, None
            for h_id, w in history.items():
                if h_id in e_index and h_id != event.id:
                    contribution = w * s[e_index[h_id], e_index[event.id]]
                    collab[k] += contribution
                    if contribution > best and h_id in known:
                        best, best_title = contribution, known[h_id].title
            if best_title:
                because_collab[event.id] = best_title
        collab /= total_w
        if collab.max() > 0:
            components["collaborative"] = _minmax(collab)

    # ---- popularity / proximity / freshness ------------------------------------------------------
    pops = np.array([math.log1p(e.popularity) for e in candidates])
    pop = _minmax(pops)
    ratings = np.array([((e.avgRating - 3) / 2) if e.avgRating else 0.0 for e in candidates])
    components["popularity"] = np.clip(0.85 * pop + 0.15 * ratings, 0, 1)

    distances = [_distance_km(e, req.location) for e in candidates]
    if req.location is not None and all(d is not None for d in distances):
        components["proximity"] = np.array([math.exp(-d / 6) for d in distances])  # type: ignore[operator]

    fresh = []
    for e in candidates:
        starts = timeutil.parse_iso(e.startsAt)
        days = max(0.0, (starts - now).total_seconds() / 86400)
        urgency = 1 / (1 + days / 7)
        is_new = 0.0
        if e.createdAt:
            age = (now - timeutil.parse_iso(e.createdAt)).total_seconds() / 86400
            is_new = 1.0 if age <= 7 else 0.0
        fresh.append(min(1.0, 0.8 * urgency + 0.2 * is_new))
    components["freshness"] = np.array(fresh)

    # ---- blend ---------------------------------------------------------------------------------
    base_weights = PERSONALIZED_WEIGHTS if personalized else COLD_START_WEIGHTS
    weights = {k: v for k, v in base_weights.items() if k in components}
    total = sum(weights.values())
    weights = {k: v / total for k, v in weights.items()}
    scores = sum(components[k] * w for k, w in weights.items())
    # Viewed-but-not-saved events stay eligible but rank lower than fresh discoveries.
    seen = np.array([1 / (1 + 0.5 * history.get(e.id, 0.0)) for e in candidates])
    scores = scores * seen

    # ---- diversify (greedy, category penalty) ---------------------------------------------------
    remaining = set(range(n))
    picked: list[int] = []
    per_category: dict[str, int] = {}
    while remaining and len(picked) < req.limit:
        best = max(remaining, key=lambda k: scores[k] * (CATEGORY_PENALTY ** per_category.get(candidates[k].category, 0)))
        picked.append(best)
        remaining.discard(best)
        per_category[candidates[best].category] = per_category.get(candidates[best].category, 0) + 1

    out: list[Recommendation] = []
    for k in picked:
        event = candidates[k]
        comps = {name: round(float(components[name][k]), 3) for name in components}
        out.append(Recommendation(
            eventId=event.id, score=round(float(scores[k]), 4), components=comps,
            reasons=_reasons(event, comps, weights, because_content, because_collab, distances[k], interests, now),
        ))
    return RecommendResponse(recommendations=out, strategy="personalized" if personalized else "cold_start")


def _reasons(event: AiEvent, comps, weights, because_content, because_collab, distance, interests, now: datetime) -> list[str]:
    contributions = sorted(((comps.get(name, 0) * w, name) for name, w in weights.items()), reverse=True)
    reasons: list[str] = []
    for _, name in contributions:
        if len(reasons) == 2:
            break
        value = comps.get(name, 0)
        if name == "content" and value >= 0.35:
            if event.id in because_content:
                reasons.append(f"تشبه «{because_content[event.id]}» اللي أبديت اهتمامك فيها")
            elif event.category in interests:
                reasons.append(f"من اهتماماتك: {event.category}")
        elif name == "collaborative" and value >= 0.35 and event.id in because_collab:
            reasons.append(f"مهتمون بـ «{because_collab[event.id]}» اهتموا فيها أيضًا")
        elif name == "popularity" and value >= 0.6:
            reasons.append("من الأكثر إقبالًا هذا الأسبوع")
        elif name == "proximity" and distance is not None and distance <= 5:
            reasons.append(f"قريبة منك ({distance:.1f} كم)")
        elif name == "freshness" and value >= 0.6:
            starts = timeutil.parse_iso(event.startsAt)
            reasons.append("تبدأ قريبًا: " + timeutil.format_when(starts, timeutil.parse_iso(event.endsAt), now))
    if not reasons:
        reasons.append("مختارة لتنوّع اختياراتك")
    return reasons
