import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { Meta } from "../types";

export interface Coords { lat: number; lng: number }
interface Stored { coords: Coords; source: "gps" | "district"; label: string }

interface LocationValue {
  coords: Coords | null;
  label: string | null;
  source: "gps" | "district" | null;
  status: "idle" | "asking" | "denied" | "unsupported";
  meta: Meta | undefined;
  requestGps: () => void;
  chooseDistrict: (name: string) => void;
  clear: () => void;
}

const KEY = "eb_loc";
const LocationContext = createContext<LocationValue | null>(null);

function load(): Stored | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}
function save(value: Stored | null) {
  try {
    if (value) sessionStorage.setItem(KEY, JSON.stringify(value));
    else sessionStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: keep it in memory only */
  }
}

/**
 * The user's position is optional and never leaves the browser except as query parameters on
 * read-only requests (to sort by distance). It is kept in sessionStorage, not on the server.
 */
export function LocationProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<Stored | null>(() => load());
  const [status, setStatus] = useState<LocationValue["status"]>("idle");
  const { data: meta } = useQuery({ queryKey: ["meta"], queryFn: () => api.get<Meta>("/meta"), staleTime: Infinity });

  useEffect(() => {
    if (!("geolocation" in navigator)) setStatus("unsupported");
  }, []);

  const requestGps = useCallback(() => {
    if (!("geolocation" in navigator)) return setStatus("unsupported");
    setStatus("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // ~100 m precision is plenty for "nearest" and avoids holding an exact position.
        const coords = { lat: Math.round(pos.coords.latitude * 1000) / 1000, lng: Math.round(pos.coords.longitude * 1000) / 1000 };
        const next: Stored = { coords, source: "gps", label: "موقعك الحالي" };
        setStored(next);
        save(next);
        setStatus("idle");
      },
      () => setStatus("denied"),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 }
    );
  }, []);

  const chooseDistrict = useCallback(
    (name: string) => {
      const d = meta?.districts.find((x) => x.name === name);
      if (!d) return;
      const next: Stored = { coords: { lat: d.lat, lng: d.lng }, source: "district", label: name };
      setStored(next);
      save(next);
      setStatus("idle");
    },
    [meta]
  );

  const clear = useCallback(() => {
    setStored(null);
    save(null);
  }, []);

  const value = useMemo<LocationValue>(
    () => ({
      coords: stored?.coords ?? null,
      label: stored?.label ?? null,
      source: stored?.source ?? null,
      status,
      meta,
      requestGps,
      chooseDistrict,
      clear
    }),
    [stored, status, meta, requestGps, chooseDistrict, clear]
  );
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useUserLocation(): LocationValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useUserLocation must be used inside LocationProvider");
  return ctx;
}
