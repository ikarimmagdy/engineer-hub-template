import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PHASES, PHASE_TITLE, useHub, type Spec } from '../lib/data';
import { taskTotal } from '../lib/attention';
import { releaseRoute, releasesFor } from '../lib/releases';
import { cx, Dot, Empty, fmtDate, Meter, PageHeader, Pager, Pill, Segmented } from '../components/ui';
import { useWorkFilter, WorkFilterBar } from '../components/WorkFilter';
import { useLoopApi, useRuns } from '../lib/loop';

type View = 'board' | 'table';
type SortKey = 'key' | 'starter' | 'phase' | 'tasks' | 'criteria' | 'findings' | 'critical' | 'updated';

/** A per-browser choice; storage can be missing (private window), then the default holds. */
function useStored(key: string, fallback: string): [string, (v: string) => void] {
  const [v, setV] = useState(() => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } });
  return [v, (x: string) => { setV(x); try { localStorage.setItem(key, x); } catch { /* not remembered */ } }];
}

export function Work() {
  const { loop } = useHub();
  const [params, setParams] = useSearchParams();
  const view = (params.get('view') as View) || 'board';
  const sort = (params.get('sort') as SortKey) || 'phase';
  const set = (k: string, v: string) => setParams((p) => { if (v) p.set(k, v); else p.delete(k); return p; }, { replace: true });
  const filter = useWorkFilter(loop.specs);
  const { specs } = filter;
  const [hideEmpty, setHideEmpty] = useStored('hub.work.hideEmpty', '0');
  const [density, setDensity] = useStored('hub.work.density', 'detailed');

  return (
    <div>
      <PageHeader
        title="Work"
        lede="Every piece of work in the engineering workspace, by phase. Status comes from spec.py and nowhere else."
        actions={<Link to="/knowledge/how-we-work/start" className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-paper">Start a work item</Link>}
      />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Segmented label="View" value={view} onChange={(v) => set('view', v === 'board' ? '' : v)} options={[['board', 'Board'], ['table', 'Table']]} />
        {view === 'board' && <>
          <Segmented label="Cards" value={density as 'detailed' | 'compact'} onChange={setDensity} options={[['detailed', 'Detailed'], ['compact', 'Compact']]} />
          <label className="flex items-center gap-1.5 text-xs text-ink-2">
            <input type="checkbox" checked={hideEmpty === '1'} onChange={(e) => setHideEmpty(e.target.checked ? '1' : '0')} className="size-3.5 accent-current" />
            Hide empty columns
          </label>
        </>}
      </div>
      <div className="mb-4"><WorkFilterBar all={loop.specs} filter={filter} /></div>
      {specs.length === 0 ? (
        <Empty action={<button type="button" className="underline" onClick={filter.clear}>Clear filters</button>}>No work matches these filters.</Empty>
      ) : view === 'board' ? <Board specs={specs} hideEmpty={hideEmpty === '1'} compact={density === 'compact'} /> : <Table specs={specs} sort={sort} onSort={(s) => set('sort', s)} />}
    </div>
  );
}

/** One line per item: key, title, next step, and a dot for what needs attention. */
function CompactCard({ s, working }: { s: Spec; working: string[] }) {
  const gate = (['intent', 'spec', 'design'] as const).some((g) => g === s.phase && !s.approved?.[g]);
  const tone = working.length ? 'run' : (s.findings?.bySeverity.critical || 0) > 0 ? 'critical' : s.tasks.blocked > 0 ? 'block' : gate ? 'wait' : null;
  return (
    <Link to={`/work/${s.key}/overview`} title={[s.title, s.next && `Next: ${s.next}`, working.length && `${working.join(', ')} working`].filter(Boolean).join('\n')}
      className="flex items-start gap-2 rounded-md border border-line bg-paper px-2.5 py-1.5 hover:border-line-2">
      {tone ? <Dot tone={tone} className={cx('mt-1.5 shrink-0', working.length > 0 && 'animate-pulse')} /> : <span className="mt-1.5 size-2 shrink-0" />}
      <span className="min-w-0">
        <span className="font-mono text-[10.5px] text-ink-3">{s.key}</span>
        <span className="block text-[13px] font-medium leading-snug break-words">{s.title}</span>
      </span>
    </Link>
  );
}

/** The board card: the whole title, the next step, progress, findings, and the agent working on it now (local hub). */
function Card({ s, working }: { s: Spec; working: string[] }) {
  const hub = useHub();
  const rel = releasesFor(hub, s.key)[0];
  const crit = s.findings?.bySeverity.critical || 0;
  const gate = (['intent', 'spec', 'design'] as const).find((g) => g === s.phase && !s.approved?.[g]);
  const total = taskTotal(s);
  const next = s.next?.trim();
  return (
    <Link to={`/work/${s.key}/overview`} className="block rounded-lg border border-line bg-paper p-3 hover:border-line-2 hover:shadow-sm">
      <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-ink-3">{s.key}<ProposedTag s={s} /><span className="ml-auto font-sans">{fmtDate(s.updated)}</span></div>
      <div className="mt-1 text-sm font-medium leading-snug break-words">{s.title}</div>
      {s.started_by && <div className="mt-1 text-[11px] text-ink-3">started by <span className="text-ink-2">{s.started_by.name}</span></div>}
      {working.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-run"><Dot tone="run" className="animate-pulse" /><span className="min-w-0 break-words">{working.join(', ')} working</span></div>
      )}
      {next && (
        <div className="mt-2 rounded-md bg-sunk px-2 py-1.5 text-[11.5px] leading-snug">
          <span className="text-ink-3">Next: </span><span className={/^\//.test(next) ? 'font-mono text-ink' : 'text-ink-2'}>{next}</span>
        </div>
      )}
      {(total > 0 || s.criteria > 1) && (
        <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] tabular-nums text-ink-3">
          {total > 0 && <div><Meter value={s.tasks.done} total={total} /><dd className="mt-1">{s.tasks.done}/{total} tasks</dd></div>}
          {s.criteria > 1 && <div><Meter value={s.criteria_passing} total={s.criteria} /><dd className="mt-1">{s.criteria_passing}/{s.criteria} criteria</dd></div>}
        </dl>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-3">
        {s.repos.length > 0 && <span className="font-mono" title={s.repos.join(', ')}>{s.repos.slice(0, 2).join(', ')}{s.repos.length > 2 ? ` +${s.repos.length - 2}` : ''}</span>}
        {s.findings && s.findings.open > 0 && <span>{s.findings.open} open findings</span>}
        {rel && <span title={rel.title}>shipped in <span className="font-mono">{rel.id}</span></span>}
      </div>
      {(gate || s.tasks.blocked > 0 || crit > 0) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {gate && <Pill tone="wait">needs approval</Pill>}
          {s.tasks.blocked > 0 && <Pill tone="block">{s.tasks.blocked} blocked</Pill>}
          {crit > 0 && <Pill tone="critical">{crit} critical</Pill>}
        </div>
      )}
    </Link>
  );
}

const PER_COLUMN = 5;

function Board({ specs, hideEmpty, compact }: { specs: Spec[]; hideEmpty: boolean; compact: boolean }) {
  const api = useLoopApi();
  const runs = useRuns(!!api);
  const [more, setMore] = useState<Set<string>>(new Set());
  const [shut, setShut] = useState<Set<string>>(new Set());
  const flip = (set: Set<string>, k: string) => { const n = new Set(set); if (n.has(k)) n.delete(k); else n.add(k); return n; };
  const working = (key: string) => [...new Set(runs.filter((r) => r.key === key && r.state === 'running').map((r) => r.agent.replace(/^(team|command|module):/, '')))];
  const cols = PHASES.map((p, i) => ({ p, i, list: specs.filter((s) => s.phase === p) })).filter((c) => !hideEmpty || c.list.length);
  // all seven fit a laptop screen; a collapsed column keeps only its title, and the others share the width
  const tracks = cols.map((c) => (shut.has(c.p) ? '44px' : 'minmax(168px, 1fr)')).join(' ');
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
      <div className="grid gap-3" style={{ gridTemplateColumns: tracks, minWidth: cols.reduce((n, c) => n + (shut.has(c.p) ? 56 : 180), 0) }}>
        {cols.map(({ p, i, list }) => {
          const closed = shut.has(p);
          const shown = more.has(p) ? list : list.slice(0, PER_COLUMN);
          if (closed) return (
            <button key={p} type="button" onClick={() => setShut(flip(shut, p))} aria-label={`Show ${PHASE_TITLE[p]}`} title={`Show ${PHASE_TITLE[p]}`}
              className="flex min-h-40 flex-col items-center gap-2 rounded-md border border-line bg-sunk/50 py-2 text-xs text-ink-2 hover:border-line-2">
              <span className="tabular-nums text-ink-3">{list.length}</span>
              <span className="[writing-mode:vertical-rl]">{i + 1} {PHASE_TITLE[p]}</span>
            </button>
          );
          return (
            <section key={p} aria-label={PHASE_TITLE[p]} className="min-w-0">
              <h2 className="mb-2 flex items-center justify-between gap-2 border-b border-line pb-1.5 text-xs font-semibold text-ink-2">
                <span><span className="mr-1 tabular-nums text-ink-3">{i + 1}</span>{PHASE_TITLE[p]}</span>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums text-ink-3">{list.length}</span>
                  <button type="button" onClick={() => setShut(flip(shut, p))} aria-label={`Collapse ${PHASE_TITLE[p]}`} title="Collapse" className="text-ink-3 hover:text-ink">‹</button>
                </span>
              </h2>
              <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
                {list.length ? shown.map((s) => (compact ? <CompactCard key={s.key} s={s} working={working(s.key)} /> : <Card key={s.key} s={s} working={working(s.key)} />))
                  : <p className="py-2 text-xs text-ink-3">Nothing in {PHASE_TITLE[p].toLowerCase()}.</p>}
                {list.length > PER_COLUMN && (
                  <button type="button" onClick={() => setMore(flip(more, p))} className="w-full rounded-md border border-dashed border-line-2 py-1.5 text-xs text-ink-2 hover:border-ink">
                    {more.has(p) ? 'Show fewer' : `Show ${list.length - PER_COLUMN} more`}
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

const PAGE = 25;

const COLS: [SortKey, string, boolean][] = [
  ['key', 'Work', false], ['starter', 'Started by', false], ['phase', 'Phase', false], ['tasks', 'Tasks done', true], ['criteria', 'Criteria passing', true],
  ['findings', 'Open findings', true], ['critical', 'Critical', true], ['updated', 'Updated', true],
];

function Table({ specs, sort, onSort }: { specs: Spec[]; sort: SortKey; onSort: (s: SortKey) => void }) {
  const hub = useHub();
  const val = (s: Spec, k: SortKey): string | number => ({
    key: s.key, starter: s.started_by?.name || '', phase: PHASES.indexOf(s.phase), tasks: s.tasks.done / (taskTotal(s) || 1), criteria: s.criteria_passing / (s.criteria || 1),
    findings: s.findings?.open || 0, critical: s.findings?.bySeverity.critical || 0, updated: s.updated,
  })[k];
  const rows = [...specs].sort((a, b) => {
    const x = val(a, sort), y = val(b, sort);
    const c = typeof x === 'number' && typeof y === 'number' ? y - x : String(x).localeCompare(String(y));
    return sort === 'phase' ? -c : c;
  });
  const [page, setPage] = useState(0);
  const pages = Math.ceil(rows.length / PAGE);
  const at = Math.min(page, Math.max(0, pages - 1));
  return (
    <div className="space-y-3">
    <div className="max-h-[70vh] overflow-auto rounded-lg border border-line bg-paper">
      <table className="w-full min-w-[920px] text-sm">
        <thead className="sticky top-0 z-10 bg-sunk text-left text-xs text-ink-2">
          <tr>
            {COLS.map(([k, l, num]) => (
              <th key={k} scope="col" aria-sort={sort === k ? 'descending' : 'none'} className={num ? 'text-right' : ''}>
                <button type="button" onClick={() => onSort(k)} className={`w-full px-3 py-2 font-semibold ${num ? 'text-right' : 'text-left'} ${sort === k ? 'text-ink' : ''}`}>
                  {l}{sort === k ? ' ↓' : ''}
                </button>
              </th>
            ))}
            <th scope="col" className="px-3 py-2 text-left font-semibold">Last release</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.slice(at * PAGE, (at + 1) * PAGE).map((s) => (
            <tr key={s.key} className="hover:bg-sunk">
              <td className="px-3 py-2">
                <Link to={`/work/${s.key}/overview`} className="hover:underline">
                  <span className="mr-2 font-mono text-[11.5px] text-ink-3">{s.key}</span><span className="font-medium">{s.title}</span> <ProposedTag s={s} />
                </Link>
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-ink-2">{s.started_by?.name || '–'}</td>
              <td className="px-3 py-2"><Pill>{PHASE_TITLE[s.phase]}</Pill></td>
              <td className="px-3 py-2 text-right tabular-nums">{s.tasks.done}/{taskTotal(s)}{s.tasks.blocked ? <span className="ml-1.5 text-block">{s.tasks.blocked} blocked</span> : null}</td>
              <td className="px-3 py-2 text-right tabular-nums">{s.criteria_passing}/{s.criteria}</td>
              <td className="px-3 py-2 text-right tabular-nums">{s.findings?.open ?? '–'}</td>
              <td className={`px-3 py-2 text-right tabular-nums ${s.findings?.bySeverity.critical ? 'font-semibold text-sev-critical' : 'text-ink-3'}`}>{s.findings?.bySeverity.critical || 0}</td>
              <td className="px-3 py-2 text-right text-ink-3">{fmtDate(s.updated)}</td>
              <td className="px-3 py-2">{(() => { const r = releasesFor(hub, s.key)[0]; return r ? <Link to={releaseRoute(r.id)} className="font-mono text-[11.5px] underline" title={r.title}>{r.id}</Link> : <span className="text-ink-3">–</span>; })()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <Pager page={at} pages={pages} total={rows.length} size={PAGE} onPage={setPage} />
    </div>
  );
}

/** A work item that exists only on an open pull request: whose it is and where to review it. */
export function ProposedTag({ s }: { s: Spec }) {
  if (!s.proposed) return null;
  return <span className="rounded-full border border-sev-medium px-1.5 py-px font-sans text-[10.5px] text-sev-medium" title={`${s.proposed.title} (${s.proposed.branch})`}>proposed · PR #{s.proposed.pr} · {s.proposed.author}</span>;
}
