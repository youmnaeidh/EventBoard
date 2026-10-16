import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useUserLocation } from "../context/LocationContext";
import { dayNumber, monthShort, priceLabel, timeOfDay } from "../lib/format";
import { trackView } from "../lib/track";
import type { EventItem } from "../types";
import { Icon } from "./Icon";

interface Msg { role: "user" | "assistant"; content: string; events?: EventItem[]; mode?: "llm" | "offline"; error?: boolean }

const SUGGESTIONS = ["وش أفضل فعالية الليلة؟", "عندكم شي مجاني للعائلة؟", "وش القريب مني؟"];

export function AssistantWidget() {
  const { coords } = useUserLocation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs, busy, open]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function ask(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const history = [...msgs.filter((m) => !m.error), { role: "user" as const, content }];
    setMsgs([...msgs, { role: "user", content }]);
    setInput("");
    setBusy(true);
    try {
      const res = await api.post<{ answer: string; mode: "llm" | "offline"; events: EventItem[] }>("/assistant", {
        messages: history.slice(-8).map((m) => ({ role: m.role, content: m.content.slice(0, 500) })),
        ...(coords ?? {})
      });
      setMsgs((list) => [...list, { role: "assistant", content: res.answer, events: res.events, mode: res.mode }]);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "تعذّر الاتصال، حاول مرة ثانية";
      setMsgs((list) => [...list, { role: "assistant", content: message, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void ask(input);
  }

  return (
    <>
      {!open && (
        <button type="button" className="assistant-fab" onClick={() => setOpen(true)} aria-label="افتح مساعد الفعاليات">
          <Icon name="sparkle" size={22} />
          <span>اسأل المساعد</span>
        </button>
      )}
      {open && (
        <section className="assistant" role="dialog" aria-label="مساعد الفعاليات">
          <header className="assistant-head">
            <span className="assistant-title"><Icon name="sparkle" size={19} /> مساعد الفعاليات</span>
            <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="إغلاق"><Icon name="x" size={20} /></button>
          </header>
          <div className="assistant-body" aria-live="polite">
            {msgs.length === 0 && (
              <div className="assistant-empty">
                <p>اسألني عن فعاليات المدينة المنورة بكلامك العادي. أجاوب من الفعاليات الموجودة فعلًا فقط.</p>
                <div className="suggest">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => void ask(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`msg msg-${m.role} ${m.error ? "msg-error" : ""}`}>
                <p>{m.content}</p>
                {m.events && m.events.length > 0 && (
                  <ul className="msg-events">
                    {m.events.map((e) => (
                      <li key={e.id}>
                        <Link to={`/events/${e.slug}`} onClick={() => { trackView(e.id, "assistant"); setOpen(false); }}>
                          <span className="mini-date num"><b>{dayNumber(e.startsAt)}</b>{monthShort(e.startsAt)}</span>
                          <span className="mini-main"><strong>{e.title}</strong><small>{timeOfDay(e.startsAt)} · {e.district} · {priceLabel(e.price)}</small></span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {m.mode === "offline" && <small className="msg-note">ردّ آلي مبني على نتائج البحث (المساعد اللغوي غير مفعّل)</small>}
              </div>
            ))}
            {busy && <div className="msg msg-assistant typing" aria-label="يكتب"><i /><i /><i /></div>}
            <div ref={endRef} />
          </div>
          <form className="assistant-form" onSubmit={submit}>
            <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder="اكتب سؤالك…" maxLength={500} aria-label="سؤالك" />
            <button type="submit" className="btn btn-primary" disabled={busy || !input.trim()} aria-label="إرسال"><Icon name="send" size={18} style={{ transform: "scaleX(-1)" }} /></button>
          </form>
        </section>
      )}
    </>
  );
}
