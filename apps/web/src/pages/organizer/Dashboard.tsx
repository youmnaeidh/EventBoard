import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "../../components/Icon";
import { Empty, ErrorBox, PageTitle } from "../../components/ui";
import { useToast } from "../../context/ToastContext";
import { api, ApiError } from "../../lib/api";
import { dayNumber, formatNumber, monthShort, money, timeOfDay } from "../../lib/format";
import { useDocTitle } from "../../lib/useDocTitle";
import type { Insights, OrganizerEventRow } from "../../types";

const STATUS: Record<string, { text: string; cls: string }> = {
  upcoming: { text: "قادمة", cls: "badge-price" },
  live: { text: "جارية", cls: "badge-live" },
  ended: { text: "انتهت", cls: "badge-ended" }
};

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="tile">
      <span className="tile-label">{label}</span>
      <b className="tile-value">{value}</b>
      {sub && <span className="tile-sub">{sub}</span>}
    </div>
  );
}

export default function Dashboard() {
  useDocTitle("لوحة المنظّم");
  const qc = useQueryClient();
  const { notify } = useToast();
  const list = useQuery({ queryKey: ["org-events"], queryFn: () => api.get<{ events: OrganizerEventRow[] }>("/organizer/events") });
  const insights = useQuery({ queryKey: ["org-insights"], queryFn: () => api.get<Insights>("/organizer/insights"), staleTime: 5 * 60_000 });
  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/organizer/events/${id}`),
    onSuccess: () => { notify("تم حذف الفعالية", "info"); qc.invalidateQueries({ queryKey: ["org-events"] }); },
    onError: (e) => notify(e instanceof ApiError ? e.message : "تعذّر الحذف", "error")
  });

  const rows = list.data?.events ?? [];
  const active = rows.filter((r) => r.event.status !== "ended");
  const totals = rows.reduce((a, r) => ({ views: a.views + r.stats.views, seats: a.seats + r.stats.seats, revenue: a.revenue + r.stats.revenue, bookings: a.bookings + r.stats.bookings }), { views: 0, seats: 0, revenue: 0, bookings: 0 });
  const capped = rows.filter((r) => r.event.capacity);
  const fill = capped.length ? Math.round((capped.reduce((a, r) => a + r.stats.seats, 0) / capped.reduce((a, r) => a + (r.event.capacity ?? 0), 0)) * 100) : null;
  const topGap = insights.data?.gaps.find((g) => g.opportunity === "high");

  return (
    <>
      <PageTitle title="فعالياتي" sub="أداء كل فعالية، وتوقّع الإقبال قبل ما تنشر">
        <Link to="/organizer/events/new" className="btn btn-primary"><Icon name="plus" size={18} />فعالية جديدة</Link>
      </PageTitle>

      {list.isError ? <ErrorBox onRetry={() => list.refetch()} /> : (
        <>
          <div className="tiles">
            <Tile label="فعاليات نشطة" value={formatNumber(active.length)} sub={`من ${formatNumber(rows.length)} فعالية`} />
            <Tile label="المشاهدات" value={formatNumber(totals.views)} />
            <Tile label="المقاعد المحجوزة" value={formatNumber(totals.seats)} sub={fill !== null ? `امتلاء ${fill}% من السعة` : undefined} />
            <Tile label="الإيراد" value={money(totals.revenue)} />
          </div>

          {topGap && (
            <Link to="/organizer/insights" className="gap-teaser">
              <span className="gap-ico"><Icon name="trend" size={22} /></span>
              <span>
                <b>فرصة: «{topGap.label}»</b>
                <small>بحث عنها <span className="num">{topGap.searches}</span> مرة بآخر 4 أسابيع، وما فيه فعالية قادمة تغطّيها تقريبًا. شوف بقية الفرص.</small>
              </span>
              <Icon name="arrow" size={20} />
            </Link>
          )}

          {list.isLoading ? <i className="skel" style={{ height: 200, marginTop: 20 }} /> : rows.length === 0 ? (
            <Empty icon="calendar" title="ما أضفت فعاليات للحين">
              <p>أضف أول فعالية، وجرّب لوحة التوقع تقترح لك أنسب موعد.</p>
              <Link to="/organizer/events/new" className="btn btn-primary">أضف فعالية</Link>
            </Empty>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th scope="col">الفعالية</th><th scope="col">الحالة</th><th scope="col">مشاهدات</th><th scope="col">محفوظات</th><th scope="col">مقاعد</th><th scope="col">الامتلاء</th><th scope="col">التحويل</th><th scope="col"><span className="sr-only">إجراءات</span></th></tr>
                </thead>
                <tbody>
                  {rows.map(({ event, stats }) => (
                    <tr key={event.id}>
                      <th scope="row">
                        <Link to={`/organizer/events/${event.id}`} className="tbl-title">{event.title}</Link>
                        <small className="muted-sm">{dayNumber(event.startsAt)} {monthShort(event.startsAt)} · {timeOfDay(event.startsAt)} · {event.district}</small>
                      </th>
                      <td><span className={`badge ${STATUS[event.status]!.cls}`}>{STATUS[event.status]!.text}</span></td>
                      <td className="num">{formatNumber(stats.views)}</td>
                      <td className="num">{formatNumber(stats.favorites)}</td>
                      <td className="num">{event.capacity ? `${stats.seats} / ${event.capacity}` : stats.seats || "—"}</td>
                      <td>{stats.fillRate !== null ? (<span className="fill"><span className="meter-wide"><i style={{ width: `${Math.min(100, stats.fillRate)}%` }} /></span><b className="num">{stats.fillRate}%</b></span>) : <span className="muted-sm">دخول مفتوح</span>}</td>
                      <td className="num">{stats.conversion}%</td>
                      <td>
                        <span className="row-actions">
                          <Link to={`/organizer/events/${event.id}`} className="icon-btn" aria-label={`تحليلات ${event.title}`} title="التحليلات"><Icon name="chart" size={18} /></Link>
                          {event.status !== "ended" && <Link to={`/organizer/events/${event.id}/edit`} className="icon-btn" aria-label={`تعديل ${event.title}`} title="تعديل"><Icon name="edit" size={18} /></Link>}
                          <button type="button" className="icon-btn" aria-label={`حذف ${event.title}`} title="حذف" disabled={remove.isPending} onClick={() => confirm(`حذف «${event.title}»؟`) && remove.mutate(event.id)}><Icon name="trash" size={18} /></button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
