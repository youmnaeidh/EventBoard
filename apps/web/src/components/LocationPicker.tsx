import { useEffect, useRef, useState } from "react";
import { useUserLocation } from "../context/LocationContext";
import { Icon } from "./Icon";

export function LocationPicker() {
  const loc = useUserLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  useEffect(() => {
    if (loc.source) setOpen(false);
  }, [loc.source, loc.label]);

  return (
    <div className="locpick" ref={ref}>
      <button type="button" className="loc-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Icon name="pin" size={17} />
        <span>{loc.label ?? "حدد موقعك"}</span>
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label="تحديد الموقع">
          <p className="popover-title">نرتّب لك الفعاليات حسب الأقرب</p>
          <button type="button" className="btn btn-soft btn-block" onClick={loc.requestGps} disabled={loc.status === "asking"}>
            <Icon name="navigation" size={17} />
            {loc.status === "asking" ? "نحدد موقعك…" : "استخدم موقعي الحالي"}
          </button>
          {loc.status === "denied" && <p className="hint hint-warn">ما قدرنا نوصل لموقعك. اختر حيّك من القائمة.</p>}
          {loc.status === "unsupported" && <p className="hint hint-warn">متصفحك ما يدعم تحديد الموقع. اختر حيّك من القائمة.</p>}
          <p className="popover-sub">أو اختر الحي</p>
          <ul className="district-list">
            {loc.meta?.districts.map((d) => (
              <li key={d.name}>
                <button type="button" className={loc.label === d.name ? "is-active" : ""} onClick={() => loc.chooseDistrict(d.name)}>{d.name}</button>
              </li>
            ))}
          </ul>
          {loc.coords && (
            <button type="button" className="link-btn" onClick={() => { loc.clear(); setOpen(false); }}>مسح الموقع</button>
          )}
          <p className="hint">موقعك يبقى في متصفحك، ما نخزّنه عندنا.</p>
        </div>
      )}
    </div>
  );
}
