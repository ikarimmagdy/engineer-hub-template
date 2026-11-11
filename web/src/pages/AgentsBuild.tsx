import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cx, Pill } from '../components/ui';
import { useHub, type AgNode } from '../lib/data';
import { Hl } from '../components/FlowScope';

/** How agents are built here: the blocks of the workspace, one request through them, three architectures, and the ways to data. */

const H = ({ children }: { children: ReactNode }) => <h2 className="mb-2 mt-6 text-base font-semibold first:mt-0">{children}</h2>;
const P = ({ children }: { children: ReactNode }) => <p className="mb-2 max-w-3xl text-sm leading-relaxed text-ink-2">{children}</p>;

/** Build styles a team agent's `build:` front matter names. */
export const BUILDS: Record<string, string> = {
  harness: 'Agent harness: instructions and tools, the model drives the loop',
  framework: 'Framework graph: our code owns the steps, the model works inside them',
  service: 'Deterministic service: code computes the facts, the model only classifies and words',
};

/** Ways an agent reaches data, as written in a team agent's `access:` front matter ("db: TEMPLATES (planned)"). */
const WAYS: Record<string, { label: string; tone: string }> = {
  code: { label: 'Source code', tone: 'bg-sunk' },
  docs: { label: 'Docs and tickets', tone: 'bg-sunk' },
  api: { label: 'Application API', tone: 'bg-ok/10 text-ok' },
  db: { label: 'Database', tone: 'bg-sev-medium/10 text-sev-medium' },
  logs: { label: 'Logs and traces', tone: 'bg-run/10 text-run' },
  events: { label: 'Events', tone: 'bg-run/10 text-run' },
  mcp: { label: 'MCP server', tone: 'bg-ok/10 text-ok' },
};

export function AccessList({ access }: { access: string[] }) {
  return (
    <ul className="space-y-1 text-xs text-ink-2">
      {access.map((a) => {
        const i = a.indexOf(':');
        const kind = i > 0 ? a.slice(0, i).trim() : a;
        const what = i > 0 ? a.slice(i + 1).trim() : '';
        const planned = /\(planned\)/i.test(what);
        const w = WAYS[kind];
        return (
          <li key={a} className="flex flex-wrap items-baseline gap-1.5">
            <span className={cx('whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium', w?.tone || 'bg-sunk', planned && 'opacity-60')}>{w?.label || kind}</span>
            <span className={planned ? 'text-ink-3' : ''}>{what}</span>
          </li>
        );
      })}
    </ul>
  );
}

const names = (xs: AgNode[] | undefined, n = 4) => (xs || []).slice(0, n).map((x) => x.name).join(', ');

export function AgentsBlocks() {
  const { manifest } = useHub();
  const ag = manifest.agentic;
  const team = (ag?.agents || []).filter((a) => a.team);
  const rows: { b: string; file: string; who: string; when: string; strength: 'enforced' | 'advice' | 'context'; here: string }[] = [
    { b: 'CLAUDE.md', file: 'CLAUDE.md at the root and in each folder', who: 'Claude Code', when: 'Loaded into every session', strength: 'context', here: 'Project brain: stack, where things live, the loop, the rules' },
    { b: 'Rules and constitution', file: '.claude/rules/*.md, constitution/', who: 'Claude Code, by path', when: 'Read before changing a path', strength: 'advice', here: `${ag?.rules.length ?? 0} rule files: ${names(ag?.rules)}` },
    { b: 'Commands', file: '.claude/commands/<name>.md', who: 'You, by typing /name', when: 'On demand; the file becomes the prompt, with your arguments', strength: 'context', here: `${ag?.commands.length ?? 0} commands: ${(ag?.commands || []).slice(0, 6).map((c) => c.name).join(', ')}` },
    { b: 'Agents (subagents)', file: '.claude/agents/<name>.md', who: 'A command, Claude itself, or the hub', when: 'Delegated work in a fresh context, with its own tool list; returns a summary', strength: 'enforced', here: `${ag?.agents.length ?? 0} agents, ${team.length} of them team agents launchable here` },
    { b: 'Skills', file: '.claude/skills/<name>/SKILL.md', who: 'Claude, when the task matches the skill description', when: 'Loaded on demand: know-how plus scripts, not always in context', strength: 'context', here: `${ag?.skills.length ?? 0} skills: ${names(ag?.skills)}` },
    { b: 'Hooks', file: '.claude/settings.json "hooks" → .claude/hooks/*', who: 'The harness, never the model', when: 'On events: SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop', strength: 'enforced', here: `${ag?.hooks.length ?? 0} hooks: ${(ag?.hooks || []).map((h) => `${h.name.replace(/\.(py|sh)$/, '')} (${h.event})`).slice(0, 4).join(', ')}` },
    { b: 'MCP servers', file: '.mcp.json, plugins', who: 'The model asks; the harness calls the server', when: 'Whenever a tool of the server is needed', strength: 'enforced', here: `${ag?.mcpServers?.length ?? 0} servers: ${(ag?.mcpServers || []).map((m) => m.name).join(', ')}` },
    { b: 'Settings and permissions', file: '.claude/settings.json (team), settings.local.json (you)', who: 'The harness', when: 'Every tool call is checked against allow and deny', strength: 'enforced', here: 'Deny rules for .env, keys and test data; allowed tools per agent run' },
    { b: 'Environment', file: 'local-env/.env (gitignored), the secret store', who: 'MCP servers and scripts, by name', when: 'When a tool needs a URL or a credential', strength: 'enforced', here: 'Configuration by name only: the model never sees a value' },
    { b: 'Memory', file: '~/.claude/projects/<workspace>/memory/', who: 'Claude, per engineer', when: 'Index loaded every session; facts written when learned', strength: 'context', here: 'Personal preferences and facts that are not in the repo' },
    { b: 'Plugins', file: 'enabledPlugins in settings', who: 'The team, once', when: 'Installs commands, skills, agents and MCP servers as one bundle', strength: 'context', here: 'beyondbase: platform knowledge, CI/CD checks, onboarding, secrets' },
  ];
  const tone = { enforced: 'bg-ok/10 text-ok', advice: 'bg-sev-medium/10 text-sev-medium', context: 'bg-sunk text-ink-2' };
  return (
    <div>
      <P>Claude Code is the <strong>harness</strong>: it runs the model in a loop and decides what the model may do. Everything else is files in this workspace. Each block below answers one question: what the model knows (context), how it is told to work (advice), and what it is allowed to do (enforced). Only enforced blocks are guarantees.</P>
      <div className="w-full overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="text-left text-xs uppercase tracking-wide text-ink-3"><th className="py-1.5 pr-3">Block</th><th className="py-1.5 pr-3">File</th><th className="py-1.5 pr-3">Started by, and when</th><th className="py-1.5 pr-3">Kind</th><th className="py-1.5">In this workspace</th></tr></thead>
        <tbody className="divide-y divide-line align-top text-ink-2">{rows.map((r) => (
          <Hl as="tr" a={`blk:${r.b}`} key={r.b}>
            <td className="py-1.5 pr-3 font-medium text-ink">{r.b}</td>
            <td className="py-1.5 pr-3"><code className="text-xs">{r.file}</code></td>
            <td className="py-1.5 pr-3 text-xs">{r.who}. {r.when}.</td>
            <td className="py-1.5 pr-3"><span className={cx('rounded px-1.5 py-0.5 text-[11px]', tone[r.strength])}>{r.strength}</span></td>
            <td className="py-1.5 text-xs">{r.here}</td>
          </Hl>))}
        </tbody>
      </table></div>
      <P><span className="mt-3 block">How they combine: a <strong>command</strong> is the recipe you start, a <strong>skill</strong> is the know-how it pulls in, an <strong>agent</strong> is a specialist it hands work to, an <strong>MCP server</strong> is how anyone reaches a system, a <strong>hook</strong> is the check nobody can skip, and <strong>settings</strong> and the <strong>environment</strong> decide what is reachable at all. <Link to="/agents/how/cycle" className="underline">The cycle</Link> follows one request through all of them.</span></P>
    </div>
  );
}

const KIND_TONE: Record<string, string> = {
  hook: 'border-sev-medium bg-sev-medium/5', model: 'border-run bg-run/5', tool: 'border-ok bg-ok/5', file: 'border-line-2 bg-paper', you: 'border-ink bg-paper',
};

export function AgentsCycle() {
  const { manifest } = useHub();
  const hooks = manifest.agentic?.hooks || [];
  const hook = (ev: string) => hooks.filter((h) => h.event?.split(/[,\s]+/).includes(ev)).map((h) => h.name.replace(/\.(py|sh)$/, '')).join(', ') || 'none configured';
  const steps: [string, string, string, string][] = [
    ['you', 'Session starts', 'Claude Code loads CLAUDE.md (root and folders), the memory index and settings.', 'CLAUDE.md, memory, settings'],
    ['hook', 'SessionStart hook', 'Prints what the session should know: team sync, work items in flight, the handoff.', hook('SessionStart')],
    ['you', 'You type a request', 'A sentence, or a command such as /notification new or /intent.', 'prompt'],
    ['hook', 'UserPromptSubmit hook', 'Reads your message before the model does, and can add context or point at the right command.', hook('UserPromptSubmit')],
    ['file', 'Command expands', 'A /command is a file: its steps become the prompt, with your arguments filled in.', '.claude/commands/<name>.md'],
    ['model', 'Model plans', 'It reads the steps and the context and decides the next action. A matching skill is loaded now.', '.claude/skills/<name>/SKILL.md'],
    ['model', 'Model asks for a tool', 'Read, Grep, Edit, Bash, or an MCP tool such as mcp__notifications__get_notification.', 'tool call'],
    ['hook', 'Permission check, then PreToolUse hooks', 'Settings allow or deny; then hooks run and can block the call with a reason the model sees.', `${hook('PreToolUse')} · settings allow/deny`],
    ['tool', 'Tool runs', 'The harness runs it, or the MCP server calls our API or database with credentials from the environment.', '.mcp.json → local-env/.env by name'],
    ['hook', 'PostToolUse hooks', 'Record or check the result.', hook('PostToolUse')],
    ['model', 'Delegate to an agent', 'For a specialist job the model starts a subagent: fresh context, its own tool list, a summary back.', '.claude/agents/<name>.md'],
    ['file', 'Writes follow the rules', 'Edits go where the rules for that path allow; spec.py commits the work item; git hooks check identity.', '.claude/rules/, git hooks'],
    ['you', 'Answer and record', 'You get the answer; the hub shows the run, its steps and what it touched.', 'hub: Runs, work item'],
  ];
  return (
    <div>
      <P>One request, start to end, in this workspace. Orange steps are hooks, which the harness runs whatever the model decides. Blue steps are the model, and green steps are tools acting on a system.</P>
      <ol className="w-full space-y-1.5">
        {steps.map(([k, t, d, w], i) => (
          <Hl as="li" a={`cycle:${i}`} key={t} className={cx('grid grid-cols-[28px_minmax(0,220px)_minmax(0,1fr)] items-start gap-3 rounded-lg border px-3 py-2', KIND_TONE[k])}>
            <span className="text-xs font-semibold text-ink-3">{i + 1}</span>
            <span className="text-sm font-semibold">{t}</span>
            <span className="text-xs text-ink-2">{d} <code className="ml-1 text-[11px] text-ink-3">{w}</code></span>
          </Hl>
        ))}
      </ol>
      <P><span className="mt-3 block">Steps 6 to 10 repeat until the model writes the answer. That repetition is <Link to="/agents/how/loop" className="underline">the loop</Link>; everything around it is what makes it safe and repeatable.</span></P>
    </div>
  );
}

export function AgentsWays() {
  const cols: { k: string; t: string; what: string; when: string[]; not: string; stack: string; here: string }[] = [
    { k: 'harness', t: '1. Agent harness', what: 'An agent file (role, rules, never) plus a tool list and MCP servers. The model plans and runs the loop. Claude Code in the terminal and the hub; the Claude Agent SDK to run the same thing in a service.',
      when: ['Open-ended engineering work: investigate, explain, plan, change code', 'Inputs vary every time', 'A person reads the result before anything happens'],
      not: 'Answers that must be identical every time, or that go straight to a customer.', stack: 'Claude Code, Claude Agent SDK. Tools as MCP servers in any language.', here: 'The team agents on this hub; the notification agent with its MCP server.' },
    { k: 'framework', t: '2. Framework graph', what: 'Our code defines the steps as a graph (nodes, state, branches, human approval, memory per conversation); the model reasons inside a node and picks tools we expose. LangChain and LangGraph in Python, Spring AI in Java, Semantic Kernel in .NET.',
      when: ['A product feature inside one of our apps: a member care assistant in the CAS-DMS portal, a notification authoring assistant', 'Several steps with branching and approvals', 'Retrieval over our documents (RAG)'],
      not: 'One-off engineering tasks: a harness is faster to build and change.', stack: 'New services are Java 21 or .NET 8 (A-2), so prefer Spring AI or Semantic Kernel. LangGraph is a Python service: worth it for heavy RAG or graph work, and it needs an A-2 exception.', here: 'Not built yet. Candidates: member care assistant, notification authoring.' },
    { k: 'service', t: '3. Deterministic service', what: 'A normal service: fixed, reviewed queries and rules compute every fact. The model only classifies the request and words the answer, and a guard checks the words against the facts. It still works with the model switched off.',
      when: ['Reports and alerts on a schedule', 'Answers to customers, dealers or member care that must be right', 'Anything audited'],
      not: 'Exploration: every new question needs code.', stack: 'Java 21 / Spring Boot 3.5 with Spring AI behind a port, read-only data sources, a named query catalogue.', here: 'IDEA-4 oman-ops-agent: 2-hourly report and case answers over CAS, provisioning and MNP.' },
  ];
  return (
    <div>
      <P>Three ways to build an agent, from most freedom for the model to least. They differ in who owns the control flow: the model, a graph we write, or plain code.</P>
      <div className="grid w-full gap-3 lg:grid-cols-3">
        {cols.map((c) => (
          <Hl a={`ways:${c.k}`} key={c.k} className="rounded-lg border border-line-2 bg-paper p-4">
            <div className="font-semibold">{c.t}</div>
            <p className="mt-1 text-xs text-ink-2">{c.what}</p>
            <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Use it when</div>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-ink-2">{c.when.map((w) => <li key={w}>{w}</li>)}</ul>
            <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Not for</div>
            <p className="text-xs text-ink-2">{c.not}</p>
            <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-3">On our stack</div>
            <p className="text-xs text-ink-2">{c.stack}</p>
            <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Here</div>
            <p className="text-xs text-ink-2">{c.here}</p>
          </Hl>
        ))}
      </div>
      <H>Choosing in four questions</H>
      <ol className="max-w-3xl list-decimal space-y-1 pl-5 text-sm text-ink-2">
        <li>Will a person read every answer before it is acted on? Yes: start with <strong>1</strong>.</li>
        <li>Does it live inside a product, with users who are not engineers? Then <strong>2</strong> or <strong>3</strong>.</li>
        <li>Must the same question always get the same, provable answer? Then <strong>3</strong>.</li>
        <li>Many steps, branches or approvals, and the answer may vary? Then <strong>2</strong>.</li>
      </ol>
      <P><span className="mt-2 block">They share one thing: tools. A tool written once as an MCP server (say <code>get_notification</code>) serves a harness agent today, and the same API client serves a Spring AI node or a service query tomorrow. So start with 1, learn which questions matter, then harden the frequent ones into 2 or 3.</span></P>
    </div>
  );
}

export function AgentsReach() {
  const { manifest } = useHub();
  const team = (manifest.agentic?.agents || []).filter((a) => a.team);
  const ways: [string, string, string, string, string][] = [
    ['code', 'Why does it behave like this? Which service writes this column?', 'Read, Grep and Glob on the repos in the agent\'s scope', 'Code is not the running state: it shows what should happen, not what did', 'Every team agent'],
    ['docs', 'What did we decide? What does the PRD say? What is the process?', 'Atlassian MCP (read-only), workspace docs, operations-center/', 'Tickets can be stale or wrong', '/intent, customer issue investigator'],
    ['api', 'Create, change or read one business object (a notification, an order)', 'MCP server calling the service API with a service account from the environment', 'Shows only what the API exposes; needs a client and a scope', 'Notification agent: notifications MCP'],
    ['db', 'History, counts, joins across services, "what happened to this line"', 'MCP server with a read-only database user, views and named queries, row limit, masking', 'Couples to the schema, bypasses business rules, personal data', 'IDEA-4 ops agent (synthetic data locally)'],
    ['logs', 'What failed, when, with which error', 'Log or trace queries (LOGS schema, Zipkin, SigNoz) through a named tool', 'Volume, and personal data in payloads', 'Planned'],
    ['events', 'React when something happens (a failed delivery, a port-out)', 'A consumer on ActiveMQ or Artemis that starts the agent', 'Needs a hosted runner, not a laptop', 'Planned'],
  ];
  return (
    <div>
      <P>Six ways an agent gets to our data. The rule of thumb: <strong>read through the API when it answers the question, read the database when only history and joins do, and write only through the API</strong>, never with SQL. The production databases a person opens in DBeaver through a tunnel are for people. An agent never gets that connection: it gets a masked or UAT copy, or synthetic data locally.</P>
      <div className="w-full overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="text-left text-xs uppercase tracking-wide text-ink-3"><th className="py-1.5 pr-3">Way</th><th className="py-1.5 pr-3">Answers</th><th className="py-1.5 pr-3">How the agent gets it</th><th className="py-1.5 pr-3">Watch out</th><th className="py-1.5">Here</th></tr></thead>
        <tbody className="divide-y divide-line align-top text-xs text-ink-2">{ways.map(([k, a, h, w, e]) => (
          <Hl as="tr" a={`reach:${k}`} key={k}><td className="py-1.5 pr-3"><span className={cx('whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium', WAYS[k].tone)}>{WAYS[k].label}</span></td><td className="py-1.5 pr-3">{a}</td><td className="py-1.5 pr-3">{h}</td><td className="py-1.5 pr-3">{w}</td><td className="py-1.5">{e}</td></Hl>))}
        </tbody>
      </table></div>
      <H>Building an agent, step by step</H>
      <ol className="max-w-3xl list-decimal space-y-1 pl-5 text-sm text-ink-2">
        <li><strong>Job and ten real questions.</strong> Write the questions the users actually ask, with the answer you would expect.</li>
        <li><strong>Source per question.</strong> For each one: code, API, database, logs. Mark the questions that need personal data.</li>
        <li><strong>Pick the build style</strong> (<Link to="/agents/how/ways" className="underline">three ways</Link>).</li>
        <Hl as="li" a="reach:tools"><strong>Tools.</strong> Named, typed and read-only first (<code>get_notification(id)</code>, not <code>run_sql</code>). Writes are separate tools that the hook and the permission prompt gate.</Hl>
        <li><strong>Guardrails.</strong> Which account, which environment, masking, row limits, a hook for the rule that must not be skipped.</li>
        <li><strong>Evals.</strong> The ten questions become tests, run on synthetic or masked data (like <code>oman-ops-synth</code>).</li>
        <Hl as="li" a="reach:ship"><strong>Ship.</strong> An agent file with <code>mcp:</code> on this hub, or a service through BeyondBase; then measure the answers it gets right.</Hl>
      </ol>
      {team.length > 0 && <>
        <H>How each team agent reaches data</H>
        <div className="grid w-full gap-2 sm:grid-cols-2">
          {team.map((a) => (
            <Link key={a.name} to={`/agents/team/about?a=${a.name}`} className="rounded-lg border border-line bg-paper px-3 py-2 hover:border-line-2">
              <div className="mb-1 flex items-center gap-2 text-sm font-medium">{a.name}{a.build && <Pill>{a.build}</Pill>}</div>
              {a.access?.length ? <AccessList access={a.access} /> : <div className="text-xs text-ink-3">Source code in its scope</div>}
            </Link>
          ))}
        </div>
      </>}
    </div>
  );
}
