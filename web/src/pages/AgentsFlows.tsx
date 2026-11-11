import type { ReactNode } from 'react';
import type { FlowStep } from '../components/StepFlow';

/** The step flow shown at the top of each How agents work section: the idea of the section as numbered steps. */
export const FLOWS: Record<string, { title: string; caption: ReactNode; steps: FlowStep[] }> = {
  blocks: {
    title: 'Seven questions, seven blocks',
    caption: 'Each block answers one question about an agent. Click a step, or press Play.',
    steps: [
      { title: 'What it knows', kind: 'file', where: 'CLAUDE.md, .claude/rules/', detail: 'CLAUDE.md is loaded into every session: the stack, where things live, the loop. Rules load by path, before a file under that path changes. Context only: it steers, it does not enforce.' },
      { title: 'What you asked', kind: 'you', where: '.claude/commands/notification.md', detail: 'A command is a recipe you start by typing /name. The file becomes the prompt, with your arguments filled in: the precheck, one step per verb, what to report.' },
      { title: 'How to do it', kind: 'file', where: '.claude/skills/notification-engine/SKILL.md', detail: 'A skill is know-how the model loads only when the task matches its description: the data model, the flow, the two ids, the rules. Facts, not steps.' },
      { title: 'Who does it', kind: 'model', where: '.claude/agents/notification-messages.md', detail: 'An agent is a specialist with a fresh context and its own tool list. The tool list is enforced: a tool that is not on it cannot be called.' },
      { title: 'How it reaches a system', kind: 'tool', where: 'tools/mcp/notifications_mcp.py, .mcp.json', detail: 'An MCP server gives the model typed tools for one system. It calls the real API with credentials it reads by name; the model never sees a URL or a token.' },
      { title: 'What it can never do', kind: 'hook', where: '.claude/hooks/notification-guard.py', detail: 'A hook runs on events, whatever the model decides. notification-guard refuses any write outside local or DEV, and any publish that was not simulated first.' },
      { title: 'What is reachable at all', kind: 'gate', where: '.claude/settings.json, local-env/.env', detail: 'Settings allow and deny every tool call; .env files and keys are denied. The environment holds URLs and credentials, referred to by name only.' },
    ],
  },
  design: {
    title: 'One work item, from phase to agent run and back',
    caption: 'The delivery loop is the SDLC. Each phase starts agent runs; what a run may do is the agentic design.',
    steps: [
      { title: 'Work item in a phase', kind: 'you', where: 'specs/<KEY>/status.json', detail: 'A work item sits in one phase of the delivery loop: intent, spec, design, build, test, deploy or maintain. Days to weeks.' },
      { title: 'Phase command', kind: 'file', where: '/spec, /design, /build ...', detail: 'You run the phase command. It is a file: the steps for that phase, the subagents it uses, the documents it writes.' },
      { title: 'Agent run starts', kind: 'model', detail: 'The command starts an agent run. This is the agent loop: seconds to minutes, per request.' },
      { title: 'Model asks for tools', kind: 'model', detail: 'Read the spec, grep the code, call an MCP tool. Each call is a request, not an action.' },
      { title: 'Design decides', kind: 'hook', where: 'tools, hooks, settings, mcp:', detail: 'The agentic design answers each request: is the tool on the list, does a hook deny it, does a setting forbid the path. Built once, reviewed like code.' },
      { title: 'Result into the phase', kind: 'file', where: 'spec.md, plan.md, tasks.md', detail: 'The run writes the phase document: the spec, the design, the code on a branch, the test results.' },
      { title: 'Owner approves', kind: 'gate', where: 'tools/spec.py approve', detail: 'A person approves the gate, and the work item moves to the next phase. Agents never approve.' },
    ],
  },
  example: {
    title: 'A real run: /notification',
    caption: 'What happened when the notification agent ran against the local notification-service.',
    steps: [
      { title: 'You ask', kind: 'you', where: '/notification new WORKSHOP_TOPUP_THANKS ...', detail: 'The command file expands into the steps: precheck, look up the action and group, show the draft, confirm, create.' },
      { title: 'Skill loads', kind: 'file', where: 'notification-engine', detail: 'The model loads the skill because the task is about notifications: the model, the API, the two ids, simulate-before-publish.' },
      { title: 'Create the draft', kind: 'tool', where: 'create_notification', detail: 'Row 4, version 1, status DRAFT. The hook allowed it: the service is on this laptop.' },
      { title: 'Change it', kind: 'tool', where: 'add_notification_version', detail: 'A new version (row 5) adds push. Version 1 stays in the history: a published notification is never changed in place.' },
      { title: 'Publish: refused', kind: 'hook', where: 'notification-guard', detail: '"simulate it first ... in this session, to a test group of synthetic numbers; then publish." The model reads the reason and changes plan.' },
      { title: 'Simulate', kind: 'tool', where: 'simulate_notification', detail: 'Sends the event through the real flow to a test group of synthetic numbers. The hook records the simulate for this session.' },
      { title: 'Publish: allowed', kind: 'system', where: 'publish_notification', detail: '"Notification is activated". History: v1 DRAFT, v2 ACTIVE.' },
      { title: 'Recorded', kind: 'hook', where: '.claude/state/notification-changes.jsonl', detail: 'Every write is appended by the hook, not by the model: when, which tool, which notification, which session.' },
    ],
  },
  exampleDb: {
    title: 'A real run: /db',
    caption: 'How many eSIM profiles are in each status, since when, and what does each status mean?',
    steps: [
      { title: 'You ask', kind: 'you', where: '/db how many eSIM profiles ...', detail: 'The command says: first decide whether the API or the database answers this.' },
      { title: 'Database, not API', kind: 'model', detail: 'Counts across the whole table: no cas-service endpoint gives that, so the database, read-only.' },
      { title: 'Find the table', kind: 'tool', where: 'list_tables, describe_table', detail: 'CAS_SERVER.esim, 1,100 rows. IMSI is marked personal: it may only be counted.' },
      { title: 'See the values', kind: 'tool', where: 'column_values esim.StatusID', detail: '1, 2, 3 and 5, with how many rows each.' },
      { title: 'Meaning from code', kind: 'model', where: 'cas-service eSIMStatusID.java:5-9', detail: 'Grep finds the enum: 1 Available, 2 Selected, 3 InUse, 4 RolledBack, 5 WrongState.' },
      { title: 'Count and age', kind: 'tool', where: 'query: SELECT StatusID, COUNT(*), MIN(..), MAX(..) ...', detail: 'One aggregate query. The hook allowed one read statement and logged it.' },
      { title: 'The finding', kind: 'system', detail: '232 profiles reserved (CasEndpoint.java:8104) and never released: nothing in cas-service moves Selected on or back. WrongState is written by no Java code.' },
    ],
  },
  cycle: {
    title: 'One request through every block',
    caption: 'The same thirteen steps as the list below, one at a time.',
    steps: [
      { title: 'Session starts', kind: 'you', where: 'CLAUDE.md, memory, settings', detail: 'Claude Code loads CLAUDE.md (root and folders), the memory index and the settings.' },
      { title: 'SessionStart hook', kind: 'hook', where: 'session-start.py', detail: 'Prints what the session should know: work items in flight, the latest decisions, the handoff.' },
      { title: 'You type', kind: 'you', detail: 'A sentence, or a command such as /notification new or /intent.' },
      { title: 'Prompt hook', kind: 'hook', where: 'prompt-router.py', detail: 'Reads your message before the model does and can point at the right command.' },
      { title: 'Command expands', kind: 'file', where: '.claude/commands/<name>.md', detail: 'The command file becomes the prompt, with your arguments filled in.' },
      { title: 'Model plans', kind: 'model', where: '.claude/skills/<name>/SKILL.md', detail: 'It decides the next action; a matching skill loads now.' },
      { title: 'Asks for a tool', kind: 'model', detail: 'Read, Grep, Edit, Bash, or an MCP tool such as mcp__localdb__query.' },
      { title: 'Permission + PreToolUse', kind: 'hook', where: 'settings allow/deny, PreToolUse hooks', detail: 'Settings allow or deny; then hooks run and can block the call with a reason the model sees.' },
      { title: 'Tool runs', kind: 'tool', where: '.mcp.json → local-env/.env by name', detail: 'The harness runs it, or the MCP server calls our API or database with credentials from the environment.' },
      { title: 'PostToolUse', kind: 'hook', detail: 'Hooks record or check the result: the notification audit, the database query log, the agent run log.' },
      { title: 'Delegate', kind: 'model', where: '.claude/agents/<name>.md', detail: 'For a specialist job the model starts a subagent: fresh context, its own tool list, a summary back.' },
      { title: 'Writes follow rules', kind: 'gate', where: '.claude/rules/, git hooks', detail: 'Edits only where the rules allow; spec.py commits the work item; the git hook checks identity.' },
      { title: 'Answer', kind: 'you', where: 'hub: Runs, work item', detail: 'You get the answer; the hub shows the run, its steps and what it touched.' },
    ],
  },
  loop: {
    title: 'The agent loop',
    caption: 'An agent is a model in a loop. It never touches a system itself: it can only ask for a tool call.',
    steps: [
      { title: 'Task', kind: 'you', detail: 'Your question, the mode (ask, plan, propose) and the work item.' },
      { title: 'Model decides', kind: 'model', detail: 'It reads the agent file, the mode rules and the recent commits, and decides the next step.' },
      { title: 'Asks for a tool', kind: 'model', where: 'Grep "1003" in code/vm-selfcare-proxy', detail: 'A request with typed inputs. Nothing has happened yet.' },
      { title: 'Permission check', kind: 'gate', where: '--tools, directories, deny rules, hooks', detail: 'Is the tool on the list, is the path inside the agent\'s directories, does a deny rule or a hook refuse it? A refused call shows as blocked on the run.' },
      { title: 'Tool runs', kind: 'tool', detail: 'The harness runs it and gives the result back to the model.' },
      { title: 'Repeat or answer', kind: 'model', detail: 'The model asks for the next call, or writes the answer. Every step is on the run: Steps, What it touched, How it ran.' },
    ],
  },
  ways: {
    title: 'Which way to build: three questions',
    caption: 'Pick by who owns the control flow. Most agents here start as the first and move right when they must.',
    steps: [
      { title: 'What is the job?', kind: 'you', detail: 'Write it in one sentence, with who uses it and how often.' },
      { title: 'A person watches?', kind: 'gate', detail: 'If an engineer starts each run and reads the answer (investigate, plan, propose a change), use the agent harness: instructions and tools, the model drives. Claude Code, the Agent SDK.' },
      { title: 'Fixed steps?', kind: 'gate', detail: 'If the steps must run in order with checkpoints, retries or human approvals in a service, use a framework graph: our code owns the steps, the model works inside them. Spring AI, Semantic Kernel, LangGraph.' },
      { title: 'Exact facts?', kind: 'gate', detail: 'If numbers must be right every time and audited (reports, customer answers), use a deterministic service: code computes the facts, the model only classifies and words. IDEA-4, the Oman operations agent.' },
      { title: 'Same blocks', kind: 'tool', detail: 'All three reach systems the same way: MCP servers or typed tools, read-only first, credentials by name, every call logged.' },
    ],
  },
  reach: {
    title: 'API or database: how an agent should reach the data',
    caption: 'Decide per question, not per agent.',
    steps: [
      { title: 'Name the question', kind: 'you', detail: 'One record now? History and counts? A change? An incident?' },
      { title: 'One record now', kind: 'system', detail: 'Use the service API. It applies the service\'s rules, tenant and masking, and it is a contract that does not move under you.' },
      { title: 'History and counts', kind: 'system', detail: 'Read the database, read-only: a user with SELECT only, personal columns counted, never read. Example: /db on the local restore.' },
      { title: 'A change', kind: 'gate', detail: 'Always the API, on local or DEV. Never a write to a database. Production changes go through the release.' },
      { title: 'An incident', kind: 'system', detail: 'Logs, traces and events: what actually happened, in order.' },
      { title: 'Wrap it in a server', kind: 'tool', where: 'tools/mcp/*.py, .mcp.json', detail: 'One MCP server per system, with narrow typed tools and credentials by name.' },
      { title: 'Give it to an agent', kind: 'file', where: 'mcp: and mcp-tools: in the agent file', detail: 'Only the agents that need it, and only the tools they need.' },
    ],
  },
  apis: {
    title: 'An agent calling an API',
    caption: 'The model asks; the server decides how the call is made.',
    steps: [
      { title: 'Model asks', kind: 'model', where: 'get_notification(id: 5)', detail: 'A tool call with typed inputs, picked from the server\'s tool descriptions.' },
      { title: 'Allowed?', kind: 'gate', where: 'mcp-tools:, settings, hooks', detail: 'Is this tool given to this agent? Does a hook refuse it (a write outside local or DEV)?' },
      { title: 'Server validates', kind: 'tool', where: 'tools/mcp/notifications_mcp.py', detail: 'Checks the inputs, gets a token from Keycloak with the client named in the environment.' },
      { title: 'Our API', kind: 'system', where: 'notification-service /v1/notification-service', detail: 'The service applies its own rules, roles and tenant.' },
      { title: 'Trimmed answer', kind: 'tool', detail: 'The server keeps the fields that matter and masks numbers and emails before the model sees them.' },
    ],
  },
  databases: {
    title: 'An agent reading a database',
    caption: 'Three enforced layers keep personal data in the database. Example: localdb on the MariaDB restore.',
    steps: [
      { title: 'Model asks', kind: 'model', where: 'query: SELECT StatusID, COUNT(*) ...', detail: 'One SQL statement, tables named as schema.table.' },
      { title: 'Hook', kind: 'hook', where: '.claude/hooks/localdb-guard.py', detail: 'One SELECT, WITH, SHOW, DESCRIBE or EXPLAIN. No files, sleeps, locks or the mysql schema.' },
      { title: 'Server rule', kind: 'gate', where: 'tools/mcp/localdb_mcp.py', detail: 'Personal columns (MSISDN, IMSI, OTP, names, ids) only in COUNT() or IS NULL; no SELECT * on such a table; 100 rows at most.' },
      { title: 'Database user', kind: 'system', where: 'agent_ro', detail: 'SELECT only, and no grant at all on the credential schemas. Even a bug above cannot write.' },
      { title: 'Masked result', kind: 'tool', detail: 'Long numbers, emails and tokens masked in whatever comes back.' },
      { title: 'Logged', kind: 'hook', where: '.claude/state/localdb-queries.jsonl', detail: 'Every call: when, which tool, the SQL, the row count, whether it was refused.' },
    ],
  },
  guardrails: {
    title: 'From advice to guarantee',
    caption: 'Only the enforced layers are guarantees. Access to a system is a tool with a narrow job, never a sentence.',
    steps: [
      { title: 'Agent file', kind: 'file', detail: 'What the agent is for and what it never does. Instructions only: they steer the model.' },
      { title: 'Tools', kind: 'gate', where: '--tools', detail: 'A tool not on the list cannot be called.' },
      { title: 'Directories', kind: 'gate', detail: 'Reads and edits only inside the agent\'s repos and the workspace docs.' },
      { title: 'Deny rules', kind: 'gate', where: '--settings', detail: 'Never .env files, keys, certificates, test data or backups, even inside allowed directories.' },
      { title: 'MCP servers', kind: 'tool', where: 'mcp:, mcp-tools:', detail: 'Which systems, with which tools, under which account.' },
      { title: 'Hooks', kind: 'hook', detail: 'Rules no prompt can skip: local or DEV only, simulate before publish, one read statement.' },
      { title: 'Limits and record', kind: 'hook', where: '.claude/state/agent-runs.jsonl', detail: '10 minutes per run, Stop at any time; every run on its work item with its exact command line.' },
    ],
  },
};

/** Which part of each section's text a step is about (see Hl in components/FlowScope.tsx), by step number. */
const ANCHORS: Record<string, string[][]> = {
  design: [['design:delivery'], ['design:delivery'], ['design:agent'], ['design:agent'], ['design:design'], ['design:delivery'], ['design:delivery']],
  example: [['ex:Command'], ['ex:Skill'], ['ex:MCP server', 'ex:Registration', 'ex:Environment'], ['ex:MCP server'], ['ex:Hook'], ['ex:MCP server'], ['ex:Agent'], ['ex:The run, recorded']],
  exampleDb: [['db:Command'], ['db:Skill'], ['db:MCP server'], ['db:MCP server'], [], ['db:Hook', 'db:Database user'], ['db:The run, recorded']],
  cycle: Array.from({ length: 13 }, (_, i) => [`cycle:${i}`]),
  loop: [['loop:task'], ['loop:model'], ['loop:call'], ['loop:check'], ['loop:run'], ['loop:model']],
  ways: [[], ['ways:harness'], ['ways:framework'], ['ways:service'], ['ways:harness', 'ways:framework', 'ways:service']],
  reach: [[], ['reach:api'], ['reach:db'], ['reach:api'], ['reach:logs', 'reach:events'], ['reach:tools'], ['reach:ship']],
  apis: [['api:model'], ['api:check'], ['api:server'], ['api:system'], ['api:server']],
  databases: [['db:model'], [], ['db:server'], ['db:copy'], ['db:server'], ['db:trace']],
  guardrails: [['guard:The agent file'], ['guard:Tools (--tools)'], ['guard:Directories'], ['guard:Deny rules (--settings)'], ['guard:MCP servers (mcp:)'], [], ['guard:Limits', 'guard:Record']],
};
for (const [k, list] of Object.entries(ANCHORS)) FLOWS[k]?.steps.forEach((s, i) => { s.anchors = list[i] || []; });
