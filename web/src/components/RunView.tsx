import { useEffect, useState } from 'react';
import { agentRun, discardChange, since, stopAgent, type LiveRun } from '../lib/loop';
import { MarkdownText } from './Markdown';
import { CopyButton, cx, Dot, ErrorNote, Pill } from './ui';

type Kind = 'read' | 'search' | 'git' | 'edit' | 'note' | 'other';
const KIND: Record<Kind, { label: string; cls: string }> = {
  read: { label: 'read', cls: 'bg-run' },
  search: { label: 'search', cls: 'bg-sev-low' },
  git: { label: 'git', cls: 'bg-sev-medium' },
  edit: { label: 'edit', cls: 'bg-ok' },
  note: { label: 'thinking', cls: 'bg-line-2' },
  other: { label: 'tool', cls: 'bg-sev-high' },
};
const kindOf = (s: { tool: string; target: string }): Kind =>
  s.tool === 'note' ? 'note' : s.tool === 'Read' ? 'read' : s.tool === 'Grep' || s.tool === 'Glob' ? 'search'
    : /^(Edit|Write|MultiEdit)$/.test(s.tool) ? 'edit' : s.tool === 'Bash' && /^git /.test(s.target) ? 'git' : 'other';

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

      {steps.length > 0 && (
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
          <details className="mt-2" open={run.state === 'running'}>
            <summary className="cursor-pointer text-xs text-ink-2">Event history</summary>
            <ol className="mt-1 max-h-64 overflow-auto border-l border-line pl-3 text-xs">
              {steps.map((s, i) => (
                <li key={i} className="relative py-0.5">
                  <span className={cx('absolute -left-[15px] top-1.5 size-1.5 rounded-full', KIND[s.kind].cls)} />
                  <span className="inline-block w-12 tabular-nums text-ink-3">+{Math.round(s.off / 1000)}s</span>
                  <span className={cx('font-mono', s.kind === 'note' ? 'text-ink-3' : 'text-ink-2')}>{s.kind === 'note' ? '' : `${s.tool} `}</span>
                  <span className={s.kind === 'note' ? 'italic text-ink-3' : ''}>{s.target}</span>
                </li>
              ))}
            </ol>
          </details>
        </div>
      )}

      {run.error && <ErrorNote>{run.error}</ErrorNote>}
      {run.text && <div className="rounded-lg border border-line bg-paper p-4"><MarkdownText src={run.text} path="" /></div>}

      {run.mode === 'propose' && run.state !== 'running' && (
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
