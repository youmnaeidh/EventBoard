"""Light Arabic text normalisation for retrieval.

Not a full morphological analyser: we normalise letter variants, strip diacritics/tatweel,
drop common definite-article/conjunction prefixes and a few plural/pronoun suffixes. That is
enough to match "القهوة" with "قهوة" and "الورشة" with "ورش" in a small event catalogue,
and it is deterministic and dependency-free.
"""
from __future__ import annotations

import re
import unicodedata

_DIACRITICS = re.compile(r"[ً-ٰٟـ]")
_NON_WORD = re.compile(r"[^\w؀-ۿ]+", re.UNICODE)
_ARABIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")

_LETTER_MAP = str.maketrans(
    {
        "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا",
        "ى": "ي", "ئ": "ي", "ؤ": "و", "ة": "ه",
    }
)

# Prefixes are tried longest-first; a stem must keep >= 3 letters.
_PREFIXES = ("وال", "بال", "كال", "فال", "لل", "ال", "و")
_SUFFIXES = ("ات", "ون", "ين", "ان", "ها", "ي", "ه")

# Function words + dialect fillers that carry no topical signal. Stored normalised.
_RAW_STOPWORDS = {
    "في", "من", "الى", "على", "عن", "مع", "هذا", "هذه", "هذي", "ذلك", "تلك", "او", "ثم", "كل", "هو", "هي",
    "ما", "لا", "لو", "كان", "يكون", "فيه", "فيها", "ابغى", "ابغا", "ابي", "ابا", "ودي", "وده", "اريد", "ابغاه",
    "وين", "ايش", "وش", "شنو", "شي", "شيء", "اي", "ايه", "عندي", "عندكم", "ممكن", "لي", "لنا", "لك", "بس",
    "يعني", "طيب", "جدا", "مره", "شوي", "اروح", "نروح", "اطلع", "نطلع", "ابحث", "دور", "ورني", "عطني",
    "فعاليه", "فعاليات", "حدث", "احداث", "نشاط", "انشطه", "تجربه", "تجارب", "مناسب", "مناسبه", "تناسب",
}


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text or "")
    text = text.translate(_ARABIC_DIGITS).lower()
    text = _DIACRITICS.sub("", text)
    text = text.translate(_LETTER_MAP)
    text = _NON_WORD.sub(" ", text)
    return re.sub(r"\s+", " ", text).strip()


STOPWORDS = {normalize(w) for w in _RAW_STOPWORDS}


def stem(token: str) -> str:
    if not token or not _is_arabic(token):
        return token
    for prefix in _PREFIXES:
        if token.startswith(prefix) and len(token) - len(prefix) >= 3:
            token = token[len(prefix):]
            break
    for suffix in _SUFFIXES:
        if token.endswith(suffix) and len(token) - len(suffix) >= 3:
            token = token[: -len(suffix)]
            break
    return token


def _is_arabic(token: str) -> bool:
    return any("؀" <= ch <= "ۿ" for ch in token)


def tokens(text: str, *, drop_stopwords: bool = True) -> list[str]:
    """Normalised, stemmed tokens. Stopwords are removed *before* stemming."""
    out: list[str] = []
    for raw in normalize(text).split():
        if drop_stopwords and raw in STOPWORDS:
            continue
        if len(raw) < 2 and not raw.isdigit():
            continue
        out.append(stem(raw))
    return out
