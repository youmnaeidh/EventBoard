"""Hybrid retrieval for Arabic event search.

score = fusion of
  * BM25 over normalised, lightly-stemmed tokens (field-weighted by repetition),
  * TF-IDF cosine over character n-grams (robust to typos, dialect spellings and morphology),
  * optional dense embeddings (sentence-transformers) when EMBEDDING_MODEL is configured,
then structured intent (free / when / near / audience / category hints) is applied:
hard filters for free/price/time, soft boosts for the rest. If hard filters leave nothing,
they are relaxed one by one and the response says so.
"""
from __future__ import annotations

import math
import os
from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache
from typing import Protocol

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

from . import lexicon as lx
from . import timeutil
from .arabic import normalize, stem, tokens
from .intent import Intent, parse
from .schemas import AiEvent, Location

FIELD_REPEAT = {"title": 3, "eventType": 2, "highlights": 1, "summary": 1, "description": 1,
                "district": 1, "venue": 1, "audience": 1}
# Categories are indexed as one atomic token (cat:<name>) and only matched when the query names the
# category itself. Otherwise "قهوة" would match every event in "طعام وقهوة", including date tours.
CATEGORY_WORDS = {
    "ثقافة": ["ثقافه", "ثقافي"], "فن": ["فن", "فنون"], "تراث": ["تراث", "تراثي"], "رياضة": ["رياضه", "رياضي"],
    "ورش": ["ورش", "ورشه"], "طعام وقهوة": ["طعام", "اكل"], "تقنية": ["تقنيه", "تكنولوجيا"],
}
_CATEGORY_LOOKUP = {stem(w): c for c, words in CATEGORY_WORDS.items() for w in words}
K1, B = 1.4, 0.75
CONCEPT_WEIGHT = 0.5


class Embedder(Protocol):
    def encode(self, texts: list[str], *, query: bool = False) -> np.ndarray: ...


class SentenceTransformerEmbedder:
    def __init__(self, model_name: str) -> None:
        from sentence_transformers import SentenceTransformer  # optional dependency

        self.model = SentenceTransformer(model_name)
        self.e5 = "e5" in model_name.lower()

    def encode(self, texts: list[str], *, query: bool = False) -> np.ndarray:
        prefix = ("query: " if query else "passage: ") if self.e5 else ""
        vectors = self.model.encode([prefix + t for t in texts], normalize_embeddings=True)
        return np.asarray(vectors, dtype=np.float32)


@lru_cache(maxsize=1)
def default_embedder() -> Embedder | None:
    name = os.getenv("EMBEDDING_MODEL", "").strip()
    if not name:
        return None
    try:
        return SentenceTransformerEmbedder(name)
    except Exception as error:  # missing package, offline model hub, ...
        print(f"[search] dense embeddings disabled: {error}")
        return None


def event_text(event: AiEvent) -> str:
    return " ".join([event.title, event.category, event.eventType, event.summary, event.description,
                     " ".join(event.highlights), event.district, event.venue, event.audience])


def _field_tokens(event: AiEvent) -> list[str]:
    values = {
        "title": event.title, "eventType": event.eventType,
        "highlights": " ".join(event.highlights), "summary": event.summary, "description": event.description,
        "district": event.district, "venue": event.venue, "audience": event.audience,
    }
    out: list[str] = [f"cat:{event.category}"] * 2
    for field, text in values.items():
        toks = tokens(text)
        out.extend(toks * FIELD_REPEAT[field])
    return out


@dataclass
class Index:
    ids: list[int]
    doc_tokens: list[Counter]
    doc_len: np.ndarray
    avg_len: float
    df: Counter
    tfidf: TfidfVectorizer
    tfidf_matrix: object
    dense: np.ndarray | None

    @property
    def n(self) -> int:
        return len(self.ids)


class SearchEngine:
    def __init__(self, events: list[AiEvent], embedder: Embedder | None = None) -> None:
        self.events = events
        self.by_id = {e.id: e for e in events}
        self.embedder = embedder
        self.index = self._build(events)

    # ---- indexing -------------------------------------------------------------------------------
    def _build(self, events: list[AiEvent]) -> Index:
        doc_tokens = [Counter(_field_tokens(e)) for e in events]
        doc_len = np.array([sum(c.values()) for c in doc_tokens], dtype=float)
        df: Counter = Counter()
        for counter in doc_tokens:
            df.update(counter.keys())
        texts = [normalize(event_text(e) + " " + e.title * 2) for e in events]
        vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True, min_df=1)
        matrix = vectorizer.fit_transform(texts) if texts else None
        dense = self.embedder.encode([event_text(e) for e in events]) if (self.embedder and events) else None
        return Index(
            ids=[e.id for e in events], doc_tokens=doc_tokens, doc_len=doc_len,
            avg_len=float(doc_len.mean()) if len(doc_len) else 1.0, df=df,
            tfidf=vectorizer, tfidf_matrix=matrix, dense=dense,
        )

    # ---- scoring --------------------------------------------------------------------------------
    def _query_weights(self, intent: Intent) -> dict[str, float]:
        weights: dict[str, float] = {}
        for tok in intent.topic_tokens:
            weights[tok] = max(weights.get(tok, 0), 1.0)
        for concept in intent.concepts:
            for syn in lx.CONCEPTS.synonyms[concept]:
                weights[syn] = max(weights.get(syn, 0), CONCEPT_WEIGHT)
        for tok in intent.topic_tokens:
            category = _CATEGORY_LOOKUP.get(tok)
            if category:
                weights[f"cat:{category}"] = 1.0
        return weights

    def _bm25(self, weights: dict[str, float]) -> np.ndarray:
        """BM25 scaled to [0,1] against the best score the query could possibly reach.

        Scaling by the best *actual* document would make a weak match look perfect whenever
        nothing better exists (e.g. a synonym-only hit for a topic the catalogue lacks).
        """
        idx = self.index
        scores = np.zeros(idx.n)
        upper = 0.0
        for term, weight in weights.items():
            df = idx.df.get(term, 0)
            if df == 0:
                continue
            idf = math.log(1 + (idx.n - df + 0.5) / (df + 0.5))
            upper += weight * idf * (K1 + 1)
            for i, counter in enumerate(idx.doc_tokens):
                tf = counter.get(term, 0)
                if tf:
                    denom = tf + K1 * (1 - B + B * idx.doc_len[i] / idx.avg_len)
                    scores[i] += weight * idf * tf * (K1 + 1) / denom
        if upper <= 0:
            return scores
        return np.minimum(1.0, scores / (0.6 * upper))

    def _ngram(self, text: str) -> np.ndarray:
        idx = self.index
        if idx.tfidf_matrix is None or not text:
            return np.zeros(idx.n)
        vec = idx.tfidf.transform([normalize(text)])
        return np.asarray((idx.tfidf_matrix @ vec.T).todense()).ravel()

    def _dense(self, text: str) -> np.ndarray | None:
        if self.index.dense is None or self.embedder is None:
            return None
        q = self.embedder.encode([text], query=True)[0]
        floor = float(os.getenv("DENSE_FLOOR", "0.78" if getattr(self.embedder, "e5", False) else "0.2"))
        # Cosine of unrelated texts is far from 0 for many embedding models; rescale above a floor.
        return np.clip((self.index.dense @ q - floor) / (1 - floor), 0, 1)

    @staticmethod
    def _norm(values: np.ndarray) -> np.ndarray:
        top = float(values.max()) if len(values) else 0.0
        return values / top if top > 0 else values

    def relevance(self, query: str) -> np.ndarray:
        """Text relevance in [0,1] per event (intent words excluded from the topical query)."""
        intent = parse(query)
        return self._relevance(intent, query)

    def _relevance(self, intent: Intent, query: str) -> np.ndarray:
        if not intent.topic_tokens:
            return np.zeros(self.index.n)
        topical_text = " ".join(intent.topic_tokens)
        bm25 = self._bm25(self._query_weights(intent))
        ngram = self._ngram(topical_text)
        dense = self._dense(query)
        if dense is not None:
            return 0.45 * bm25 + 0.2 * ngram + 0.35 * dense
        return 0.65 * bm25 + 0.35 * ngram

    # ---- public search --------------------------------------------------------------------------
    def search(self, query: str, now: datetime, location: Location | None, limit: int):
        intent = parse(query)
        relevance = self._relevance(intent, query)
        has_topic = bool(intent.topic_tokens)

        window = timeutil.window(intent.when, now) if intent.when else None
        stages = ["strict", "no_time", "no_filters"]
        relaxed_stage = None
        chosen: list[int] = []
        for stage in stages:
            chosen = self._candidates(intent, relevance, has_topic, window, stage)
            if chosen:
                relaxed_stage = stage
                break
        relaxed = relaxed_stage not in (None, "strict")

        results = []
        pop_max = max((e.popularity for e in self.events), default=0) or 1
        for i in chosen:
            event = self.events[i]
            score, reasons = self._final_score(i, event, relevance[i], intent, location, now, window, pop_max, has_topic)
            results.append((score, event, reasons))
        results.sort(key=lambda r: r[0], reverse=True)
        return intent, relaxed, relaxed_stage, results[:limit]

    def _candidates(self, intent, relevance, has_topic, window, stage) -> list[int]:
        out: list[int] = []
        for i, event in enumerate(self.events):
            if has_topic and relevance[i] < 0.18:
                continue
            if stage in ("strict", "no_time"):
                if intent.free and event.price > 0:
                    continue
                if intent.max_price is not None and event.price > intent.max_price:
                    continue
            if stage == "strict" and window is not None:
                if not timeutil.overlaps(timeutil.parse_iso(event.startsAt), timeutil.parse_iso(event.endsAt), window):
                    continue
            out.append(i)
        return out

    def _final_score(self, i, event, rel, intent, location, now, window, pop_max, has_topic):
        reasons: list[str] = []
        score = float(rel) if has_topic else 0.35
        if has_topic and rel >= 0.18:
            matched = [t for t in intent.topic_tokens if t in self.index.doc_tokens[i]]
            if matched:
                reasons.append("تطابق مع «" + " ".join(matched[:2]) + "»")
            elif intent.concepts:
                reasons.append("قريبة من اهتمامك")
        if event.category in intent.category_hints:
            score += 0.15
        if intent.family:
            audience = normalize(event.audience)
            if event.category == "عائلي" or "عائل" in audience or "اطفال" in audience:
                score += 0.2
                reasons.append("مناسبة للعائلة")
        if intent.kids:
            audience = normalize(event.audience)
            if "اطفال" in audience or event.category == "عائلي":
                score += 0.15
        if intent.free and event.price == 0:
            reasons.append("مجانية")
        elif intent.max_price is not None and event.price <= intent.max_price:
            reasons.append(f"{int(event.price)} ر.س")
        if window is not None and timeutil.overlaps(timeutil.parse_iso(event.startsAt), timeutil.parse_iso(event.endsAt), window):
            reasons.append(timeutil.format_when(timeutil.parse_iso(event.startsAt), timeutil.parse_iso(event.endsAt), now))
        distance = _distance_km(event, location)
        if location is not None and distance is not None:
            proximity = math.exp(-distance / 6)
            score += (0.3 if intent.near else 0.08) * proximity
            if intent.near or distance <= 3:
                reasons.append(f"تبعد {distance:.1f} كم")
        score += 0.06 * (event.popularity / pop_max)
        if event.avgRating:
            score += 0.02 * (event.avgRating - 3) / 2
        if event.seatsLeft == 0:
            score -= 0.2
            reasons.append("اكتمل العدد")
        elif event.seatsLeft is not None and event.capacity and event.seatsLeft <= max(5, 0.1 * event.capacity):
            reasons.append(f"باقي {event.seatsLeft} مقعد")
        return round(score, 4), reasons[:3]


def _distance_km(event: AiEvent, location: Location | None) -> float | None:
    if location is None or event.lat is None or event.lng is None:
        return None
    r = 6371.0
    p1, p2 = math.radians(location.lat), math.radians(event.lat)
    dphi = p2 - p1
    dl = math.radians(event.lng - location.lng)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


# ---- engine cache: the catalogue changes rarely, so reuse the index between requests -----------
_CACHE: dict[tuple, SearchEngine] = {}


def get_engine(events: list[AiEvent]) -> SearchEngine:
    key = tuple((e.id, hash(event_text(e))) for e in events)
    engine = _CACHE.get(key)
    if engine is None:
        if len(_CACHE) > 8:
            _CACHE.clear()
        engine = SearchEngine(events, default_embedder())
        _CACHE[key] = engine
    return engine


def run_search(query: str, events: list[AiEvent], now_iso: str, location: Location | None, limit: int):
    engine = get_engine(events)
    now = timeutil.parse_iso(now_iso)
    intent, relaxed, stage, results = engine.search(query, now, location, limit)
    interpretation = intent.as_dict()
    # Tells the UI which constraint could not be honoured, e.g. "no free events tonight".
    interpretation["relaxedStage"] = stage if relaxed else None
    return {
        "interpretation": interpretation,
        "chips": intent.chips(),
        "results": [{"eventId": e.id, "score": s, "reasons": r} for s, e, r in results],
        "relaxed": relaxed,
        "engine": "hybrid-dense" if engine.index.dense is not None else "hybrid-lexical",
    }
