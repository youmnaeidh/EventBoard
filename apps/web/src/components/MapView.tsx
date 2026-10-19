import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { categoryStyle } from "../lib/categories";
import { dayNumber, distanceLabel, monthShort, priceLabel, timeOfDay } from "../lib/format";
import { trackView } from "../lib/track";
import type { EventItem } from "../types";
import type { Coords } from "../context/LocationContext";

const CENTER: [number, number] = [24.4672, 39.6111];

function pinIcon(color: string, label: string, active: boolean) {
  return L.divIcon({
    className: "pin-wrap",
    html: `<span class="pin ${active ? "pin-active" : ""}" style="--pin:${color}"><b>${label}</b></span>`,
    iconSize: [40, 48],
    iconAnchor: [20, 46],
    popupAnchor: [0, -42]
  });
}

function Fit({ events, user }: { events: EventItem[]; user: Coords | null }) {
  const map = useMap();
  useEffect(() => {
    const pts: [number, number][] = events.map((e) => [e.lat, e.lng]);
    if (user) pts.push([user.lat, user.lng]);
    if (pts.length === 0) {
      map.setView(CENTER, 12);
      return;
    }
    if (pts.length === 1) {
      map.setView(pts[0]!, 14);
      return;
    }
    map.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 15 });
  }, [events, user, map]);
  return null;
}

export default function MapView({ events, user, selectedId }: { events: EventItem[]; user: Coords | null; selectedId?: number | null }) {
  // Several events can share a district centre; spread them slightly so every pin stays clickable.
  const placed = useMemo(() => {
    const seen = new Map<string, number>();
    return events.map((e) => {
      const key = `${e.lat.toFixed(4)},${e.lng.toFixed(4)}`;
      const n = seen.get(key) ?? 0;
      seen.set(key, n + 1);
      const angle = n * 2.4;
      const r = n === 0 ? 0 : 0.0016 * Math.sqrt(n);
      return { event: e, pos: [e.lat + Math.sin(angle) * r, e.lng + Math.cos(angle) * r] as [number, number] };
    });
  }, [events]);

  return (
    <MapContainer center={CENTER} zoom={12} scrollWheelZoom={false} className="map" attributionControl>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
      <Fit events={events} user={user} />
      {user && <CircleMarker center={[user.lat, user.lng]} radius={9} pathOptions={{ color: "#fff", weight: 3, fillColor: "#2f6fe4", fillOpacity: 1 }} />}
      {placed.map(({ event, pos }) => (
        <Marker key={event.id} position={pos} icon={pinIcon(categoryStyle(event.category).color, dayNumber(event.startsAt), event.id === selectedId)} eventHandlers={{ click: () => trackView(event.id, "map") }}>
          <Popup>
            <div className="map-pop">
              <span className="chip chip-cat" style={{ ["--cat-soft" as string]: categoryStyle(event.category).soft, ["--cat-ink" as string]: categoryStyle(event.category).ink }}>{event.category}</span>
              <strong>{event.title}</strong>
              <span className="map-pop-meta">{dayNumber(event.startsAt)} {monthShort(event.startsAt)} · {timeOfDay(event.startsAt)}</span>
              <span className="map-pop-meta">{event.venue}{event.distanceKm !== null ? ` · ${distanceLabel(event.distanceKm)}` : ""}</span>
              <span className="map-pop-foot"><b>{priceLabel(event.price)}</b><Link to={`/events/${event.slug}`}>التفاصيل</Link></span>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
