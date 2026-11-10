import { useEffect, useState } from 'react';
import { agentRun, discardChange, since, stopAgent, type LiveRun, type Reach } from '../lib/loop';
import { MarkdownText } from './Markdown';
import { CopyButton, cx, Dot, ErrorNote, Pill, Segmented } from './ui';

type Kind = 'read' | 'search' | 'git' | 'edit' | 'note' | 'blocked' | 'other';
const KIND: Record<Kind, { label: string; cls: string }> = {
  read: { label: 'read', cls: 'bg-run' },
  search: { label: 'search', cls: 'bg-sev-low' },
  git: { label: 'git', cls: 'bg-sev-medium' },
  edit: { label: 'edit', cls: 'bg-ok' },
  note: { label: 'thinking', cls: 'bg-line-2' },
  blocked: { label: 'blocked by a guardrail', cls: 'bg-block' },
  other: { label: 'tool', cls: 'bg-sev-high' },
};
const kindOf = (s: { tool: string; target: string }): Kind =>
  s.tool === 'note' ? 'note' : s.tool === 'blocked' ? 'blocked' : s.tool === 'Read' ? 'read' : s.tool === 'Grep' || s.tool === 'Glob' ? 'search'
    : /^(Edit|Write|MultiEdit)$/.test(s.tool) ? 'edit' : s.tool === 'Bash' && /^git /.test(s.target) ? 'git' : 'other';

const STROKE: Record<Kind, string> = { read: 'var(--run)', search: 'var(--sev-low)', git: 'var(--sev-medium)', edit: 'var(--ok)', note: 'var(--line-2)', blocked: 'var(--block)', other: 'var(--sev-high)' };

/** The system a step's path belongs to: a repo, the workspace docs, the work items, the worktree being edited. */
function areaOf(path: string | undefined, run: LiveRun): string {
  if (path === undefined) return 'Workspace';
  if (path.startsWith('worktree/')) return `${run.repo} (worktree)`;
  const m = path.match(/^code\/([^/]+)(\/)?/);
  if (m && (m[2] || run.reach?.repos.includes(m[1]))) return m[1];
  if (/^docs(\/|$)/.test(path)) return 'Workspace docs';
  if (/^specs(\/|$)/.test(path)) return 'Work items';
  if (path === '' || path === 'code') return 'Whole workspace';
  return path.startsWith('/') ? 'Outside the workspace' : 'Workspace';
}

/** Agent → every system it touched (edge weight by calls, the latest one animated) and the systems it can and cannot reach. */
function ActivityMap({ run, steps }: { run: LiveRun; steps: { kind: Kind; path?: string; tool: string }[] }) {
  const tools = steps.filter((s) => s.kind !== 'note');
  const areas = new Map<string, Record<string, number>>();
  for (const s of tools) {
    const a = areaOf(s.path, run);
    const c = areas.get(a) || {};
    c[s.kind] = (c[s.kind] || 0) + 1;
    areas.set(a, c);
  }
  const rows = [...areas.entries()].map(([name, c]) => ({ name, c, n: Object.values(c).reduce((x, y) => x + y, 0) })).sort((a, b) => b.n - a.n).slice(0, 10);
  const last = tools.length ? areaOf(tools[tools.length - 1].path, run) : '';
  const max = Math.max(1, ...rows.map((r) => r.n));
  const RH = 34, H = Math.max(rows.length, 1) * RH, W = 140;
  const name = run.agent.replace(/^(team|module):/, '');
  return (
    <div className="rounded-md border border-line p-3">
      <div className="mb-2 text-xs font-medium text-ink-2">What the agent is touching</div>
      <div className="grid grid-cols-[150px_140px_minmax(0,1fr)] items-center">
        <div className="flex justify-center">
          <div className={cx('rounded-full border-2 px-3 py-3 text-center text-xs font-semibold', run.state === 'running' ? 'animate-pulse border-run' : run.state === 'done' ? 'border-ok' : 'border-block')} style={{ maxWidth: 140 }}>
            {name}<div className="mt-0.5 text-[10px] font-normal text-ink-3">{run.mode || 'ask'} · {run.state}</div>
          </div>
        </div>
        <svg width={W} height={H} className="overflow-visible" aria-hidden>
          {rows.map((r, i) => {
            const y = i * RH + RH / 2, top = (r.c.blocked ? 'blocked' : Object.entries(r.c).sort((a, b) => b[1] - a[1])[0][0]) as Kind;
            const live = run.state === 'running' && r.name === last;
            return <path key={r.name} d={`M0 ${H / 2} C ${W / 2} ${H / 2}, ${W / 2} ${y}, ${W} ${y}`} fill="none" stroke={STROKE[top]}
              strokeWidth={1 + (r.n / max) * 4} strokeOpacity={live ? 1 : 0.55} strokeDasharray={live ? '6 4' : undefined}
              className={live ? 'animate-[dash_1s_linear_infinite]' : undefined} />;
          })}
        </svg>
        <ul>
          {!rows.length && <li className="text-xs text-ink-3" style={{ height: RH }}>Starting...</li>}
          {rows.map((r) => (
            <li key={r.name} className="flex items-center gap-2" style={{ height: RH }}>
              <span className={cx('truncate rounded-md border px-2 py-1 text-xs', r.name === last && run.state === 'running' ? 'border-run font-medium' : 'border-line-2', (r.name === 'Outside the workspace' || !!r.c.blocked) && 'border-block text-block')}>{r.name}</span>
              <span className="flex h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-sunk" title={Object.entries(r.c).map(([k, v]) => `${KIND[k as Kind].label} ${v}`).join(', ')}>
                {(Object.keys(KIND) as Kind[]).filter((k) => r.c[k]).map((k) => <span key={k} className={KIND[k].cls} style={{ width: `${(r.c[k] / max) * 100}%` }} />)}
              </span>
              <span className="w-8 text-right text-[11px] tabular-nums text-ink-3">{r.n}</span>
            </li>
          ))}
        </ul>
      </div>
      {run.reach && <ReachRow reach={run.reach} />}
    </div>
  );
}

function ReachRow({ reach }: { reach: Reach }) {
  const yes = [
    `Code, read-only${reach.repos.length ? `: ${reach.repos.length > 4 ? `${reach.repos.slice(0, 4).join(', ')} +${reach.repos.length - 4}` : reach.repos.join(', ')}` : ''}`,
    ...(reach.docs ? ['Workspace docs and work items'] : []), 'Git history (given in its instructions)',
    ...(reach.edits ? [`Edits: ${reach.edits} only`] : []), ...reach.mcp.map((m) => `MCP server: ${m} (its tools only)`),
  ];
  const no = [!reach.databases && 'Databases', !reach.clusters && 'Clusters (OKD, Rancher)', !reach.mcp.length && 'Other systems (no MCP server)', !reach.network && 'Internet', !reach.shell && 'Shell'].filter(Boolean) as string[];
  return (
    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3 text-[11px]">
      <span className="mr-1 text-ink-3">Can reach</span>
      {yes.map((x) => <span key={x} className="rounded-full bg-ok/10 px-2 py-0.5 text-ok">{x}</span>)}
      <span className="ml-2 mr-1 text-ink-3">Not connected</span>
      {no.map((x) => <span key={x} className="rounded-full border border-line-2 px-2 py-0.5 text-ink-3 line-through decoration-ink-3/50">{x}</span>)}
    </div>
  );
}

/** Polls one live run until it ends. */
export function useRun(id: string | null) {
  const [run, setRun] = useState<LiveRun | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    let alive = true;
    setRun(null); setErr(null);
    const tick = () => agentRun(id).then((r) => { if (!alive) return; setRun(r); if (r.state !== 'running') clearInterval(t); }, (e) => alive && setErr((e as Error).message));
    const t = setInterval(tick, 1500);
    tick();
    return () => { alive = false; clearInterval(t); };
  }, [id]);
  return { run, err };
}

/** One agent run as an event history: a swimlane of every step over time, the list of events, the answer, and for propose mode the diff. */
export function RunView({ run, live = true }: { run: LiveRun; live?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // ADR 0029: one view of the run at a time; while it works, what it touches; once done, the answer
  const [pick, setPick] = useState<RunTab | null>(null);
  const tab: RunTab = pick || (run.state === 'running' ? 'map' : run.mode === 'propose' && run.diff ? 'change' : 'answer');
  const tabs: [RunTab, string][] = [['answer', 'Answer'], ['map', 'What it touched'], ['steps', `Steps ${run.steps.filter((x) => x.tool !== 'note').length}`],
    ...(run.mode === 'propose' ? [['change', 'Change'] as [RunTab, string]] : []), ...(run.launch ? [['how', 'How it ran'] as [RunTab, string]] : [])];
  const t0 = Date.parse(run.started);
  const span = Math.max(1, (run.ended ? Date.parse(run.ended) : Date.now()) - t0);
  const steps = run.steps.map((s) => ({ ...s, kind: kindOf(s), off: s.at ? Date.parse(s.at) - t0 : 0 }));
  const counts = steps.reduce<Record<string, number>>((m, s) => ({ ...m, [s.kind]: (m[s.kind] || 0) + 1 }), {});
  const act = (f: () => Promise<unknown>, done: string) => { setBusy(true); f().then(() => setNote(done), (e) => setNote((e as Error).message)).finally(() => setBusy(false)); };
  const take = run.worktree && run.branch
    ? `cd ${run.worktree} && git add -A && git commit -m ${JSON.stringify(`${run.key ? `${run.key}: ` : ''}${run.question.split('\n')[0].slice(0, 60)}`)} && git push -u origin ${run.branch}`
    : '';
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
        <Dot tone={run.state === 'running' ? 'run' : run.state === 'done' ? 'ok' : 'block'} className={run.state === 'running' ? 'animate-pulse' : undefined} />
        <span className="font-medium text-ink-2">{run.agent.replace(/^team:/, '')}</span>
        {run.mode && <Pill>{run.mode}</Pill>}
        {run.repo && <Pill>{run.repo}</Pill>}
        {run.key && <Pill>{run.key}</Pill>}
        <span>{run.state === 'running' ? `working for ${since(run.started)}` : `${run.state} in ${since(run.started, run.ended)}`}</span>
        {typeof run.cost === 'number' && <span>· about ${run.cost.toFixed(2)}</span>}
        <span>· {run.steps.filter((s) => s.tool !== 'note').length} tool calls</span>
        {live && run.state === 'running' && (
          <button type="button" disabled={busy} onClick={() => act(() => stopAgent(run.id), 'Stopping.')}
            className="ml-auto rounded-md border border-line-2 px-2 py-0.5 text-xs text-ink-2 hover:text-ink">Stop</button>
        )}
      </div>

      <Segmented label="Run view" value={tab} onChange={setPick} options={tabs} />

      {tab === 'map' && <ActivityMap run={run} steps={steps} />}

      {tab === 'steps' && steps.length > 0 && (
        <div className="rounded-md border border-line p-3">
          <div className="relative h-6 rounded bg-sunk" aria-label="Steps over time">
            {steps.map((s, i) => (
              <span key={i} title={`+${Math.round(s.off / 1000)}s ${s.tool} ${s.target}`}
                className={cx('absolute top-1 h-4 w-1 rounded-sm', KIND[s.kind].cls)} style={{ left: `calc(${Math.min(99.5, (s.off / span) * 100)}% - 2px)` }} />
            ))}
            {run.state === 'running' && <span className="absolute right-0 top-0 h-6 w-0.5 animate-pulse bg-run" />}
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-ink-3">
            {(Object.keys(KIND) as Kind[]).filter((k) => counts[k]).map((k) => (
              <span key={k} className="inline-flex items-center gap-1"><span className={cx('inline-block h-2.5 w-1 rounded-sm', KIND[k].cls)} />{KIND[k].label} {counts[k]}</span>
            ))}
          </div>
          <div className="mt-2">
            <ol className="mt-1 max-h-[50dvh] overflow-auto border-l border-line pl-3 text-xs">
              {steps.map((s, i) => (
                <li key={i} className="relative py-0.5">
                  <span className={cx('absolute -left-[15px] top-1.5 size-1.5 rounded-full', KIND[s.kind].cls)} />
                  <span className="inline-block w-12 tabular-nums text-ink-3">+{Math.round(s.off / 1000)}s</span>
                  <span className={cx('font-mono', s.kind === 'note' ? 'text-ink-3' : 'text-ink-2')}>{s.kind === 'note' ? '' : `${s.tool} `}</span>
                  <span className={s.kind === 'note' ? 'italic text-ink-3' : ''}>{s.target}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {run.error && <ErrorNote>{run.error}</ErrorNote>}
      {tab === 'answer' && (run.text
        ? <div className="max-h-[60dvh] overflow-auto rounded-lg border border-line bg-paper p-4"><MarkdownText src={run.text} path="" /></div>
        : <p className="text-sm text-ink-3">{run.state === 'running' ? 'The answer shows here when the agent finishes. Watch it work in What it touched.' : 'No answer.'}</p>)}

      {tab === 'how' && run.launch && <HowItRan launch={run.launch} />}

      {tab === 'change' && (run.state === 'running' ? <p className="text-sm text-ink-3">The change shows here when the agent finishes.</p> : 
        <div className="rounded-lg border border-line p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Proposed change</span>
            {run.branch && <code className="text-xs">{run.branch}</code>}
            {run.base && <span className="text-xs text-ink-3">from {run.base}</span>}
          </div>
          {run.diffStat === 'discarded' ? <p className="text-sm text-ink-3">Discarded: the worktree and the branch are removed.</p>
            : !run.diff ? <p className="text-sm text-ink-3">The agent changed no files.</p> : (
              <>
                <pre className="mb-2 overflow-auto rounded bg-sunk p-2 text-[11px]">{run.diffStat}</pre>
                <pre className="max-h-[28rem] overflow-auto rounded border border-line text-[11px] leading-snug">
                  {run.diff.split('\n').map((l, i) => (
                    <div key={i} className={cx('px-2', l.startsWith('+') && !l.startsWith('+++') ? 'bg-ok/10 text-ok' : l.startsWith('-') && !l.startsWith('---') ? 'bg-block/10 text-block' : l.startsWith('@@') ? 'text-run' : l.startsWith('diff ') ? 'mt-2 font-semibold text-ink' : 'text-ink-2')}>{l || ' '}</div>
                  ))}
                </pre>
                <p className="mt-2 text-xs text-ink-3">Nothing is pushed. Review it, build and test it in the worktree, then take it as your own branch:</p>
                <div className="mt-1"><CopyButton text={take} /></div>
                {live && (
                  <button type="button" disabled={busy} onClick={() => act(() => discardChange(run.id), 'Discarded.')}
                    className="mt-2 rounded-md border border-line-2 px-2 py-0.5 text-xs text-block">Discard the change</button>
                )}
              </>
            )}
          {note && <p className="mt-2 text-xs text-ink-3">{note}</p>}
        </div>
      )}
    </div>
  );
}

type RunTab = 'answer' | 'map' | 'steps' | 'change' | 'how';

/** The exact command line and instructions of a run: nothing about an agent is hidden. */
function HowItRan({ launch }: { launch: NonNullable<LiveRun['launch']> }) {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-ink-2">The hub started this run as a Claude Code process on this laptop, signed in as you. Its tools, permissions and directories are all on this command line; nothing else is granted.</p>
      <div><div className="mb-1 text-xs text-ink-3">Directory</div><code className="text-xs">{launch.cwd}</code></div>
      <div><div className="mb-1 flex items-center gap-2 text-xs text-ink-3">Command <CopyButton text={launch.command} label="command" /></div>
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-sunk p-3 text-[11px]">{launch.command.replace(/ --/g, '\n  --')}</pre></div>
      <details><summary className="cursor-pointer text-xs text-ink-2">The instructions below ({launch.instructions.length.toLocaleString()} characters: the agent file, the mode rules, the recent commits)</summary>
        <pre className="mt-2 max-h-[50dvh] overflow-auto whitespace-pre-wrap rounded bg-sunk p-3 text-[11px]">{launch.instructions}</pre></details>
    </div>
  );
}
