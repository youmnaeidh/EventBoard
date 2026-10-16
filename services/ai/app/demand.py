"""Demand-gap analysis: what do people search for, and does the catalogue have it?

Search-log queries are grouped into topics using the domain lexicon (so "سيراميك", "ورشة فخار" and
"ودي بورشة فخار" land together). Each topic gets demand (searches, 7-day vs previous-7-day trend,
share of searches that returned nothing) and supply (upcoming events whose text matches the topic,
measured with the same retrieval engine used by search). Opportunity = demand relative to supply.
"""
from __future__ import annotations

import statistics
from collections import Counter, defaultdict
from datetime import timedelta

from . import lexicon as lx
from . import timeutil
from .arabic import normalize
from .intent import parse
from .schemas import AiEvent, DemandGapsRequest
from .search import get_engine

GENERIC = {"ورشة", "فن", "طعام"}  # broad concepts: only used when nothing more specific matches
SUPPLY_THRESHOLD = 0.35
RANK = {"high": 2, "medium": 1, "low": 0}


def _topic_key(query: str) -> tuple[str, str | None] | None:
    intent = parse(query)
    if intent.concepts:
        specific = [c for c in intent.concepts if c not in GENERIC]
        concept = (specific or intent.concepts)[0]
        return f"concept:{concept}", lx.CONCEPTS.category.get(concept)
    if intent.topic_tokens:
        return "text:" + " ".join(intent.topic_tokens), None
    if intent.family:
        return "intent:family", "عائلي"
    return None  # pure filters such as "الليلة" or "مجاني": demand for a time/price, not a topic


def _supply(label: str, key: str, events: list[AiEvent], engine) -> int:
    if key == "intent:family":
        return sum(1 for e in events if e.category == "عائلي" or "عائل" in normalize(e.audience) or "اطفال" in normalize(e.audience))
    relevance = engine.relevance(label)
    return int((relevance >= SUPPLY_THRESHOLD).sum())


def analyze(req: DemandGapsRequest) -> dict:
    now = timeutil.parse_iso(req.now)
    engine = get_engine(req.events) if req.events else None
    week = timedelta(days=7)

    clusters: dict[str, dict] = defaultdict(lambda: {"queries": Counter(), "times": [], "zero": 0, "category": Counter()})
    for item in req.searches:
        topic = _topic_key(item.q)
        if topic is None:
            continue
        key, category = topic
        c = clusters[key]
        c["queries"][item.q.strip()] += 1
        c["times"].append(timeutil.parse_iso(item.at))
        c["zero"] += 1 if item.results == 0 else 0
        if item.category or category:
            c["category"][item.category or category] += 1

    rows = []
    for key, c in clusters.items():
        searches = len(c["times"])
        if searches < 3:
            continue
        label = c["queries"].most_common(1)[0][0]
        s7 = sum(1 for t in c["times"] if now - week <= t <= now)
        p7 = sum(1 for t in c["times"] if now - 2 * week <= t < now - week)
        supply = _supply(label, key, req.events, engine) if engine else 0
        rows.append({
            "label": label,
            "category": c["category"].most_common(1)[0][0] if c["category"] else None,
            "searches": searches,
            "searches7d": s7,
            "prev7d": p7,
            "trend": round((s7 - p7) / p7, 2) if p7 >= 3 else None,
            "zeroResultShare": round(c["zero"] / searches, 2),
            "supply": supply,
            "demandRatio": round(searches / (supply + 1), 1),
            "exampleQueries": [q for q, _ in c["queries"].most_common(3)],
        })

    median_ratio = statistics.median([r["demandRatio"] for r in rows]) if rows else 1.0
    median_ratio = max(median_ratio, 1.0)
    clustered_total = sum(r["searches"] for r in rows) or 1
    for r in rows:
        if (r["supply"] == 0 and r["searches"] >= max(10, 0.03 * clustered_total)) or r["demandRatio"] >= 4 * median_ratio:
            r["opportunity"] = "high"
        elif (r["supply"] <= 1 and r["searches"] >= 10) or r["demandRatio"] >= 2 * median_ratio:
            r["opportunity"] = "medium"
        else:
            r["opportunity"] = "low"

    rows.sort(key=lambda r: (RANK[r["opportunity"]], r["demandRatio"]), reverse=True)
    return {"gaps": rows[:12], "totalSearches": len(req.searches)}
