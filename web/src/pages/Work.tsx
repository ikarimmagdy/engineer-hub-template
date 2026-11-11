import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PHASES, PHASE_TITLE, useHub, type Spec } from '../lib/data';
import { taskTotal } from '../lib/attention';
import { releaseRoute, releasesFor } from '../lib/releases';
import { Empty, fmtDate, Meter, PageHeader, Pill, Segmented, Select } from '../components/ui';

type View = 'board' | 'table';
type SortKey = 'key' | 'starter' | 'phase' | 'tasks' | 'criteria' | 'findings' | 'critical' | 'updated';

export function Work() {
  const { loop } = useHub();
  const [params, setParams] = useSearchParams();
  const view = (params.get('view') as View) || 'board';
  const repo = params.get('repo') || '';
  const flag = params.get('flag') || '';
  const q = (params.get('q') || '').toLowerCase();
  const sort = (params.get('sort') as SortKey) || 'phase';
  const set = (k: string, v: string) => setParams((p) => { if (v) p.set(k, v); else p.delete(k); return p; }, { replace: true });

  const repos = useMemo(() => [...new Set(loop.specs.flatMap((s) => s.repos))].sort(), [loop]);
  const specs = loop.specs.filter((s) =>
    (!repo || s.repos.includes(repo)) &&
    (!flag || (flag === 'blocked' ? s.tasks.blocked > 0 : flag === 'critical' ? (s.findings?.bySeverity.critical || 0) > 0 : true)) &&
    (!q || `${s.key} ${s.title}`.toLowerCase().includes(q)),
  );

  return (
    <div>
      <PageHeader
        title="Work"
        lede="Every piece of work in the engineering workspace, by phase. Status comes from spec.py and nowhere else."
        actions={<Link to="/knowledge/how-we-work/start" className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-paper">Start a work item</Link>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented label="View" value={view} onChange={(v) => set('view', v === 'board' ? '' : v)} options={[['board', 'Board'], ['table', 'Table']]} />
        <input
          type="search"
          value={params.get('q') || ''}
          onChange={(e) => set('q', e.target.value)}
          placeholder="Filter by key or title"
          aria-label="Filter by key or title"
          className="h-8 w-52 rounded-md border border-line-2 bg-paper px-2.5 text-sm"
        />
        <Select label="Repo" value={repo} onChange={(v) => set('repo', v)} options={[['', 'Any'], ...repos.map((r) => [r, r] as [string, string])]} />
        <Select label="Show" value={flag} onChange={(v) => set('flag', v)} options={[['', 'All work'], ['blocked', 'Has blocked tasks'], ['critical', 'Has critical findings']]} />
        <span className="text-xs text-ink-3">{specs.length} of {loop.specs.length}</span>
      </div>
      {specs.length === 0 ? (
        <Empty action={<button type="button" className="underline" onClick={() => setParams({}, { replace: true })}>Clear filters</button>}>No work matches these filters.</Empty>
      ) : view === 'board' ? <Board specs={specs} /> : <Table specs={specs} sort={sort} onSort={(s) => set('sort', s)} />}
    </div>
  );
}

function Card({ s }: { s: Spec }) {
  const hub = useHub();
  const rel = releasesFor(hub, s.key)[0];
  const crit = s.findings?.bySeverity.critical || 0;
  const gate = (['intent', 'spec', 'design'] as const).find((g) => g === s.phase && !s.approved?.[g]);
  return (
    <Link to={`/work/${s.key}/overview`} className="block rounded-lg border border-line bg-paper p-3 hover:border-line-2">
      <div className="flex items-center gap-2 font-mono text-[11px] text-ink-3">{s.key}<ProposedTag s={s} /></div>
      <div className="mt-0.5 line-clamp-2 text-sm font-medium">{s.title}</div>
      {s.criteria > 1 && (
        <div className="mt-2.5">
          <Meter value={s.criteria_passing} total={s.criteria} />
          <div className="mt-1 text-[11px] tabular-nums text-ink-3">{s.criteria_passing}/{s.criteria} criteria</div>
        </div>
      )}
      {rel && <div className="mt-2 truncate text-[11px] text-ink-3" title={rel.title}>Shipped in <span className="font-mono">{rel.id}</span></div>}
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

function Board({ specs }: { specs: Spec[] }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
      <div className="grid min-w-[980px] grid-cols-7 gap-3">
        {PHASES.map((p, i) => {
          const list = specs.filter((s) => s.phase === p);
          return (
            <section key={p} aria-label={PHASE_TITLE[p]} className="min-w-0">
              <h2 className="mb-2 flex items-center justify-between border-b border-line pb-1.5 text-xs font-semibold text-ink-2">
                <span><span className="mr-1 tabular-nums text-ink-3">{i + 1}</span>{PHASE_TITLE[p]}</span>
                <span className="tabular-nums text-ink-3">{list.length}</span>
              </h2>
              <div className="space-y-2">
                {list.length ? list.map((s) => <Card key={s.key} s={s} />) : <p className="py-2 text-xs text-ink-3">Nothing in {PHASE_TITLE[p].toLowerCase()}.</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

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
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-paper">
      <table className="w-full min-w-[920px] text-sm">
        <thead className="bg-sunk text-left text-xs text-ink-2">
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
          {rows.map((s) => (
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
  );
}

/** A work item that exists only on an open pull request: whose it is and where to review it. */
export function ProposedTag({ s }: { s: Spec }) {
  if (!s.proposed) return null;
  return <span className="rounded-full border border-sev-medium px-1.5 py-px font-sans text-[10.5px] text-sev-medium" title={`${s.proposed.title} (${s.proposed.branch})`}>proposed · PR #{s.proposed.pr} · {s.proposed.author}</span>;
}
