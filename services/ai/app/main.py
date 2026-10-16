from __future__ import annotations

import os
import secrets
import threading
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException

from . import assistant as assistant_mod
from . import demand as demand_mod
from . import recommend as recommend_mod
from .forecast import get_model
from .schemas import (
    AssistantRequest, AssistantResponse, DemandGapsRequest, ForecastRequest, RecommendRequest,
    RecommendResponse, SearchRequest, SearchResponse,
)
from .search import default_embedder, run_search


def _warm() -> None:
    get_model()
    default_embedder()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Train the forecast model in the background so the first organizer request is not slow.
    threading.Thread(target=_warm, daemon=True).start()
    yield


app = FastAPI(title="EventBoard AI service", version="2.0.0", lifespan=lifespan)


def require_token(authorization: str | None = Header(default=None)) -> None:
    expected = os.getenv("AI_SERVICE_TOKEN", "")
    if not expected:
        return
    supplied = (authorization or "").removeprefix("Bearer ").strip()
    if not secrets.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="invalid token")


@app.get("/health")
def health():
    return {"status": "ok", "llm": bool(os.getenv("ANTHROPIC_API_KEY")), "dense": default_embedder() is not None}


@app.post("/v1/search", response_model=SearchResponse, dependencies=[Depends(require_token)])
def search(req: SearchRequest):
    return run_search(req.query, req.events, req.now, req.location, req.limit)


@app.post("/v1/recommend", response_model=RecommendResponse, dependencies=[Depends(require_token)])
def recommend(req: RecommendRequest):
    return recommend_mod.recommend(req)


@app.post("/v1/assistant", response_model=AssistantResponse, dependencies=[Depends(require_token)])
def assistant(req: AssistantRequest):
    return assistant_mod.answer(req)


@app.post("/v1/forecast/predict", dependencies=[Depends(require_token)])
def forecast(req: ForecastRequest):
    return get_model().predict(req)


@app.get("/v1/model-card", dependencies=[Depends(require_token)])
def model_card():
    return get_model().card


@app.post("/v1/demand-gaps", dependencies=[Depends(require_token)])
def demand_gaps(req: DemandGapsRequest):
    return demand_mod.analyze(req)
