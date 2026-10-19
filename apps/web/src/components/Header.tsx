import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Icon } from "./Icon";
import { LocationPicker } from "./LocationPicker";
import { Logo } from "./Logo";

export function Header() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const { pathname, search } = useLocation();
  const isMap = pathname === "/events" && new URLSearchParams(search).get("view") === "map";
  const [menu, setMenu] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const onHome = pathname === "/";

  // On the home page the header floats over the hero video and turns solid once the page scrolls.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setDrawer(false);
    setMenu(false);
  }, [pathname]);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const links = (
    <>
      <NavLink to="/" end>الرئيسية</NavLink>
      <NavLink to="/events" className={({ isActive }) => (isActive && !isMap ? "active" : "")}>الفعاليات</NavLink>
      <NavLink to="/events?view=map" className={() => (isMap ? "active" : "")}>الخريطة</NavLink>
      {user?.role === "organizer" ? <NavLink to="/organizer">لوحة المنظّم</NavLink> : <NavLink to="/register?role=organizer">للمنظّمين</NavLink>}
    </>
  );

  return (
    <header className={`site-header ${onHome ? "on-hero" : ""} ${!onHome || scrolled || drawer ? "is-solid" : ""}`}>
      <div className="container header-inner">
        <Logo />
        <nav className="nav-desktop" aria-label="التنقل الرئيسي">{links}</nav>
        <div className="header-actions">
          <LocationPicker />
          {user ? (
            <div className="usermenu" ref={menuRef}>
              <button type="button" className="avatar-btn" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
                <span className="avatar" aria-hidden="true">{user.name.trim().charAt(0)}</span>
                <span className="avatar-name">{user.name.split(" ")[0]}</span>
              </button>
              {menu && (
                <div className="popover popover-menu">
                  <Link to="/account"><Icon name="ticket" size={17} />حجوزاتي ومحفوظاتي</Link>
                  {user.role === "organizer" && <Link to="/organizer"><Icon name="chart" size={17} />لوحة المنظّم</Link>}
                  <button type="button" onClick={async () => { await logout(); setMenu(false); nav("/"); }}><Icon name="logout" size={17} />تسجيل الخروج</button>
                </div>
              )}
            </div>
          ) : (
            <div className="auth-links">
              <Link to="/login" state={{ from: pathname }} className="btn btn-ghost">دخول</Link>
              <Link to="/register" className="btn btn-primary btn-sm">إنشاء حساب</Link>
            </div>
          )}
          <button type="button" className="burger" aria-label="القائمة" aria-expanded={drawer} onClick={() => setDrawer((v) => !v)}>
            <Icon name={drawer ? "x" : "menu"} size={24} />
          </button>
        </div>
      </div>
      {drawer && (
        <nav className="nav-drawer" aria-label="التنقل">
          {links}
          {!user && <Link to="/login" state={{ from: pathname }}>دخول</Link>}
        </nav>
      )}
    </header>
  );
}
