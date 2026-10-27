import json
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from app.forecast import get_model
from app.main import app
from app.schemas import ForecastRequest
from tests.fixtures import NOW, at, catalogue

client = TestClient(app)


def forecast(**kw):
    base = dict(category="عائلي", district="المنطقة المركزية", price=20, capacity=300, startsAt=at(5, 19).isoformat(),
                durationHours=3, leadDays=14, featured=False)
    base.update(kw)
    return get_model().predict(ForecastRequest(**base))


def test_forecast_shape_and_interval_order():
    r = forecast()
    assert r["low"] <= r["expectedBookings"] <= r["high"]
    assert 0 < r["expectedBookings"] <= 300
    assert len(r["slots"]) == 3 and len(r["drivers"]) <= 4
    assert r["slots"][0]["expectedBookings"] >= r["slots"][-1]["expectedBookings"]
    assert r["model"]["metrics"]["mae"] < r["model"]["metrics"]["baselineMaeCategoryMean"]


def test_slots_recompute_actual_date_and_lead_time():
    from datetime import datetime
    starts = at(5, 19)
    r = forecast(startsAt=starts.isoformat(), leadDays=14)
    for slot in r["slots"]:
        actual = datetime.fromisoformat(slot["startsAt"])
        assert actual >= starts
        assert slot["leadDays"] == pytest.approx(14 + (actual-starts).total_seconds()/86400)
        chosen = forecast(startsAt=slot["startsAt"], leadDays=slot["leadDays"])
        assert chosen["expectedBookings"] == slot["expectedBookings"]


def test_forecast_learns_expected_effects():
    # day 5 from NOW (Sunday) is Friday; day 2 is Tuesday
    friday_evening = forecast(startsAt=at(5, 19).isoformat())["expectedBookings"]
    tuesday_morning = forecast(startsAt=at(2, 9).isoformat())["expectedBookings"]
    assert friday_evening > tuesday_morning * 1.3
    assert forecast(price=0)["expectedBookings"] > forecast(price=120)["expectedBookings"]
    assert forecast(leadDays=21)["expectedBookings"] > forecast(leadDays=1)["expectedBookings"]
    assert forecast(featured=True)["expectedBookings"] >= forecast(featured=False)["expectedBookings"]


def test_forecast_respects_capacity_and_advises():
    small = forecast(capacity=20)
    assert small["expectedBookings"] <= 20 and small["high"] <= 20
    assert "رفع السعة" in small["capacityAdvice"] or "جلسة" in small["capacityAdvice"] or "مناسبة" in small["capacityAdvice"]
    open_ended = forecast(capacity=None)
    assert "السعة المقترحة" in open_ended["capacityAdvice"]


def test_demand_gaps_group_dialect_queries_and_compare_with_supply():
    logs = []
    def add(q, n, results, days_ago_range=(0, 13)):
        for i in range(n):
            d = days_ago_range[0] + (i % (days_ago_range[1] - days_ago_range[0] + 1))
            logs.append({"q": q, "category": None, "results": results, "at": (NOW - timedelta(days=d, hours=i % 5)).isoformat()})
    add("فخار", 20, 0); add("ودي بورشة فخار", 12, 0); add("سيراميك", 8, 0)
    add("قهوة", 14, 2); add("كوفي", 6, 2)
    add("فعاليات عائلية", 25, 5)
    add("الليلة", 30, 4)   # pure time filter, not a topic
    add("يوغا", 12, 0)
    r = client.post("/v1/demand-gaps", json={"searches": logs, "events": [e.model_dump() for e in catalogue()], "now": NOW.isoformat()}).json()
    by_label = {g["label"]: g for g in r["gaps"]}
    assert r["totalSearches"] == len(logs)
    pottery = next(g for g in r["gaps"] if g["label"] in ("فخار", "ودي بورشة فخار", "سيراميك"))
    assert pottery["searches"] == 40 and pottery["supply"] == 0 and pottery["opportunity"] == "high"
    assert pottery["zeroResultShare"] == 1.0
    coffee = next(g for g in r["gaps"] if g["label"] in ("قهوة", "كوفي"))
    assert coffee["supply"] >= 2 and coffee["opportunity"] != "high"
    assert not any(g["label"] == "الليلة" for g in r["gaps"])
    yoga = next(g for g in r["gaps"] if g["label"] == "يوغا")
    assert yoga["supply"] == 0


def test_assistant_offline_is_grounded_and_flags_mode(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    body = {"messages": [{"role": "user", "content": "ابغى شي عائلي الليلة"}], "events": [e.model_dump() for e in catalogue()], "now": NOW.isoformat()}
    r = client.post("/v1/assistant", json=body).json()
    assert r["mode"] == "offline" and r["eventIds"] and r["eventIds"][0] == 5
    assert "سينما الهواء الطلق" in r["answer"]
    none = client.post("/v1/assistant", json={**body, "messages": [{"role": "user", "content": "ابغى يوغا"}]}).json()
    assert none["eventIds"] == [] and "ما لقيت" in none["answer"]


def test_assistant_llm_path_validates_cited_ids(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    captured = {}

    class FakeResponse:
        def raise_for_status(self): pass
        def json(self):
            return {"content": [{"type": "text", "text": json.dumps({"answer": "أنصحك بسينما الهواء الطلق الليلة", "event_ids": [5, 999]}, ensure_ascii=False)}]}

    def fake_post(url, headers, json, timeout):
        captured["system"] = json["system"]
        captured["headers"] = headers
        return FakeResponse()

    monkeypatch.setattr("app.assistant.httpx.post", fake_post)
    body = {"messages": [{"role": "user", "content": "ابغى شي عائلي الليلة"}], "events": [e.model_dump() for e in catalogue()], "now": NOW.isoformat()}
    r = client.post("/v1/assistant", json=body).json()
    assert r["mode"] == "llm"
    assert r["eventIds"] == [5]            # 999 was not retrieved, so it is dropped
    assert "<events>" in captured["system"] and "سينما الهواء الطلق" in captured["system"]
    assert captured["headers"]["x-api-key"] == "test-key"


def test_assistant_falls_back_when_llm_fails(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    def boom(*a, **k): raise RuntimeError("network down")
    monkeypatch.setattr("app.assistant.httpx.post", boom)
    body = {"messages": [{"role": "user", "content": "قهوة"}], "events": [e.model_dump() for e in catalogue()], "now": NOW.isoformat()}
    r = client.post("/v1/assistant", json=body).json()
    assert r["mode"] == "offline" and r["eventIds"]


def test_token_auth(monkeypatch):
    monkeypatch.setenv("AI_SERVICE_TOKEN", "s3cret")
    body = {"query": "قهوة", "events": [e.model_dump() for e in catalogue()], "now": NOW.isoformat()}
    assert client.post("/v1/search", json=body).status_code == 401
    assert client.post("/v1/search", json=body, headers={"Authorization": "Bearer s3cret"}).status_code == 200
    assert client.get("/health").status_code == 200


def test_search_endpoint_contract():
    body = {"query": "ابغى شي عائلي الليلة", "events": [e.model_dump() for e in catalogue()], "now": NOW.isoformat(),
            "location": {"lat": 24.46, "lng": 39.61}}
    r = client.post("/v1/search", json=body).json()
    assert r["results"][0]["eventId"] == 5
    assert "للعائلة" in r["chips"] and "الليلة" in r["chips"]
    assert r["interpretation"]["when"] == "tonight" and r["engine"] == "hybrid-lexical"
