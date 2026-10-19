import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useUserLocation } from "../context/LocationContext";
import { ApiError } from "../lib/api";
import { categoryStyle } from "../lib/categories";
import { useDocTitle } from "../lib/useDocTitle";
import type { Role } from "../types";

function useRedirect() {
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from;
  return from && from.startsWith("/") && !from.startsWith("//") ? from : "/";
}

function FieldError({ error, field }: { error: ApiError | null; field: string }) {
  const d = error?.details?.find((x) => x.path === field);
  return d ? <span className="field-error" role="alert">{d.message}</span> : null;
}

const DEMOS = [
  { label: "جرّب كحاضر", email: "demo@eventboard.demo", password: "Demo#2026", sub: "حجوزات وتقييمات ومحفوظات جاهزة" },
  { label: "جرّب كمنظّم", email: "organizer@eventboard.demo", password: "Demo#2026", sub: "لوحة التوقعات وفجوات الطلب" }
];

export function Login() {
  useDocTitle("تسجيل الدخول");
  const { login } = useAuth();
  const nav = useNavigate();
  const redirect = useRedirect();
  const { notify } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function go(e: string, p: string, demoRole?: Role) {
    setBusy(true);
    setError(null);
    try {
      const user = await login(e, p);
      notify(`أهلًا ${user.name.split(" ")[0]}`, "success");
      nav(demoRole === "organizer" || (user.role === "organizer" && redirect === "/") ? "/organizer" : redirect, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "network", "تعذّر الاتصال"));
    } finally {
      setBusy(false);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    void go(email, password);
  }

  return (
    <div className="container auth">
      <form className="auth-card" onSubmit={submit} noValidate>
        <h1>أهلًا بعودتك</h1>
        <p className="auth-sub">سجّل دخولك لحجز الفعاليات وحفظها.</p>
        {error && <p className="form-error" role="alert">{error.message}</p>}
        <label className="field"><span>البريد الإلكتروني</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" dir="ltr" required /></label>
        <label className="field"><span>كلمة المرور</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" dir="ltr" required /></label>
        <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy || !email || !password}>{busy ? "جاري الدخول…" : "دخول"}</button>
        <p className="auth-alt">ما عندك حساب؟ <Link to="/register" state={{ from: redirect }}>أنشئ حساب</Link></p>
      </form>
      <aside className="demo-card">
        <h2>تبي تتفرّج بسرعة؟</h2>
        <p>حسابات تجريبية جاهزة ببيانات وهمية، بدون تسجيل.</p>
        {DEMOS.map((d) => (
          <button key={d.email} type="button" className="demo-btn" disabled={busy} onClick={() => go(d.email, d.password, d.email.startsWith("organizer") ? "organizer" : "attendee")}>
            <strong>{d.label}</strong><span>{d.sub}</span><Icon name="arrow" size={18} />
          </button>
        ))}
      </aside>
    </div>
  );
}

export function Register() {
  useDocTitle("إنشاء حساب");
  const { register } = useAuth();
  const { meta } = useUserLocation();
  const nav = useNavigate();
  const redirect = useRedirect();
  const [sp] = useSearchParams();
  const { notify } = useToast();
  const [role, setRole] = useState<Role>(sp.get("role") === "organizer" ? "organizer" : "attendee");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = (c: string) => setInterests((list) => (list.includes(c) ? list.filter((x) => x !== c) : list.length >= 4 ? list : [...list, c]));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register({ name, email, password, role, interests: role === "attendee" ? interests : [] });
      notify("تم إنشاء حسابك", "success");
      nav(role === "organizer" ? "/organizer" : redirect, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "network", "تعذّر الاتصال"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container auth">
      <form className="auth-card" onSubmit={submit} noValidate>
        <h1>إنشاء حساب</h1>
        <div className="role-switch" role="radiogroup" aria-label="نوع الحساب">
          <button type="button" role="radio" aria-checked={role === "attendee"} className={role === "attendee" ? "is-on" : ""} onClick={() => setRole("attendee")}><Icon name="ticket" size={18} />أحضر فعاليات</button>
          <button type="button" role="radio" aria-checked={role === "organizer"} className={role === "organizer" ? "is-on" : ""} onClick={() => setRole("organizer")}><Icon name="chart" size={18} />أنظّم فعاليات</button>
        </div>
        {error && !error.details?.length && <p className="form-error" role="alert">{error.message}</p>}
        <label className="field"><span>الاسم</span><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /><FieldError error={error} field="name" /></label>
        <label className="field"><span>البريد الإلكتروني</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" dir="ltr" required /><FieldError error={error} field="email" /></label>
        <label className="field"><span>كلمة المرور</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" dir="ltr" minLength={8} required /><small>8 أحرف على الأقل</small><FieldError error={error} field="password" /></label>
        {role === "attendee" && (
          <fieldset className="field interests">
            <legend>وش يهمك؟ <small>(اختر حتى 4، تحسّن ترشيحاتك)</small></legend>
            <div className="pill-group wrap">
              {meta?.categories.map((c) => {
                const s = categoryStyle(c);
                const on = interests.includes(c);
                return (
                  <button key={c} type="button" className={`pill ${on ? "is-on" : ""}`} aria-pressed={on} onClick={() => toggle(c)} style={on ? { background: s.soft, color: s.ink, borderColor: s.color } : undefined}>{c}</button>
                );
              })}
            </div>
          </fieldset>
        )}
        <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy || !name || !email || password.length < 8}>{busy ? "جاري الإنشاء…" : "إنشاء الحساب"}</button>
        <p className="auth-alt">عندك حساب؟ <Link to="/login" state={{ from: redirect }}>سجّل دخولك</Link></p>
      </form>
    </div>
  );
}
