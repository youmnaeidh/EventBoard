import pytest

from app import arabic, intent
from app.search import SearchEngine
from tests.fixtures import NOW, catalogue


def top_ids(query, location=None, limit=5):
    engine = SearchEngine(catalogue())
    parsed, relaxed, stage, results = engine.search(query, NOW, location, limit)
    return [e.id for _, e, _ in results], parsed, relaxed, stage, results


def test_normalisation_and_light_stemming():
    assert arabic.normalize("القَهْوَةُ") == "القهوه"
    assert arabic.stem("القهوه") == arabic.stem("قهوه") == arabic.stem(arabic.normalize("قهوة"))
    assert arabic.normalize("أمسية ٢٠٢٦") == "امسيه 2026"
    assert "ابغى" not in arabic.tokens("ابغى قهوة")


def test_intent_extracts_structure_from_dialect():
    i = intent.parse("ابغى شي عائلي رخيص الليلة قريب مني")
    assert i.family and i.near and i.when == "tonight" and i.max_price == 30
    assert i.topic_tokens == []
    j = intent.parse("فعاليات مجانية بكرة للعيال")
    assert j.free and j.when == "tomorrow" and j.kids


def test_topical_query_ranks_matching_events_first():
    ids, *_ = top_ids("قهوة")
    assert ids[0] in (2, 3)
    assert set(ids[:2]) == {2, 3}


def test_dialect_synonym_and_typo_still_match():
    ids, *_ = top_ids("كوفي")  # dialect synonym for coffee
    assert 2 in ids[:3]
    ids2, *_ = top_ids("قهوه مختصه")  # spelling variants (ة/ه)
    assert ids2[0] == 2
    ids3, *_ = top_ids("ورشه خط")  # no ta marbuta, shared concept
    assert ids3[0] == 8


def test_free_and_tonight_are_hard_filters():
    ids, parsed, relaxed, _, results = top_ids("مجاني الليلة")
    assert not relaxed
    assert set(ids) <= {3, 6, 1, 13, 15}  # free events overlapping tonight
    assert all("مجانية" in r for _, _, r in results[:1])
    assert 5 not in ids  # cinema costs 20 SAR


def test_family_tonight_prefers_family_events():
    ids, parsed, relaxed, _, _ = top_ids("ابغى شي عائلي الليلة")
    assert ids[0] == 5
    assert parsed.family and parsed.when == "tonight"


def test_near_boosts_distance():
    uhud = type("L", (), {"lat": 24.5004, "lng": 39.6121})()
    ids_near, *_ = top_ids("رياضة قريب مني", location=uhud)
    assert ids_near[0] == 7  # Uhud sunset trip is the closest sports event


def test_relaxes_constraints_when_nothing_matches():
    # nothing free about AI tomorrow -> relax time (and say so)
    ids, parsed, relaxed, stage, _ = top_ids("ذكاء اصطناعي بكرة")
    assert relaxed and stage == "no_time"
    assert ids[0] in (10, 11)


def test_unknown_topic_returns_nothing_instead_of_noise():
    ids, *_ = top_ids("يوغا")
    assert ids == []


def test_ended_catalogue_entries_are_not_special_cased():
    # the API only sends upcoming/live events, but live multi-day events (ids 1, 13) must still match
    ids, *_ = top_ids("معرض الكتاب")
    assert ids[0] == 1


def test_category_name_matches_but_secondary_words_do_not_leak():
    # "قهوة" must not pull every event of the category "طعام وقهوة" (e.g. the date tour / street food)
    from tests.fixtures import catalogue as cat
    engine = SearchEngine(cat())
    _, _, _, results = engine.search("قهوة", NOW, None, 10)
    got = {e.id for _, e, _ in results}
    assert got == {2, 3}
    # but naming the category itself works
    _, _, _, sport = engine.search("رياضة", NOW, None, 10)
    assert {e.id for _, e, _ in sport} == {6, 7}
