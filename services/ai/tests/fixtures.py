"""A small catalogue shaped like the API payload, with times relative to NOW (Sunday 2026-10-11, 18:30 Riyadh)."""
from datetime import datetime, timedelta, timezone

from app.schemas import AiEvent

RIYADH = timezone(timedelta(hours=3))
NOW = datetime(2026, 10, 11, 18, 30, tzinfo=RIYADH)
MIDNIGHT = NOW.replace(hour=0, minute=0)


def at(day: int, hour: float) -> datetime:
    return MIDNIGHT + timedelta(days=day, hours=hour)


def ev(id, title, category, *, day, hour, hours=3, price=0, capacity=None, left=None, audience="الجميع",
       summary="", highlights=(), district="المنطقة المركزية", lat=24.4672, lng=39.6111, pop=10, rating=None,
       event_type="", created_days_ago=10, venue=""):
    return AiEvent(
        id=id, title=title, summary=summary or title, description=summary or title, category=category,
        eventType=event_type, district=district, venue=venue, lat=lat, lng=lng,
        startsAt=at(day, hour).isoformat(), endsAt=(at(day, hour) + timedelta(hours=hours)).isoformat(),
        price=price, requiresBooking=capacity is not None, capacity=capacity,
        seatsLeft=left if left is not None else capacity, audience=audience, highlights=list(highlights),
        popularity=pop, avgRating=rating, reviewCount=5 if rating else 0,
        createdAt=(NOW - timedelta(days=created_days_ago)).isoformat(),
    )


def catalogue() -> list[AiEvent]:
    return [
        ev(1, "معرض المدينة المنورة للكتاب", "ثقافة", day=-3, hour=16, hours=24 * 7, price=0, audience="العائلات ومحبو القراءة",
           summary="رحلة بين الكتب والندوات واللقاءات الثقافية", event_type="معرض", pop=200, rating=4.5, district="حي الخالدية", lat=24.489, lng=39.573),
        ev(2, "تجربة القهوة المختصة", "طعام وقهوة", day=4, hour=18, price=55, capacity=70, left=28, audience="محبو القهوة والتذوق",
           summary="جلسة تذوق تفاعلية للتعرف على محاصيل القهوة وطرق التحضير", event_type="تجربة", pop=120, rating=4.6, district="حي العريض", lat=24.504, lng=39.579),
        ev(3, "ليلة القهوة العربية", "طعام وقهوة", day=0, hour=20, price=0, summary="أمسية للتعرف على القهوة العربية والهيل", event_type="أمسية", pop=60),
        ev(4, "مسرح الأطفال: حكاية النخلة", "عائلي", day=2, hour=17, hours=1.5, price=35, capacity=120, left=96, audience="الأطفال (٤–١٠ سنوات)",
           summary="مسرحية تفاعلية للأطفال عن النخلة", event_type="مسرحية", pop=140, rating=4.7, district="حي العزيزية", lat=24.4585, lng=39.6425),
        ev(5, "سينما الهواء الطلق العائلية", "عائلي", day=0, hour=21, hours=2.5, price=20, capacity=200, left=170, audience="العائلات",
           summary="فيلم رسوم متحركة على شاشة كبيرة تحت السماء", event_type="عرض", pop=90, district="حي العزيزية", lat=24.4585, lng=39.6425),
        ev(6, "جولة قباء المسائية سيرًا", "رياضة", day=0, hour=20.5, hours=2, price=0, audience="الجميع",
           summary="مشي هادئ في أحياء قباء القديمة مع مرشد", event_type="جولة", pop=70, district="قباء", lat=24.4393, lng=39.6177),
        ev(7, "رحلة غروب جبل أحد", "رياضة", day=4, hour=16, hours=3.5, price=60, capacity=40, left=26,
           summary="مسار سهل عند العصر ينتهي بمشاهدة الغروب", event_type="رحلة", pop=80, rating=4.7, district="منطقة أحد", lat=24.5004, lng=39.6121),
        ev(8, "ورشة الخط العربي للمبتدئين", "ورش", day=1, hour=17, price=60, capacity=25, left=15,
           summary="ثلاث ساعات تتعلم فيها أساسيات خط الثلث والنسخ بالقلم والحبر", event_type="ورشة", pop=60, rating=4.7, district="حي الهجرة", lat=24.4762, lng=39.5602),
        ev(9, "ورشة الزراعة المنزلية", "ورش", day=6, hour=10, price=45, capacity=30, left=19,
           summary="ابدأ حديقتك الصغيرة في البلكونة", event_type="ورشة", pop=30, district="حي الهجرة", lat=24.4762, lng=39.5602),
        ev(10, "ملتقى البيانات والذكاء الاصطناعي", "تقنية", day=10, hour=9, hours=7, price=0, capacity=180, left=150,
           summary="يوم مفتوح عن تطبيقات البيانات والذكاء الاصطناعي", event_type="ملتقى", pop=110, district="حي الخالدية", lat=24.489, lng=39.573),
        ev(11, "هاكاثون طيبة للطلاب", "تقنية", day=12, hour=9, hours=33, price=0, capacity=120, left=95,
           summary="٢٤ ساعة لبناء فكرة مشروع تقني", event_type="هاكاثون", pop=50, audience="طلاب الجامعات"),
        ev(12, "ليلة العود", "فن", day=7, hour=20.5, hours=2.5, price=50, capacity=150, left=121,
           summary="أمسية موسيقية على آلة العود بين المقامات العربية", event_type="حفل", pop=95, rating=4.6, district="حي العريض", lat=24.504, lng=39.579),
        ev(13, "معرض الخط والزخرفة الإسلامية", "فن", day=-4, hour=16, hours=24 * 16, price=0,
           summary="لوحات خط وزخرفة معاصرة", event_type="معرض", pop=100, rating=4.6, district="حي الهجرة", lat=24.4762, lng=39.5602),
        ev(14, "مهرجان الأكل الشعبي", "طعام وقهوة", day=-2, hour=17, hours=24 * 5, price=15,
           summary="أكثر من ثلاثين عربة وركنًا للأكلات الحجازية والمدنية", event_type="مهرجان", pop=160, district="قباء", lat=24.4393, lng=39.6177),
        ev(15, "سوق التمور الموسمي", "تراث", day=-1, hour=16, hours=24 * 10, price=0,
           summary="أنواع التمور المدنية من مزارع المنطقة مع تذوق مجاني", event_type="سوق", pop=130, district="حي العوالي", lat=24.4262, lng=39.6334),
    ]
