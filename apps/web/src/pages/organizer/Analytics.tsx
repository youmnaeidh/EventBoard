import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChartCard, HBars, LineChart, ORDINAL, C1, C2 } from "../../components/charts";
import { Icon } from "../../components/Icon";
import { ErrorBox, PageTitle } from "../../components/ui";
import { api } from "../../lib/api";
import { dateRange, formatNumber, money, percent } from "../../lib/format";
import { useDocTitle } from "../../lib/useDocTitle";
import type { Analytics as AnalyticsData } from "../../types";

const dayLabel = (d: string) => new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
const SOURCES: Record<string, string> = { home: "الرئيسية", search: "البحث", list: "قائمة الفعاليات", map: "الخريطة", recommendation: "الترشيحات", assistant: "المساعد", shared: "رابط مباشر", unknown: "غير محدد" };

export default function Analytics() {
  const { id } = useParams();
  const q = useQuery({ queryKey: ["org-analytics", id], queryFn: () => api.get<AnalyticsData>(`/organizer/events/${id}/analytics`) });
  useDocTitle(q.data?.event.title);

  if (q.isError) return <ErrorBox onRetry={() => q.refetch()} />;
  if (!q.data) return <i className="skel" style={{ height: 300 }} />;
  const a = q.data;
  const labels = a.daily.map((d) => dayLabel(d.day));

  return (
    <>
      <PageTitle title={a.event.title} sub={dateRange(a.event)}>
        <Link to="/organizer" className="btn btn-ghost btn-sm"><Icon name="arrow" size={16} style={{ transform: "scaleX(-1)" }} />كل الفعاليات</Link>
      </PageTitle>

      <div className="tiles">
        <div className="tile"><span className="tile-label">المشاهدات</span><b className="tile-value">{formatNumber(a.funnel.views)}</b><span className="tile-sub num">{formatNumber(a.funnel.visitors)} زائر مختلف</span></div>
        <div className="tile"><span className="tile-label">معدل الحفظ</span><b className="tile-value">{percent(a.rates.favoriteRate, 1)}</b><span className="tile-sub">من الزوّار</span></div>
        <div className="tile"><span className="tile-label">معدل الحجز</span><b className="tile-value">{percent(a.rates.bookingRate, 1)}</b><span className="tile-sub">من الزوّار</span></div>
        <div className="tile"><span className="tile-label">الإيراد</span><b className="tile-value">{money(a.revenue)}</b>{a.rates.fillRate !== null && <span className="tile-sub">امتلاء {a.rates.fillRate}%</span>}</div>
      </div>

      <div className="chart-grid">
        <ChartCard title="مسار الاهتمام" sub="من المشاهدة إلى الحجز (ترتيب المراحل بتدرّج لون واحد)">
          <HBars
            tableHead={["المرحلة", "العدد"]}
            format={formatNumber}
            rows={[
              { label: "مشاهدات", value: a.funnel.views, color: ORDINAL[0] },
              { label: "زوّار مختلفون", value: a.funnel.visitors, color: ORDINAL[1] },
              { label: "حفظوا", value: a.funnel.favorites, color: ORDINAL[2] },
              { label: "شاركوا", value: a.funnel.shares, color: ORDINAL[3] },
              { label: "حجزوا", value: a.funnel.bookings, color: ORDINAL[4] }
            ]}
          />
        </ChartCard>
        <ChartCard title="مصدر الزيارات" sub="من وين وصلوا للفعالية">
          <HBars rows={a.sources.map((s) => ({ label: SOURCES[s.source] ?? s.source, value: s.count }))} format={formatNumber} tableHead={["المصدر", "المشاهدات"]} />
        </ChartCard>
      </div>

      <ChartCard title="المشاهدات يوميًا" sub="آخر 14 يومًا">
        <LineChart labels={labels} series={[{ name: "مشاهدات", color: C1, values: a.daily.map((d) => d.views) }]} />
      </ChartCard>
      <ChartCard title="المحفوظات والحجوزات يوميًا" sub="مقياس مستقل عن المشاهدات، لأن الأعداد أصغر بكثير">
        <LineChart labels={labels} series={[{ name: "محفوظات", color: C1, values: a.daily.map((d) => d.favorites) }, { name: "حجوزات", color: C2, values: a.daily.map((d) => d.bookings) }]} />
      </ChartCard>

      <div className="chart-grid">
        <ChartCard title="توزيع التقييمات" sub={a.ratings.reduce((s, r) => s + r.count, 0) === 0 ? "ما فيه تقييمات للحين" : undefined}>
          <HBars rows={[5, 4, 3, 2, 1].map((n) => ({ label: `${n} نجوم`, value: a.ratings.find((r) => r.rating === n)?.count ?? 0 }))} format={String} tableHead={["التقييم", "العدد"]} />
        </ChartCard>
      </div>
    </>
  );
}
