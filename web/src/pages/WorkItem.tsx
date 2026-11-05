import { Link, Navigate, useParams, useSearchParams } from 'react-router';
import {
  getText, PHASES, PHASE_TITLE, SEVERITIES, severityOf, specDoc, TASK_STATES, trackerUrl, useAsync, useFindings, useHub, useSpec,
  type Finding, type Hub, type Spec, type TaskState,
} from '../lib/data';
import { taskTotal } from '../lib/attention';
import { renderInline } from '../lib/markdown';
import { parseTasks, type TaskRow } from '../lib/tasks';
import { TABS, type Tab } from '../lib/routes';
import { MarkdownFile, MarkdownText } from '../components/Markdown';
import {
  CopyButton, cx, Empty, ErrorNote, fmtDate, Meter, Panel, Pill, SEV_LABEL, SEV_TONE, Select, Skeleton, Stat, StatusText, TabBar, TASK_TONE,
} from '../components/ui';
import { TestsTab, LatestRun } from './Tests';

export function WorkItem() {
  const { key, tab = 'overview' } = useParams();
  const spec = useSpec(key);
  const hub = useHub();
  if (!spec) return <Empty action={<Link className="underline" to="/work">All work</Link>}>No work item {key} in the workspace.</Empty>;
  if (key !== spec.key) return <Navigate to={`/work/${spec.key}/${tab}`} replace />;
  if (!TABS.some(([t]) => t === tab)) return <Navigate to={`/work/${spec.key}/overview`} replace />;

  const counts: Partial<Record<Tab, number>> = {
    requirements: spec.requirements, tasks: taskTotal(spec), tests: spec.criteria, findings: spec.findings?.open,
  };
  const jira = trackerUrl(hub, spec.tracker?.initiative || spec.key);

  return (
    <div>
      <div className="mb-1 text-xs text-ink-3"><Link to="/work" className="hover:underline">Work</Link> / <span className="font-mono">{spec.key}</span></div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold leading-tight text-balance">{spec.title}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
            <Pill>{PHASE_TITLE[spec.phase]}</Pill>
            {jira && <a href={jira} target="_blank" rel="noopener" className="underline decoration-line-2 underline-offset-4 hover:decoration-ink">Jira {spec.tracker?.initiative || spec.key}</a>}
            {!!spec.tracker?.epics?.length && <span>{spec.tracker.epics.length} epics, {spec.tracker.stories?.length || 0} stories</span>}
            <span>{spec.repos.length} {spec.repos.length === 1 ? 'repo' : 'repos'}</span>
            <span className="text-ink-3">updated {fmtDate(spec.updated)}</span>
          </div>
        </div>
        {spec.next && <NextStep next={spec.next} />}
      </div>

      <PhaseStrip spec={spec} />

      <TabBar label="Work item" className="mt-7" tabs={TABS.map(([t, label]) => ({ to: `/work/${spec.key}/${t}`, label, count: counts[t] }))} />

      <div className="pt-6">
        {tab === 'overview' && <Overview spec={spec} />}
        {tab === 'requirements' && <Doc spec={spec} file="spec.md" what="the spec" cmd={`/spec ${spec.key}`} />}
        {tab === 'design' && <Design spec={spec} />}
        {tab === 'tasks' && <Tasks spec={spec} />}
        {tab === 'tests' && <TestsTab spec={spec} />}
        {tab === 'findings' && <Findings spec={spec} />}
        {tab === 'documents' && <Documents spec={spec} hub={hub} />}
        {tab === 'activity' && <Activity spec={spec} />}
      </div>
    </div>
  );
}

function NextStep({ next }: { next: string }) {
  const cmd = next.match(/^\/[\w-]+(?:\s+[^\s,;]+)*/)?.[0];
  if (cmd && cmd === next.trim()) return <CopyButton text={cmd} />;
  return <div className="max-w-sm text-right text-xs text-ink-3"><span className="font-medium text-ink-2">Next:</span> {next}</div>;
}

function PhaseStrip({ spec }: { spec: Spec }) {
  const at = PHASES.indexOf(spec.phase);
  return (
    <ol className="mt-5 grid grid-cols-7 gap-1.5" aria-label="Phases">
      {PHASES.map((p, i) => {
        const approval = (spec.approved as Record<string, { date: string; by: string } | null | undefined>)[p];
        const state = i < at ? 'done' : i === at ? 'now' : 'later';
        const note = approval ? `approved ${fmtDate(approval.date)}` : i === at
          ? (p === 'build' ? `${spec.tasks.done}/${taskTotal(spec)} tasks` : p === 'test' ? `${spec.criteria_passing}/${spec.criteria} passing` : ['intent', 'spec', 'design'].includes(p) ? 'needs approval' : 'current')
          : i < at ? 'done' : '';
        return (
          <li key={p} aria-current={state === 'now' ? 'step' : undefined} title={approval ? `Approved by ${approval.by} on ${approval.date}` : undefined}
            className={cx('border-t-[3px] pt-1.5 text-xs', state === 'done' && 'border-ink text-ink-2', state === 'now' && 'border-brand font-semibold text-ink', state === 'later' && 'border-line-2 text-ink-3')}>
            <div className="truncate">{PHASE_TITLE[p]}</div>
            <div className="truncate font-normal text-ink-3">{note}</div>
          </li>
        );
      })}
    </ol>
  );
}

export function areaTitle(hub: Hub, key: string) {
  const areas = (hub.manifest.loopConfig.review as { areas?: { key: string; title: string }[] } | undefined)?.areas || [];
  return areas.find((a) => a.key === key)?.title || key.charAt(0).toUpperCase() + key.slice(1);
}

function Overview({ spec }: { spec: Spec }) {
  const hub = useHub();
  const tasksMd = useAsync(spec.files.tasks ? () => getText(specDoc(spec, 'tasks.md')) : null, [spec.dir]);
  const rows = tasksMd.data ? withStatus(parseTasks(tasksMd.data).rows, spec) : [];
  const blocked = rows.filter((r) => r.status === 'blocked');
  const inReview = rows.filter((r) => r.status === 'review');
  const f = spec.findings;
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-line bg-paper px-4 py-3">
          <div className="text-2xl font-semibold tabular-nums">{spec.criteria_passing} <span className="text-base font-normal text-ink-3">/ {spec.criteria}</span></div>
          <div className="mb-2 mt-0.5 text-xs text-ink-3">acceptance criteria passing</div>
          <Meter value={spec.criteria_passing} total={spec.criteria} />
        </div>
        <Stat value={<>{spec.tasks.done} <span className="text-base font-normal text-ink-3">/ {taskTotal(spec)}</span></>} label={`tasks done · ${spec.tasks.doing} doing · ${spec.tasks.review} in review`} />
        <Stat value={spec.tasks.blocked} tone={spec.tasks.blocked ? 'block' : undefined} label="tasks blocked" />
        <Stat value={f ? <>{f.bySeverity.critical || 0} <span className="text-base font-normal text-ink-3">critical · {f.bySeverity.high || 0} high</span></> : '–'} tone={f?.bySeverity.critical ? 'critical' : undefined} label={f ? `of ${f.open} open findings` : 'not reviewed yet'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-6">
          <Panel title="Blocked" action={blocked.length > 0 && <Link to={`/work/${spec.key}/tasks?status=blocked`} className="text-xs underline">All tasks</Link>}>
            {tasksMd.loading ? <Skeleton /> : blocked.length ? <TaskList rows={blocked.slice(0, 6)} more={blocked.length - 6} spec={spec} /> : <p className="text-sm text-ink-3">Nothing is blocked.</p>}
          </Panel>
          {inReview.length > 0 && (
            <Panel title="Waiting for review" action={<Link to={`/work/${spec.key}/tasks?status=review`} className="text-xs underline">All tasks</Link>}>
              <TaskList rows={inReview.slice(0, 6)} more={inReview.length - 6} spec={spec} />
            </Panel>
          )}
        </div>
        <div className="space-y-6">
          <LatestRun spec={spec} />
          {f && (
            <Panel title="Findings by area" action={<Link to={`/work/${spec.key}/findings`} className="text-xs underline">All findings</Link>}>
              <ul className="space-y-1.5">
                {Object.entries(f.byArea || {}).filter(([a]) => a !== 'none').sort((a, b) => b[1] - a[1]).map(([a, n]) => (
                  <li key={a}>
                    <Link to={`/work/${spec.key}/findings?area=${a}`} className="flex items-center gap-3 text-sm hover:underline">
                      <span className="w-28 shrink-0">{areaTitle(hub, a)}</span>
                      <span className="h-1.5 flex-1 rounded-full bg-sunk"><span className="block h-full rounded-full bg-ink-3" style={{ width: `${(n / Math.max(...Object.entries(f.byArea || {}).filter(([k]) => k !== 'none').map(([, v]) => v))) * 100}%` }} /></span>
                      <span className="w-8 text-right tabular-nums text-ink-2">{n}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel title="Where the work is">
            <dl className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
              {spec.intake && <><dt className="text-ink-3">Came from</dt><dd>{spec.intake.summary}</dd></>}
              <dt className="text-ink-3">Repos</dt><dd className="font-mono text-[12px]">{spec.repos.join(', ') || '–'}</dd>
              <dt className="text-ink-3">Folder</dt><dd className="font-mono text-[12px] break-all">specs/{spec.folder}/</dd>
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function withStatus(rows: TaskRow[], spec: Spec): TaskRow[] {
  const map = new Map(spec.task_list.map((t) => [t.id, t.status]));
  return rows.map((r) => ({ ...r, status: map.get(r.id) || r.status }));
}

function TaskList({ rows, more, spec }: { rows: TaskRow[]; more?: number; spec: Spec }) {
  return (
    <ul className="-my-1 divide-y divide-line">
      {rows.map((r) => (
        <li key={r.id} className="grid grid-cols-[48px_minmax(0,1fr)] gap-3 py-2 text-sm">
          <span className="font-mono text-[11.5px] text-ink-3">{r.id}</span>
          <div className="min-w-0">
            <div className="text-pretty" dangerouslySetInnerHTML={{ __html: renderInline(r.task) }} />
            {r.depends && r.depends !== '—' && <div className="mt-0.5 text-xs text-ink-3">waits on: <span dangerouslySetInnerHTML={{ __html: renderInline(r.depends) }} /></div>}
          </div>
        </li>
      ))}
      {!!more && more > 0 && <li className="py-2 text-sm"><Link to={`/work/${spec.key}/tasks`} className="text-ink-3 underline">{more} more</Link></li>}
    </ul>
  );
}

function Doc({ spec, file, what, cmd }: { spec: Spec; file: string; what: string; cmd: string }) {
  if (!spec.files[file.replace(/\.md$/, '')]) {
    return <Empty action={<CopyButton text={cmd} />}>There is no {what} yet. It is written in the workspace with:</Empty>;
  }
  return <MarkdownFile path={specDoc(spec, file)} />;
}

function Design({ spec }: { spec: Spec }) {
  const [params, setParams] = useSearchParams();
  const docs = [['plan', 'Design'], ['data-model', 'Data model'], ['test-plan', 'Test plan']].filter(([f]) => spec.files[f]);
  const doc = params.get('doc') && docs.some(([f]) => f === params.get('doc')) ? params.get('doc')! : docs[0]?.[0];
  if (!doc) return <Empty action={<CopyButton text={`/design ${spec.key}`} />}>No design yet. It is written in the workspace with:</Empty>;
  return (
    <div>
      {docs.length > 1 && (
        <div role="group" aria-label="Design documents" className="mb-5 flex flex-wrap gap-2">
          {docs.map(([f, l]) => (
            <button key={f} type="button" aria-pressed={doc === f} onClick={() => setParams({ doc: f }, { replace: true })}
              className={cx('rounded-md border px-3 py-1 text-sm', doc === f ? 'border-ink bg-ink text-paper' : 'border-line-2 bg-paper text-ink-2 hover:text-ink')}>{l}</button>
          ))}
        </div>
      )}
      <MarkdownFile path={specDoc(spec, `${doc}.md`)} />
    </div>
  );
}

const STATE_LABEL: Record<TaskState, string> = { blocked: 'Blocked', doing: 'Doing', review: 'In review', todo: 'To do', done: 'Done' };

function Tasks({ spec }: { spec: Spec }) {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const repo = params.get('repo') || '';
  const md = useAsync(spec.files.tasks ? () => getText(specDoc(spec, 'tasks.md')) : null, [spec.dir]);
  if (!spec.files.tasks) return <Empty action={<CopyButton text={`/tasks ${spec.key}`} />}>No tasks yet. The design is broken into tasks with:</Empty>;
  if (md.loading) return <Skeleton lines={8} />;
  if (md.error) return <ErrorNote>Could not load tasks.md.</ErrorNote>;
  const parsed = parseTasks(md.data!);
  const rows = withStatus(parsed.rows, spec);
  const repos = [...new Set(rows.map((r) => r.repo).filter((r) => r && r !== '—'))];
  const shown = rows.filter((r) => (!status || r.status === status) && (!repo || r.repo === repo));
  const set = (k: string, v: string) => setParams((p) => { if (v) p.set(k, v); else p.delete(k); return p; }, { replace: true });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-pressed={!status} onClick={() => set('status', '')} className={cx('rounded-full border px-3 py-1 text-xs', !status ? 'border-ink bg-ink text-paper' : 'border-line-2 bg-paper')}>All {rows.length}</button>
        {TASK_STATES.map((s) => (
          <button key={s} type="button" aria-pressed={status === s} onClick={() => set('status', status === s ? '' : s)}
            className={cx('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs', status === s ? 'border-ink bg-ink text-paper' : 'border-line-2 bg-paper')}>
            <StatusText tone={TASK_TONE[s]}><span className={status === s ? 'text-paper' : 'text-ink'}>{STATE_LABEL[s]} {spec.tasks[s] || 0}</span></StatusText>
          </button>
        ))}
        {repos.length > 1 && <Select label="Repo" value={repo} onChange={(v) => set('repo', v)} options={[['', 'Any'], ...repos.map((r) => [r, r] as [string, string])]} />}
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-paper">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-sunk text-left text-xs text-ink-2">
            <tr>{['Task', '', 'Repo', 'Covers', 'Story', 'Waits on', 'Status'].map((h, i) => <th key={i} scope="col" className="px-3 py-2 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line align-top">
            {shown.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 font-mono text-[11.5px] text-ink-3">{r.id}</td>
                <td className="px-3 py-2 text-pretty" dangerouslySetInnerHTML={{ __html: renderInline(r.task) }} />
                <td className="px-3 py-2 text-xs text-ink-2">{r.repo}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-ink-3">{r.covers}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px]">{r.story}</td>
                <td className="px-3 py-2 text-xs text-ink-2" dangerouslySetInnerHTML={{ __html: renderInline(r.depends) }} />
                <td className="px-3 py-2">{(TASK_STATES as readonly string[]).includes(r.status) ? <StatusText tone={TASK_TONE[r.status as TaskState]}>{STATE_LABEL[r.status as TaskState]}</StatusText> : r.status}</td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={7} className="px-3 py-6 text-center text-ink-3">No tasks with this status.</td></tr>}
          </tbody>
        </table>
      </div>

      {(parsed.before.trim() || parsed.after.trim()) && (
        <details className="rounded-lg border border-line bg-paper px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium">How these tasks are run</summary>
          <div className="mt-3"><MarkdownText src={parsed.before.replace(/^#\s.*\n/, '') + '\n\n' + parsed.after} path={specDoc(spec, 'tasks.md')} /></div>
        </details>
      )}
    </div>
  );
}

function Findings({ spec }: { spec: Spec }) {
  const { data, loading, error } = useFindings(spec);
  if (!spec.findingsFile) return <Empty action={<CopyButton text={`/gap ${spec.key} all`} />}>This work has not been reviewed yet. Review the existing code with:</Empty>;
  if (loading) return <Skeleton lines={8} />;
  if (error) return <ErrorNote>Could not load findings.</ErrorNote>;
  return <FindingsTable findings={data!} reviewBase={`content/specs/${spec.dir}/review/`} reviewed={spec.review} />;
}

export function FindingsTable({ findings, reviewBase, reviewed, showSpec }: { findings: (Finding & { spec?: string })[]; reviewBase?: string; reviewed?: string[]; showSpec?: boolean }) {
  const hub = useHub();
  const [params, setParams] = useSearchParams();
  const f = { severity: params.get('severity') || '', area: params.get('area') || '', type: params.get('type') || '', team: params.get('team') || '', spec: params.get('spec') || '', q: (params.get('q') || '').toLowerCase() };
  const set = (k: string, v: string) => setParams((p) => { if (v) p.set(k, v); else p.delete(k); return p; }, { replace: true });
  const opts = (key: keyof Finding | 'spec') => [...new Set(findings.map((x) => String((x as unknown as Record<string, unknown>)[key] ?? '')).filter(Boolean))].sort().map((v) => [v, v] as [string, string]);
  const open = findings.filter((x) => (x.status || 'open') === 'open');
  const shown = open.filter((x) =>
    (!f.severity || severityOf(x) === f.severity) && (!f.area || x.area === f.area) && (!f.type || x.type === f.type) &&
    (!f.team || x.team === f.team) && (!f.spec || x.spec === f.spec) &&
    (!f.q || `${x.id} ${x.title} ${x.location} ${x.detail}`.toLowerCase().includes(f.q)),
  ).sort((a, b) => SEVERITIES.indexOf(severityOf(a)) - SEVERITIES.indexOf(severityOf(b)));
  const count = (s: string) => open.filter((x) => severityOf(x) === s).length;
  const area = f.area && reviewed?.includes(f.area) ? f.area : '';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {SEVERITIES.filter((s) => count(s)).map((s) => (
          <button key={s} type="button" aria-pressed={f.severity === s} onClick={() => set('severity', f.severity === s ? '' : s)}
            className={cx('inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-left', f.severity === s ? 'border-ink bg-paper ring-1 ring-ink' : 'border-line bg-paper hover:border-line-2')}>
            <StatusText tone={SEV_TONE[s]}>{SEV_LABEL[s]}</StatusText>
            <span className="text-lg font-semibold tabular-nums">{count(s)}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input type="search" value={params.get('q') || ''} onChange={(e) => set('q', e.target.value)} placeholder="Search findings" aria-label="Search findings" className="h-8 w-56 rounded-md border border-line-2 bg-paper px-2.5 text-sm" />
        {showSpec && <Select label="Work" value={f.spec} onChange={(v) => set('spec', v)} options={[['', 'Any'], ...opts('spec')]} />}
        <Select label="Area" value={f.area} onChange={(v) => set('area', v)} options={[['', 'Any'], ...opts('area')]} />
        <Select label="Type" value={f.type} onChange={(v) => set('type', v)} options={[['', 'Any'], ...opts('type')]} />
        <Select label="Team" value={f.team} onChange={(v) => set('team', v)} options={[['', 'Any'], ...opts('team')]} />
        <span className="text-xs text-ink-3">{shown.length} of {open.length} open</span>
      </div>

      {area && reviewBase && (
        <details className="rounded-lg border border-line bg-paper px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium">The {areaTitle(hub, area)} review</summary>
          <div className="mt-3"><MarkdownFile path={`${reviewBase}${area}.md`} missing="No review document for this area." /></div>
        </details>
      )}

      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-paper">
        {shown.slice(0, 300).map((x, i) => (
          <li key={`${x.spec || ''}${x.id}${i}`}>
            <details className="group">
              <summary className="grid cursor-pointer list-none grid-cols-[84px_minmax(0,1fr)] gap-x-3 gap-y-1 px-4 py-2.5 hover:bg-sunk md:grid-cols-[84px_minmax(0,1fr)_auto]">
                <StatusText tone={SEV_TONE[severityOf(x)]}>{SEV_LABEL[severityOf(x)]}</StatusText>
                <span className="min-w-0">
                  {showSpec && x.spec && <span className="mr-2 font-mono text-[11px] text-ink-3">{x.spec}</span>}
                  <span className="mr-2 font-mono text-[11px] text-ink-3">{x.id}</span>
                  <span className="text-sm" dangerouslySetInnerHTML={{ __html: renderInline(x.title) }} />
                </span>
                <span className="col-start-2 flex flex-wrap gap-1.5 md:col-start-3">
                  {x.area && <Pill>{x.area}</Pill>}
                  {x.component && <Pill>{x.component}</Pill>}
                </span>
              </summary>
              <dl className="grid gap-x-4 gap-y-2 border-t border-line bg-sunk px-4 py-3 text-sm md:grid-cols-[110px_minmax(0,1fr)]">
                {([['Where', x.location], ['What', x.detail], ['Impact', x.impact], ['Fix', x.fix], ['Type', x.type], ['Team', x.team], ['Source', x.source]] as [string, string | undefined][])
                  .filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-xs font-medium text-ink-3 md:pt-0.5">{k}</dt>
                      <dd className="text-pretty [&_code]:font-mono [&_code]:text-[12px]" dangerouslySetInnerHTML={{ __html: renderInline(v!) }} />
                    </div>
                  ))}
              </dl>
            </details>
          </li>
        ))}
        {shown.length > 300 && <li className="px-4 py-3 text-sm text-ink-3">Showing the first 300. Narrow the filters to see the rest.</li>}
        {!shown.length && <li className="px-4 py-8 text-center text-sm text-ink-3">No open findings match these filters.</li>}
      </ul>
    </div>
  );
}

function Documents({ spec, hub }: { spec: Spec; hub: Hub }) {
  const core = [['intent', 'Intent'], ['spec', 'Spec'], ['plan', 'Design'], ['data-model', 'Data model'], ['tasks', 'Tasks'], ['test-plan', 'Test plan']].filter(([f]) => spec.files[f]);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Spec files">
        <ul className="space-y-1.5 text-sm">
          {core.map(([f, l]) => <li key={f}><Link className="underline decoration-line-2 underline-offset-4 hover:decoration-ink" to={`/doc/${specDoc(spec, f + '.md')}`}>{l}</Link> <span className="font-mono text-[11px] text-ink-3">{f}.md</span></li>)}
        </ul>
      </Panel>
      <Panel title="Outputs">
        {spec.outputs.length ? (
          <ul className="space-y-1.5 text-sm">
            {spec.outputs.map((o) => <li key={o}><Link className="underline decoration-line-2 underline-offset-4 hover:decoration-ink" to={`/doc/content/specs/${spec.dir}/outputs/${o}`}>{o.replace(/\.md$/, '').replace(/-/g, ' ')}</Link></li>)}
          </ul>
        ) : <p className="text-sm text-ink-3">None yet.</p>}
      </Panel>
      <Panel title="Area reviews">
        {spec.review.length ? (
          <ul className="flex flex-wrap gap-2">
            {spec.review.map((a) => <li key={a}><Link to={`/doc/content/specs/${spec.dir}/review/${a}.md`} className="inline-block rounded-md border border-line-2 px-2.5 py-1 text-sm hover:border-ink-3">{areaTitle(hub, a)}</Link></li>)}
          </ul>
        ) : <p className="text-sm text-ink-3">Not reviewed yet.</p>}
      </Panel>
      <Panel title="Sources and inputs">
        <ul className="space-y-1.5 text-sm">
          {spec.sources.map((u) => <li key={u} className="truncate"><a href={u} target="_blank" rel="noopener" className="underline decoration-line-2 underline-offset-4 hover:decoration-ink">{sourceLabel(u)}</a></li>)}
          {spec.inputs.map((i) => <li key={i} className="font-mono text-[12px] text-ink-3">inputs/{i}</li>)}
          {spec.tracker?.stories?.slice(0, 40).map((s) => {
            const u = trackerUrl(hub, s);
            return u ? <a key={s} href={u} target="_blank" rel="noopener" className="mr-2 inline-block font-mono text-[11.5px] underline decoration-line-2 underline-offset-2">{s}</a> : null;
          })}
        </ul>
      </Panel>
    </div>
  );
}

function sourceLabel(u: string) {
  if (u.includes('atlassian.net/wiki')) return 'Confluence page';
  if (u.includes('figma.com')) return 'Figma file';
  if (u.includes('atlassian.net/browse')) return 'Jira ' + u.split('/').pop();
  if (u.includes('github.com')) return u.replace(/^https:\/\/github.com\//, '');
  return u.replace(/^https?:\/\//, '').slice(0, 60);
}

function Activity({ spec }: { spec: Spec }) {
  const h = [...spec.history].reverse();
  return (
    <ol className="relative max-w-2xl border-l border-line pl-5">
      {h.map((e, i) => (
        <li key={i} className="relative pb-4">
          <span aria-hidden className="absolute -left-[25px] top-1.5 size-2 rounded-full bg-ink-3 ring-4 ring-canvas" />
          <div className="text-xs tabular-nums text-ink-3">{fmtDate(e.date)}</div>
          <div className="text-sm">{e.event}{e.by && <span className="text-ink-3">, {e.by}</span>}</div>
        </li>
      ))}
    </ol>
  );
}
