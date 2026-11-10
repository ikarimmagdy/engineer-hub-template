import { useState } from 'react';
import { Link } from 'react-router';
import { PHASES, PHASE_TITLE, useHub, type LoopConfig, type Phase, type Spec } from '../lib/data';
import { approve, checkSpec, movePhase, nextAction, since, useLoopApi, useRuns, type AgentRun } from '../lib/loop';
import { howRoute } from '../lib/routes';
import { phaseList, phaseWiring } from './Sdlc';
import { CopyButton, cx, Dot, ErrorNote, fmtDate, fmtDateTime, Panel, Pill, type Tone } from './ui';

const RUN_TONE: Record<AgentRun['state'], Tone> = { running: 'run', done: 'ok', failed: 'block', lost: 'wait' };
const APPROVED_IN: Partial<Record<Phase, 'intent' | 'spec' | 'design'>> = { intent: 'intent', spec: 'spec', design: 'design' };

/** Work item tab: the agents each phase hands to the next, the gate to pass now, and the agent runs on this item. */
export function WorkAgents({ spec }: { spec: Spec }) {
  const hub = useHub();
  const api = useLoopApi();
  const runs = useRuns(!!api, spec.key);
  const ag = hub.manifest.agentic;
  const phases = phaseList(hub.manifest.loopConfig) as NonNullable<LoopConfig['phases']>;
  const cur = PHASES.indexOf(spec.phase);
  const wiring = phases.map((p, i) => phaseWiring(ag, p.command, i));
  const phaseOfAgent = (name: string) => wiring.findIndex((w) => w.agents.includes(name));
  const byPhase = phases.map((_, i) => runs.filter((r) => phaseOfAgent(r.agent) === i));
  const other = runs.filter((r) => phaseOfAgent(r.agent) < 0);
  const running = runs.filter((r) => r.state === 'running');

  return (
    <div className="space-y-6">
      <GatePanel spec={spec} api={api} />
      <Panel title="How the agents hand over" action={<span className="text-xs text-ink-3">{running.length ? `${running.length} working now` : api ? 'no agent working now' : 'live runs show on the local hub'}</span>}>
        <ol className="space-y-0">
          {phases.map((p, i) => {
            const state = i < cur ? 'done' : i === cur ? 'now' : 'next';
            const w = wiring[i];
            const appr = APPROVED_IN[p.key as Phase];
            const rec = appr ? spec.approved[appr] : undefined;
            const live = byPhase[i].filter((r) => r.state === 'running');
            return (
              <li key={p.key} className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-3 pb-5 last:pb-0">
                {i < phases.length - 1 && <span aria-hidden className={cx('absolute left-[13px] top-7 bottom-0 w-0.5', i < cur ? 'bg-ok' : 'bg-line')} />}
                <span className={cx('mt-0.5 flex size-7 items-center justify-center rounded-full border-2 text-xs font-semibold',
                  state === 'done' ? 'border-ok bg-ok text-paper' : state === 'now' ? 'border-ink bg-ink text-paper' : 'border-line-2 bg-paper text-ink-3')}>{i + 1}</span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-semibold">{p.title}</span>
                    {p.command.split(/[,\s]+/).filter((c) => c.startsWith('/')).map((c) => (
                      <Link key={c} to={howRoute(c.slice(1))} className="font-mono text-[12px] underline decoration-line-2 underline-offset-4">{c}</Link>
                    ))}
                    {state === 'now' && <Pill tone="run">current</Pill>}
                    {live.length > 0 && <span className="flex items-center gap-1.5 text-xs text-run"><Dot tone="run" className="animate-pulse" />{live.length} working</span>}
                  </div>
                  {p.does && <p className="mt-1 text-sm text-ink-2">{p.does}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {w.agents.length ? w.agents.map((a) => {
                      const r = byPhase[i].find((x) => x.agent === a);
                      return <span key={a} className={cx('rounded-md border px-2 py-0.5 font-mono text-[11.5px]', r?.state === 'running' ? 'border-run text-run' : 'border-line-2 text-ink-2')}>{a}</span>;
                    }) : <span className="text-xs text-ink-3">no subagent: the command does the work</span>}
                    {w.tools.map((t) => <span key={t} className="rounded-md bg-sunk px-2 py-0.5 text-[11.5px] text-ink-3">{t}</span>)}
                  </div>
                  {!!p.files?.length && (
                    <div className="mt-1.5 text-xs text-ink-3">hands over: {p.files.map((f) => <code key={f} className="mr-1.5">{f}</code>)}</div>
                  )}
                  {p.gate && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span aria-hidden className={cx('inline-block size-2.5 rotate-45 border', rec ? 'border-ok bg-ok' : 'border-sev-medium')} />
                      <span className="text-ink-2">Gate: {p.gate}</span>
                      {rec && <span className="text-ok">approved by {rec.by}, {fmtDate(rec.date)}</span>}
                    </div>
                  )}
                  {byPhase[i].length > 0 && <RunList runs={byPhase[i].slice(0, 6)} />}
                </div>
              </li>
            );
          })}
        </ol>
      </Panel>
      {api && (
        <Panel title="Other agent runs on this item">
          {other.length ? <RunList runs={other.slice(0, 15)} /> : <p className="text-sm text-ink-3">None recorded. Subagents started in Claude Code are logged by the workspace's agent-log hook; agents asked from the Agents page with this key show here too.</p>}
        </Panel>
      )}
    </div>
  );
}

function RunList({ runs }: { runs: AgentRun[] }) {
  return (
    <ul className="mt-2 divide-y divide-line rounded-md border border-line">
      {runs.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-1.5 text-xs">
          <Dot tone={RUN_TONE[r.state]} className={r.state === 'running' ? 'animate-pulse' : undefined} />
          <span className="font-mono">{r.agent}</span>
          <span className="min-w-0 flex-1 truncate text-ink-2" title={r.description}>{r.description}</span>
          <span className="text-ink-3" title={fmtDateTime(r.started)}>{r.state === 'running' ? `for ${since(r.started)}` : `${r.state}, ${since(r.started, r.ended)}`}</span>
          {r.source === 'hub' && <span className="text-ink-3">from the hub</span>}
        </li>
      ))}
    </ul>
  );
}

function GatePanel({ spec, api }: { spec: Spec; api: ReturnType<typeof useLoopApi> }) {
  const { manifest } = useHub();
  const act = nextAction(spec);
  const gate = manifest.loopConfig.phases?.find((p) => p.key === spec.phase)?.gate;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [check, setCheck] = useState<string | null>(null);
  if (!act) return null;
  const label = act.kind === 'approve' ? `Approve ${act.what}` : `Move to ${PHASE_TITLE[act.to]}`;
  const cli = act.kind === 'approve' ? `python3 tools/spec.py approve ${spec.key} ${act.what} --by "<your name>"` : `python3 tools/spec.py phase ${spec.key} ${act.to}`;
  const go = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = act.kind === 'approve' ? await approve(spec.key, act.what) : await movePhase(spec.key, act.to);
      setMsg({ ok: true, text: `${r.output}\n${r.note}` });
      setTimeout(() => location.reload(), 1500);
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    setBusy(false);
  };
  return (
    <Panel title={`Gate: leaving ${PHASE_TITLE[spec.phase]}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl text-sm">
          {gate && <p className="text-ink-2">{gate}.</p>}
          <p className="mt-1 text-ink-2">
            {act.kind === 'approve'
              ? <>The {act.what} needs approval before the item moves to the next phase. Read the document first; approving records your name and the date in <code>status.json</code> and shares the work item with the team (commit and push).</>
              : <>The next step is to move to <strong>{PHASE_TITLE[act.to]}</strong>. <code>tools/spec.py</code> refuses if the gate is not met and says why.</>}
          </p>
          {msg && <pre className={cx('mt-3 whitespace-pre-wrap rounded-md p-2.5 text-xs', msg.ok ? 'bg-sunk text-ink-2' : 'bg-block/10 text-block')}>{msg.text}</pre>}
          {check && <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-sunk p-2.5 text-xs text-ink-2">{check}</pre>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {api ? (
            <>
              <button type="button" disabled={busy} onClick={go} className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-paper disabled:opacity-50">
                {busy ? 'Working' : label}{act.kind === 'approve' && api.approver ? ` as ${api.approver}` : ''}
              </button>
              <button type="button" className="text-xs underline" onClick={() => checkSpec(spec.key).then((r) => setCheck(r.output || 'No problems.'), (e) => setCheck((e as Error).message))}>Check the spec first</button>
            </>
          ) : api === null ? (
            <div className="text-right text-xs text-ink-3">
              <div>Approve from the hub on your laptop (<code>cd web && npm run dev</code>), or run:</div>
              <div className="mt-1 flex items-center justify-end gap-2"><code className="text-ink-2">{cli}</code><CopyButton text={cli} /></div>
            </div>
          ) : null}
        </div>
      </div>
      {msg && !msg.ok && <ErrorNote>Nothing changed.</ErrorNote>}
    </Panel>
  );
}
