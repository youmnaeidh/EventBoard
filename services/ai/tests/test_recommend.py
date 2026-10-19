import random

from app.recommend import recommend
from app.schemas import RecommendRequest, UserProfile, HistoryItem
from tests.fixtures import NOW, catalogue, ev, at


def req(**kw):
    base = dict(events=catalogue(), now=NOW.isoformat(), limit=6)
    base.update(kw)
    return RecommendRequest(**base)


def ids(res):
    return [r.eventId for r in res.recommendations]


def test_cold_start_uses_popularity_and_freshness_and_explains():
    res = recommend(req())
    assert res.strategy == "cold_start"
    assert len(res.recommendations) == 6
    assert all(r.reasons for r in res.recommendations)
    assert set(res.recommendations[0].components) >= {"popularity", "freshness"}


def test_interests_shape_the_ranking():
    res = recommend(req(user=UserProfile(interests=["تقنية"])))
    assert res.strategy == "personalized"
    assert ids(res)[0] in (10, 11)
    assert any("تقنية" in " ".join(r.reasons) or "تشبه" in " ".join(r.reasons) for r in res.recommendations[:2])


def test_history_content_similarity_names_the_source_event():
    past = [ev(100, "ورشة الخط للمتقدمين", "ورش", day=-9, hour=17, summary="تعلم خط الثلث والنسخ بالقلم والحبر", event_type="ورشة")]
    res = recommend(req(pastEvents=past, user=UserProfile(history=[HistoryItem(eventId=100, weight=5)])))
    top = res.recommendations[0]
    assert top.eventId == 8  # the beginners calligraphy workshop
    assert any("ورشة الخط للمتقدمين" in r for r in top.reasons)


def test_collaborative_signal_surfaces_co_engaged_events():
    # 12 synthetic users: everyone who engaged with event 8 (calligraphy) also engaged with 9 (gardening)
    random.seed(1)
    matrix = []
    for u in range(12):
        matrix.append((u, 8, 5.0))
        matrix.append((u, 9, 4.0))
        matrix.append((u, random.choice([2, 4, 12, 7]), 2.0))
    res = recommend(req(
        user=UserProfile(history=[HistoryItem(eventId=8, weight=5)]),
        matrix=matrix, excludeIds=[8], limit=3,
    ))
    assert 9 in ids(res)
    nine = next(r for r in res.recommendations if r.eventId == 9)
    assert nine.components["collaborative"] > 0.5


def test_excludes_booked_and_sold_out_events():
    events = catalogue()
    events[1] = events[1].model_copy(update={"seatsLeft": 0})  # coffee experience sold out
    res = recommend(req(events=events, excludeIds=[4]))
    assert 2 not in ids(res) and 4 not in ids(res)


def test_proximity_changes_order_and_reason():
    uhud = {"lat": 24.5004, "lng": 39.6121}
    res = recommend(req(location=uhud, limit=3))
    assert "proximity" in res.recommendations[0].components
    assert any("قريبة منك" in " ".join(r.reasons) for r in res.recommendations)


def test_diversification_limits_category_runs():
    res = recommend(req(limit=8))
    cats = [next(e.category for e in catalogue() if e.id == i) for i in ids(res)]
    # no category should take more than half of an 8-slot shelf
    assert max(cats.count(c) for c in set(cats)) <= 4
