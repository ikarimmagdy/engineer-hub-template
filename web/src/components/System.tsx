import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  CHANGE_COLOR, CHANGE_LABEL, CHANGE_TONE, changeOf, INFRA_KIND, keysOf, whereText,
  type ChangeRec, type Component, type Flow, type Infra, type Screen, type SystemModel, type UseCase,
} from '../lib/system';
import { cx, Dot, Empty, fmtDate, Pill } from './ui';

const CAP = 8;
const W = 1200, LABEL = 168, BW = 160, BH = 50, GX = 12, GY = 12, PAD = 16;
const PER_ROW = Math.floor((W - LABEL - PAD + GX) / (BW + GX));

export const nameOf = (sys: SystemModel, id: string) => sys.components.find((c) => c.id === id)?.name || id;

interface Box { c: Component; x: number; y: number }

/** Layers as lanes, components as boxes, flows as arrows. With a work item in focus, what it touches is coloured by change. */
export function SystemMap({ sys, focus, only, selected, onSelect, edges = 'auto' }: {
  sys: SystemModel; focus?: string; only?: Set<string>; selected?: string | null; onSelect?: (id: string | null) => void; edges?: 'auto' | 'all';
}) {
  const [hover, setHover] = useState<string | null>(null);
  const { boxes, lanes, height } = useMemo(() => {
    const boxes = new Map<string, Box>();
    const lanes: { id: string; name: string; y: number; h: number; n: number }[] = [];
    let y = 0;
    for (const l of sys.layers) {
      const cs = sys.components.filter((c) => c.layer === l.id && (!only || only.has(c.id)));
      if (!cs.length) continue;
      const rows = Math.ceil(cs.length / PER_ROW);
      const h = rows * (BH + GY) - GY + PAD * 2;
      cs.forEach((c, i) => boxes.set(c.id, { c, x: LABEL + (i % PER_ROW) * (BW + GX), y: y + PAD + Math.floor(i / PER_ROW) * (BH + GY) }));
      lanes.push({ id: l.id, name: l.name, y, h, n: cs.length });
      y += h + 6;
    }
    return { boxes, lanes, height: Math.max(y - 6, 60) };
  }, [sys, only]);

  const active = hover || selected;
  const shown = sys.flows.filter((f) => boxes.has(f.from) && boxes.has(f.to) && f.from !== f.to && (
    focus ? f.changes.some((c) => c.key === focus) : active ? f.from === active || f.to === active : edges === 'all'
  ));
  if (!boxes.size) return <Empty>Nothing to draw yet.</Empty>;

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-paper" data-scroll>
      <svg viewBox={`0 0 ${W} ${height}`} className="mx-auto block max-h-[calc(100dvh-220px)] w-full min-w-[900px]" role="img" aria-label="System map: layers, components and the flows between them">
        <defs>
          {(['added', 'changed', 'removed', 'used'] as const).map((k) => (
            <marker key={k} id={`arrow-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={CHANGE_COLOR[k]} />
            </marker>
          ))}
        </defs>
        {lanes.map((l, i) => (
          <g key={l.id}>
            <rect x={0} y={l.y} width={W} height={l.h} fill={i % 2 ? 'var(--paper)' : 'var(--sunk)'} />
            <text x={14} y={l.y + PAD + 16} fontSize={13} fontWeight={600} fill="var(--ink)">{l.name}</text>
            <text x={14} y={l.y + PAD + 33} fontSize={11.5} fill="var(--ink-3)">{l.n} {l.n === 1 ? 'component' : 'components'}</text>
          </g>
        ))}
        {shown.map((f) => <Edge key={f.id} f={f} a={boxes.get(f.from)!} b={boxes.get(f.to)!} focus={focus} sys={sys} />)}
        {[...boxes.values()].map(({ c, x, y }) => {
          const ch = focus ? changeOf(c, focus) : null;
          const dim = (focus && !ch) || (!focus && active && active !== c.id && !shown.some((f) => f.from === c.id || f.to === c.id));
          const stories = keysOf(c).length;
          const sel = selected === c.id;
          return (
            <g key={c.id} transform={`translate(${x},${y})`} role="button" tabIndex={0} aria-label={`${c.name}${ch ? `, ${CHANGE_LABEL[ch]}` : ''}`}
              onClick={() => onSelect?.(sel ? null : c.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(sel ? null : c.id); } }}
              onMouseEnter={() => setHover(c.id)} onMouseLeave={() => setHover(null)}
              opacity={dim ? 0.32 : 1} className="cursor-pointer outline-none">
              <title>{`${c.name} (${c.kind})${stories ? ` · changed by ${keysOf(c).join(', ')}` : ''}`}</title>
              <rect width={BW} height={BH} rx={7} fill="var(--paper)" stroke={sel ? 'var(--ink)' : ch ? CHANGE_COLOR[ch] : 'var(--line-2)'} strokeWidth={sel || ch ? 2 : 1} />
              {ch && <rect width={5} height={BH} rx={2} fill={CHANGE_COLOR[ch]} />}
              <text x={12} y={21} fontSize={12.5} fontWeight={500} fill="var(--ink)">{clip(c.name, 21)}</text>
              <text x={12} y={38} fontSize={10.5} fill="var(--ink-3)">{ch ? CHANGE_LABEL[ch] : c.kind}{c.baseline ? '' : ' · new'}</text>
              {!focus && stories > 0 && (
                <g transform={`translate(${BW - 14},${BH - 14})`}>
                  <circle r={8} fill="var(--ink)" />
                  <text textAnchor="middle" y={3.6} fontSize={10} fontWeight={600} fill="var(--paper)">{stories}</text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Edge({ f, a, b, focus, sys }: { f: Flow; a: Box; b: Box; focus?: string; sys: SystemModel }) {
  const ch = (focus ? changeOf(f, focus) : changeOf(f)) || 'used';
  let d: string;
  if (Math.abs(a.y - b.y) < 2) {
    const [l, r] = a.x < b.x ? [a, b] : [b, a];
    const x1 = l.x + BW * 0.7, x2 = r.x + BW * 0.3, lift = Math.min(40, 14 + (x2 - x1) / 12);
    d = a.x < b.x ? `M${x1},${a.y} C${x1},${a.y - lift} ${x2},${b.y - lift} ${x2},${b.y}` : `M${x2},${a.y} C${x2},${a.y - lift} ${x1},${b.y - lift} ${x1},${b.y}`;
  } else {
    const down = b.y > a.y;
    const x1 = a.x + BW / 2, x2 = b.x + BW / 2;
    const y1 = down ? a.y + BH : a.y, y2 = down ? b.y : b.y + BH;
    const k = Math.max(24, Math.abs(y2 - y1) / 2.4) * (down ? 1 : -1);
    d = `M${x1},${y1} C${x1},${y1 + k} ${x2},${y2 - k} ${x2},${y2}`;
  }
  return (
    <path d={d} fill="none" stroke={CHANGE_COLOR[ch]} strokeWidth={ch === 'used' ? 1.3 : 2} strokeDasharray={ch === 'used' ? '4 3' : undefined} markerEnd={`url(#arrow-${ch})`} opacity={0.9}>
      <title>{`${nameOf(sys, f.from)} → ${nameOf(sys, f.to)}: ${[f.protocol, f.interface].filter(Boolean).join(' ')}`}</title>
    </path>
  );
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3">
      {(['added', 'changed', 'removed', 'used'] as const).map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5"><span className="inline-block h-0.5 w-5" style={{ background: CHANGE_COLOR[k] }} />{CHANGE_LABEL[k]}</span>
      ))}
      <span>Click a component for what it talks to and every change to it.</span>
    </div>
  );
}

/** One chip per work item that changed an element, coloured by its strongest change. */
export function ChangedBy({ el, current }: { el: { changes: ChangeRec[] }; current?: string }) {
  const keys = keysOf(el);
  if (!keys.length) return <span className="text-xs text-ink-3">Before the loop</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {keys.map((k) => {
        const ch = changeOf(el, k)!;
        return (
          <Link key={k} to={`/work/${k}/impact`} title={`${CHANGE_LABEL[ch]} by ${k}`}
            className={cx('inline-flex items-center gap-1 rounded-full border px-1.5 py-px font-mono text-[11px]', k === current ? 'border-ink text-ink' : 'border-line-2 text-ink-2 hover:border-ink')}>
            <Dot tone={CHANGE_TONE[ch]} />{k}
          </Link>
        );
      })}
    </span>
  );
}

export function ChangePill({ change }: { change: ChangeRec['change'] | null }) {
  return change ? <Pill tone={CHANGE_TONE[change]}>{CHANGE_LABEL[change]}</Pill> : null;
}

function WhereList({ where }: { where?: ChangeRec['where'] }) {
  if (!where?.length) return null;
  return (
    <ul className="mt-1 space-y-0.5">
      {where.map((w, i) => <li key={i} className="break-all font-mono text-[11px] text-ink-3">{whereText(w)}</li>)}
    </ul>
  );
}

export function FlowTable({ sys, flows, focus }: { sys: SystemModel; flows: Flow[]; focus?: string }) {
  if (!flows.length) return <Empty>No flows recorded.</Empty>;
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-paper">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-sunk text-left text-xs text-ink-3">
          <tr><th className="px-3 py-2 font-medium">From</th><th className="px-3 py-2 font-medium">To</th><th className="px-3 py-2 font-medium">Protocol</th><th className="px-3 py-2 font-medium">Interface</th><th className="px-3 py-2 font-medium">{focus ? 'Change' : 'Changed by'}</th></tr>
        </thead>
        <tbody className="divide-y divide-line">
          {flows.map((f) => {
            const rec = focus ? f.changes.find((c) => c.key === focus) : undefined;
            return (
              <tr key={f.id} className="align-top">
                <td className="px-3 py-2">{nameOf(sys, f.from)}</td>
                <td className="px-3 py-2">{nameOf(sys, f.to)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-ink-2">{f.protocol}</td>
                <td className="px-3 py-2">
                  <span className="break-all font-mono text-[12px]">{f.interface || '–'}</span>
                  {rec?.summary && <div className="mt-0.5 text-xs text-ink-3">{rec.summary}</div>}
                  {!!rec?.reqs?.length && <div className="mt-0.5 font-mono text-[11px] text-ink-3">{rec.reqs.join(' ')}</div>}
                </td>
                <td className="px-3 py-2">{focus ? <ChangePill change={changeOf(f, focus)} /> : <ChangedBy el={f} />}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function InfraList({ sys, items, focus }: { sys: SystemModel; items: Infra[]; focus?: string }) {
  if (!items.length) return <Empty>No infrastructure recorded.</Empty>;
  const kinds = [...new Set(items.map((x) => x.kind))];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {kinds.map((k) => (
        <section key={k} className="min-w-0 rounded-lg border border-line bg-paper">
          <header className="flex items-baseline justify-between border-b border-line px-4 py-2.5">
            <h3 className="text-sm font-semibold">{INFRA_KIND[k] || k}</h3><span className="text-xs tabular-nums text-ink-3">{items.filter((x) => x.kind === k).length}</span>
          </header>
          <ul className="divide-y divide-line">
            {items.filter((x) => x.kind === k).map((x) => {
              const rec = focus ? x.changes.find((c) => c.key === focus) : undefined;
              return (
                <li key={x.id} className="px-4 py-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="min-w-0 break-all font-mono text-[12.5px]">{x.name}</span>
                    {focus ? <ChangePill change={changeOf(x, focus)} /> : <ChangedBy el={x} />}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-3">{nameOf(sys, x.component)}{x.env.length ? ` · ${x.env.join(', ')}` : ''}</div>
                  {rec?.summary && <div className="mt-0.5 text-xs text-ink-2">{rec.summary}</div>}
                  <WhereList where={rec?.where} />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function ScreenGrid({ sys, screens, focus }: { sys: SystemModel; screens: Screen[]; focus?: string }) {
  const [zoom, setZoom] = useState<Screen | null>(null);
  if (!screens.length) return <Empty>No screens recorded.</Empty>;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {screens.map((s) => {
          const rec = focus ? s.changes.find((c) => c.key === focus) : s.changes[s.changes.length - 1];
          return (
            <figure key={s.id} className="min-w-0 overflow-hidden rounded-lg border border-line bg-paper">
              {s.image
                ? <button type="button" onClick={() => setZoom(s)} className="block w-full bg-sunk"><img src={s.image} alt={s.name} loading="lazy" className="mx-auto h-56 object-contain" /></button>
                : <div className="grid h-24 place-items-center bg-sunk text-xs text-ink-3">No capture</div>}
              <figcaption className="space-y-1 px-3 py-2">
                <div className="text-sm font-medium leading-snug">{s.name}</div>
                <div className="text-[11px] text-ink-3">{nameOf(sys, s.app)}{s.platforms.length ? ` · ${s.platforms.join(', ')}` : ''}</div>
                {focus ? <ChangePill change={changeOf(s, focus)} /> : <ChangedBy el={s} />}
                {rec?.summary && <p className="text-xs text-ink-2">{rec.summary}</p>}
              </figcaption>
            </figure>
          );
        })}
      </div>
      {zoom?.image && (
        <dialog open className="fixed inset-0 z-50 m-0 grid size-full max-h-none max-w-none place-items-center bg-black/70 p-4" onClick={() => setZoom(null)}>
          <img src={zoom.image} alt={zoom.name} className="max-h-[90dvh] max-w-full rounded" />
        </dialog>
      )}
    </>
  );
}

export function UseCaseList({ sys, items, showKey }: { sys: SystemModel; items: UseCase[]; showKey?: boolean }) {
  if (!items.length) return <Empty>No use cases recorded.</Empty>;
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-paper">
      {items.map((u) => (
        <li key={u.id} className="grid gap-x-4 gap-y-1 px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {showKey && <Link to={`/work/${u.key}/impact`} className="font-mono text-[11.5px] text-ink-3 hover:text-ink">{u.key}</Link>}
              <span className="font-medium">{u.name}</span><ChangePill change={u.change} />
            </div>
            {u.summary && <p className="mt-0.5 text-sm text-ink-2">{u.summary}</p>}
          </div>
          <div className="text-xs text-ink-3">
            {u.actor && <div><span className="text-ink-2">Actor:</span> {u.actor}</div>}
            {!!u.components?.length && <div><span className="text-ink-2">Through:</span> {u.components.map((c) => nameOf(sys, c)).join(' → ')}</div>}
            {!!u.reqs?.length && <div className="font-mono">{u.reqs.join(' ')}</div>}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** What one component talks to, its infrastructure and screens, and every change made to it by work item. */
export function ComponentDetail({ sys, id, onClose, focus }: { sys: SystemModel; id: string; onClose: () => void; focus?: string }) {
  const [all, setAll] = useState(false);
  const c = sys.components.find((x) => x.id === id);
  if (!c) return null;
  // with a work item in focus, its part first; long lists stop at CAP until "Show all"
  const first = <T extends { changes: ChangeRec[] }>(xs: T[]) => (focus ? [...xs].sort((a, b) => +b.changes.some((x) => x.key === focus) - +a.changes.some((x) => x.key === focus)) : xs);
  const cap = <T,>(xs: T[]) => (all ? xs : xs.slice(0, CAP));
  const flows = first([...sys.flows.filter((f) => f.from === id), ...sys.flows.filter((f) => f.to === id)]);
  const infra = first(sys.infra.filter((x) => x.component === id));
  const screens = sys.screens.filter((s) => s.app === id);
  const layer = sys.layers.find((l) => l.id === c.layer)?.name || c.layer;
  const row = (f: Flow, other: string, dir: string) => (
    <li key={f.id + dir} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
      <span className="min-w-0"><span className="text-ink-3">{dir}</span> {nameOf(sys, other)} <span className="break-all font-mono text-[11px] text-ink-3">{[f.protocol, f.interface].filter(Boolean).join(' ')}</span></span>
      <ChangedBy el={f} current={focus} />
    </li>
  );
  return (
    <aside className="min-w-0 rounded-lg border border-ink bg-paper" aria-label={`${c.name} details`}>
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h3 className="font-semibold">{c.name}</h3>
          <div className="text-xs text-ink-3">{layer} · {c.kind}{c.repo ? ` · repo ${c.repo}` : ''}{c.baseline ? '' : ' · added by the loop'}</div>
          {c.stack && <div className="mt-0.5 text-xs text-ink-3">{c.stack}</div>}
        </div>
        <button type="button" onClick={onClose} className="rounded border border-line-2 px-2 py-0.5 text-xs text-ink-2 hover:text-ink">Close</button>
      </header>
      <div className="space-y-4 px-4 py-3 text-sm">
        {c.summary && <p className="text-ink-2">{c.summary}</p>}
        <Block title={`Talks to (${flows.length})`}>
          {flows.length ? <ul className="divide-y divide-line">{cap(flows).map((f) => (f.from === id ? row(f, f.to, '→') : row(f, f.from, '←')))}</ul> : <p className="text-ink-3">No flows recorded.</p>}
        </Block>
        {infra.length > 0 && (
          <Block title={`Infrastructure (${infra.length})`}>
            <ul className="space-y-1">{cap(infra).map((x) => <li key={x.id} className="flex flex-wrap items-baseline justify-between gap-2"><span className="min-w-0 break-all"><span className="text-xs text-ink-3">{x.kind}</span> <span className="font-mono text-[12px]">{x.name}</span></span><ChangedBy el={x} current={focus} /></li>)}</ul>
          </Block>
        )}
        {screens.length > 0 && <Block title={`Screens (${screens.length})`}><p className="text-ink-2">{screens.map((s) => s.name).join(' · ')}</p></Block>}
        <Block title={`History (${c.changes.length})`}>
          {c.changes.length ? (
            <ol className="space-y-2.5">
              {cap([...c.changes].reverse()).map((ch, i) => (
                <li key={i} className="border-l-2 pl-3" style={{ borderColor: CHANGE_COLOR[ch.change] }}>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Link to={`/work/${ch.key}/impact`} className="font-mono font-medium hover:underline">{ch.key}</Link>
                    <span className="text-ink-3">{CHANGE_LABEL[ch.change]} · {fmtDate(ch.date)}</span>
                  </div>
                  {ch.summary && <p className="mt-0.5 text-ink-2">{ch.summary}</p>}
                  <WhereList where={all ? ch.where : ch.where?.slice(0, 3)} />
                  {!all && (ch.where?.length || 0) > 3 && <div className="text-[11px] text-ink-3">+{ch.where!.length - 3} more files</div>}
                </li>
              ))}
            </ol>
          ) : <p className="text-ink-3">No work item has changed it yet.</p>}
        </Block>
        {Math.max(flows.length, infra.length, c.changes.length) > CAP && (
          <button type="button" onClick={() => setAll(!all)} className="text-xs text-ink-2 underline decoration-line-2 underline-offset-4 hover:decoration-ink">{all ? 'Show less' : 'Show all'}</button>
        )}
      </div>
    </aside>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return <section><h4 className="mb-1 text-xs font-semibold text-ink-3">{title}</h4>{children}</section>;
}
