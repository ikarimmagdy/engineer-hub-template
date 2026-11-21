import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { PHASES, PHASE_TITLE, useHub, type Agentic, type LoopConfig, type Phase, type Spec } from '../lib/data';
import { approve, checkSpec, movePhase, phaseOfRun, rerunPhase, since, useLoopApi, useRuns, type AgentRun, type LoopApi } from '../lib/loop';
import { howRoute } from '../lib/routes';
import { phaseState } from './PhaseNav';
import { phaseList, phaseWiring } from './Sdlc';
import { RunList } from './Handover';
import { RunView, useRun } from './RunView';
import { PhaseVisual } from './PhaseVisual';
import { CopyButton, cx, Dot, Panel, Pill } from './ui';

type PhaseCfg = NonNullable<LoopConfig['phases']>[number];
const GATE_OF: Partial<Record<Phase, 'intent' | 'spec' | 'design'>> = { intent: 'intent', spec: 'spec', design: 'design' };
const cmdsOf = (p: PhaseCfg) => p.command.split(/[,\s]+/).filter((c) => c.startsWith('/'));

/** Work item: the whole loop as one cycle (where the work is, who works on each step), and the selected step's agents, blocks and actions. */
export function LoopCycle({ spec }: { spec: Spec }) {
  const hub = useHub();
  const api = useLoopApi();
  const runs = useRuns(!!api, spec.key);
  const phases = phaseList(hub.manifest.loopConfig) as PhaseCfg[];
  const wiring = phases.map((p, i) => phaseWiring(hub.manifest.agentic, p.command, i));
  const cur = PHASES.indexOf(spec.phase);
  const byPhase = phases.map((_, i) => runs.filter((r) => phaseOfRun(r.agent, phases, wiring) === i));
  const [sel, setSel] = useState(cur);
  const working = runs.filter((r) => r.state === 'running').length;

  return (
    <Panel title="Where this work is in the loop" action={<span className="text-xs text-ink-3">{working ? `${working} agents working now` : api ? 'no agent working now' : 'live agents show on the local hub'}</span>}>
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <ol className="relative grid min-w-[880px] grid-cols-7 gap-2">
          {phases.map((p, i) => {
            const st = phaseState(spec, p.key as Phase);
            const live = byPhase[i].filter((r) => r.state === 'running');
            const last = byPhase[i].find((r) => r.state !== 'running');
            const agents = wiring[i].agents;
            const gate = GATE_OF[p.key as Phase];
            return (
              <li key={p.key} className="relative min-w-0">
                {i < phases.length - 1 && <span aria-hidden className={cx('absolute left-[calc(50%+18px)] right-[calc(-50%+18px)] top-[17px] h-0.5', i < cur ? 'bg-ok' : 'bg-line-2')} />}
                <button type="button" onClick={() => setSel(i)} aria-pressed={sel === i}
                  className={cx('group flex w-full flex-col items-center rounded-lg px-1.5 pb-2 pt-0 text-center', sel === i ? 'bg-sunk' : 'hover:bg-sunk/60')}>
                  <span className={cx('relative z-10 flex size-9 items-center justify-center rounded-full border-2 text-sm font-semibold',
                    st.state === 'done' ? 'border-ok bg-ok text-paper' : st.state === 'now' ? 'border-brand bg-brand text-paper' : 'border-line-2 bg-paper text-ink-3')}>
                    {st.state === 'done' ? '✓' : i + 1}
                    {live.length > 0 && <span className="absolute -right-1 -top-1 size-3 animate-pulse rounded-full border-2 border-paper bg-run" />}
                  </span>
                  <span className={cx('mt-1.5 text-sm', st.state === 'now' ? 'font-semibold text-ink' : 'text-ink-2')}>{p.title}</span>
                  <span className="text-[11px] leading-tight text-ink-3">{st.note}</span>
                  {gate && !st.approval && <span className={cx('mt-1 text-[10.5px]', st.state === 'now' ? 'text-sev-medium' : 'text-ink-3')}>◇ {st.state === 'now' ? `needs ${gate} approval` : `${gate} gate`}</span>}
                  <span className="mt-1.5 flex flex-wrap justify-center gap-1">
                    {agents.slice(0, 2).map((a) => (
                      <span key={a} className={cx('max-w-full truncate rounded border px-1 font-mono text-[10px]', live.some((r) => r.agent === a) ? 'border-run text-run' : 'border-line text-ink-3')}>{a}</span>
                    ))}
                    {agents.length > 2 && <span className="text-[10px] text-ink-3">+{agents.length - 2}</span>}
                    {!agents.length && <span className="text-[10px] text-ink-3">{cmdsOf(p)[0] || ''}</span>}
                  </span>
                  {live.length > 0 ? <span className="mt-1 text-[10.5px] text-run">{live.length} working</span>
                    : last ? <span className={cx('mt-1 text-[10.5px]', last.state === 'failed' ? 'text-block' : 'text-ink-3')}>last run {last.state}, {since(last.ended || last.started)} ago</span> : null}
                </button>
              </li>
            );
          })}
        </ol>
        <div aria-hidden className="mx-[7%] -mt-1 flex min-w-[820px] items-center gap-2 text-[11px] text-ink-3">
          <span className="h-3 flex-1 rounded-b-xl border-x-2 border-b-2 border-dashed border-line-2" />
        </div>
        <p className="min-w-[820px] text-center text-[11px] text-ink-3">Maintain feeds back: a new need becomes a new intent</p>
      </div>
      <StepDetail key={sel} spec={spec} phases={phases} i={sel} cur={cur} runs={byPhase[sel]} api={api} />
    </Panel>
  );
}

function StepDetail({ spec, phases, i, cur, runs, api }: { spec: Spec; phases: PhaseCfg[]; i: number; cur: number; runs: AgentRun[]; api: LoopApi | null | undefined }) {
  const hub = useHub();
  const p = phases[i];
  const [view, setView] = useState<'agents' | 'blocks' | 'diagrams'>('agents');
  const w = phaseWiring(hub.manifest.agentic, p.command, i);
  const gate = GATE_OF[p.key as Phase];
  const rec = gate ? spec.approved[gate] : undefined;
  return (
    <div className="mt-4 rounded-lg border border-line p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="text-base font-semibold">Step {i + 1} · {p.title}</h3>
            {cmdsOf(p).map((c) => <Link key={c} to={howRoute(c.slice(1))} className="font-mono text-[12px] underline decoration-line-2 underline-offset-4">{c}</Link>)}
            {i === cur && <Pill tone="run">current</Pill>}
          </div>
          {p.does && <p className="mt-1 text-sm text-ink-2">{p.does}</p>}
          {p.gate && (
            <p className="mt-1.5 flex items-center gap-2 text-xs">
              <span aria-hidden className={cx('inline-block size-2.5 rotate-45 border', rec ? 'border-ok bg-ok' : 'border-sev-medium')} />
              <span className="text-ink-2">Gate: {p.gate}</span>{rec && <span className="text-ok">approved by {rec.by}, {rec.date}</span>}
            </p>
          )}
          {!!p.files?.length && <p className="mt-1 text-xs text-ink-3">hands over: {p.files.map((f) => <code key={f} className="mr-1.5">{f}</code>)}</p>}
        </div>
        <StepActions spec={spec} phases={phases} i={i} cur={cur} api={api} />
      </div>
      <div className="mt-4 flex items-center gap-1 border-b border-line text-sm">
        {([['agents', `Who works on it${runs.length ? ` · ${runs.length} runs` : ''}`], ['blocks', 'Building blocks'], ['diagrams', `Diagrams${spec.diagrams?.[p.key as Phase] ? '' : ' (none yet)'}`]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setView(k)} aria-pressed={view === k}
            className={cx('-mb-px border-b-2 px-3 py-1.5', view === k ? 'border-ink font-medium text-ink' : 'border-transparent text-ink-3 hover:text-ink')}>{l}</button>
        ))}
      </div>
      {view === 'agents' ? (
        <div className="pt-3">
          <div className="flex flex-wrap gap-1.5">
            {w.agents.length ? w.agents.map((a) => {
              const live = runs.some((r) => r.agent === a && r.state === 'running');
              return <span key={a} className={cx('rounded-md border px-2 py-0.5 font-mono text-[11.5px]', live ? 'border-run text-run' : 'border-line-2 text-ink-2')}>{live && <Dot tone="run" className="mr-1 animate-pulse" />}{a}</span>;
            }) : <span className="text-xs text-ink-3">No subagent: the command itself does the work.</span>}
            {w.tools.map((t) => <span key={t} className="rounded-md bg-sunk px-2 py-0.5 text-[11.5px] text-ink-3">{t}</span>)}
          </div>
          {runs.length ? <RunList runs={runs.slice(0, 8)} /> : <p className="mt-2 text-xs text-ink-3">{api ? 'No runs recorded for this step yet.' : 'Runs on this step show on the local hub.'}</p>}
        </div>
      ) : view === 'blocks' ? <StepBlocks ag={hub.manifest.agentic} p={p} i={i} spec={spec} /> : <div className="pt-3"><PhaseVisual spec={spec} phase={p.key as Phase} /></div>}
    </div>
  );
}

/** What can be done on a step: approve its gate, move on, check, run its command again, send the work back or reopen a done step. */
function StepActions({ spec, phases, i, cur, api }: { spec: Spec; phases: PhaseCfg[]; i: number; cur: number; api: LoopApi | null | undefined }) {
  const p = phases[i];
  const phase = p.key as Phase;
  const gate = GATE_OF[phase];
  const approved = gate ? !!spec.approved[gate] : true;
  const now = i === cur, done = i < cur;
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ ok: boolean; text: string } | null>(null);
  const [ask, setAsk] = useState<null | { kind: 'rerun'; cmd: string } | { kind: 'back' | 'reopen'; to: Phase }>(null);
  const [note, setNote] = useState('');
  const [runId, setRunId] = useState<string | null>(null);
  const rerun = cmdsOf(p).filter((c) => (api?.rerun || []).includes(c));
  const terminal = cmdsOf(p).filter((c) => !rerun.includes(c));
  if (!now && !done) return <p className="max-w-xs text-right text-xs text-ink-3">Not reached yet. Its actions open when the work gets here.</p>;

  const act = async (fn: () => Promise<{ output?: string; note?: string }>, reload: boolean) => {
    setBusy(true); setOut(null);
    try {
      const r = await fn();
      setOut({ ok: true, text: [r.output, r.note].filter(Boolean).join('\n') || 'Done.' });
      if (reload) setTimeout(() => location.reload(), 1500);
    } catch (e) { setOut({ ok: false, text: `${(e as Error).message}\nNothing changed.` }); }
    setBusy(false);
  };
  const confirm = () => {
    if (!ask) return;
    if (ask.kind === 'rerun') {
      setBusy(true); setOut(null);
      rerunPhase(spec.key, ask.cmd, note).then((r) => { setRunId(r.id); setAsk(null); setNote(''); }, (e) => setOut({ ok: false, text: (e as Error).message })).finally(() => setBusy(false));
    } else act(() => movePhase(spec.key, ask.to, note), true);
  };
  const next = PHASES[i + 1] as Phase | undefined;
  const prev = PHASES[i - 1] as Phase | undefined;
  const btn = (label: ReactNode, onClick: () => void, primary = false, title?: string) => (
    <button type="button" disabled={busy || !api} onClick={onClick} title={title}
      className={cx('rounded-md px-3 py-1.5 text-sm disabled:opacity-50', primary ? 'bg-ink font-medium text-paper' : 'border border-line-2 bg-paper text-ink hover:border-ink')}>{label}</button>
  );

  if (api === null) {
    const cli = now && gate && !approved ? `python3 tools/spec.py approve ${spec.key} ${gate} --by "<your name>"` : now && next ? `python3 tools/spec.py phase ${spec.key} ${next}` : `${cmdsOf(p)[0] || ''} ${spec.key}`;
    return (
      <div className="max-w-sm text-right text-xs text-ink-3">
        <div>Actions run on the hub on your laptop (<code>cd web && npm run dev</code>). From the terminal:</div>
        <div className="mt-1 flex items-center justify-end gap-2"><code className="text-ink-2">{cli}</code><CopyButton text={cli} /></div>
      </div>
    );
  }
  return (
    <div className="flex max-w-md shrink-0 flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {now && gate && !approved && btn(<>Approve {gate}{api?.approver ? ` as ${api.approver}` : ''}</>, () => act(() => approve(spec.key, gate), true), true)}
        {now && approved && next && btn(<>Accept, move to {PHASE_TITLE[next]}</>, () => act(() => movePhase(spec.key, next), true), true)}
        {now && btn('Revalidate', () => act(() => checkSpec(spec.key).then((r) => ({ output: r.output || 'No problems: the work item meets the gates of its phase.' })), false), false, 'tools/spec.py check: does the work item meet the gates of its phase?')}
        {rerun.map((c) => <span key={c}>{btn(<>Rerun {c}</>, () => { setAsk({ kind: 'rerun', cmd: c }); setNote(''); }, false, `Run ${c} again; it writes only inside the work item, and you review the result before approving.`)}</span>)}
        {now && prev && btn(<>Send back to {PHASE_TITLE[prev]}</>, () => { setAsk({ kind: 'back', to: prev }); setNote(''); })}
        {done && btn(<>Reopen {p.title}</>, () => { setAsk({ kind: 'reopen', to: phase }); setNote(''); }, false, `Move the work item back to ${p.title}; approvals stay recorded.`)}
      </div>
      {terminal.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-ink-3">
          <span>In the terminal:</span>{terminal.map((c) => <CopyButton key={c} text={`${c} ${spec.key}`} />)}
        </div>
      )}
      {ask && (
        <div className="w-full rounded-md border border-line-2 bg-sunk p-3 text-left text-sm">
          <label className="block text-xs text-ink-2">
            {ask.kind === 'rerun' ? `What should ${ask.cmd} change? (optional; it keeps what is still right)` : ask.kind === 'back' ? `Why send ${spec.key} back to ${PHASE_TITLE[ask.to]}? (recorded in the history)` : `Why reopen ${PHASE_TITLE[ask.to]}? (recorded in the history)`}
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={ask.kind === 'rerun' ? 1000 : 300} className="mt-1 w-full rounded-md border border-line-2 bg-paper px-2 py-1 text-sm" />
          </label>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" className="text-xs underline" onClick={() => setAsk(null)}>Cancel</button>
            <button type="button" disabled={busy || (ask.kind !== 'rerun' && !note.trim())} onClick={confirm} className="rounded-md bg-ink px-3 py-1 text-xs font-medium text-paper disabled:opacity-50">
              {ask.kind === 'rerun' ? `Run ${ask.cmd}` : ask.kind === 'back' ? 'Send back' : 'Reopen'}
            </button>
          </div>
        </div>
      )}
      {out && <pre className={cx('w-full max-h-56 overflow-auto whitespace-pre-wrap rounded-md p-2.5 text-left text-xs', out.ok ? 'bg-sunk text-ink-2' : 'bg-block/10 text-block')}>{out.text}</pre>}
      {runId && <RerunView id={runId} />}
    </div>
  );
}

function RerunView({ id }: { id: string }) {
  const { run, err } = useRun(id);
  if (err) return <p className="text-xs text-block">{err}</p>;
  if (!run) return <p className="text-xs text-ink-3">Starting…</p>;
  return (
    <div className="w-full text-left">
      <p className="mb-2 text-xs text-ink-2">
        {run.state === 'running' ? 'Running; the result shows here.' : run.state === 'done' ? 'Done. Review the changed documents on their tabs, then approve or rerun. Nothing is shared until a gate is approved.' : 'The run failed; nothing to approve.'}
      </p>
      <RunView run={run} />
    </div>
  );
}

type Kind = 'you' | 'context' | 'model' | 'enforced' | 'system';
const BOX: Record<Kind, string> = {
  you: 'border-ink bg-paper', context: 'border-line-2 bg-sunk', model: 'border-run bg-run/10', enforced: 'border-ok bg-ok/10', system: 'border-brand bg-brand/10',
};
function Box({ kind, t, d, to }: { kind: Kind; t: ReactNode; d?: ReactNode; to?: string }) {
  const body = <><div className="text-[13px] font-semibold leading-tight break-words">{t}</div>{d && <div className="mt-0.5 text-[11px] leading-snug text-ink-3 break-words">{d}</div>}</>;
  return to ? <Link to={to} className={cx('block rounded-lg border px-2.5 py-2 hover:shadow-sm', BOX[kind])}>{body}</Link> : <div className={cx('rounded-lg border px-2.5 py-2', BOX[kind])}>{body}</div>;
}

/** The building blocks one step uses, read from the workspace's .claude wiring: never a hand-written list. */
export function stepBlocks(ag: Agentic | undefined, p: PhaseCfg, i: number) {
  if (!ag) return null;
  const names = cmdsOf(p);
  const cmds = ag.commands.filter((c) => c.phase === i + 1 || names.includes(c.name));
  const agents = [...new Set(cmds.flatMap((c) => c.agents))].map((n) => ag.agents.find((a) => a.id === `agent:${n}`) || { id: `agent:${n}`, name: n });
  const toolIds = [...new Set([...cmds.flatMap((c) => c.tools), ...agents.flatMap((a) => a.mcp || [])])];
  const tools = toolIds.map((t) => ag.tools.find((x) => x.id === `tool:${t}`) || { id: `tool:${t}`, name: t });
  const ids = new Set([...cmds.map((c) => c.id), ...agents.map((a) => a.id)]);
  const skills = ag.skills.filter((s) => ag.edges.some(([a, b]) => ids.has(a) && b === s.id));
  const files = [...new Set(cmds.flatMap((c) => c.files))].map((f) => ag.files.find((x) => x.id === `file:${f}`) || { id: `file:${f}`, name: f });
  // a hook joins the step when its matcher matches a tool the step uses: every step writes files, subagents start through Task
  const probe = ['Edit', 'Write', ...(agents.length ? ['Task', 'Agent'] : []), ...toolIds.map((t) => `mcp__${t}__call`)];
  const fires = (m?: string) => { try { const re = new RegExp(`^(?:${m || '.*'})$`); return probe.some((x) => re.test(x)); } catch { return false; } };
  const hooks = ag.hooks.filter((h) => /PreToolUse|PostToolUse/.test(h.event || '') && fires(h.matcher));
  const session = ag.hooks.filter((h) => /SessionStart|UserPromptSubmit/.test(h.event || ''));
  return { cmds, agents, tools, skills, files, hooks, session, rules: ag.rules.length, constitution: ag.constitution?.length || 0 };
}

function StepBlocks({ ag, p, i, spec }: { ag: Agentic | undefined; p: PhaseCfg; i: number; spec: Spec }) {
  const b = stepBlocks(ag, p, i);
  if (!b) return <p className="pt-3 text-sm text-ink-3">The workspace's .claude wiring is not in this hub (run sync.sh).</p>;
  const col = (title: string, children: ReactNode) => (
    <div className="min-w-0 space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{title}</div>
      {children}
    </div>
  );
  const arrow = <div aria-hidden className="hidden items-center justify-center text-lg text-ink-3 lg:flex">→</div>;
  return (
    <div className="pt-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_16px_minmax(0,1fr)_16px_minmax(0,1fr)_16px_minmax(0,1fr)_16px_minmax(0,1fr)]">
        {col('You and context', <>
          <Box kind="you" t="You" d={<>run <code>{cmdsOf(p)[0] || p.title} {spec.key}</code> or a button above</>} />
          <Box kind="context" t="CLAUDE.md, rules, memory" d={`${b.rules} path rules${b.constitution ? `, ${b.constitution} constitution files` : ''}; always loaded`} />
          {b.session.map((h) => <Box key={h.id} kind="context" t={h.name} d={`${h.event} hook`} />)}
        </>)}
        {arrow}
        {col('Recipe', <>
          {b.cmds.length ? b.cmds.map((c) => <Box key={c.id} kind="context" t={c.name} d={c.path} to={howRoute(c.name.slice(1))} />) : <Box kind="context" t="No command file" d="loop-config names none for this step" />}
          {b.skills.map((s) => <Box key={s.id} kind="context" t={s.name} d="skill, loaded on demand" />)}
        </>)}
        {arrow}
        {col('Model and subagents', <>
          <Box kind="model" t="The model" d="plans each next step" />
          {b.agents.map((a) => <Box key={a.id} kind="enforced" t={a.name} d={['tools' in a && a.tools ? `tools: ${a.tools}` : '', 'mcp' in a && a.mcp?.length ? `MCP: ${a.mcp.join(', ')}` : ''].filter(Boolean).join(' · ') || 'subagent'} />)}
        </>)}
        {arrow}
        {col('Enforced', <>
          <Box kind="enforced" t="Settings" d="allow / deny per tool" />
          {b.hooks.length ? b.hooks.map((h) => <Box key={h.id} kind="enforced" t={h.name} d={`${h.event}${h.matcher ? ` on ${h.matcher}` : ''}`} />) : <Box kind="enforced" t="No tool hook" d="no hook matches this step's tools" />}
        </>)}
        {arrow}
        {col('Reach and output', <>
          {b.tools.map((t) => <Box key={t.id} kind="system" t={t.name} d={'description' in t && t.description ? t.description : 'tool'} />)}
          {b.files.map((f) => <Box key={f.id} kind="context" t={f.name} d="hands over to the next step" />)}
        </>)}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-3">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-sm border border-line-2 bg-sunk" />context: steers the model</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-sm border border-ok bg-ok/10" />enforced: holds whatever the model decides</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-sm border border-run bg-run/10" />the model</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-sm border border-brand bg-brand/10" />what it reaches</span>
        <Link to="/agents/how" className="underline decoration-line-2 underline-offset-4">How the blocks work</Link>
      </div>
    </div>
  );
}
