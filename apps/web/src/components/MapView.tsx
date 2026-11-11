import { useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import L from "leaflet";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { categoryStyle } from "../lib/categories";
import { dayNumber, priceLabel, fullDate } from "../lib/format";
import { trackView } from "../lib/track";
import type { EventItem } from "../types";
import type { Coords } from "../context/LocationContext";

const CENTER: [number, number] = [24.4672, 39.6111];
function Fit({ events, user, selectedId }: { events: EventItem[]; user: Coords | null; selectedId?: number | null }) {
  const map = useMap();
  useEffect(() => {
    const pts: [number,number][] = events.map(e=>[e.lat,e.lng]);
    if(user) pts.push([user.lat,user.lng]);
    if(pts.length>1) map.fitBounds(L.latLngBounds(pts),{padding:[48,48],maxZoom:15});
    else map.setView(pts[0] ?? CENTER,pts.length ? 14 : 12);
  },[events,user,map]);
  useEffect(()=>{
    const e=events.find(e=>e.id===selectedId);
    if(e) map.setView([e.lat,e.lng],Math.max(14,map.getZoom()));
  },[selectedId,events,map]);
  return null;
}
function GroupMarker({group,selectedId,onSelect}:{group:EventItem[];selectedId?:number|null;onSelect?:(id:number)=>void}){
  const marker=useRef<L.Marker>(null);
  const first=group[0]!;
  const active=group.some(e=>e.id===selectedId);
  useEffect(()=>{if(active)marker.current?.openPopup();},[active,selectedId]);
  const icon=L.divIcon({className:'pin-wrap',html:`<span class="pin ${active?'pin-active':''}" style="--pin:${categoryStyle(first.category).color}"><b>${group.length>1?group.length:dayNumber(first.startsAt)}</b></span>`,iconSize:[40,48],iconAnchor:[20,46],popupAnchor:[0,-42]});
  return <Marker ref={marker} position={[first.lat,first.lng]} icon={icon} eventHandlers={{click:()=>onSelect?.(first.id)}}>
    <Popup><div className="map-group">
      {group.length>1 && <b>{group.length} فعاليات في نفس النقطة</b>}
      {group.map(e=><div className="map-pop" key={e.id}>
        <span className="chip chip-soft">{e.category}</span><strong>{e.title}</strong>
        <span className="map-pop-meta">{fullDate(e.startsAt)} · {e.venue}</span>
        <small>{e.details?.locationAccuracy==='exact'?'موقع محدد من المنظّم':e.details?.locationAccuracy==='illustrative'?'موقع تجريبي توضيحي':'موقع تقريبي'}</small>
        <span className="map-pop-foot"><b>{priceLabel(e.price)}</b><Link to={`/events/${e.slug}`} onClick={()=>trackView(e.id,'map')}>التفاصيل</Link></span>
      </div>)}
    </div></Popup>
  </Marker>;
}
export default function MapView({events,user,selectedId,onSelect}:{events:EventItem[];user:Coords|null;selectedId?:number|null;onSelect?:(id:number)=>void}){
  // Group exact duplicates at their actual stored coordinate; never move a marker for display.
  const groups=useMemo(()=>{
    const grouped=new Map<string,EventItem[]>();
    for(const e of events){const key=`${e.lat},${e.lng}`;grouped.set(key,[...(grouped.get(key)??[]),e]);}
    return [...grouped.values()];
  },[events]);
  return <div>
    <p className="hint">الرقم على العلامة المجمّعة هو عدد الفعاليات. المواقع التجريبية والتقريبية ليست عناوين دخول مؤكدة.</p>
    <div className="map-legend" aria-label="مفتاح الفئات">{[...new Set(events.map(e=>e.category))].map(c=><span key={c}><i style={{background:categoryStyle(c).color}}/>{c}</span>)}</div>
    <MapContainer center={CENTER} zoom={12} scrollWheelZoom={false} className="map" attributionControl>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19}/>
      <Fit events={events} user={user} selectedId={selectedId}/>
      {user && <CircleMarker center={[user.lat,user.lng]} radius={9} pathOptions={{color:'#fff',weight:3,fillColor:'#2f6fe4',fillOpacity:1}}/>}
      {groups.map(g=><GroupMarker key={`${g[0]!.lat},${g[0]!.lng}`} group={g} selectedId={selectedId} onSelect={onSelect}/>)}
    </MapContainer>
  </div>;
}
