import { useMemo } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';
import { PHASE_TITLE, useHub, type Phase, type Spec } from '../lib/data';
import { forWork, keysOf, type SystemModel } from '../lib/system';
import { ChangedBy, ComponentDetail, FlowTable, InfraList, Legend, ScreenGrid, SystemMap, UseCaseList } from '../components/System';
import { cx, Empty, fmtDate, PageHeader, Pill, Select, TabBar } from '../components/ui';

const LENSES = [
  ['map', 'Map'],
  ['matrix', 'Communication matrix'],
  ['infra', 'Infrastructure'],
  ['screens', 'Screens'],
  ['use-cases', 'Use cases'],
  ['timeline', 'How it grew'],
] as const;

const NO_MODEL = (
  <Empty>
    No system model yet. Each work item records what it changes in <code className="font-mono text-[12px]">outputs/impact.json</code>;
    run the hub's sync to merge them (<code className="font-mono text-[12px]">tools/impact.py json</code> in the workspace).
  </Empty>
);

/** The whole system as the loop has built it up: the big picture first, then any component, flow or screen and the work that changed it. */
export function SystemPage() {
  const { system: sys } = useHub();
  const { lens = 'map' } = useParams();
  const [params, setParams] = useSearchParams();
  const work = params.get('work') || '';
  const layer = params.get('layer') || '';
  const sel = params.get('c');
  const set = (k: string, v: string | null) => setParams((p) => { if (v) p.set(k, v); else p.delete(k); return p; }, { replace: true });

  if (!sys) return <div><PageHeader title="System" />{NO_MODEL}</div>;
  if (!LENSES.some(([l]) => l === lens)) return <Navigate to="/system" replace />;

  const counts: Record<string, number> = {
    map: sys.components.length, matrix: sys.flows.length, infra: sys.infra.length, screens: sys.screens.length,
    'use-cases': sys.useCases.length, timeline: sys.works.length,
  };
  const qs = params.toString() ? `?${params}` : '';
  const pick = <T extends { changes: { key: string }[] }>(xs: T[]) => (work ? xs.filter((x) => x.changes.some((c) => c.key === work)) : xs);
  const changed = sys.components.filter((c) => c.changes.some((x) => x.change !== 'used')).length;

  return (
    <div>
      <PageHeader
        crumb={<Link to="/knowledge" className="hover:underline">Knowledge</Link>}
        title="System"
        lede={`What the system is made of and how it talks, built up by every work item: ${sys.components.length} components in ${sys.layers.length} layers, ${sys.flows.length} flows, ${changed} components changed by ${sys.works.length} work items so far.`}
      />
      <TabBar label="System views" tabs={LENSES.map(([l, t]) => ({ to: `/system${l === 'map' ? '' : `/${l}`}${qs}`, label: t, count: counts[l], end: true }))} />
      <div className="mb-4 mt-4 flex flex-wrap items-center gap-3">
        <Select label="Work item" value={work} onChange={(v) => set('work', v || null)}
          options={[['', 'All work'], ...sys.works.map((w) => [w.key, `${w.key} ${w.title}`] as [string, string])]} />
        {lens === 'map' && (
          <Select label="Layer" value={layer} onChange={(v) => set('layer', v || null)}
            options={[['', 'All layers'], ...sys.layers.map((l) => [l.id, l.name] as [string, string])]} />
        )}
        {work && <Link to={`/work/${work}/impact`} className="text-xs underline decoration-line-2 underline-offset-4 hover:decoration-ink">Open {work} impact</Link>}
      </div>

      {lens === 'map' && <MapLens sys={sys} work={work} layer={layer} sel={sel} onSelect={(id) => set('c', id)} />}
      {lens === 'matrix' && <MatrixLens sys={sys} work={work} />}
      {lens === 'infra' && <InfraList sys={sys} items={pick(sys.infra)} focus={work || undefined} />}
      {lens === 'screens' && <ScreenGrid sys={sys} screens={pick(sys.screens)} focus={work || undefined} />}
      {lens === 'use-cases' && <UseCaseList sys={sys} items={work ? sys.useCases.filter((u) => u.key === work) : sys.useCases} showKey />}
      {lens === 'timeline' && <Timeline sys={sys} />}
    </div>
  );
}

function MapLens({ sys, work, layer, sel, onSelect }: { sys: SystemModel; work: string; layer: string; sel: string | null; onSelect: (id: string | null) => void }) {
  const only = useMemo(() => {
    if (!layer) return undefined;
    const ids = new Set(sys.components.filter((c) => c.layer === layer).map((c) => c.id));
    // a layer shows with everything it talks to
    for (const f of sys.flows) {
      if (ids.has(f.from)) ids.add(f.to);
      else if (ids.has(f.to)) ids.add(f.from);
    }
    return ids;
  }, [sys, layer]);
  return (
    <div className={cx('grid grid-cols-[minmax(0,1fr)] gap-4', sel && 'xl:grid-cols-[minmax(0,1fr)_380px]')}>
      <div className="min-w-0 space-y-2">
        <Legend />
        <SystemMap sys={sys} focus={work || undefined} only={only} selected={sel} onSelect={onSelect} edges={layer ? 'all' : 'auto'} />
        <p className="text-xs text-ink-3">The number on a box is how many work items changed it. Pick a work item to colour what it touched and draw its flows.</p>
      </div>
      {sel && <div className="min-w-0 xl:sticky xl:top-20 xl:self-start"><ComponentDetail sys={sys} id={sel} onClose={() => onSelect(null)} focus={work || undefined} /></div>}
    </div>
  );
}

function MatrixLens({ sys, work }: { sys: SystemModel; work: string }) {
  const [params, setParams] = useSearchParams();
  const comp = params.get('with') || '';
  const flows = sys.flows.filter((f) => (!work || f.changes.some((c) => c.key === work)) && (!comp || f.from === comp || f.to === comp));
  const used = [...new Set(sys.flows.flatMap((f) => [f.from, f.to]))].sort((a, b) => a.localeCompare(b));
  const byLayer = sys.layers.map((l) => ({ l, flows: flows.filter((f) => sys.components.find((c) => c.id === f.from)?.layer === l.id) })).filter((g) => g.flows.length);
  return (
    <div className="space-y-4">
      <Select label="Component" value={comp} onChange={(v) => setParams((p) => { if (v) p.set('with', v); else p.delete('with'); return p; }, { replace: true })}
        options={[['', 'Any'], ...used.map((id) => [id, sys.components.find((c) => c.id === id)?.name || id] as [string, string])]} />
      {byLayer.length ? byLayer.map(({ l, flows }) => (
        <section key={l.id}>
          <h3 className="mb-2 text-sm font-semibold">From {l.name} <span className="font-normal text-ink-3">{flows.length}</span></h3>
          <FlowTable sys={sys} flows={flows} focus={work || undefined} />
        </section>
      )) : <Empty>No flows match.</Empty>}
    </div>
  );
}

function Timeline({ sys }: { sys: SystemModel }) {
  const { loop } = useHub();
  const works = [...sys.works].sort((a, b) => (b.started || b.updated).localeCompare(a.started || a.updated));
  return (
    <ol className="relative space-y-4 border-l border-line-2 pl-6">
      {works.map((w) => {
        const spec = loop.specs.find((s) => s.key === w.key);
        const firsts = sys.components.filter((c) => c.changes[0]?.key === w.key && !c.baseline);
        return (
          <li key={w.key} className="relative">
            <span className="absolute -left-[31px] top-1.5 size-2.5 rounded-full border-2 border-paper bg-ink" />
            <div className="rounded-lg border border-line bg-paper px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-ink-3" title={`impact recorded ${w.updated}`}>started {fmtDate(w.started || w.updated)}</span>
                <Link to={`/work/${w.key}/impact`} className="font-mono text-[12px] font-medium hover:underline">{w.key}</Link>
                <span className="font-medium">{w.title}</span>
                {spec && <Pill>{PHASE_TITLE[spec.phase as Phase] || spec.phase}</Pill>}
              </div>
              {w.summary && <p className="mt-1 max-w-4xl text-sm text-ink-2">{w.summary}</p>}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
                <span>{w.counts.components} components</span><span>{w.counts.flows} flows</span><span>{w.counts.infra} infrastructure</span>
                <span>{w.counts.screens} screens</span><span>{w.counts.useCases} use cases</span>
                {!!w.decisions.length && <span>decisions {w.decisions.map((d) => <Link key={d} to={`/knowledge/decisions/ADR-${d}`} className="mr-1 underline">{d}</Link>)}</span>}
              </div>
              {firsts.length > 0 && <p className="mt-1.5 text-xs text-ink-2">New to the system: {firsts.map((c) => c.name).join(', ')}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** A work item's Impact tab: what it changes in the system, drawn on the system map and listed per lens. */
export function WorkImpact({ spec }: { spec: Spec }) {
  const { system: sys, manifest } = useHub();
  const [params, setParams] = useSearchParams();
  if (!sys) return NO_MODEL;
  const w = forWork(sys, spec.key);
  if (!w.work) {
    return (
      <Empty>
        {spec.key} has not recorded its system impact yet. <code className="font-mono text-[12px]">/design {spec.key}</code> writes
        <code className="ml-1 font-mono text-[12px]">specs/{spec.folder}/outputs/impact.json</code>.
      </Empty>
    );
  }
  const view = params.get('view') || 'map';
  const sel = params.get('c');
  const setSel = (id: string | null) => setParams((p) => { if (id) p.set('c', id); else p.delete('c'); return p; }, { replace: true });
  const whole = params.get('whole') === '1';
  const only = whole ? undefined : new Set(w.components.map((c) => c.id));
  const views: [string, string, number][] = [
    ['map', 'Architecture', w.components.length], ['matrix', 'Communications', w.flows.length], ['infra', 'Infrastructure', w.infra.length],
    ['screens', 'Screens', w.screens.length], ['use-cases', 'Use cases', w.useCases.length], ['where', 'Where in the code', w.components.filter((c) => c.changes.some((x) => x.key === spec.key && x.where?.length)).length],
  ];
  const go = (v: string) => setParams((p) => { if (v === 'map') p.delete('view'); else p.set('view', v); return p; }, { replace: true });
  const adr = (d: string) => manifest.adrs.find((a) => a.id === d || a.id === `ADR-${d}`);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">What this work changes in the system</h2>
          <p className="mt-1 max-w-3xl text-sm text-ink-2">{w.work.summary}</p>
          <p className="mt-2 text-xs text-ink-3">Recorded {fmtDate(w.work.updated)} in <code className="font-mono">specs/{spec.folder}/outputs/impact.json</code>. Everything here also adds to the <Link to={`/system?work=${spec.key}`} className="underline">system map</Link>.</p>
        </div>
        {!!w.work.decisions.length && (
          <div className="min-w-0 rounded-lg border border-line bg-paper px-4 py-3">
            <h3 className="mb-1 text-xs font-semibold text-ink-3">Decisions</h3>
            <ul className="space-y-1 text-sm">
              {w.work.decisions.map((d) => {
                const a = adr(d);
                return <li key={d}>{a ? <Link to={`/knowledge/decisions/${a.id}`} className="hover:underline"><span className="font-mono text-[11.5px] text-ink-3">{d}</span> {a.title}</Link> : <span className="font-mono text-[12px]">{d}</span>}</li>;
              })}
            </ul>
          </div>
        )}
      </div>

      <div role="group" aria-label="Impact views" className="flex flex-wrap gap-2">
        {views.map(([v, label, n]) => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => go(v)}
            className={cx('rounded-lg border px-3 py-1.5 text-sm', view === v ? 'border-ink bg-ink font-medium text-paper' : 'border-line bg-paper text-ink-2 hover:border-line-2 hover:text-ink')}>
            {label} <span className={cx('ml-1 tabular-nums', view === v ? 'text-paper/80' : 'text-ink-3')}>{n}</span>
          </button>
        ))}
      </div>

      {view === 'map' && (
        <div className={cx('grid grid-cols-[minmax(0,1fr)] gap-4', sel && 'xl:grid-cols-[minmax(0,1fr)_380px]')}>
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Legend />
              <label className="inline-flex items-center gap-2 text-xs text-ink-2">
                <input type="checkbox" checked={whole} onChange={(e) => setParams((p) => { if (e.target.checked) p.set('whole', '1'); else p.delete('whole'); return p; }, { replace: true })} />
                Show it in the whole system
              </label>
            </div>
            <SystemMap sys={sys} focus={spec.key} only={only} selected={sel} onSelect={setSel} />
          </div>
          {sel && <div className="min-w-0 xl:sticky xl:top-20 xl:self-start"><ComponentDetail sys={sys} id={sel} onClose={() => setSel(null)} focus={spec.key} /></div>}
        </div>
      )}
      {view === 'matrix' && <FlowTable sys={sys} flows={w.flows} focus={spec.key} />}
      {view === 'infra' && <InfraList sys={sys} items={w.infra} focus={spec.key} />}
      {view === 'screens' && <ScreenGrid sys={sys} screens={w.screens} focus={spec.key} />}
      {view === 'use-cases' && <UseCaseList sys={sys} items={w.useCases} />}
      {view === 'where' && (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-paper">
          {w.components.map((c) => {
            const recs = c.changes.filter((x) => x.key === spec.key);
            const others = keysOf(c).filter((k) => k !== spec.key);
            return (
              <li key={c.id} className="grid gap-x-4 gap-y-1 px-4 py-3 md:grid-cols-[220px_minmax(0,1fr)]">
                <div className="min-w-0">
                  <button type="button" onClick={() => { setSel(c.id); go('map'); }} className="text-left font-medium hover:underline">{c.name}</button>
                  <div className="text-xs text-ink-3">{sys.layers.find((l) => l.id === c.layer)?.name}</div>
                  {others.length > 0 && <div className="mt-1 text-xs text-ink-3">Also changed by <ChangedBy el={{ changes: c.changes.filter((x) => x.key !== spec.key) }} /></div>}
                </div>
                <div className="min-w-0 space-y-1.5">
                  {recs.map((r, i) => (
                    <div key={i}>
                      <p className="text-sm text-ink-2">{r.summary}</p>
                      {r.where?.map((x, j) => (
                        <div key={j} className="break-all font-mono text-[11.5px] text-ink-3">{x.repo}{x.path ? ` / ${x.path}` : ''}{x.ref && <span className="ml-1 rounded bg-sunk px-1">{x.ref}</span>}</div>
                      ))}
                    </div>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** The Overview card: one line on the system impact, with its counts. */
export function ImpactCard({ spec }: { spec: Spec }) {
  const { system: sys } = useHub();
  const w = sys && forWork(sys, spec.key);
  if (!w?.work) return null;
  const n: [string, number, string][] = [
    ['components', w.components.length, 'map'], ['flows', w.flows.length, 'matrix'], ['infrastructure', w.infra.length, 'infra'],
    ['screens', w.screens.length, 'screens'], ['use cases', w.useCases.length, 'use-cases'],
  ];
  return (
    <section className="min-w-0 rounded-lg border border-line bg-paper">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-semibold">System impact</h2>
        <Link to={`/work/${spec.key}/impact`} className="text-xs underline">Open</Link>
      </header>
      <div className="px-4 py-3">
        <p className="line-clamp-3 text-sm text-ink-2">{w.work.summary}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {n.filter(([, v]) => v).map(([l, v, view]) => (
            <Link key={l} to={`/work/${spec.key}/impact${view === 'map' ? '' : `?view=${view}`}`} className="rounded-full border border-line-2 px-2 py-0.5 text-xs text-ink-2 hover:border-ink">
              <span className="font-medium tabular-nums text-ink">{v}</span> {l}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
