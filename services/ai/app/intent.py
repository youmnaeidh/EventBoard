"""Turns a free-text Arabic query into structured intent (free / time / audience / ...) + topic words."""
from __future__ import annotations

from dataclasses import dataclass, field

from . import lexicon as lx
from .arabic import normalize, stem


@dataclass
class Intent:
    free: bool = False
    max_price: float | None = None
    when: str | None = None  # today | tonight | tomorrow | weekend | week
    near: bool = False
    family: bool = False
    kids: bool = False
    topic_tokens: list[str] = field(default_factory=list)  # stemmed, intent/stop words removed
    concepts: list[str] = field(default_factory=list)
    category_hints: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "free": self.free,
            "maxPrice": self.max_price,
            "when": self.when,
            "near": self.near,
            "audience": "kids" if self.kids else ("family" if self.family else None),
            "topics": self.topic_tokens,
            "concepts": self.concepts,
            "categoryHints": self.category_hints,
        }

    def chips(self) -> list[str]:
        chips: list[str] = []
        if self.free:
            chips.append("مجانية")
        if self.max_price is not None:
            chips.append(f"حتى {int(self.max_price)} ر.س")
        if self.when:
            chips.append({"tonight": "الليلة", "today": "اليوم", "tomorrow": "بكرة",
                          "weekend": "الويكند", "week": "هذا الأسبوع"}[self.when])
        if self.near:
            chips.append("قريبة منك")
        if self.kids:
            chips.append("للأطفال")
        elif self.family:
            chips.append("للعائلة")
        for category in self.category_hints[:2]:
            chips.append(category)
        return [c for c in chips if c]


def _strip_al(token: str) -> str:
    return token[2:] if token.startswith("ال") and len(token) > 4 else token


def parse(query: str) -> Intent:
    intent = Intent()
    normalized = normalize(query)
    raw_tokens = normalized.split()
    consumed: set[int] = set()

    def has(words: set[str], idx: int) -> bool:
        token = raw_tokens[idx]
        return token in words or _strip_al(token) in words

    for i in range(len(raw_tokens)):
        if has(lx.FREE, i):
            intent.free = True
            consumed.add(i)
        elif has(lx.CHEAP, i):
            intent.max_price = 30
            consumed.add(i)
        elif has(lx.TONIGHT, i):
            intent.when = "tonight"
            consumed.add(i)
        elif has(lx.TODAY, i):
            intent.when = intent.when or "today"
            consumed.add(i)
        elif has(lx.TOMORROW, i):
            intent.when = "tomorrow"
            consumed.add(i)
        elif has(lx.WEEKEND, i):
            intent.when = "weekend"
            consumed.add(i)
        elif has(lx.WEEK, i):
            intent.when = intent.when or "week"
            consumed.add(i)
        elif has(lx.NEAR, i):
            intent.near = True
            consumed.add(i)
        elif has(lx.KIDS, i):
            intent.kids = True
            intent.family = True
            consumed.add(i)
        elif has(lx.FAMILY, i):
            intent.family = True
            consumed.add(i)
        elif raw_tokens[i] in lx.INTENT_WORDS:
            consumed.add(i)

    # "هذا الاسبوع" after normalisation is two tokens; "الاسبوع" is already handled.
    topic: list[str] = []
    for i, token in enumerate(raw_tokens):
        if i in consumed or token in {"من", "في", "على", "الى", "عن", "مع"}:
            continue
        if token in lx_stopwords():
            continue
        if len(token) < 2:
            continue
        topic.append(stem(token))

    intent.topic_tokens = topic
    intent.concepts = lx.CONCEPTS.concepts_for(topic)
    for concept in intent.concepts:
        category = lx.CONCEPTS.category.get(concept)
        if category and category not in intent.category_hints:
            intent.category_hints.append(category)
    if intent.family and "عائلي" not in intent.category_hints and not intent.concepts:
        intent.category_hints.append("عائلي")
    return intent


def lx_stopwords() -> set[str]:
    from .arabic import STOPWORDS

    return STOPWORDS
