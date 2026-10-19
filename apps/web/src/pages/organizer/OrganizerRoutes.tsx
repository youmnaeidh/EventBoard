import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { Empty } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { Link } from "react-router-dom";
import Analytics from "./Analytics";
import Dashboard from "./Dashboard";
import EventForm from "./EventForm";
import Insights from "./Insights";

export default function OrganizerRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="container page"><i className="skel" style={{ height: 240 }} /></div>;
  if (!user) return <Navigate to="/login" state={{ from: "/organizer" }} replace />;
  if (user.role !== "organizer") {
    return (
      <div className="container page">
        <Empty icon="chart" title="هذي المنطقة للمنظّمين فقط">
          <p>حسابك حساب حضور. سجّل حساب منظّم عشان تنشر فعاليات وتشوف التوقعات.</p>
          <Link to="/register?role=organizer" className="btn btn-primary">سجّل كمنظّم</Link>
        </Empty>
      </div>
    );
  }
  return (
    <div className="container page org">
      <nav className="org-tabs" aria-label="لوحة المنظّم">
        <NavLink to="/organizer" end>فعالياتي</NavLink>
        <NavLink to="/organizer/insights">فجوات الطلب</NavLink>
        <NavLink to="/organizer/events/new">فعالية جديدة</NavLink>
      </nav>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="insights" element={<Insights />} />
        <Route path="events/new" element={<EventForm />} />
        <Route path="events/:id/edit" element={<EventForm />} />
        <Route path="events/:id" element={<Analytics />} />
        <Route path="*" element={<Navigate to="/organizer" replace />} />
      </Routes>
    </div>
  );
}
