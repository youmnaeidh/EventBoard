"""Riyadh time helpers (UTC+3, no daylight saving)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

RIYADH = timezone(timedelta(hours=3))

WEEKDAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]


def parse_iso(value: str) -> datetime:
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def to_riyadh(dt: datetime) -> datetime:
    return dt.astimezone(RIYADH)


def riyadh_midnight(dt: datetime) -> datetime:
    local = to_riyadh(dt)
    return local.replace(hour=0, minute=0, second=0, microsecond=0)


def weekday_sun0(dt: datetime) -> int:
    """0 = Sunday ... 6 = Saturday (matches JavaScript's getDay)."""
    return (to_riyadh(dt).weekday() + 1) % 7


def window(name: str, now: datetime) -> tuple[datetime, datetime]:
    today = riyadh_midnight(now)
    if name == "today":
        return now, today + timedelta(days=1)
    if name == "tonight":
        return max(now, today + timedelta(hours=17)), today + timedelta(days=1, hours=4)
    if name == "tomorrow":
        return today + timedelta(days=1), today + timedelta(days=2)
    if name == "weekend":  # Friday + Saturday
        wd = weekday_sun0(now)
        to_friday = -1 if wd == 6 else (5 - wd) % 7
        friday = today + timedelta(days=to_friday)
        return max(now, friday), friday + timedelta(days=2)
    if name == "week":
        return now, today + timedelta(days=7)
    raise ValueError(name)


def overlaps(starts: datetime, ends: datetime, win: tuple[datetime, datetime]) -> bool:
    return starts < win[1] and ends > win[0]


def format_when(starts: datetime, ends: datetime, now: datetime) -> str:
    """Short Arabic description like 'اليوم 8:30 م' or 'الجمعة 5:00 م'."""
    s = to_riyadh(starts)
    n = to_riyadh(now)
    hour12 = s.hour % 12 or 12
    suffix = "ص" if s.hour < 12 else "م"
    clock = f"{hour12}:{s.minute:02d} {suffix}"
    if starts <= now <= ends:
        return "جارية الحين"
    day_diff = (s.date() - n.date()).days
    if day_diff == 0:
        day = "اليوم"
    elif day_diff == 1:
        day = "بكرة"
    elif 1 < day_diff < 7:
        day = WEEKDAYS_AR[weekday_sun0(starts)]
    else:
        day = f"{s.day}/{s.month}"
    return f"{day} {clock}"
