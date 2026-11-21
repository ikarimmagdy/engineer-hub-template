import { useState, type ReactNode } from 'react';
import { cx } from './ui';

/**
 * Small charts for the hub, by the dataviz rules: thin marks with a 2px surface gap and 4px rounded data ends,
 * recessive axes, a legend whenever there are two series, text in ink (never the series colour), a tooltip on every
 * mark, and a table view of the same numbers. Series colours are --series-1 and --series-2 (validated in both modes).
 */

const fmtWeek = (w: string) => new Date(w + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export function Legend({ items }: { items: [string, string][] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-2">
      {items.map(([label, color]) => (
        <span key={label} className="inline-flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-sm" style={{ background: `var(${color})` }} />{label}</span>
      ))}
    </div>
  );
}

/** A tooltip that follows the hovered mark. */
function useTip() {
  const [tip, setTip] = useState<{ x: number; y: number; body: ReactNode } | null>(null);
  const el = tip && (
    <div role="tooltip" className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-line-2 bg-paper px-2.5 py-1.5 text-xs text-ink shadow-md"
      style={{ left: tip.x, top: tip.y - 8 }}>{tip.body}</div>
  );
  return { el, show: (x: number, y: number, body: ReactNode) => setTip({ x, y, body }), hide: () => setTip(null) };
}

/** The same numbers as a table, closed by default. */
export function ChartTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-2 text-xs">
      <summary className="cursor-pointer text-ink-3 hover:text-ink">Show as a table</summary>
      <div className="mt-2 max-h-56 overflow-auto rounded-md border border-line">
        <table className="w-full tabular-nums">
          <thead className="sticky top-0 bg-sunk text-left text-ink-2"><tr>{head.map((h, i) => <th key={h} className={cx('px-2 py-1 font-semibold', i > 0 && 'text-right')}>{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={cx('px-2 py-1', j > 0 && 'text-right')}>{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </details>
  );
}

/** A one-series trend for a stat tile: 2px line, the last point marked, a value on hover. */
export function Sparkline({ values, labels, label }: { values: number[]; labels?: string[]; label: string }) {
  const w = 120, h = 32, max = Math.max(1, ...values);
  const x = (i: number) => (values.length < 2 ? w / 2 : (i / (values.length - 1)) * (w - 8) + 4);
  const y = (v: number) => h - 4 - (v / max) * (h - 8);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-[120px]" role="img" aria-label={`${label}: ${values.join(', ')}`}>
      <path d={d} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" style={{ stroke: 'var(--series-1)' }} />
      {values.length > 0 && <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={4} strokeWidth={2} style={{ fill: 'var(--series-1)', stroke: 'var(--paper)' }} />}
      {values.map((v, i) => <rect key={i} x={x(i) - w / values.length / 2} y={0} width={w / values.length} height={h} fill="transparent"><title>{`${labels?.[i] ? fmtWeek(labels[i]) + ': ' : ''}${v}`}</title></rect>)}
    </svg>
  );
}

/** Weekly columns of two stacked series (for example AI-assisted on top of the rest). */
export function WeeklyStacked({ rows, a, b, unit }: { rows: { week: string; a: number; b: number }[]; a: string; b: string; unit: string }) {
  const tip = useTip();
  const W = 640, H = 200, padL = 28, padB = 22, padT = 14, max = Math.max(1, ...rows.map((r) => r.a + r.b));
  const step = (W - padL) / Math.max(1, rows.length), bw = Math.max(6, Math.min(28, step - 8));
  const y = (v: number) => padT + (H - padB - padT) * (1 - v / max);
  const ticks = [0, Math.round(max / 2), max];
  return (
    <div>
      <Legend items={[[a, '--series-1'], [b, '--series-2']]} />
      <div className="relative mt-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={`${a} and ${b} per week`}>
          {ticks.map((t) => <g key={t}><line x1={padL} x2={W} y1={y(t)} y2={y(t)} className="stroke-line" strokeWidth={1} /><text x={padL - 6} y={y(t) + 4} textAnchor="end" className="fill-ink-3 text-[10px]">{t}</text></g>)}
          {rows.map((r, i) => {
            const cx0 = padL + step * i + (step - bw) / 2;
            const hb = (H - padB) - y(r.b), ha = (H - padB) - y(r.a);
            // b at the base, a above it, a 2px surface gap between them; rounded ends only at the top of the stack
            return (
              <g key={r.week} onMouseMove={(e) => { const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect(); tip.show(((cx0 + bw / 2) / W) * box.width, (y(r.a + r.b) / H) * box.height, <><div className="font-semibold">{fmtWeek(r.week)}</div><div>{a}: {r.a}</div><div>{b}: {r.b}</div><div className="text-ink-3">{r.a + r.b} {unit}</div></>); }} onMouseLeave={tip.hide}>
                <rect x={cx0 - 3} y={0} width={bw + 6} height={H - padB} fill="transparent" />
                {r.b > 0 && <rect x={cx0} y={H - padB - hb} width={bw} height={hb} rx={r.a ? 0 : 4} style={{ fill: 'var(--series-2)' }} />}
                {r.a > 0 && <rect x={cx0} y={H - padB - hb - ha - (r.b ? 2 : 0)} width={bw} height={Math.max(0, ha)} rx={4} style={{ fill: 'var(--series-1)' }} />}
                {(i % 2 === 0 || rows.length < 8) && <text x={cx0 + bw / 2} y={H - 6} textAnchor="middle" className="fill-ink-3 text-[10px]">{fmtWeek(r.week)}</text>}
              </g>
            );
          })}
        </svg>
        {tip.el}
      </div>
      <ChartTable head={['Week', a, b, 'Total']} rows={rows.map((r) => [fmtWeek(r.week), r.a, r.b, r.a + r.b])} />
    </div>
  );
}

/** Horizontal bars, one row per thing, of one series or two stacked. Values are written at the end of each bar. */
export function HBars({ rows, a, b, unit, max: maxIn }: { rows: { label: ReactNode; key: string; a: number; b?: number; note?: string }[]; a: string; b?: string; unit: string; max?: number }) {
  const tip = useTip();
  const max = maxIn || Math.max(1, ...rows.map((r) => r.a + (r.b || 0)));
  return (
    <div className="relative">
      {b && <div className="mb-2"><Legend items={[[a, '--series-1'], [b, '--series-2']]} /></div>}
      <ul className="space-y-2">
        {rows.map((r) => {
          const total = r.a + (r.b || 0);
          return (
            <li key={r.key} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3 text-xs"
              onMouseMove={(e) => { const box = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect(); tip.show(e.clientX - box.left, e.currentTarget.offsetTop, <><div className="font-semibold">{r.key}</div><div>{a}: {r.a}</div>{b && <div>{b}: {r.b || 0}</div>}{r.note && <div className="text-ink-3">{r.note}</div>}</>); }}
              onMouseLeave={tip.hide}>
              <span className="truncate text-ink-2" title={r.key}>{r.label}</span>
              <span className="flex h-2.5 items-center gap-[2px]" style={{ width: `${Math.max(2, (total / max) * 100)}%` }}>
                {r.a > 0 && <span className="h-full rounded-l-[4px] last:rounded-r-[4px]" style={{ width: `${(r.a / total) * 100}%`, background: 'var(--series-1)' }} />}
                {(r.b || 0) > 0 && <span className="h-full rounded-r-[4px] first:rounded-l-[4px]" style={{ width: `${((r.b || 0) / total) * 100}%`, background: 'var(--series-2)' }} />}
              </span>
              <span className="tabular-nums text-ink-2">{total}{r.note ? <span className="ml-1 text-ink-3">{r.note}</span> : null}</span>
            </li>
          );
        })}
      </ul>
      {tip.el}
      <ChartTable head={b ? ['', a, b, `Total ${unit}`] : ['', `${a}`]} rows={rows.map((r) => (b ? [r.key, r.a, r.b || 0, r.a + (r.b || 0)] : [r.key, r.a]))} />
    </div>
  );
}
