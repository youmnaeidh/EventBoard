import { Link } from "react-router-dom";
import { Empty } from "../components/ui";
import { useDocTitle } from "../lib/useDocTitle";

export default function NotFound() {
  useDocTitle("الصفحة غير موجودة");
  return (
    <div className="container page">
      <Empty icon="map" title="هذي الصفحة مو موجودة">
        <p>يمكن الرابط تغيّر أو انحذفت الفعالية.</p>
        <Link to="/events" className="btn btn-primary">تصفّح الفعاليات</Link>
      </Empty>
    </div>
  );
}
