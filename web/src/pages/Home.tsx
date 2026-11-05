import { Link } from 'react-router';
import { PHASE_TITLE, useHub, usePoll, type TestLatest } from '../lib/data';
import { attention, taskTotal, type AttentionKind } from '../lib/attention';
import { Empty, fmtDate, fmtDateTime, KeyLink, Meter, Panel, Pill, type Tone } from '../components/ui';

const TONE: Record<AttentionKind, Tone> = { gate: 'wait', blocked: 'block', critical: 'critical', ready: 'ok', failing: 'block' };

export function Home() {
  const hub = useHub();
  const specs = hub.loop.specs;
  const items = attention(specs);
  const live = usePoll<{ sessions: { key: string; state: string; platform: string; device: { model: string }; passed: number; failed: number; total: number }[] }>('content/test-executions/live.json', 5000);
  const running = (live?.sessions || []).filter((s) => s.state === 'running');
  const flight = specs.filter((s) => !['intent', 'maintain'].includes(s.phase));
  const activity = specs
    .flatMap((s) => s.history.map((h) => ({ ...h, key: s.key })))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);
  const openFindings = specs.reduce((n, s) => n + (s.findings?.open || 0), 0);
  const critical = specs.reduce((n, s) => n + (s.findings?.bySeverity?.critical || 0), 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">What needs attention</h1>
          <p className="mt-1 text-ink-2">
            {specs.length} work items · {openFindings} open findings, {critical} critical · data from {hub.loop.workspace} on {fmtDate(hub.loop.generated)}
          </p>
        </div>
        <Link to="/work" className="text-sm font-medium underline decoration-line-2 underline-offset-4 hover:decoration-ink">All work</Link>
      </header>

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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="Act on these first" action={<span className="text-xs text-ink-3">{items.length}</span>}>
          {items.length === 0 ? (
            <Empty>Nothing waits on the team right now.</Empty>
          ) : (
            <ul className="-my-1 divide-y divide-line">
              {items.map((a, i) => (
                <li key={i}>
                  <Link to={a.to} className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2.5 md:grid-cols-[104px_96px_minmax(0,1fr)_auto]">
                    <Pill tone={TONE[a.kind]} className="justify-start md:w-[104px]">{a.label}</Pill>
                    <span className="font-mono text-[11.5px] text-ink-3">{a.spec.key}</span>
                    <span className="col-span-3 row-start-2 min-w-0 md:col-span-1 md:col-start-3 md:row-start-1">
                      <span className="font-medium group-hover:underline">{a.spec.title}</span>
                      <span className="text-ink-2">: {a.text}</span>
                    </span>
                    <span className="col-start-3 row-start-1 text-right text-xs text-ink-3 md:col-start-4">{a.since ? `since ${fmtDate(a.since)}` : ''}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent activity">
          <ul className="-my-1 divide-y divide-line">
            {activity.map((h, i) => (
              <li key={i} className="flex gap-3 py-2 text-sm">
                <span className="w-12 shrink-0 text-xs tabular-nums text-ink-3">{fmtDate(h.date)}</span>
                <span className="min-w-0">
                  <KeyLink to={`/work/${h.key}/activity`} k={h.key} /> <span className="text-ink-2">{h.event}{h.by ? `, ${h.by.replace(/\s*\(.*\)$/, '')}` : ''}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="In flight" action={<span className="text-xs text-ink-3">criteria passing</span>}>
        {flight.length === 0 ? <Empty action={<Link to="/knowledge/how-we-work" className="underline">Start a work item</Link>}>No work is past intent yet.</Empty> : (
          <ul className="-my-1 divide-y divide-line">
            {flight.map((s) => (
              <li key={s.key}>
                <Link to={`/work/${s.key}/overview`} className="group grid grid-cols-[96px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 py-2.5 md:grid-cols-[96px_minmax(0,1fr)_80px_200px_160px]">
                  <span className="font-mono text-[11.5px] text-ink-3">{s.key}</span>
                  <span className="truncate font-medium group-hover:underline">{s.title}</span>
                  <span className="hidden md:block"><Pill>{PHASE_TITLE[s.phase]}</Pill></span>
                  <span className="col-span-2 text-xs tabular-nums text-ink-3 md:col-span-1">
                    tasks {s.tasks.done}/{taskTotal(s)} · criteria {s.criteria_passing}/{s.criteria}
                  </span>
                  <span className="col-span-2 md:col-span-1"><Meter value={s.criteria_passing} total={s.criteria} /></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <LastRuns />
    </div>
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
