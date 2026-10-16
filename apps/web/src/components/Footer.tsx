import { Link } from "react-router-dom";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="site-footer on-ink">
      <div className="container">
        <Link to="/events" className="footer-big">وش يصير في المدينة؟</Link>
      </div>
      <div className="container footer-grid">
        <div>
          <Logo height={36} />
          <p className="footer-about">اكتشفي فعاليات المدينة المنورة، من الأقرب إليك إلى الأنسب لاهتماماتك.</p>
        </div>
        <div>
          <h4>استكشف</h4>
          <ul>
            <li><Link to="/events">كل الفعاليات</Link></li>
            <li><Link to="/events?view=map">على الخريطة</Link></li>
            <li><Link to="/events?when=weekend">نهاية الأسبوع</Link></li>
            <li><Link to="/events?price=free">المجانية</Link></li>
          </ul>
        </div>
        <div>
          <h4>للمنظّمين</h4>
          <ul>
            <li><Link to="/register?role=organizer">سجّل كمنظّم</Link></li>
            <li><Link to="/organizer">لوحة التوقعات</Link></li>
          </ul>
        </div>
        <div className="footer-note">
          <h4>عن هذه النسخة</h4>
          <p>
            نسخة مطوّرة من مشروع التخرج، أُعيد بناؤها بالكامل: واجهة جديدة، قاعدة بيانات حقيقية، وخدمة ذكاء اصطناعي مستقلة.
            الفعاليات والحجوزات المعروضة هنا بيانات تجريبية.
          </p>
        </div>
      </div>
    </footer>
  );
}
