import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ChartCard, HBars } from "../../components/charts";
import { Icon } from "../../components/Icon";
import { ErrorBox, PageTitle } from "../../components/ui";
import { api } from "../../lib/api";
import { formatNumber } from "../../lib/format";
import { useDocTitle } from "../../lib/useDocTitle";
import type { Insights as InsightsData } from "../../types";

const OPP = {
  high: { text: "فرصة عالية", cls: "badge-low", icon: "flame" as const },
  medium: { text: "فرصة متوسطة", cls: "badge-live", icon: "trend" as const },
  low: { text: "مغطّاة", cls: "badge-free", icon: "check" as const }
};

interface ModelCard { name?: string; algorithm?: string; trainedOn?: { rows: number; source: string }; metrics?: Record<string, number | string>; limitations?: string[]; features?: string[] }

export default function Insights() {
  useDocTitle("فجوات الطلب");
  const q = useQuery({ queryKey: ["org-insights"], queryFn: () => api.get<InsightsData>("/organizer/insights"), staleTime: 60_000 });
  const model = useQuery({ queryKey: ["org-model"], queryFn: () => api.get<ModelCard>("/organizer/model"), retry: false, staleTime: Infinity });

  if (q.isError) return <ErrorBox onRetry={() => q.refetch()} />;
  if (!q.data) return <i className="skel" style={{ height: 320 }} />;
  const d = q.data;
  const m = model.data?.metrics;

  return (
    <>
      <PageTitle title="وش يطلبه الناس وما لقوه؟" sub={`عينة من ${formatNumber(d.totalSearches)} بحثًا بعد تقليل التكرار خلال 28 يومًا؛ لا تثبت طلبًا حقيقيًا في بيانات العرض الصناعية`}>
        <Link to="/organizer/events/new" className="btn btn-primary"><Icon name="plus" size={18} />جهّز فعالية</Link>
      </PageTitle>
      {d.sample && <p className="notice">{d.sample.uniqueSearchers} باحثًا أو جلسة مختلفة. نحتسب نفس النص مرة يوميًا لكل مستخدم/جلسة. لا مخزون يحقق القيود: {d.sample.noInventory} · نتائج صفرية مع وجود مرشحين (قد تكون مشكلة استرجاع): {d.sample.retrievalFailures} · استخدام البحث البديل: {d.sample.engineUnavailable}. السجلات القديمة بلا تشخيص لا تُصنّف كفجوة مؤكدة.</p>}
      {d.mode === "basic" && <p className="notice"><Icon name="info" size={18} />خدمة التحليل الذكي غير متاحة الحين، نعرض تجميعًا بسيطًا لنص البحث بدون تقدير للعرض.</p>}

      <div className="gap-list">
        {d.gaps.length === 0 && <p className="muted">ما فيه بيانات بحث كافية للحين.</p>}
        {d.gaps.map((g) => {
          const o = OPP[g.opportunity];
          return (
            <article key={g.label} className="gap-card">
              <header>
                <h3>{g.label}{g.category && <span className="chip chip-soft">{g.category}</span>}</h3>
                <span className={`badge ${o.cls}`}><Icon name={o.icon} size={14} />{o.text}</span>
              </header>
              <dl className="gap-stats">
                <div><dt>عمليات البحث</dt><dd className="num">{formatNumber(g.searches)}</dd></div>
                <div><dt>فعاليات تغطيها</dt><dd className="num">{formatNumber(g.supply)}</dd></div>
                <div><dt>بدون نتائج</dt><dd className="num">{Math.round(g.zeroResultShare * 100)}%</dd></div>
                <div><dt>الاتجاه (أسبوع)</dt><dd className="num">{g.trend === null ? "—" : `${g.trend > 0 ? "▲ +" : g.trend < 0 ? "▼ −" : ""}${Math.round(Math.abs(g.trend) * 100)}%`}</dd></div>
              </dl>
              {g.exampleQueries.length > 0 && <p className="gap-examples">أمثلة بحث: {g.exampleQueries.slice(0, 3).map((e) => `«${e}»`).join("، ")}</p>}
            </article>
          );
        })}
      </div>

      <div className="chart-grid">
        <ChartCard title="مقاعد محجوزة حسب الفئة" sub="كل الفعاليات في المنصة">
          <HBars rows={d.categories.map((c) => ({ label: c.category, value: c.seats, note: `${c.events} فعالية` }))} format={formatNumber} tableHead={["الفئة", "المقاعد"]} />
        </ChartCard>
        <ChartCard title="متوسط التقييم حسب الفئة" sub="من 5">
          <HBars rows={d.categories.filter((c) => c.avgRating).map((c) => ({ label: c.category, value: Number(c.avgRating) }))} format={(n) => n.toFixed(1)} tableHead={["الفئة", "التقييم"]} />
        </ChartCard>
      </div>

      <details className="model-card">
        <summary>كيف نحسب هذي الأرقام؟ وكم نثق فيها؟</summary>
        <div>
          <p><b>فجوات الطلب:</b> نجمّع عمليات البحث المتقاربة في المعنى (مثل «ودي بورشة فخار» و«ورشة سيراميك») في موضوع واحد، ونقدّر العرض بعدد الفعاليات القادمة التي تتطابق معه في البحث. الفرصة «عالية» إذا كان الطلب كبيرًا مع عرض معدوم أو ضعيف نسبةً للمتوسط.</p>
          <p><b>توقع الإقبال:</b> {model.data?.algorithm ?? "نموذج Gradient Boosting مع نطاق ثقة 80%"}.</p>
          {m && (
            <ul className="metrics">
              <li><b className="num">{String(m.mae)}</b><span>متوسط الخطأ المطلق (حجز). المقارنة بمتوسط الفئة: <span className="num">{String(m.baselineMaeCategoryMean)}</span></span></li>
              <li><b className="num">{String(m.r2)}</b><span>R² (جودة التفسير)</span></li>
              <li><b className="num">{Math.round(Number(m.intervalCoverage80) * 100)}%</b><span>تغطية النطاق المتوقع (الهدف 80%)</span></li>
            </ul>
          )}
          {model.data?.limitations && <ul className="limits">{model.data.limitations.map((l) => <li key={l}><Icon name="info" size={16} />{l}</li>)}</ul>}
        </div>
      </details>
    </>
  );
}
