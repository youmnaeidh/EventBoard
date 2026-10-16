import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Icon } from "./Icon";

export function FavButton({ eventId, initial, label = false }: { eventId: number; initial: boolean; label?: boolean }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const qc = useQueryClient();
  const { notify } = useToast();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => setOn(initial), [initial]);

  async function toggle() {
    if (!user) {
      notify("سجّل دخولك عشان تحفظ الفعاليات", "info");
      nav("/login", { state: { from: loc.pathname + loc.search } });
      return;
    }
    if (busy) return;
    const next = !on;
    setOn(next); // optimistic
    setBusy(true);
    try {
      if (next) await api.put(`/events/${eventId}/favorite`);
      else await api.del(`/events/${eventId}/favorite`);
      qc.invalidateQueries({ queryKey: ["favorites"] });
      qc.invalidateQueries({ queryKey: ["recommendations"] });
    } catch {
      setOn(!next);
      notify("ما قدرنا نحفظ التغيير، حاول مرة ثانية", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`fav ${on ? "is-on" : ""} ${label ? "fav-labeled" : ""}`}
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? "إزالة من المحفوظات" : "حفظ الفعالية"}
    >
      <Icon name="heart" size={label ? 20 : 19} filled={on} />
      {label && <span>{on ? "محفوظة" : "حفظ"}</span>}
    </button>
  );
}
