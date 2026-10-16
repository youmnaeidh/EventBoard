import { config } from "../config.js";
import type { EventDto } from "./events.js";

/** Slim, stable event shape sent to the AI service (the service never touches the database). */
export interface AiEvent {
  id: number;
  title: string;
  summary: string;
  description: string;
  category: string;
  eventType: string;
  district: string;
  venue: string;
  lat: number;
  lng: number;
  startsAt: string;
  endsAt: string;
  price: number;
  requiresBooking: boolean;
  capacity: number | null;
  seatsLeft: number | null;
  audience: string;
  highlights: string[];
  popularity: number;
  avgRating: number | null;
  reviewCount: number;
  createdAt: string;
  featured: boolean;
}

export const toAiEvent = (e: EventDto): AiEvent => ({
  id: e.id,
  title: e.title,
  summary: e.summary,
  description: e.description,
  category: e.category,
  eventType: e.eventType,
  district: e.district,
  venue: e.venue,
  lat: e.lat,
  lng: e.lng,
  startsAt: e.startsAt,
  endsAt: e.endsAt,
  price: e.price,
  requiresBooking: e.requiresBooking,
  capacity: e.capacity,
  seatsLeft: e.seatsLeft,
  audience: e.audience,
  highlights: e.highlights,
  popularity: e.popularity,
  avgRating: e.avgRating,
  reviewCount: e.reviewCount,
  createdAt: e.createdAt,
  featured: e.featured
});

export interface SearchResponse {
  interpretation: Record<string, unknown>;
  chips: string[];
  results: { eventId: number; score: number; reasons: string[] }[];
  relaxed: boolean;
  engine: string;
}

export interface RecommendResponse {
  recommendations: {
    eventId: number;
    score: number;
    components: Record<string, number>;
    reasons: string[];
  }[];
  strategy: "personalized" | "cold_start";
}

export interface AssistantResponse {
  answer: string;
  eventIds: number[];
  mode: "llm" | "offline";
  chips?: string[];
}

export interface ForecastRequest {
  category: string;
  district?: string;
  price: number;
  capacity?: number | null;
  startsAt: string;
  durationHours: number;
  leadDays: number;
  featured?: boolean;
}

export interface ForecastResponse {
  expectedBookings: number;
  low: number;
  high: number;
  expectedFillRate: number | null;
  drivers: { factor: string; label: string; impact: number }[];
  slots: { label: string; weekday: number; hour: number; expectedBookings: number }[];
  capacityAdvice: string;
  model: Record<string, unknown>;
}

export interface DemandGap {
  label: string;
  category: string | null;
  searches: number;
  searches7d: number;
  prev7d: number;
  trend: number | null;
  zeroResultShare: number;
  supply: number;
  demandRatio: number;
  opportunity: "high" | "medium" | "low";
  exampleQueries: string[];
}

export interface DemandGapsResponse {
  gaps: DemandGap[];
  totalSearches: number;
}

// Tiny circuit breaker: after a failure, skip the AI service for a short while so the site
// stays fast (and uses the SQL fallbacks) instead of waiting for a timeout on every request.
let blockedUntil = 0;
const BLOCK_MS = 15_000;

export function aiEnabled(): boolean {
  return config.AI_SERVICE_URL !== "";
}

export async function callAi<T>(path: string, body?: unknown, method: "POST" | "GET" = "POST"): Promise<T | null> {
  if (!aiEnabled() || Date.now() < blockedUntil) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.AI_TIMEOUT_MS);
  try {
    const response = await fetch(`${config.AI_SERVICE_URL.replace(/\/$/, "")}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(config.AI_SERVICE_TOKEN ? { authorization: `Bearer ${config.AI_SERVICE_TOKEN}` } : {})
      },
      body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`AI service responded ${response.status}`);
    return (await response.json()) as T;
  } catch (error) {
    blockedUntil = Date.now() + BLOCK_MS;
    console.warn(`[ai] ${path} unavailable: ${(error as Error).message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function resetAiCircuit(): void {
  blockedUntil = 0;
}
