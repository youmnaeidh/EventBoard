import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icon, type IconName } from "./Icon";

export function SectionHead({ title, sub, action }: { title: string; sub?: string; action?: { to: string; label: string } }) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {action && <Link to={action.to} className="more-link">{action.label}<Icon name="arrow" size={17} /></Link>}
    </div>
  );
}

export function Empty({ icon = "search", title, children }: { icon?: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={icon} size={28} /></span>
      <h3>{title}</h3>
      {children && <div className="empty-body">{children}</div>}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="errorbox" role="alert">
      <Icon name="info" size={20} />
      <span>{message ?? "صار خطأ وما قدرنا نحمّل البيانات."}</span>
      {onRetry && <button type="button" className="btn btn-soft btn-sm" onClick={onRetry}><Icon name="refresh" size={16} />إعادة المحاولة</button>}
    </div>
  );
}

export function PageTitle({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children}
    </div>
  );
}
