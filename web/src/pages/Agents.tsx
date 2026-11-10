import { useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';
import { getJson, useAsync, useHub } from '../lib/data';
import { startAgent, useLoopApi, useRuns } from '../lib/loop';
import { RunView, useRun } from '../components/RunView';
import { CreateAgent, Runs, TeamAgents } from './AgentStudio';
import { AgentsHow, HOW_TABS } from './AgentsHow';
import { howRoute } from '../lib/routes';
import { CopyButton, cx, Dot, Empty, ErrorNote, PageHeader, Panel, Pill, Skeleton, TabBar } from '../components/ui';

/** A module's knowledge pack (tools/sync_modules.py): where the agent starts looking; the code is the truth. */
interface Module {
  id: string; name: string; group: string; stack: string; default: string; production: string; branch: string;
  head: { sha: string; date: string; subject: string }; summary: string; files: number;
  folders: { name: string; files: number }[]; languages: { name: string; files: number }[]; entryPoints: string[];
  routes: number; routeFiles: { path: string; routes: number }[]; tests: number;
  runtime?: { runtime: string; port: string; run: string; tests: string; source: string } | null;
  component?: { id: string; name: string; layer: string; summary: string }; talksTo?: string[]; calledBy?: string[];
  changedBy?: { key: string; change: string; summary: string }[];
}

const VIEWS = [['team', 'Team agents'], ['runs', 'Runs'], ['create', 'Create an agent'], ['modules', 'Module agents'], ['oncall', 'On-call agent'], ['mcp', 'MCP servers'], ['how', 'How agents work']] as const;
// ADR 0029: the MCP guide is split into parts, each its own route under /agents/mcp/<part>
const MCP_TABS = [['servers', 'Our servers'], ['what', 'What and when'], ['design', 'Designing tools'], ['build', 'Build and test'], ['ship', 'Register and secure']] as const;

export function Agents() {
  const { view, sub } = useParams();
  const [qs] = useSearchParams();
  if (!view) return <Navigate to="/agents/team" replace />;
  if (view === 'mcp' && !sub) return <Navigate to="/agents/mcp/servers" replace />;
  if (view === 'how' && !sub) return <Navigate to="/agents/how/blocks" replace />;
  if (view === 'team' && !sub) return <Navigate to={`/agents/team/launch${qs.toString() ? `?${qs}` : ''}`} replace />;
  if (view === 'build-mcp') return <Navigate to="/agents/mcp/what" replace />;
  if (!VIEWS.some(([v]) => v === view)) return <Navigate to="/agents" replace />;
  return (
    <div>
      <PageHeader title="Agents" lede="The agent studio: launch a team agent to investigate, plan or propose a change, watch every step it takes, create agents for your team, and ask any module or the on-call agent." />
      <TabBar label="Agents" className="mb-6" tabs={VIEWS.map(([v, l]) => ({ to: `/agents/${v}`, label: l }))} />
      {view === 'team' && <TeamAgents />}
      {view === 'runs' && <Runs />}
      {view === 'create' && <CreateAgent />}
      {view === 'modules' && <Modules />}
      {view === 'oncall' && <OnCall />}
      {view === 'mcp' && <>
        <TabBar label="MCP" className="mb-5" tabs={MCP_TABS.map(([t, l]) => ({ to: `/agents/mcp/${t}`, label: l }))} />
        {sub === 'servers' ? <McpServers /> : <BuildMcp part={sub!} />}
      </>}
      {view === 'how' && <>
        <TabBar label="How agents work" className="mb-5" tabs={HOW_TABS.map(([t, l]) => ({ to: `/agents/how/${t}`, label: l }))} />
        <AgentsHow tab={sub!} />
      </>}
    </div>
  );
}

function useModules() {
  return useAsync(() => getJson<{ modules: Module[] }>('content/data/modules.json').then((d) => d.modules), []);
}

function Modules() {
  const mods = useModules();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const list = useMemo(() => (mods.data || []).filter((m) => !q || `${m.name} ${m.stack} ${m.component?.layer || m.group}`.toLowerCase().includes(q.toLowerCase())), [mods.data, q]);
  if (mods.loading) return <Skeleton lines={6} />;
  if (mods.error || !mods.data?.length) return <Empty>No knowledge packs yet. Run the hub's <code>sync.sh</code>: it builds one per repo cloned under the workspace's <code>code/</code>.</Empty>;
  const sel = mods.data.find((m) => m.id === params.get('m')) || mods.data[0];
  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter modules" aria-label="Filter modules"
          className="mb-2 w-full rounded-md border border-line-2 bg-paper px-2.5 py-1.5 text-sm" />
        <ul className="max-h-[70vh] overflow-auto rounded-lg border border-line">
          {list.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => setParams({ m: m.id }, { replace: true })}
                className={cx('block w-full border-b border-line px-3 py-2 text-left last:border-0', m.id === sel.id ? 'bg-sunk' : 'hover:bg-sunk')}>
                <div className="text-sm font-medium">{m.name}</div>
                <div className="truncate text-xs text-ink-3">{m.component?.layer || m.group} · {m.stack}</div>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink-3">{mods.data.length} modules with a clone on this laptop.</p>
      </div>
      <div className="min-w-0 space-y-6">
        <ModulePack m={sel} />
        <AskBox key={sel.id} agent="module" module={sel.id} title={`Ask the ${sel.name} agent`}
          placeholder={`For example: where is the request validated, which settings does it read, what calls ${sel.talksTo?.[0] || 'the next service'}?`} />
      </div>
    </div>
  );
}

function ModulePack({ m }: { m: Module }) {
  const row = (k: string, v: ReactNode) => v ? <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-3 py-1.5 text-sm"><dt className="text-ink-3">{k}</dt><dd className="min-w-0">{v}</dd></div> : null;
  return (
    <Panel title={<span className="flex items-center gap-2">{m.name}<Pill>{m.component?.layer || m.group}</Pill></span>}
      action={<span className="text-xs text-ink-3">knowledge pack, rebuilt on every sync</span>}>
      {(m.component?.summary || m.summary) && <p className="mb-2 text-sm text-ink-2">{m.component?.summary || m.summary}</p>}
      <dl className="divide-y divide-line">
        {row('Stack', m.stack)}
        {row('Branch', <><code>{m.branch}</code> · {m.head.sha} {m.head.date} <span className="text-ink-3">{m.head.subject}</span></>)}
        {row('Runtime', m.runtime && <>{m.runtime.runtime} · port {m.runtime.port} · run {m.runtime.run}</>)}
        {row('Size', `${m.files} files · ${m.routes} API routes · ${m.tests} test files`)}
        {row('Languages', m.languages.map((l) => `${l.name} ${l.files}`).join(', '))}
        {row('Folders', m.folders.slice(0, 8).map((f) => <code key={f.name} className="mr-2">{f.name}/ <span className="text-ink-3">{f.files}</span></code>))}
        {row('Entry points', m.entryPoints.slice(0, 6).map((e) => <code key={e} className="mr-2 block truncate">{e}</code>))}
        {row('Most routes', m.routeFiles.slice(0, 5).map((r) => <code key={r.path} className="block truncate">{r.path} <span className="text-ink-3">{r.routes}</span></code>))}
        {row('Calls', m.talksTo?.join(', '))}
        {row('Called by', m.calledBy?.join(', '))}
        {row('Changed by', m.changedBy?.length ? m.changedBy.map((c) => <Link key={c.key + c.summary} to={`/work/${c.key}/impact`} className="mr-2 font-mono text-[12px] underline">{c.key}</Link>) : null)}
      </dl>
    </Panel>
  );
}

function OnCall() {
  const { loop } = useHub();
  const [key, setKey] = useState('');
  return (
    <div className="space-y-6">
      <Panel title="How the on-call agent works">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-2">
          <li>Names the components most likely involved, from the call paths in the system map.</li>
          <li>Checks what changed recently: git history of those repos and the work items in build or deploy.</li>
          <li>Follows the code path and its error handling, citing file and line.</li>
          <li>Ranks the likely causes, lists read-only diagnostic steps for you to run, and the mitigation options.</li>
        </ol>
        <p className="mt-2 text-xs text-ink-3">It only reads: code, runbooks, the configuration catalog and the system model. It never runs commands against an environment and never reads secrets or test data.</p>
      </Panel>
      <label className="flex items-center gap-2 text-sm"><span className="text-ink-3">Related work item</span>
        <select value={key} onChange={(e) => setKey(e.target.value)} className="rounded-md border border-line-2 bg-paper px-2 py-1 text-sm">
          <option value="">none</option>
          {loop.specs.map((s) => <option key={s.key} value={s.key}>{s.key} {s.title}</option>)}
        </select>
      </label>
      <AskBox agent="oncall" workKey={key || undefined} title="Describe the symptom or paste the alert"
        placeholder="For example: KSA users get 'something went wrong' after the OTP step since 10:00; proxy logs show 502 from Selfcare." />
    </div>
  );
}

function AskBox({ agent, module, workKey, title, placeholder }: { agent: 'oncall' | 'module'; module?: string; workKey?: string; title: string; placeholder: string }) {
  const api = useLoopApi();
  const [question, setQuestion] = useState('');
  const [runId, setRunId] = useState<string | null>(null);
  const { run, err: runErr } = useRun(runId);
  const [startErr, setErr] = useState<string | null>(null);
  const err = startErr || runErr;
  const ask = () => {
    setErr(null);
    startAgent({ agent, module, question, key: workKey }).then((r) => setRunId(r.id), (e) => setErr((e as Error).message));
  };
  const cli = `claude -p ${JSON.stringify(question || '<your question>')} --allowedTools Read Grep Glob`;
  return (
    <Panel title={title}>
      <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={4} placeholder={placeholder} aria-label={title}
        className="w-full rounded-md border border-line-2 bg-paper px-3 py-2 text-sm" />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {api?.agents ? (
          <button type="button" disabled={!question.trim() || run?.state === 'running'} onClick={ask}
            className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-paper disabled:opacity-50">{run?.state === 'running' ? 'Working' : 'Ask'}</button>
        ) : api === undefined ? null : (
          <span className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
            {api ? 'Claude Code is not installed on this laptop.' : 'Agents run from the hub on your laptop (cd web && npm run dev). Or in a terminal:'}
            <code className="text-ink-2">{cd(agent, module)}{cli}</code><CopyButton text={`${cd(agent, module)}${cli}`} />
          </span>
        )}
        <span className="text-xs text-ink-3">Read-only: Read, Grep and Glob, no shell, no MCP servers. Recent commits are given to the agent.</span>
      </div>
      {err && <div className="mt-3"><ErrorNote>{err}</ErrorNote></div>}
      {run && <div className="mt-4"><RunView run={run} /></div>}
      <RecentRuns agent={agent === 'module' ? `module:${module}` : 'oncall'} />
    </Panel>
  );
}

const cd = (agent: string, module?: string) => (agent === 'module' && module ? `cd code/${module} && ` : '');

function RecentRuns({ agent }: { agent: string }) {
  const api = useLoopApi();
  const runs = useRuns(!!api, undefined, 10000).filter((r) => r.agent === agent).slice(0, 5);
  if (!runs.length) return null;
  return (
    <div className="mt-4 text-xs">
      <div className="mb-1 text-ink-3">Asked recently</div>
      <ul className="space-y-0.5">{runs.map((r) => <li key={r.id} className="truncate text-ink-2" title={r.description}><Dot tone={r.state === 'done' ? 'ok' : r.state === 'running' ? 'run' : 'block'} /> {r.description}</li>)}</ul>
    </div>
  );
}

function McpServers() {
  const { manifest } = useHub();
  const servers = manifest.agentic?.mcpServers;
  if (!servers?.length) return <Empty>The workspace configures no MCP servers, or the hub was synced before the catalog existed. Run <code>sync.sh</code>.</Empty>;
  return (
    <div>
      <p className="mb-4 max-w-3xl text-sm text-ink-2">Each server gives the agents tools for one system. They are configured in the workspace's <code>.mcp.json</code> (shared with everyone who clones it) or as a Claude Code plugin. Sign-in is per person: an agent sees only what you can see.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {servers.map((s) => (
          <div key={s.name} className="rounded-lg border border-line bg-paper p-4">
            <div className="flex flex-wrap items-center gap-2"><span className="font-mono font-semibold">{s.name}</span><Pill>{s.transport}</Pill></div>
            {s.for && <p className="mt-1.5 text-sm text-ink-2">{s.for}</p>}
            <dl className="mt-2 space-y-1 text-xs">
              <div className="flex gap-2"><dt className="w-20 shrink-0 text-ink-3">{s.transport === 'plugin' ? 'Repository' : s.transport === 'http' ? 'Endpoint' : 'Runs'}</dt><dd className="min-w-0 break-all font-mono">{s.endpoint}</dd></div>
              {s.signIn && <div className="flex gap-2"><dt className="w-20 shrink-0 text-ink-3">Sign-in</dt><dd>{s.signIn.replace(/`/g, '')}</dd></div>}
              {(s.headers.length > 0 || s.env.length > 0) && <div className="flex gap-2"><dt className="w-20 shrink-0 text-ink-3">Settings</dt><dd className="font-mono">{[...s.headers, ...s.env].join(', ')}</dd></div>}
              <div className="flex gap-2"><dt className="w-20 shrink-0 text-ink-3">Used by</dt><dd>{s.usedBy.length ? s.usedBy.map((c) => <Link key={c} to={howRoute(c.slice(1))} className="mr-2 font-mono underline">{c}</Link>) : <span className="text-ink-3">no command names it; available in any session</span>}</dd></div>
              <div className="flex gap-2"><dt className="w-20 shrink-0 text-ink-3">Defined in</dt><dd className="font-mono">{s.source}</dd></div>
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

function BuildMcp({ part }: { part: string }) {
  const { manifest } = useHub();
  const servers = manifest.agentic?.mcpServers || [];
  const plugin = servers.find((s) => s.transport === 'plugin');
  const H = ({ children }: { children: ReactNode }) => <h2 className="mb-2 mt-8 text-lg font-semibold first:mt-0">{children}</h2>;
  const P = ({ children }: { children: ReactNode }) => <p className="mb-2 max-w-3xl text-sm leading-relaxed text-ink-2">{children}</p>;
  const L = ({ items }: { items: ReactNode[] }) => <ul className="mb-2 max-w-3xl list-disc space-y-1 pl-5 text-sm text-ink-2">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>;
  const Code = ({ children }: { children: string }) => <pre className="mb-3 max-w-3xl overflow-auto rounded-md bg-sunk p-3 text-xs"><code>{children}</code></pre>;
  return (
    <div className="max-w-4xl">
      {part === 'what' && <>
      <H>What an MCP server is</H>
      <P>The Model Context Protocol is a standard way for an agent to use a system. A server describes its <strong>tools</strong> (actions with typed inputs), <strong>resources</strong> (things to read) and <strong>prompts</strong> (ready-made instructions). The agent reads the descriptions and decides when to call a tool. One server works with Claude Code, the Agent SDK and any other MCP client.</P>
      <H>Build one when</H>
      <L items={[
        'Agents keep needing the same system and today someone copies its data into the chat by hand.',
        'The system has an API, a CLI or a database the team already uses, and the rules for using it can be written down.',
        'No good server exists already. Check first: Jira, Confluence, Figma, GitHub and the cloud providers publish their own.',
      ]} />
      </>}
      {part === 'design' && <>
      <H>Design the tools</H>
      <L items={[
        'Name tools for the task, not the endpoint: find_failed_deploys rather than get_api_v2_runs.',
        'Write each description for the model: what it does, when to use it, what it returns, and its limits. The description is the only documentation the agent reads.',
        'Typed, validated inputs; small outputs. Return the 20 rows that matter with a way to page, not 5,000.',
        'Read tools first. A write tool needs a dry run, an idempotency key and a clear statement of what it changes.',
        'Prefer writes as pull requests or tickets that a person merges or approves, over direct changes.',
        'Errors the model can act on: "service not found; did you mean payment-proxy?" beats a stack trace.',
      ]} />
      <H>Pick a transport</H>
      <div className="mb-3 overflow-x-auto"><table className="w-full max-w-3xl text-sm">
        <thead><tr className="text-left text-xs uppercase tracking-wide text-ink-3"><th className="py-1.5 pr-4">Transport</th><th className="py-1.5 pr-4">Runs</th><th className="py-1.5">Use for</th></tr></thead>
        <tbody className="divide-y divide-line text-ink-2">
          <tr><td className="py-1.5 pr-4 font-mono">stdio</td><td className="py-1.5 pr-4">On the engineer's laptop, started by Claude Code</td><td className="py-1.5">Tools that use the person's own login and files; the simplest start</td></tr>
          <tr><td className="py-1.5 pr-4 font-mono">streamable HTTP</td><td className="py-1.5 pr-4">As a service, shared by many clients</td><td className="py-1.5">Central servers with sign-in (OAuth or Entra ID), audit and rate limits</td></tr>
        </tbody>
      </table></div>
      </>}
      {part === 'build' && <>
      <H>A first server in Python</H>
      <Code>{`# pip install mcp   (the official SDK; TypeScript: @modelcontextprotocol/sdk)
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("service-catalog")

@mcp.tool()
def find_service(name: str) -> dict:
    """Find a service in the catalog by name or alias. Returns its repo,
    owning team, environments and health URL. Read-only."""
    return catalog.lookup(name)          # your code: validate, query, trim

if __name__ == "__main__":
    mcp.run()                            # stdio; mcp.run("streamable-http") to serve`}</Code>
      <H>Test it</H>
      <L items={[
        <>Run the MCP Inspector against it (<code>npx @modelcontextprotocol/inspector python server.py</code>) and call every tool by hand.</>,
        'Unit-test each tool function like any other code, including bad input and an unreachable backend.',
        'Then ask Claude Code real questions with only your server enabled, and read which tools it picked and why. Fix the descriptions, not the prompt.',
      ]} />
      </>}
      {part === 'ship' && <>
      <H>Register it for the team</H>
      <Code>{`// .mcp.json at the workspace root: everyone who clones it gets the server
{ "mcpServers": {
    "service-catalog": { "type": "stdio", "command": "uvx", "args": ["service-catalog-mcp@1.2.0"] },
    "hosted-catalog":  { "type": "http",  "url": "https://catalog-mcp.internal.example/mcp" } } }`}</Code>
      <P>Pin versions. Put tokens in the person's environment or the secret store and refer to them by name; never write a value into <code>.mcp.json</code>. A server with skills, hooks and commands around it ships better as a Claude Code plugin{plugin ? <>, as <span className="font-mono">{plugin.name}</span> does ({plugin.endpoint})</> : null}.</P>
      <H>Security checklist</H>
      <L items={[
        'Least privilege: the server can do only what its tools need, and each agent gets only the tools it needs.',
        'Act as the person: pass their token through so the agent sees no more than they could.',
        'Treat everything the server returns as data. A document that says "ignore your instructions" must not change what tools do.',
        'No secrets or personal data in tool output; mask by default.',
        'Log every call with who, which tool, the inputs and the outcome.',
        'Rate-limit and time out every call to the backend.',
      ]} />
      <H>The servers this workspace already uses</H>
      <P>{servers.length ? <>See <Link to="/agents/mcp/servers" className="underline">Our servers</Link>: {servers.map((s) => s.name).join(', ')}.</> : 'None configured yet.'}</P>
      </>}
    </div>
  );
}
