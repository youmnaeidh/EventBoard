import { useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

/**
 * Small, dependency-free charts that follow one spec: thin marks (bars <= 24px, 4px rounded data end),
 * 2px lines with >= 8px end dots ringed in the surface colour, hairline recessive grid, a legend whenever there are
 * two or more series, hover + keyboard tooltips, and a table alternative for every chart.
 *
 * Colours are validated (see docs/ai.md#chart-colours): categorical 1 = #6f45d6, 2 = #eb6834;
 * the funnel uses an ordinal one-hue ramp. Text never wears a series colour.
 */
export const C1 = "#6f45d6";
export const C2 = "#eb6834";
export const ORDINAL = ["#b8a0f2", "#9a78ea", "#7d56dc", "#6238c0", "#4a2a96"];
const GRID = "#e7dfee";
const AXIS = "#d6cae2";
const MUTED = "#6f6578";
const SURFACE = "#ffffff";

const compact = (n: number) => (n >= 1000 ? `${+(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(Math.round(n)));

function niceMax(max: number): number {
  if (max <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(max));
  const n = max / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

interface TipState { x: number; y: number; title: string; rows: { color?: string; label: string; value: string }[] }

function Tip({ tip }: { tip: TipState | null }) {
  if (!tip) return null;
  return (
    <div className="chart-tip" style={{ left: tip.x, top: tip.y }} role="status">
      <strong>{tip.title}</strong>
      {tip.rows.map((r, i) => (
        <span key={i} className="chart-tip-row">
          {r.color && <i style={{ background: r.color }} />}
          <b className="num">{r.value}</b>
          <span>{r.label}</span>
        </span>
      ))}
    </div>
  );
}

function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="chart-table">
      <summary>عرض البيانات كجدول</summary>
      <table>
        <thead><tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j} className="num">{c}</td>))}</tr>)}</tbody>
      </table>
    </details>
  );
}

export function ChartCard({ title, sub, children, aside }: { title: string; sub?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="chart-card">
      <header><div><h3>{title}</h3>{sub && <p>{sub}</p>}</div>{aside}</header>
      {children}
    </section>
  );
}

/* ---------- horizontal bars (compare magnitude / funnel / distribution) ---------- */

export interface BarRow { label: string; value: number; color?: string; note?: string }

export function HBars({ rows, color = C1, format = (n: number) => String(n), unit = "", tableHead = ["البند", "القيمة"] }: { rows: BarRow[]; color?: string; format?: (n: number) => string; unit?: string; tableHead?: string[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const [tip, setTip] = useState<TipState | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const show = (e: PointerEvent | { clientX: number; clientY: number }, r: BarRow) => {
    const b = box.current!.getBoundingClientRect();
    setTip({ x: e.clientX - b.left, y: e.clientY - b.top - 12, title: r.label, rows: [{ color: r.color ?? color, label: r.note ?? unit, value: format(r.value) }] });
  };
  return (
    <div className="hbars" ref={box} onPointerLeave={() => setTip(null)}>
      {rows.map((r) => (
        <div
          key={r.label}
          className="hbar"
          tabIndex={0}
          onPointerMove={(e) => show(e, r)}
          onFocus={(e) => { const b = e.currentTarget.getBoundingClientRect(); show({ clientX: b.left + b.width / 2, clientY: b.top }, r); }}
          onBlur={() => setTip(null)}
        >
          <span className="hbar-label">{r.label}</span>
          <span className="hbar-track">
            <i style={{ width: `${Math.max(r.value > 0 ? 1.5 : 0, (r.value / max) * 100)}%`, background: r.color ?? color }} />
          </span>
          <b className="hbar-value num">{format(r.value)}{unit && <small>{unit}</small>}</b>
        </div>
      ))}
      <Tip tip={tip} />
      <DataTable head={tableHead} rows={rows.map((r) => [r.label, format(r.value)])} />
    </div>
  );
}

/* ---------- line chart (trend over time) ---------- */

export interface LineSeries { name: string; color: string; values: number[] }

export function LineChart({ labels, series, height = 220, area = false }: { labels: string[]; series: LineSeries[]; height?: number; area?: boolean }) {
  const W = 640, padL = 38, padR = 14, padT = 14, padB = 28;
  const H = height;
  const n = labels.length;
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * (W - padL - padR));
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const ticks = [0, 1, 2, 3, 4].map((t) => (max / 4) * t);
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const id = useId();

  const idxFromPointer = (e: PointerEvent<SVGRectElement>) => {
    const b = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - b.left) / b.width) * W;
    return Math.max(0, Math.min(n - 1, Math.round(((px - padL) / (W - padL - padR)) * (n - 1))));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
    else if (e.key === "ArrowRight") setHover((h) => Math.max(0, (h ?? n) - 1));
    else if (e.key === "Escape") setHover(null);
  };

  const labelIdx = n <= 6 ? labels.map((_, i) => i) : [0, Math.round((n - 1) * 0.25), Math.round((n - 1) * 0.5), Math.round((n - 1) * 0.75), n - 1];
  const tip: TipState | null = hover === null ? null : {
    x: (x(hover) / W) * 100, y: 0, title: labels[hover]!,
    rows: series.map((s) => ({ color: s.color, label: s.name, value: String(s.values[hover] ?? 0) }))
  };

  return (
    <div className="linechart">
      {series.length > 1 && (
        <ul className="legend" aria-label="مفتاح الرسم">
          {series.map((s) => <li key={s.name}><i style={{ background: s.color }} />{s.name}</li>)}
        </ul>
      )}
      <div className="linechart-box" dir="ltr">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={series.map((s) => s.name).join("، ")} tabIndex={0} onKeyDown={onKey} onBlur={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={t === 0 ? AXIS : GRID} strokeWidth={1} />
              <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill={MUTED}>{compact(t)}</text>
            </g>
          ))}
          {labelIdx.map((i) => <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize={11} fill={MUTED}>{labels[i]}</text>)}
          {series.map((s, si) => {
            const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
            const lastI = s.values.length - 1;
            return (
              <g key={s.name}>
                {(area || series.length === 1) && n > 1 && (
                  <polygon points={`${x(0)},${y(0)} ${pts} ${x(lastI)},${y(0)}`} fill={s.color} opacity={0.1} id={`${id}-a${si}`} />
                )}
                <polyline points={pts} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={x(lastI)} cy={y(s.values[lastI] ?? 0)} r={5} fill={s.color} stroke={SURFACE} strokeWidth={2} />
              </g>
            );
          })}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke={AXIS} strokeWidth={1} />
              {series.map((s) => <circle key={s.name} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={5} fill={s.color} stroke={SURFACE} strokeWidth={2} />)}
            </g>
          )}
          <rect x={padL} y={padT} width={W - padL - padR} height={H - padT - padB} fill="transparent" onPointerMove={(e) => setHover(idxFromPointer(e))} onPointerLeave={() => setHover(null)} />
        </svg>
        {tip && <div className="chart-tip" style={{ left: `${tip.x}%`, top: 8, transform: tip.x > 60 ? "translateX(-105%)" : "translateX(5%)" }} role="status" dir="rtl">
          <strong>{tip.title}</strong>
          {tip.rows.map((r) => <span key={r.label} className="chart-tip-row"><i style={{ background: r.color }} /><b className="num">{r.value}</b><span>{r.label}</span></span>)}
        </div>}
      </div>
      <DataTable head={["اليوم", ...series.map((s) => s.name)]} rows={labels.map((l, i) => [l, ...series.map((s) => s.values[i] ?? 0)])} />
    </div>
  );
}

/* ---------- forecast: expected value inside an 80% interval ---------- */

export function IntervalBar({ low, expected, high, capacity }: { low: number; expected: number; high: number; capacity?: number | null }) {
  const scaleMax = Math.max(capacity ?? 0, high, 1) * 1.08;
  const pct = (v: number) => `${(v / scaleMax) * 100}%`;
  return (
    <div className="interval" dir="ltr">
      <div className="interval-track" role="img" aria-label={`المتوقع ${expected}، النطاق من ${low} إلى ${high}${capacity ? `، السعة ${capacity}` : ""}`}>
        <i className="interval-range" style={{ left: pct(low), width: `calc(${pct(high)} - ${pct(low)})` }} />
        <i className="interval-dot" style={{ left: pct(expected) }} />
        {capacity ? <i className="interval-cap" style={{ left: pct(capacity) }}><span>السعة {capacity}</span></i> : null}
      </div>
      <div className="interval-scale">
        <span style={{ left: pct(low) }} className="num">{low}</span>
        <span style={{ left: pct(high) }} className="num">{high}</span>
      </div>
    </div>
  );
}

/* ---------- drivers: diverging bars around zero ---------- */

export function DivergingBars({ rows }: { rows: { label: string; impact: number }[] }) {
  const max = Math.max(0.1, ...rows.map((r) => Math.abs(r.impact)));
  const [tip, setTip] = useState<TipState | null>(null);
  const box = useRef<HTMLDivElement>(null);
  return (
    <div className="diverging" ref={box} onPointerLeave={() => setTip(null)}>
      <div className="diverging-legend"><span><i style={{ background: C2 }} />يقلّل الإقبال</span><span><i style={{ background: C1 }} />يزيد الإقبال</span></div>
      {rows.map((r) => {
        const w = (Math.abs(r.impact) / max) * 50;
        const pos = r.impact >= 0;
        const text = `${pos ? "+" : "−"}${Math.round(Math.abs(r.impact) * 100)}%`;
        return (
          <div
            key={r.label}
            className="div-row"
            tabIndex={0}
            onPointerMove={(e) => { const b = box.current!.getBoundingClientRect(); setTip({ x: e.clientX - b.left, y: e.clientY - b.top - 12, title: r.label, rows: [{ color: pos ? C1 : C2, label: pos ? "أعلى من المتوسط" : "أقل من المتوسط", value: text }] }); }}
          >
            <span className="div-label">{r.label}</span>
            <span className="div-plot" dir="ltr">
              <i className="div-axis" />
              <i className="div-bar" style={{ background: pos ? C1 : C2, width: `${w}%`, [pos ? "left" : "right"]: "50%", borderRadius: pos ? "0 4px 4px 0" : "4px 0 0 4px" }} />
            </span>
            <b className="div-value num">{text}</b>
          </div>
        );
      })}
      <Tip tip={tip} />
    </div>
  );
}

/* ---------- meter ---------- */

export function Meter({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="meter-wide" role="img" aria-label={`${label}: ${Math.round(v)}%`}>
      <i style={{ width: `${v}%`, background: C1 }} />
    </div>
  );
}
