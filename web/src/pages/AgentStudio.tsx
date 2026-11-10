import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { useHub } from '../lib/data';
import { createAgent, since, startAgent, teamAgents, useLive, useLoopApi, useRuns, type TeamAgent } from '../lib/loop';
import { RunView, useRun } from '../components/RunView';
import { CopyButton, cx, Dot, Empty, ErrorNote, Panel, Pill, Segmented, Select, Skeleton } from '../components/ui';

const MODE_HELP: Record<string, string> = {
  ask: 'Reads the code and answers, with path:line evidence.',
  plan: 'Reads, then writes a plan in pull-request-sized steps with verification and rollback.',
  propose: 'Edits an isolated worktree of one repo on a local agent/ branch and shows the diff. Needs a work item in build. Nothing is pushed.',
};

/** Team agents from the local server (live, with clones) or, on a statically served hub, from the synced agentic data. */
function useTeamAgents() {
  const api = useLoopApi();
  const { manifest } = useHub();
  const [live, setLive] = useState<TeamAgent[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (api) teamAgents().then(setLive, (e) => setErr((e as Error).message)); }, [api]);
  const synced = (manifest.agentic?.agents || []).filter((a) => a.team).map((a) => ({
    name: a.name, description: a.description || '', team: a.team!, family: a.family || '', scope: a.scope || [], modes: a.modes || ['ask'],
    starters: a.starters || [], prompt: a.prompt || '', path: a.path || '',
  }));
  return { api, agents: api ? live : synced, err, loading: api === undefined || (!!api && !live && !err) };
}

export function TeamAgents() {
  const { api, agents, err, loading } = useTeamAgents();
  const [params, setParams] = useSearchParams();
  if (loading) return <Skeleton lines={6} />;
  if (err) return <ErrorNote>{err}</ErrorNote>;
  if (!agents?.length) return <Empty>No team agents yet. A team agent is a <code>.claude/agents/&lt;name&gt;.md</code> file with <code>team:</code> in its front matter; create one in <strong>Create an agent</strong>.</Empty>;
  const families = [...new Set(agents.map((a) => a.family || 'Other'))];
  const sel = agents.find((a) => a.name === params.get('a')) || agents[0];
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="space-y-4">
        {families.map((f) => (
          <div key={f}>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">{f}</div>
            <ul className="space-y-1.5">
              {agents.filter((a) => (a.family || 'Other') === f).map((a) => (
                <li key={a.name}>
                  <button type="button" onClick={() => setParams({ a: a.name }, { replace: true })}
                    className={cx('block w-full rounded-lg border px-3 py-2 text-left', a.name === sel.name ? 'border-ink bg-sunk' : 'border-line hover:bg-sunk')}>
                    <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{title(a.name)}</span><span className="text-[11px] text-ink-3">{a.team}</span></div>
                    <div className="mt-0.5 line-clamp-2 text-xs text-ink-3">{a.description.split('. ').slice(1).join('. ') || a.description}</div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="text-xs text-ink-3">Defined in the workspace's <code>.claude/agents/</code>: the same file works in Claude Code ("use the {sel.name} agent to ...") and here.</p>
      </div>
      <div className="min-w-0 space-y-6">
        <AgentCard a={sel} />
        <Launcher key={sel.name} a={sel} api={!!api?.agents} />
      </div>
    </div>
  );
}

const title = (n: string) => n.split('-').map((w) => (w === 'dotnet' ? '.NET' : w[0].toUpperCase() + w.slice(1))).join(' ');

function AgentCard({ a }: { a: TeamAgent }) {
  return (
    <Panel title={<span className="flex flex-wrap items-center gap-2">{title(a.name)}<Pill>{a.team}</Pill>{a.family && <Pill>{a.family}</Pill>}</span>}
      action={<code className="text-[11px] text-ink-3">{a.path}</code>}>
      <p className="text-sm text-ink-2">{a.description}</p>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-[110px_minmax(0,1fr)]">
        <div className="text-ink-3">Modes</div><div className="flex flex-wrap gap-1.5">{a.modes.map((m) => <Pill key={m}>{m}</Pill>)}</div>
        <div className="text-ink-3">Scope</div>
        <div className="flex flex-wrap gap-1.5">{a.scope.map((r) => <code key={r} className={cx('rounded px-1.5 text-xs', a.cloned && !a.cloned.includes(r) ? 'text-ink-3 line-through' : 'bg-sunk')} title={a.cloned && !a.cloned.includes(r) ? 'not cloned on this laptop' : undefined}>{r}</code>)}</div>
        <div className="text-ink-3">Guardrails</div>
        <div className="text-xs text-ink-2">Read, Grep and Glob only (plus edits inside an isolated worktree in propose mode); no shell, no MCP servers; never .env files, keys or test data; 10-minute limit; every run logged on the work item.</div>
      </div>
      <details className="mt-3"><summary className="cursor-pointer text-xs text-ink-2">Instructions the agent follows</summary>
        <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded bg-sunk p-3 text-xs">{a.prompt}</pre>
      </details>
    </Panel>
  );
}

function Launcher({ a, api }: { a: TeamAgent; api: boolean }) {
  const { loop } = useHub();
  const [mode, setMode] = useState(a.modes[0]);
  const repos = a.cloned ?? a.scope;
  const [repo, setRepo] = useState('');
  const [key, setKey] = useState('');
  const [question, setQuestion] = useState('');
  const [ids, setIds] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const open = loop.specs.filter((s) => ['build', 'test', 'deploy', 'maintain'].includes(s.phase) && s.approved.intent && s.approved.spec && s.approved.design);
  const keys = mode === 'propose' ? open : loop.specs;
  const launch = () => {
    setErr(null);
    startAgent({ agent: 'team', name: a.name, mode, repo: repo || undefined, key: key || undefined, question })
      .then((r) => setIds((x) => [r.id, ...x]), (e) => setErr((e as Error).message));
  };
  const cli = `claude ${JSON.stringify(`Use the ${a.name} agent (${mode} mode${repo ? `, ${repo}` : ''}${key ? `, ${key}` : ''}): ${question || '<what you need>'}`)}`;
  return (
    <Panel title="Launch">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented label="Mode" value={mode} onChange={setMode} options={a.modes.map((m) => [m, m] as [string, string])} />
        <Select label="Repository" value={repo} onChange={setRepo} options={[['', mode === 'propose' ? 'pick one' : 'whole scope'], ...repos.map((r) => [r, r] as [string, string])]} />
        <Select label="Work item" value={key} onChange={setKey} options={[['', mode === 'propose' ? 'pick one in build' : 'none'], ...keys.map((s) => [s.key, `${s.key} ${s.title}`.slice(0, 60)] as [string, string])]} />
      </div>
      <p className="mt-2 text-xs text-ink-3">{MODE_HELP[mode]}</p>
      {a.starters.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {a.starters.map((s) => (
            <button key={s} type="button" onClick={() => setQuestion(s)} className="rounded-full border border-line-2 px-2.5 py-0.5 text-left text-xs text-ink-2 hover:border-ink hover:text-ink">{s.length > 90 ? `${s.slice(0, 88)}...` : s}</button>
          ))}
        </div>
      )}
      <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={4} aria-label="Task for the agent" placeholder="What should the agent do?"
        className="mt-3 w-full rounded-md border border-line-2 bg-paper px-3 py-2 text-sm" />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {api ? (
          <button type="button" disabled={!question.trim() || (mode === 'propose' && (!repo || !key))} onClick={launch}
            className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-paper disabled:opacity-50">Launch {title(a.name)}</button>
        ) : (
          <span className="flex flex-wrap items-center gap-2 text-xs text-ink-3">Agents launch from the hub on your laptop. Or in Claude Code: <CopyButton text={cli} /></span>
        )}
        {ids.length > 1 && <span className="text-xs text-ink-3">{ids.length} runs launched; all of them are on Runs.</span>}
      </div>
      {err && <div className="mt-3"><ErrorNote>{err}</ErrorNote></div>}
      {ids[0] && <div className="mt-4"><LiveRunView id={ids[0]} /></div>}
    </Panel>
  );
}

function LiveRunView({ id }: { id: string }) {
  const { run, err } = useRun(id);
  if (err) return <ErrorNote>{err}</ErrorNote>;
  return run ? <RunView run={run} /> : <Skeleton lines={2} />;
}

/** Every run: launched from this hub (live, with their event history) and every subagent the workspace's agent-log hook recorded. */
export function Runs() {
  const api = useLoopApi();
  const live = useLive(!!api?.agents);
  const history = useRuns(!!api, undefined, 10000);
  const [open, setOpen] = useState<string | null>(null);
  const ids = useMemo(() => new Set(live.map((r) => r.id)), [live]);
  if (api === undefined) return <Skeleton lines={4} />;
  if (!api) return <Empty>Runs are recorded on each laptop. Start the hub locally (<code>cd web && npm run dev</code>) to launch agents and watch them here.</Empty>;
  const running = live.filter((r) => r.state === 'running').length;
  return (
    <div className="space-y-6">
      <Panel title={<span className="flex items-center gap-2">Launched from this hub {running > 0 && <Pill tone="run">{running} running</Pill>}</span>}
        action={<span className="text-xs text-ink-3">kept until the hub server restarts</span>}>
        {!live.length ? <p className="text-sm text-ink-3">Nothing launched yet. Pick a team agent and launch it; launch several at once and they run side by side.</p> : (
          <ul className="divide-y divide-line">
            {live.map((r) => (
              <li key={r.id} className="py-2">
                <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="flex w-full flex-wrap items-center gap-2 text-left text-sm">
                  <Dot tone={r.state === 'running' ? 'run' : r.state === 'done' ? 'ok' : 'block'} className={r.state === 'running' ? 'animate-pulse' : undefined} />
                  <span className="font-medium">{r.agent.replace(/^(team|module):/, '')}</span>
                  {r.mode && <Pill>{r.mode}</Pill>}{r.repo && <Pill>{r.repo}</Pill>}{r.key && <Pill>{r.key}</Pill>}
                  <span className="min-w-0 flex-1 truncate text-ink-2">{r.question}</span>
                  <span className="text-xs tabular-nums text-ink-3">{r.steps.filter((s) => s.tool !== 'note').length} calls · {since(r.started, r.ended)}</span>
                </button>
                {open === r.id && <div className="mt-3"><LiveRunView id={r.id} /></div>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="All agent runs on this laptop" action={<span className="text-xs text-ink-3">.claude/state/agent-runs.jsonl</span>}>
        {!history.length ? <p className="text-sm text-ink-3">No runs recorded yet.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-ink-3"><th className="py-1.5 pr-3">State</th><th className="py-1.5 pr-3">Agent</th><th className="py-1.5 pr-3">Work item</th><th className="py-1.5 pr-3">Task</th><th className="py-1.5 pr-3">From</th><th className="py-1.5">Took</th></tr></thead>
            <tbody className="divide-y divide-line">
              {history.slice(0, 60).map((r) => (
                <tr key={r.id} className={ids.has(r.id) ? 'bg-sunk/50' : undefined}>
                  <td className="py-1.5 pr-3"><span className="inline-flex items-center gap-1.5 text-xs"><Dot tone={r.state === 'done' ? 'ok' : r.state === 'running' ? 'run' : 'block'} />{r.state}</span></td>
                  <td className="py-1.5 pr-3 font-mono text-xs">{r.agent.replace(/^team:/, '')}</td>
                  <td className="py-1.5 pr-3 font-mono text-xs">{r.key || ''}</td>
                  <td className="max-w-md truncate py-1.5 pr-3 text-ink-2" title={r.description}>{r.description}</td>
                  <td className="py-1.5 pr-3 text-xs text-ink-3">{r.source === 'hub' ? 'hub' : 'Claude Code'}</td>
                  <td className="py-1.5 text-xs tabular-nums text-ink-3">{since(r.started, r.ended)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Panel>
    </div>
  );
}

const SAMPLE = `You are the <role> for the team.

What you know:
- Where the code for this lives, and the patterns to follow.

How you work:
1. Find ... and cite path:line.
2. ...

Never ...`;

function L({ t, h, children }: { t: string; h?: string; children: ReactNode }) {
  return <label className="block text-sm"><span className="font-medium">{t}</span>{h && <span className="ml-2 text-xs text-ink-3">{h}</span>}<div className="mt-1">{children}</div></label>;
}

export function CreateAgent() {
  const api = useLoopApi();
  const { manifest } = useHub();
  const all = useMemo(() => [...new Set((manifest.agentic?.agents || []).flatMap((a) => a.scope || []))].sort(), [manifest]);
  const [f, setF] = useState({ name: '', description: '', team: '', family: 'Build', scope: '', modes: ['ask'], starters: '', instructions: SAMPLE });
  const [done, setDone] = useState<{ path: string; share: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const list = (s: string, sep = ',') => s.split(sep).map((x) => x.trim()).filter(Boolean);
  const md = ['---', `name: ${f.name}`, `description: ${f.description}`, 'tools: Read, Grep, Glob, Bash', `team: ${f.team}`, `family: ${f.family}`,
    `scope: ${list(f.scope).join(', ')}`, `modes: ${f.modes.join(', ')}`, `starters: ${list(f.starters, '\n').join(' | ')}`, '---', '', f.instructions].join('\n');
  const submit = () => {
    setErr(null);
    createAgent({ ...f, scope: list(f.scope), starters: list(f.starters, '\n') }).then(setDone, (e) => setErr((e as Error).message));
  };
  const input = 'w-full rounded-md border border-line-2 bg-paper px-2.5 py-1.5 text-sm';
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel title="A new team agent">
        <div className="space-y-3">
          <L t="Name" h="lower case and hyphens, e.g. payments-reconciliation"><input value={f.name} onChange={set('name')} className={input} /></L>
          <L t="What it does and when to use it" h="the first line people and Claude read"><textarea value={f.description} onChange={set('description')} rows={2} className={input} /></L>
          <div className="grid gap-3 sm:grid-cols-2">
            <L t="Team"><input value={f.team} onChange={set('team')} placeholder="Payments" className={input} /></L>
            <L t="Family"><select value={f.family} onChange={set('family')} className={input}>{['Build', 'Delivery', 'Operate', 'Harmonization', 'Quality'].map((x) => <option key={x}>{x}</option>)}</select></L>
          </div>
          <L t="Scope" h="repos, comma separated"><input value={f.scope} onChange={set('scope')} list="repos" placeholder="paymentgateway, seta-payment-service" className={input} /></L>
          <datalist id="repos">{all.map((r) => <option key={r} value={r} />)}</datalist>
          <div className="text-sm"><span className="font-medium">Modes</span>
            <div className="mt-1 flex flex-wrap gap-3">{['ask', 'plan', 'propose'].map((m) => (
              <label key={m} className="inline-flex items-center gap-1.5 text-sm"><input type="checkbox" checked={f.modes.includes(m)}
                onChange={(e) => setF({ ...f, modes: e.target.checked ? [...f.modes, m] : f.modes.filter((x) => x !== m) })} />{m}</label>
            ))}</div>
          </div>
          <L t="Starter tasks" h="one per line"><textarea value={f.starters} onChange={set('starters')} rows={3} className={input} /></L>
          <L t="Instructions" h="the role, what it knows, how it works, what it never does"><textarea value={f.instructions} onChange={set('instructions')} rows={12} className={cx(input, 'font-mono text-xs')} /></L>
          {api?.writable ? (
            <button type="button" onClick={submit} disabled={!f.name || !f.description || !f.team}
              className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-paper disabled:opacity-50">Create the agent</button>
          ) : <p className="text-xs text-ink-3">On a statically served hub, copy the file on the right into the workspace's <code>.claude/agents/{f.name || '<name>'}.md</code>.</p>}
          {err && <ErrorNote>{err}</ErrorNote>}
          {done && (
            <div className="rounded-md border border-line p-3 text-sm">
              <p>Created <code>{done.path}</code>. It shows under Team agents now and in Claude Code from the next session. Share it with the team:</p>
              <div className="mt-1"><CopyButton text={done.share} /></div>
            </div>
          )}
        </div>
      </Panel>
      <Panel title="The file" action={<CopyButton text={md} label=".md" />}>
        <pre className="max-h-[48rem] overflow-auto whitespace-pre-wrap rounded bg-sunk p-3 text-xs">{md}</pre>
        <p className="mt-2 text-xs text-ink-3">Good agents are narrow: one role, a named scope, the patterns to follow, evidence for every claim, and a clear "never". Tools stay read-only; propose mode adds edits inside an isolated worktree only.</p>
      </Panel>
    </div>
  );
}
