import { Link, useSearchParams } from 'react-router';
import { getText, specDoc, useAsync, useHub, usePoll, type Spec, type TestLatest, type TestSession } from '../lib/data';
import { MarkdownText } from '../components/Markdown';
import { CopyButton, cx, Empty, fmtDateTime, Meter, Panel, Pill, Skeleton, Stat, StatusText } from '../components/ui';

function sectionsOf(md: string) {
  const parts: { title: string; slug: string; body: string }[] = [];
  let intro = '';
  for (const chunk of md.split(/^## /m)) {
    if (!parts.length && !/^\S/.test(chunk)) { intro += chunk; continue; }
    const nl = chunk.indexOf('\n');
    const title = chunk.slice(0, nl).trim();
    if (!title) { intro += chunk; continue; }
    parts.push({ title, slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), body: chunk.slice(nl + 1) });
  }
  return { intro, parts };
}

export function useHasRuns(spec: Spec) {
  const { manifest } = useHub();
  return manifest.sections.find((s) => s.id === `test-executions-${spec.key.toLowerCase()}`);
}

export function TestsTab({ spec }: { spec: Spec }) {
  const section = useHasRuns(spec);
  const [params, setParams] = useSearchParams();
  const md = useAsync(section ? () => getText(section.doc) : null, [section?.doc]);
  const parsed = md.data ? sectionsOf(md.data) : null;
  const parts = (parsed?.parts || []).filter((p) => !/^live now$/i.test(p.title));
  const view = params.get('view') || parts[0]?.slug || '';
  const current = parts.find((p) => p.slug === view) || parts[0];
  const notTested = spec.criteria - spec.criteria_tested;

  return (
    <div className="space-y-6">
      {section && <LivePanel spec={spec} />}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-paper px-4 py-3">
          <div className="text-2xl font-semibold tabular-nums">{spec.criteria_passing} <span className="text-base font-normal text-ink-3">/ {spec.criteria}</span></div>
          <div className="mb-2 mt-0.5 text-xs text-ink-3">acceptance criteria passing</div>
          <Meter value={spec.criteria_passing} total={spec.criteria} />
        </div>
        <Stat value={spec.criteria_tested - spec.criteria_passing} label="criteria with a test that is not passing yet" />
        <Stat value={notTested} tone={notTested ? 'block' : undefined} label="criteria with no test yet (nothing ships until each has one)" />
      </div>

      {section && (
        md.loading ? <Skeleton lines={8} /> : parts.length > 0 && (
          <div>
            <div role="group" aria-label="Test views" className="mb-5 flex flex-wrap gap-2">
              {parts.map((p) => (
                <button key={p.slug} type="button" aria-pressed={current?.slug === p.slug} onClick={() => setParams({ view: p.slug }, { replace: true })}
                  className={cx('rounded-md border px-3 py-1 text-sm', current?.slug === p.slug ? 'border-ink bg-ink text-paper' : 'border-line-2 bg-paper text-ink-2 hover:text-ink')}>
                  {p.title}
                </button>
              ))}
            </div>
            {current && <MarkdownText src={current.body} path={section.doc} wide />}
          </div>
        )
      )}

      {spec.files['test-plan'] ? (
        <details className="rounded-lg border border-line bg-paper px-4 py-3" open={!section}>
          <summary className="cursor-pointer text-sm font-medium">Test plan</summary>
          <div className="mt-3"><TestPlan spec={spec} /></div>
        </details>
      ) : !section && (
        <Empty action={<CopyButton text={`/test ${spec.key}`} />}>No test plan or recorded runs yet. Tests run layer by layer with:</Empty>
      )}
    </div>
  );
}

function TestPlan({ spec }: { spec: Spec }) {
  const md = useAsync(() => getText(specDoc(spec, 'test-plan.md')), [spec.dir]);
  if (md.loading) return <Skeleton lines={5} />;
  return md.data ? <MarkdownText src={md.data} path={specDoc(spec, 'test-plan.md')} /> : null;
}

const STATE_TONE = { running: 'run', finished: 'ok', failed: 'block', stopped: 'wait', waiting: 'wait' } as const;

function LivePanel({ spec }: { spec: Spec }) {
  const live = usePoll<{ updated: string; sessions: TestSession[] }>('content/test-executions/live.json', 2000);
  const sessions = (live?.sessions || []).filter((s) => s.key === spec.key);
  const running = sessions.filter((s) => s.state === 'running');
  return (
    <Panel
      title={running.length ? `Running now on ${running.length} ${running.length === 1 ? 'phone' : 'phones'}` : 'Phones'}
      action={<CopyButton text={`/live-test ${spec.key} both`} />}
    >
      {!sessions.length ? (
        <p className="text-sm text-ink-3">No run in progress. Start one from the engineering workspace; this panel follows it every 2 seconds.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {sessions.map((s) => <PhoneCard key={s.session || s.platform} s={s} />)}
        </div>
      )}
    </Panel>
  );
}

function PhoneCard({ s }: { s: TestSession }) {
  const done = s.passed + s.failed;
  const tone = s.failed && s.state !== 'running' ? 'block' : (STATE_TONE as Record<string, 'run' | 'ok' | 'block' | 'wait'>)[s.state] || 'wait';
  const failed = (s.results || []).filter((r) => r.status !== 'PASS');
  return (
    <div className="rounded-lg border border-line px-3.5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusText tone={tone}>{s.state}</StatusText>
        <span className="text-sm font-medium">{s.device.model}</span>
        <span className="text-xs text-ink-3">{s.device.os} · {s.short_suite || `${s.suite} ${s.suite_detail || ''}`}{s.data_mode ? ` · ${s.data_mode} data` : ''}</span>
      </div>
      <div className="mt-2.5 flex items-center gap-3">
        <div className="flex-1"><Meter value={s.passed} total={s.total || done || 1} label="Cases passed" /></div>
        <span className="text-sm tabular-nums">{s.passed}/{s.total}</span>
        {s.failed > 0 && <Pill tone="block">{s.failed} failed</Pill>}
      </div>
      {s.state === 'running' && s.current && <p className="mt-2 truncate text-xs text-ink-2">On screen now: <code className="font-mono">{s.current}</code></p>}
      {s.notice && <p className="mt-2 text-xs text-sev-high">{s.notice}</p>}
      {failed.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs">
          {failed.slice(0, 5).map((r) => <li key={r.name} className="truncate text-block"><code className="font-mono">{r.name}</code></li>)}
        </ul>
      )}
      <p className="mt-2 text-[11px] text-ink-3">updated {fmtDateTime(s.updated)}{s.records?.length ? ` · record ${s.records[s.records.length - 1]}` : ''}</p>
    </div>
  );
}

export function LatestRun({ spec }: { spec: Spec }) {
  const section = useHasRuns(spec);
  const latest = usePoll<TestLatest>(`content/test-executions/latest-${spec.key.toLowerCase()}.json`, 30000);
  if (!section || !latest?.last) return null;
  const l = latest.last;
  return (
    <Panel title="Latest phone run" action={<Link to={`/work/${spec.key}/tests`} className="text-xs underline">Tests</Link>}>
      <div className="flex items-center gap-2 text-sm">
        <StatusText tone={l.failed ? 'block' : 'ok'}>{l.failed ? `${l.failed} failed` : 'passed'}</StatusText>
        <span className="font-medium tabular-nums">{l.passed}/{l.cases}</span>
        <span className="text-ink-2">{l.model}, {l.suite}</span>
      </div>
      <p className="mt-1 text-xs text-ink-3">{fmtDateTime(l.when)} · run {l.run_id}</p>
      {latest.sessions.some((s) => s.data_mode === 'replay') && (
        <p className="mt-2 text-xs text-ink-2">Replay data: proves the screens and the flow, not the backend end to end.</p>
      )}
    </Panel>
  );
}
