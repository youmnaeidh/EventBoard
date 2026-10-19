"""Domain lexicon for Madinah events: concepts (synonym groups, incl. Saudi dialect) and intent words.

Concepts are used in two places:
  * query expansion in search (a query for "كوفي" also matches "قهوة"),
  * grouping searches into topics for demand-gap analysis ("سيراميك" ~ "فخار").
Words are written naturally and normalised/stemmed on load so matching is consistent.
"""
from __future__ import annotations

from .arabic import normalize, stem

# concept id -> (synonyms, category hint or None)
_CONCEPTS: dict[str, tuple[list[str], str | None]] = {
    # Concepts are deliberately tight: a query word expands only to its true synonyms. Generic
    # hypernyms (رياضة, فن, ثقافة) are NOT synonyms - they are category hints (soft boost only).
    "قهوة": (["قهوة", "كوفي", "كافيه", "بن", "اسبريسو", "قهوه مختصه"], "طعام وقهوة"),
    "فخار": (["فخار", "سيراميك", "طين", "خزف", "عجلة فخار"], "ورش"),
    "رسم": (["رسم", "الوان", "مائية", "لوحة", "تلوين", "فرشاة"], "ورش"),
    "مشي": (["مشي", "هايكنج", "طلعة", "تسلق", "جبل", "مسار", "استكشاف", "غروب", "رحلة", "مغامرة", "طبيعة"], "رياضة"),
    "جري": (["جري", "ماراثون", "سباق", "ركض"], "رياضة"),
    "لياقة": (["لياقة", "يوغا", "بيلاتس", "تمارين", "جيم", "كمال اجسام"], "رياضة"),
    "كتب": (["كتب", "كتاب", "قراءة", "مكتبة", "نشر", "رواية", "روايات"], "ثقافة"),
    "شعر": (["شعر", "قصيدة", "شعراء", "نبطي", "ادب"], "ثقافة"),
    "فن": (["فن", "فنون", "معرض", "معارض", "غاليري", "تشكيل", "تشكيلي"], "فن"),
    "خط": (["خط", "خطاط", "ثلث", "نسخ", "حبر", "زخرفة"], "ورش"),
    "موسيقى": (["موسيقى", "عود", "حفل", "حفلة", "غناء", "عزف", "اغاني", "مقام"], "فن"),
    "تصوير": (["تصوير", "كاميرا", "فوتوغرافي", "مصور", "عدسة"], "ورش"),
    "تقنية": (["ذكاء", "اصطناعي", "برمجة", "بيانات", "هاكاثون", "تقنية", "ai", "تكنولوجيا", "ابتكار"], "تقنية"),
    "تمور": (["تمر", "تمور", "عجوة", "نخل", "نخيل", "مزرعة", "مزارع"], "تراث"),
    "طعام": (["اكل", "اكلات", "طعام", "مطاعم", "عربات", "مأكولات", "حلويات"], "طعام وقهوة"),
    "تراث": (["تراث", "تراثي", "صقور", "صقر", "حرف", "تقليدي", "فلكلور"], "تراث"),
    "مسرح": (["مسرح", "مسرحية", "دمى", "سينما", "فيلم", "افلام"], "عائلي"),
    "ورشة": (["ورشة", "ورش", "دورة", "كورس", "تعلم", "تدريب", "دروس"], "ورش"),
    "زراعة": (["زراعة", "نباتات", "حديقة", "اصيص", "نبات"], "ورش"),
}

# Words that express *how* the user wants events, not *what* they are about.
FREE_WORDS = {"مجاني", "مجانا", "مجانيه", "مجانية", "ببلاش", "بلاش", "فري", "free", "ببلاشه"}
CHEAP_WORDS = {"رخيص", "رخيصه", "رخيصة", "اقتصادي", "اقتصاديه", "ميزانيه", "ميزانية"}
TONIGHT_WORDS = {"الليله", "الليلة", "الليل", "المسا", "مساء", "السهره", "سهرة", "السهرة"}
TODAY_WORDS = {"اليوم", "الحين", "حاليا", "الان"}
TOMORROW_WORDS = {"بكره", "بكرة", "بكرا", "غدا", "باكر"}
WEEKEND_WORDS = {"ويكند", "الويكند", "الويك", "الاجازه", "الاجازة", "الجمعه", "الجمعة", "السبت", "weekend"}
WEEK_WORDS = {"الاسبوع", "الأسبوع", "اسبوعي"}
NEAR_WORDS = {"قريب", "قريبه", "قريبة", "جنبي", "حولي", "حواليني", "مني", "اقرب", "الاقرب", "جنب"}
FAMILY_WORDS = {"عائلي", "عائلة", "عائله", "عائلية", "عائليه", "اهل", "اسرة", "اسره", "العائلة", "العائله"}
KIDS_WORDS = {"اطفال", "أطفال", "طفل", "عيال", "العيال", "صغار", "ولاد", "الاطفال", "للاطفال", "كيدز", "للعيال"}
GENERIC_MARKERS = {"فعاليات", "فعالية", "فعاليه"}


def _n(words: set[str] | list[str]) -> set[str]:
    return {normalize(w) for w in words}


FREE = _n(FREE_WORDS)
CHEAP = _n(CHEAP_WORDS)
TONIGHT = _n(TONIGHT_WORDS)
TODAY = _n(TODAY_WORDS)
TOMORROW = _n(TOMORROW_WORDS)
WEEKEND = _n(WEEKEND_WORDS)
WEEK = _n(WEEK_WORDS)
NEAR = _n(NEAR_WORDS)
FAMILY = _n(FAMILY_WORDS)
KIDS = _n(KIDS_WORDS)

# every word that is an intent marker: removed from the "topic" part of a query
INTENT_WORDS = FREE | CHEAP | TONIGHT | TODAY | TOMORROW | WEEKEND | WEEK | NEAR | FAMILY | KIDS | _n(GENERIC_MARKERS)


class Concepts:
    """stemmed word -> concept ids, concept -> stemmed synonyms, concept -> category."""

    def __init__(self) -> None:
        self.word_to_concepts: dict[str, set[str]] = {}
        self.synonyms: dict[str, list[str]] = {}
        self.category: dict[str, str | None] = {}
        for concept, (words, category) in _CONCEPTS.items():
            stems: list[str] = []
            for phrase in words:
                for piece in normalize(phrase).split():
                    s = stem(piece)
                    if s not in stems:
                        stems.append(s)
            self.synonyms[concept] = stems
            self.category[concept] = category
            for s in stems:
                self.word_to_concepts.setdefault(s, set()).add(concept)

    def concepts_for(self, stems: list[str]) -> list[str]:
        found: list[str] = []
        for s in stems:
            for concept in sorted(self.word_to_concepts.get(s, ())):
                if concept not in found:
                    found.append(concept)
        return found


CONCEPTS = Concepts()
