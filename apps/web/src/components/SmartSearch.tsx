import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "./Icon";

export const EXAMPLES = ["ابغى شي عائلي الليلة", "فعاليات مجانية نهاية الأسبوع", "ورشة فخار", "قهوة مختصة قريبة مني", "نشاط للأطفال بكرة"];

interface Props {
  initial?: string;
  size?: "hero" | "bar";
  onSubmit?: (q: string) => void;
}

export function SmartSearch({ initial = "", size = "bar", onSubmit }: Props) {
  const [q, setQ] = useState(initial);
  const nav = useNavigate();

  function submit(e: FormEvent) {
    e.preventDefault();
    const value = q.trim();
    if (!value) return;
    if (onSubmit) onSubmit(value);
    else nav(`/events?q=${encodeURIComponent(value)}`);
  }

  return (
    <form className={`smart smart-${size}`} onSubmit={submit} role="search">
      <label htmlFor={`smart-${size}`} className="sr-only">ابحث عن فعالية بكلامك</label>
      <Icon name="sparkle" size={size === "hero" ? 24 : 20} className="smart-icon" />
      <input
        id={`smart-${size}`}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="اكتب بكلامك: ابغى شي عائلي الليلة…"
        maxLength={200}
        autoComplete="off"
      />
      <button type="submit" className="btn btn-primary smart-go" aria-label="ابحث"><Icon name="search" size={19} /><span>ابحث</span></button>
    </form>
  );
}
