import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { getSessionId } from "./session";
import { useAuth } from "../context/AuthContext";
import { useUserLocation } from "../context/LocationContext";
import type { EventItem, RecommendationItem, Review } from "../types";

export function useCoordsKey() {
  const { coords } = useUserLocation();
  return { coords, key: coords ? `${coords.lat},${coords.lng}` : "none" };
}

/** The whole upcoming catalogue (small enough to fetch once); sections of the home page are derived from it. */
export function useCatalogue() {
  const { coords, key } = useCoordsKey();
  return useQuery({
    queryKey: ["events", "catalogue", key],
    queryFn: () => api.get<{ events: EventItem[]; total: number }>("/events", { limit: 100, sort: "soonest", lat: coords?.lat, lng: coords?.lng })
  });
}

export function useRecommendations(limit = 6) {
  const { user } = useAuth();
  const { coords, key } = useCoordsKey();
  return useQuery({
    queryKey: ["recommendations", user?.id ?? "anon", key, limit],
    queryFn: () =>
      api.get<{ mode: "ai" | "basic"; strategy: "personalized" | "cold_start"; items: RecommendationItem[] }>("/recommendations", {
        sessionId: getSessionId(),
        limit,
        lat: coords?.lat,
        lng: coords?.lng
      })
  });
}

export function useLatestReviews(limit = 3) {
  return useQuery({
    queryKey: ["reviews-latest", limit],
    queryFn: () => api.get<{ reviews: Review[] }>("/reviews/latest", { limit }),
    staleTime: 60_000
  });
}
