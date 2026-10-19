from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class AiEvent(BaseModel):
    """Event as sent by the API. Extra fields are ignored so the contract can grow."""

    model_config = ConfigDict(extra="ignore")

    id: int
    title: str
    summary: str = ""
    description: str = ""
    category: str
    eventType: str = ""
    district: str = ""
    venue: str = ""
    lat: float | None = None
    lng: float | None = None
    startsAt: str
    endsAt: str
    price: float = 0
    requiresBooking: bool = False
    capacity: int | None = None
    seatsLeft: int | None = None
    audience: str = ""
    highlights: list[str] = Field(default_factory=list)
    popularity: float = 0
    avgRating: float | None = None
    reviewCount: int = 0
    createdAt: str | None = None
    featured: bool = False


class Location(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=200)
    events: list[AiEvent] = Field(max_length=300)
    now: str
    location: Location | None = None
    limit: int = Field(default=24, ge=1, le=100)


class SearchResult(BaseModel):
    eventId: int
    score: float
    reasons: list[str]


class SearchResponse(BaseModel):
    interpretation: dict[str, Any]
    chips: list[str]
    results: list[SearchResult]
    relaxed: bool
    engine: str


class HistoryItem(BaseModel):
    eventId: int
    weight: float = Field(gt=0, le=20)
    at: str | None = None


class UserProfile(BaseModel):
    interests: list[str] = Field(default_factory=list, max_length=8)
    history: list[HistoryItem] = Field(default_factory=list, max_length=500)


class RecommendRequest(BaseModel):
    events: list[AiEvent] = Field(max_length=300)
    pastEvents: list[AiEvent] = Field(default_factory=list, max_length=300)
    user: UserProfile = Field(default_factory=UserProfile)
    excludeIds: list[int] = Field(default_factory=list)
    matrix: list[tuple[int, int, float]] = Field(default_factory=list, max_length=50000)
    now: str
    location: Location | None = None
    limit: int = Field(default=8, ge=1, le=30)


class Recommendation(BaseModel):
    eventId: int
    score: float
    components: dict[str, float]
    reasons: list[str]


class RecommendResponse(BaseModel):
    recommendations: list[Recommendation]
    strategy: Literal["personalized", "cold_start"]


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=500)


class AssistantRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=10)
    events: list[AiEvent] = Field(max_length=300)
    now: str
    location: Location | None = None


class AssistantResponse(BaseModel):
    answer: str
    eventIds: list[int]
    mode: Literal["llm", "offline"]
    chips: list[str] = Field(default_factory=list)


class ForecastRequest(BaseModel):
    category: str
    district: str | None = None
    price: float = Field(default=0, ge=0, le=5000)
    capacity: int | None = Field(default=None, ge=1, le=20000)
    startsAt: str
    durationHours: float = Field(default=3, ge=0.5, le=72)
    leadDays: float = Field(default=7, ge=0, le=120)
    featured: bool = False


class SearchLogItem(BaseModel):
    q: str = Field(max_length=200)
    category: str | None = None
    results: int = 0
    at: str


class DemandGapsRequest(BaseModel):
    searches: list[SearchLogItem] = Field(max_length=10000)
    events: list[AiEvent] = Field(max_length=300)
    now: str
