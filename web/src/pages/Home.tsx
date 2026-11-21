import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { PHASES, PHASE_TITLE, useHub, usePoll, type TestLatest } from '../lib/data';
import { attention, taskTotal, type AttentionKind } from '../lib/attention';
import { LatestRelease } from './Releases';
import { Empty, fmtDate, fmtDateTime, KeyLink, Meter, Panel, Pill, type Tone } from '../components/ui';
import { useWorkFilter, WorkFilterBar } from '../components/WorkFilter';
import { AdoptionChart, AgentsChart, AiChart, LoopChart, NewsList, ReposChart, StatTiles, TopPeople } from '../components/InsightsPanels';
import { useInsights } from '../lib/insights';
import { useLoopApi, useRuns, type AgentRun } from '../lib/loop';

const TONE: Record<AttentionKind, Tone> = { gate: 'wait', blocked: 'block', critical: 'critical', ready: 'ok', failing: 'block' };

export function Home() {
  const hub = useHub();
  const filter = useWorkFilter(hub.loop.specs);
  const specs = filter.specs;
  const { search } = useLocation();
  const items = attention(specs);
  const live = usePoll<{ sessions: { key: string; state: string; platform: string; device: { model: string }; passed: number; failed: number; total: number }[] }>('content/test-executions/live.json', 5000);
  const running = (live?.sessions || []).filter((s) => s.state === 'running');
  const flight = specs.filter((s) => !['intent', 'maintain'].includes(s.phase));
  const activity = specs
    .flatMap((s) => s.history.map((h) => ({ ...h, key: s.key })))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);
  const openFindings = specs.reduce((n, s) => n + (s.findings?.open || 0), 0);
  const critical = specs.reduce((n, s) => n + (s.findings?.bySeverity?.critical || 0), 0);
  const ins = useInsights();
  const api = useLoopApi();
  const keys = new Set(specs.map((s) => s.key));
  const runs = useRuns(!!api).filter((r) => r.key && keys.has(r.key)).slice(0, 40);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">The workspace at a glance</h1>
          <p className="mt-1 text-ink-2">
            {hub.loop.specs.length} work items · {openFindings} open findings, {critical} critical · data from {hub.loop.workspace} on {fmtDate(hub.loop.generated)}
          </p>
        </div>
        <span className="flex items-center gap-4 text-sm">
          <Link to="/insights" className="font-medium underline decoration-line-2 underline-offset-4 hover:decoration-ink">Weekly digest</Link>
          <Link to="/work" className="font-medium underline decoration-line-2 underline-offset-4 hover:decoration-ink">All work</Link>
        </span>
      </header>

      {ins.data && <>
        <StatTiles ins={ins.data} specs={hub.loop.specs} />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <AiChart ins={ins.data} />
          <TopPeople ins={ins.data} />
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <NewsList ins={ins.data} />
          <AgentsChart ins={ins.data} />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <LoopChart specs={hub.loop.specs} />
          <ReposChart ins={ins.data} />
        </div>
      </>}

      <LatestRelease />

      {running.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-run/40 bg-paper px-4 py-3 text-sm">
          <Pill tone="run">running</Pill>
          {running.map((r) => (
            <Link key={r.platform + r.key} to={`/work/${r.key}/tests`} className="hover:underline">
              {r.key} on {r.device.model}: {r.passed + r.failed} of {r.total}{r.failed ? `, ${r.failed} failed` : ''}
            </Link>
          ))}
        </div>
      )}

      <WorkFilterBar all={hub.loop.specs} filter={filter} />
      <Feed items={items} activity={activity} runs={runs} />

      <Panel title="In flight" action={<Link to={`/work${search}`} className="text-xs underline">All in Work</Link>}>
        {flight.length === 0 ? <Empty action={<Link to="/knowledge/how-we-work" className="underline">Start a work item</Link>}>No work is past intent yet.</Empty> : (
          <div className="space-y-4">
            {PHASES.map((p) => ({ p, list: flight.filter((s) => s.phase === p) })).filter((g) => g.list.length).map(({ p, list }) => (
              <section key={p}>
                <h3 className="mb-1 flex items-center justify-between text-xs font-semibold text-ink-2">
                  <span>{PHASE_TITLE[p]} <span className="font-normal tabular-nums text-ink-3">{list.length}</span></span>
                  {list.length > 4 && <Link to={`/work?phase=${p}`} className="font-normal underline">All {list.length} in {PHASE_TITLE[p]}</Link>}
                </h3>
                <ul className="divide-y divide-line">
                  {list.slice(0, 4).map((s) => (
                    <li key={s.key}>
                      <Link to={`/work/${s.key}/overview`} className="group grid grid-cols-[96px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 py-2 md:grid-cols-[96px_minmax(0,1fr)_200px_160px]">
                        <span className="font-mono text-[11.5px] text-ink-3">{s.key}</span>
                        <span className="min-w-0 font-medium leading-snug break-words group-hover:underline">{s.title}</span>
                        <span className="col-span-2 text-xs tabular-nums text-ink-3 md:col-span-1">tasks {s.tasks.done}/{taskTotal(s)} · criteria {s.criteria_passing}/{s.criteria}</span>
                        <span className="col-span-2 md:col-span-1"><Meter value={s.criteria_passing} total={s.criteria} /></span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Panel>
      <LastRuns />
      {ins.data && <AdoptionChart ins={ins.data} />}
    </div>
  );
}

type FeedKind = 'needs' | 'approval' | 'phase' | 'run' | 'other';
interface FeedRow { kind: FeedKind; date: string; key: string; node: ReactNode; tone?: Tone }

/** One stream instead of three lists: what waits on someone, what the loop did, and the agents' runs (local hub). */
function Feed({ items, activity, runs }: { items: ReturnType<typeof attention>; activity: { date: string; event: string; by?: string; key: string }[]; runs: AgentRun[] }) {
  const [show, setShow] = useState<FeedKind | 'all'>('all');
  const rows: FeedRow[] = [
    ...items.map((a) => ({ kind: 'needs' as const, date: a.since || '9999', key: a.spec.key, tone: TONE[a.kind],
      node: <Link to={a.to} className="hover:underline"><span className="font-medium">{a.spec.title}</span><span className="text-ink-2">: {a.text}</span></Link> })),
    ...activity.map((h) => ({ kind: (h.event.startsWith('approved') ? 'approval' : h.event.startsWith('phase') ? 'phase' : 'other') as FeedKind, date: h.date, key: h.key,
      node: <span className="text-ink-2">{h.event}{h.by ? `, ${h.by.replace(/\s*\(.*\)$/, '')}` : ''}</span> })),
    ...runs.filter((r) => r.key).map((r) => ({ kind: 'run' as const, date: r.started.slice(0, 10), key: r.key!, tone: (r.state === 'running' ? 'run' : r.state === 'failed' ? 'block' : 'ok') as Tone,
      node: <span className="text-ink-2"><span className="font-mono">{r.agent.replace(/^(team|command|module):/, '')}</span> {r.state === 'running' ? 'is working' : r.state}: {r.description}</span> })),
  ];
  const label: Record<FeedKind | 'all', string> = { all: 'Everything', needs: 'Needs someone', approval: 'Approvals', phase: 'Phase moves', run: 'Agent runs', other: 'Other' };
  const counts = rows.reduce((c, r) => ({ ...c, [r.kind]: (c[r.kind] || 0) + 1 }), {} as Record<string, number>);
  const shown = rows.filter((r) => show === 'all' || r.kind === show).sort((x, y) => (x.kind === 'needs' ? -1 : 0) - (y.kind === 'needs' ? -1 : 0) || y.date.localeCompare(x.date));
  return (
    <Panel title="What is happening" action={
      <span className="flex flex-wrap gap-1">
        {(['all', 'needs', 'approval', 'phase', 'run'] as const).filter((k) => k === 'all' || counts[k]).map((k) => (
          <button key={k} type="button" onClick={() => setShow(k)} aria-pressed={show === k}
            className={`rounded-full border px-2 py-0.5 text-xs ${show === k ? 'border-ink bg-ink text-paper' : 'border-line-2 text-ink-2 hover:border-ink'}`}>{label[k]}{k !== 'all' ? ` ${counts[k]}` : ''}</button>
        ))}
      </span>
    }>
      {shown.length === 0 ? <Empty>Nothing here for these filters.</Empty> : (
        <Capped n={10} total={shown.length} render={(k) => (
          <ul className="-my-1 divide-y divide-line">
            {shown.slice(0, k).map((r, i) => (
              <li key={i} className="grid grid-cols-[116px_96px_minmax(0,1fr)_56px] items-center gap-x-3 py-2 text-sm">
                <span>{r.kind === 'needs' || r.kind === 'run' ? <Pill tone={r.tone} className="justify-start">{label[r.kind]}</Pill> : <span className="text-xs text-ink-3">{label[r.kind]}</span>}</span>
                <KeyLink to={`/work/${r.key}/overview`} k={r.key} />
                <span className="min-w-0 break-words">{r.node}</span>
                <span className="text-right text-xs tabular-nums text-ink-3">{r.date === '9999' ? '' : fmtDate(r.date)}</span>
              </li>
            ))}
          </ul>
        )} />
      )}
    </Panel>
  );
}

/** A long list shows its first n; the rest open in place. */
function Capped({ n, total, render }: { n: number; total: number; render: (shown: number) => ReactNode }) {
  const [all, setAll] = useState(false);
  return (
    <>
      {render(all ? total : n)}
      {total > n && <button type="button" onClick={() => setAll(!all)} className="mt-2 text-xs underline">{all ? 'Show fewer' : `Show all ${total}`}</button>}
    </>
  );
}

function LastRuns() {
  const { loop, manifest } = useHub();
  const withRuns = loop.specs.filter((s) => manifest.sections.some((x) => x.id === `test-executions-${s.key.toLowerCase()}`));
  if (!withRuns.length) return null;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {withRuns.map((s) => <LastRun key={s.key} k={s.key} />)}
    </div>
  );
}

function LastRun({ k }: { k: string }) {
  const latest = usePoll<TestLatest>(`content/test-executions/latest-${k.toLowerCase()}.json`, 60000);
  if (!latest?.last) return null;
  const l = latest.last;
  return (
    <Link to={`/work/${k}/tests`} className="flex min-w-0 items-center gap-3 rounded-lg border border-line bg-paper px-4 py-3 text-sm hover:border-line-2">
      <Pill tone={l.failed ? 'block' : 'ok'}>{l.failed ? `${l.failed} failed` : 'passed'}</Pill>
      <span className="min-w-0 flex-1 truncate">
        <span className="font-mono text-[11.5px] text-ink-3">{k}</span> last phone run: {l.passed}/{l.cases} on {l.model}, {l.suite}
      </span>
      <span className="text-xs text-ink-3">{fmtDateTime(l.when)}</span>
    </Link>
  );
}
