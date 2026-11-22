import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { cx } from '../components/ui';
import { StepFlow } from '../components/StepFlow';
import { FlowScope, Hl, useFlowScope } from '../components/FlowScope';
import { FLOWS } from './AgentsFlows';

/** Agentic design versus the two loops, and the worked example: what is written in every block for one real agent. */

const H = ({ children }: { children: ReactNode }) => <h2 className="mb-2 mt-6 text-base font-semibold first:mt-0">{children}</h2>;
const P = ({ children }: { children: ReactNode }) => <p className="mb-2 max-w-3xl text-sm leading-relaxed text-ink-2">{children}</p>;
const Code = ({ children }: { children: string }) => <pre className="max-h-80 w-full overflow-auto rounded-md bg-sunk p-3 text-[11px] leading-relaxed"><code>{children}</code></pre>;

const SDLC = ['Intent', 'Spec', 'Design', 'Tasks', 'Build', 'Test', 'Deploy', 'Maintain'];
const AGENT = ['Prompt', 'Model decides', 'Tool call', 'Permission + hooks', 'Tool runs', 'Result'];

function Ring({ items, tone, label, a }: { items: string[]; tone: string; label: string; a: string }) {
  return (
    <Hl a={a} className={cx('rounded-lg border px-3 py-2', tone)}>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{label}</div>
      <div className="flex flex-wrap items-center gap-1 text-xs">
        {items.map((s, i) => (
          <span key={s} className="flex items-center gap-1"><span className="rounded bg-paper px-1.5 py-0.5 shadow-sm">{s}</span>{i < items.length - 1 ? <span aria-hidden className="text-ink-3">&rarr;</span> : <span aria-hidden className="text-ink-3">&#8635;</span>}</span>
        ))}
      </div>
    </Hl>
  );
}

export function AgentsDesign() {
  const rows: [string, string, string, string][] = [
    ['What it is', 'How we deliver a change: the phases a piece of work moves through, with people approving the gates', 'How one agent run works: the model asks for a tool, the harness checks and runs it, the result comes back, repeat', 'What an agent is made of: the files you write (command, skill, agent, MCP server, hook, settings, environment)'],
    ['Unit', 'A work item (a Jira key): days to weeks', 'One request: seconds to minutes', 'One agent or capability: built once, used many times'],
    ['Who drives it', 'The team; owners approve intent, spec and design', 'The model chooses each step; the harness enforces', 'An engineer designs it, in a pull request, like any code'],
    ['Where it lives', 'specs/<KEY>/status.json, tools/spec.py, the spec-gate hook', 'Claude Code (or the Agent SDK, or our framework code) at run time', '.claude/, tools/mcp/, .mcp.json, local-env/.env names'],
    ['Its question', 'Are we building the right thing, and is it proven?', 'What is the next step for this request?', 'What may this agent know, do and reach, and what can it never do?'],
    ['You see it on the hub', 'Work items, phases, gates, the Loop page', 'A run: Steps, What it touched, blocked calls', 'Building blocks, Agent studio About card, Worked example'],
  ];
  const confusions: [string, string][] = [
    ['"The agentic loop is our SDLC."', 'No. The delivery loop (intent to maintain) is the SDLC. Agents work inside each phase; each agent run is its own small loop of tool calls.'],
    ['"An agent is a prompt."', 'A prompt is one block. An agent is the design around it: which tools, which data, which checks run whatever the model decides.'],
    ['"The skill makes it safe."', 'A skill is context: the model may ignore it. Safety is enforced only by hooks, permissions, the MCP server and the system’s own access control.'],
    ['"Designing an agent skips the loop."', 'Building an agent is a work item too: intent (its job), spec (what it may and may not do), design (the blocks), build, test (run it, try to break the guard), deploy (merge, hub), maintain.'],
  ];
  return (
    <div>
      <P>Three ideas that people mix up. They nest: the <strong>delivery loop</strong> is how the team ships; inside every phase, agents do work, and each agent run is an <strong>agent loop</strong>; what an agent is allowed to do in that loop is its <strong>agentic design</strong>.</P>
      <div className="my-3 w-full space-y-2">
        <Ring a="design:delivery" label="Delivery loop (SDLC): per work item, days to weeks, gated by people" items={SDLC} tone="border-line-2 bg-paper" />
        <div className="ml-6 border-l-2 border-dashed border-line-2 pl-4">
          <div className="mb-1 text-xs text-ink-3">inside every phase, for example /design or /build, an agent runs:</div>
          <Ring a="design:agent" label="Agent loop: per request, seconds to minutes, run by the harness" items={AGENT} tone="border-run bg-run/5" />
          <div className="ml-6 mt-2 border-l-2 border-dashed border-line-2 pl-4">
            <div className="mb-1 text-xs text-ink-3">what that loop may know, do and reach is set by:</div>
            <Hl a="design:design" className="rounded-lg border border-ok bg-ok/5 px-3 py-2 text-xs">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Agentic design: files, built once</div>
              Command (the recipe) · Skill (the know-how) · Agent (the specialist and its tool list) · MCP server (the reach into a system) · Hook (the check nobody skips) · Settings (allow and deny) · Environment (credentials by name)
            </Hl>
          </div>
        </div>
      </div>
      <H>Side by side</H>
      <div className="w-full overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="text-left text-xs uppercase tracking-wide text-ink-3"><th className="py-1.5 pr-3" /><th className="py-1.5 pr-3">Delivery loop (SDLC)</th><th className="py-1.5 pr-3">Agent loop</th><th className="py-1.5">Agentic design</th></tr></thead>
        <tbody className="divide-y divide-line align-top text-xs text-ink-2">{rows.map(([k, a, b, c]) => (
          <tr key={k}><td className="py-1.5 pr-3 font-medium text-ink">{k}</td><td className="py-1.5 pr-3">{a}</td><td className="py-1.5 pr-3">{b}</td><td className="py-1.5">{c}</td></tr>))}
        </tbody>
      </table></div>
      <H>Building an agent goes through the delivery loop</H>
      <div className="w-full overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="text-left text-xs uppercase tracking-wide text-ink-3"><th className="py-1.5 pr-3">Phase</th><th className="py-1.5 pr-3">For an agent, this means</th><th className="py-1.5">Notification example</th></tr></thead>
        <tbody className="divide-y divide-line align-top text-xs text-ink-2">
          {[
            ['Intent', 'The job and who uses it', 'Engineers create, change, read and publish notifications without hand-written API calls'],
            ['Spec', 'What it may do, what it must never do, as testable criteria', 'Writes only on local or DEV; no publish before a simulate; no real phone number anywhere; every write recorded'],
            ['Design', 'Pick the blocks and the build style; where data comes from (API or database)', 'Harness style; notification-service API through an MCP server; a hook for the two rules; a skill for the model; one command'],
            ['Build', 'Write the files', '/notification, notification-engine, notification-guard, notifications_mcp.py, .mcp.json, settings, .env names'],
            ['Test', 'Run it for real, and try to break every rule', 'Created, versioned, read; publish tried early and refused by the hook; simulate, then publish passed'],
            ['Deploy', 'Merge, register, show it', 'Committed to the workspace; the hub lists the command, skill, hook, server and agent'],
            ['Maintain', 'Watch what it does; fix what it gets wrong', '.claude/state/notification-changes.jsonl; known gaps in the skill'],
          ].map(([p, a, b]) => <tr key={p}><td className="py-1.5 pr-3 font-medium text-ink">{p}</td><td className="py-1.5 pr-3">{a}</td><td className="py-1.5">{b}</td></tr>)}
        </tbody>
      </table></div>
      <H>What people get wrong</H>
      <ul className="max-w-3xl space-y-1.5 text-sm text-ink-2">{confusions.map(([q, a]) => <li key={q}><strong className="text-ink">{q}</strong> {a}</li>)}</ul>
      <P><span className="mt-3 block">See every file of one real agent in the <Link to="/agents/how/example" className="underline">Worked example</Link>.</span></P>
    </div>
  );
}

type Block = { b: string; kind: 'context' | 'advice' | 'enforced'; file: string; write: string; code: string };

const NOTIFICATION: Block[] = [
  { b: 'CLAUDE.md row', kind: 'context', file: 'CLAUDE.md', write: 'One line so every session knows the example exists and where its parts are.',
    code: `| \`.claude/commands/notification.md\`, \`.claude/skills/notification-engine/\`, \`.claude/hooks/notification-guard.py\` |
  The worked example of every block on one job: /notification creates, changes, retrieves, simulates and publishes
  a notification through the notifications MCP server; the skill holds the model and the flow; the hook allows
  writes on a local or dev service only and no publish before a simulate. |` },
  { b: 'Command', kind: 'context', file: '.claude/commands/notification.md', write: 'The recipe the engineer starts. Front matter: description and argument hint. Body: the precheck, one numbered step per verb, what to report. It names the skill, tools, hook and agent it relies on.',
    code: `---
description: Create, change, retrieve, simulate or publish a notification in the notification engine, through the notifications MCP server
argument-hint: show [name | id] | new <what, when, channels, tenant> | change <id> <what changes> | simulate <id> | publish <id> | why <what did not arrive>
---
Notification: $ARGUMENTS

Skill: \`notification-engine\`. Tools: the \`notifications\` MCP server. Hook: \`notification-guard\`.

Before anything: check the server answers (list_notifications, page_size 1). If it fails, say how to start the
local stack and stop. Never print a token or a value from .env.

2. new: work out the action, tenant, group, severity and one detail per channel. Look them up
   (list_actions, list_groups) rather than guessing ids. Show the draft as a table, ask to confirm, then create_notification.
3. change: get_notification, show what changes, confirm, then add_notification_version.
4. simulate: sends to every member of a test group, so synthetic numbers only.
5. publish: only after a simulate the engineer has seen. If the hook refuses, say why; do not work around it.` },
  { b: 'Skill', kind: 'context', file: '.claude/skills/notification-engine/SKILL.md', write: 'The know-how the model loads when the task matches the description: the data model, how a message flows, the API, the two ids, the rules, known gaps. Facts, not steps.',
    code: `---
name: notification-engine
description: How the notification engine is configured and how a message flows ... Use when creating,
  changing, retrieving or explaining a notification, or when a customer did not receive a message.
---
## The model
| Notification | notification-service (NOTIFICATIONS, NOTIFICATION_DETAILS) | The rule: when this action happens for this
  tenant, send on these channels with these templates. Versioned; a draft until published |

## How one message flows
1. Nobill calls POST v1/nobill-service/notification on notification-application-interface ...
2. notification-service consumes VirtualTopic.eventTopic, finds the event and the published notification ...

Two ids: id is one version's row; notificationId is the notification across its versions.

## Rules
- Never change a published notification in place: add a version.
- Simulate before publish, to a test group of synthetic numbers only.` },
  { b: 'Agent', kind: 'enforced', file: '.claude/agents/notification-messages.md', write: 'The specialist: who it is, its tool list (enforced), its scope repos, how it reaches data, and how it works. On the hub it gets read tools only, because a hub run cannot ask before a write.',
    code: `---
name: notification-messages
description: Notification messages agent. Adds or changes a customer message ...
tools: Read, Grep, Glob, Bash, mcp__notifications__list_notifications, mcp__notifications__get_notification, ...
team: Notification
build: harness
access: code: template, configuration and notification services | api: notification-service (notifications MCP server)
mcp: notifications
mcp-tools: list_notifications, find_notification, get_notification, notification_history, list_actions, list_groups, list_test_groups
modes: ask, plan, propose
---
You are the notification engineer for the team ...
5. With the notifications MCP server: read the live configuration instead of guessing from seed files.` },
  { b: 'MCP server', kind: 'enforced', file: 'tools/mcp/notifications_mcp.py', write: 'The reach into the system: one tool per action, each with a description the model reads and typed inputs. It calls the real API with a token it gets itself; the model never sees a URL or a credential. Writes are separate tools so each one can be gated.',
    code: `TOOLS = [
  ("get_notification", "One notification version by its id, with the full structure. Read-only.",
   {"id": {"type": "integer"}, "full": {"type": "boolean"}}, ["id"],
   lambda a: call("GET", "/notifications/full-structure/" + str(int(a["id"])))),
  ("simulate_notification", "Send an event through the real notification flow to every member of a test group
   (not a dry run). Use a test group of synthetic numbers only.", ...),
  ("publish_notification", "Activate one version ... The previously active version becomes NA. Write.",
   {"id": INT, "notification_id": ID}, ["id", "notification_id"],
   lambda a: call("POST", f"/notifications/{int(a['id'])}/publish", body={"notificationId": ...})),
]
# token(): client credentials from NOTIFICATIONS_CLIENT_ID / _SECRET, read by name from local-env/.env` },
  { b: 'Registration', kind: 'enforced', file: '.mcp.json', write: 'Tells Claude Code how to start the server. Values are references to names, never values.',
    code: `"notifications": {
  "type": "stdio", "command": "python3", "args": ["tools/mcp/notifications_mcp.py"],
  "env": { "NOTIFICATIONS_API_URL": "\${NOTIFICATIONS_API_URL:-}", "NOTIFICATIONS_CLIENT_SECRET": "\${NOTIFICATIONS_CLIENT_SECRET:-}", ... }
}` },
  { b: 'Hook', kind: 'enforced', file: '.claude/hooks/notification-guard.py + .claude/settings.json', write: 'The check nobody can skip. The harness runs it before and after every notifications tool call; it can deny with a reason the model reads. Put here every rule that must hold whatever the prompt says.',
    code: `# settings.json
"PreToolUse":  [{ "matcher": "mcp__notifications__.*", "hooks": [{ "type": "command",
                  "command": "python3 \\"$CLAUDE_PROJECT_DIR/.claude/hooks/notification-guard.py\\"" }] }],
"PostToolUse": [ same matcher, same script ]

# notification-guard.py (PreToolUse)
if name in WRITES and host not in LOCAL and NOTIFICATIONS_ENV != "dev":
    deny("notification changes go to a local or dev notification-service only")
if name == "publish_notification" and nid not in simulated_this_session:
    deny("simulate it first ... in this session, to a test group of synthetic numbers; then publish.")
# PostToolUse: remember simulates; append every write to .claude/state/notification-changes.jsonl` },
  { b: 'Environment', kind: 'enforced', file: 'local-env/.env.example (names), local-env/.env (values, gitignored)', write: 'Every URL and credential by name. bin/env init generates local secrets; bin/env keycloak creates the client.',
    code: `NOTIFICATION_MCP_CLIENT_SECRET=generate
NOTIFICATIONS_API_URL=http://127.0.0.1:8110/api
NOTIFICATIONS_TOKEN_URL=http://127.0.0.1:8180/auth/realms/Notification-Realm/protocol/openid-connect/token
NOTIFICATIONS_CLIENT_ID=notification-mcp` },
  { b: 'The run, recorded', kind: 'enforced', file: '.claude/state/notification-changes.jsonl', write: 'What the agent changed, written by the hook, not by the model.',
    code: `> /notification new WORKSHOP_TOPUP_THANKS ...
create_notification          -> row 4, version 1, DRAFT
get_notification (full)      -> details, channels
add_notification_version     -> row 5, version 2 (adds push)
publish_notification         -> DENIED by notification-guard: "simulate it first ..."
simulate_notification        -> "Successfully scheduled notification"
publish_notification         -> "Notification is activated"; history: v1 DRAFT, v2 ACTIVE

{"at": "2026-11-10T22:47:56", "tool": "create_notification", "name": "WORKSHOP_TOPUP_THANKS", ...}
{"at": "2026-11-10T22:48:03", "tool": "add_notification_version", "notification_id": "1569785701226356736", ...}
{"at": "2026-11-10T22:48:12", "tool": "publish_notification", "notification_id": "1569785701226356736", ...}` },
];

const LOCALDB: Block[] = [
  { b: 'Command', kind: 'context', file: '.claude/commands/db.md', write: 'Question in, numbers and meanings out. Step 1 says whether the API or the database answers it.',
    code: `---
description: Answer an operations or member care question from the local MariaDB restore, read-only ...
---
1. Say first whether the API or the database answers this.
2. Find the table and its columns (list_tables, describe_table). Note which columns are personal.
3. See the status values (column_values), then find what each means in the owning service's code, with file:line.
4. Count, group and age with query. If a call is refused, read why and change the query; do not work around the rule.` },
  { b: 'Skill', kind: 'context', file: '.claude/skills/local-database/SKILL.md', write: 'Which service owns each schema, API versus database, the personal-data rule, the method, recipes.',
    code: `| Question | Use |
| One record now | The service's API (it applies the service's rules, tenant and masking) |
| History, counts, "how many are stuck and since when" | The database, read-only |
| Any change | The API, on local or DEV. Never the database |` },
  { b: 'MCP server', kind: 'enforced', file: 'tools/mcp/localdb_mcp.py', write: 'Five read tools. It finds each table the query names, looks up its personal columns, and allows them only in COUNT() or IS NULL; masks long numbers, emails and tokens; 100 rows at most.',
    code: `> query: select MSISDN as status from CAS_SERVER.activation
  refused: MSISDN hold personal data: count them (COUNT(col)) or test them (col IS NULL), never select,
           compare, group or join on their values. Work by the internal id and the status columns.
> query: select StatusID, count(*) n, min(LastUpdateDateTime), max(LastUpdateDateTime) from CAS_SERVER.esim group by 1
  StatusID 3: 420 · 1: 356 · 2: 232 · 5: 92` },
  { b: 'Database user', kind: 'enforced', file: 'local-env/bin/env db agent-user', write: 'The hard floor: agent_ro has SELECT only, and no grant at all on KEYCLOAK*, AUTHENTICATORS* or mysql.',
    code: `$ local-env/bin/env db agent-user
agent_ro: read-only on 47 grant line(s); password LOCALDB_AGENT_PASSWORD in .env
> delete from CAS_SERVER.esim   -> ERROR 1142: DELETE command denied to user 'agent_ro'` },
  { b: 'Hook', kind: 'enforced', file: '.claude/hooks/localdb-guard.py', write: 'One read statement per call; no file, sleep or lock functions; every call logged to .claude/state/localdb-queries.jsonl.',
    code: `deny("localdb query: read-only. SELECT, WITH, SHOW, DESCRIBE or EXPLAIN only; changes to data go through the
      owning service's API, never the database.")` },
  { b: 'The run, recorded', kind: 'enforced', file: '.claude/state/localdb-queries.jsonl', write: 'A real run of /db: the agent chose the database over the API, read the status values, found their meaning in cas-service, and counted. IMSI was only ever counted.',
    code: `> /db how many eSIM profiles are in each status in CAS_SERVER, since when, and what does each StatusID mean?
list_schemas, list_tables CAS_SERVER, describe_table esim (IMSI: personal), column_values esim.StatusID
Grep cas-service -> enums/eSIMStatusID.java:5-9 (1 Available, 2 Selected, 3 InUse, 4 RolledBack, 5 WrongState)
query: SELECT StatusID, COUNT(*) n, SUM(LastUpdateDateTime IS NULL) no_date, MIN(...), MAX(...) FROM CAS_SERVER.esim GROUP BY 1

| 1 Available | 356 | 2022-10-03 .. 2023-06-06 |
| 2 Selected  | 232 | 2019-06-19 .. 2023-06-12 |  <- reserved (CasEndpoint.java:8104) and never released:
| 3 InUse     | 420 | 2019-06-19 .. 2022-12-28 |     nothing in cas-service moves Selected on or back
| 5 WrongState|  92 | 2020-06-07 .. 2023-06-06 |  <- no Java code writes it: hand fixes or the kjar
Next: confirm whether CAS_SERVER.esim is still the live eSIM pool; if so, release expired reservations.` },
];

function Blocks({ items, prefix }: { items: Block[]; prefix: string }) {
  const [open, setOpen] = useState<string | null>(items[0]?.b ?? null);
  const scope = useFlowScope();
  const lit = scope?.steps[scope.at]?.anchors || [];
  useEffect(() => { const hit = items.find((x) => lit.includes(`${prefix}:${x.b}`)); if (hit) setOpen(hit.b); }, [scope?.at]);
  const tone = { enforced: 'bg-ok/10 text-ok', advice: 'bg-sev-medium/10 text-sev-medium', context: 'bg-sunk text-ink-2' };
  return (
    <ol className="w-full space-y-1.5">
      {items.map((x, i) => (
        <li key={x.b} className={cx('rounded-lg border bg-paper transition-colors', lit.includes(`${prefix}:${x.b}`) ? 'border-brand ring-2 ring-brand/40' : 'border-line-2')}>
          <button type="button" onClick={() => setOpen(open === x.b ? null : x.b)} className="grid w-full grid-cols-[24px_minmax(0,150px)_70px_minmax(0,1fr)] items-baseline gap-3 px-3 py-2 text-left">
            <span className="text-xs font-semibold text-ink-3">{i + 1}</span>
            <span className="text-sm font-semibold">{x.b}</span>
            <span className={cx('w-fit rounded px-1.5 py-0.5 text-[11px]', tone[x.kind])}>{x.kind}</span>
            <span className="text-xs text-ink-2"><code className="text-[11px]">{x.file}</code> · {x.write}</span>
          </button>
          {open === x.b && <div className="px-3 pb-3"><Code>{x.code}</Code></div>}
        </li>
      ))}
    </ol>
  );
}

export function AgentsExample() {
  return (
    <div>
      <P>One real agent, file by file, in the order a request meets them. These are excerpts of the files in this workspace, not illustrations; open each block to see what is written in it. The same pattern builds any agent here: change the system the MCP server reaches, the rules the hook enforces and the know-how in the skill.</P>
      <H>Notifications: create, change, read, simulate, publish (writes, on the API)</H>
      <Blocks items={NOTIFICATION} prefix="ex" />
      <H>Operations data: the local database, read-only</H>
      <P>The same blocks for a database. The local MariaDB on <code>127.0.0.1:13306</code> is a restore of production schemas, so it likely holds customer data: three layers keep that data in the database, and the model works from counts, statuses and internal ids.</P>
      <FlowScope steps={FLOWS.exampleDb.steps}>
        <StepFlow title={FLOWS.exampleDb.title} caption={FLOWS.exampleDb.caption} steps={FLOWS.exampleDb.steps} />
        <Blocks items={LOCALDB} prefix="db" />
      </FlowScope>
    </div>
  );
}
