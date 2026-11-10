import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { Plugin } from 'vite';

// The loop on this laptop: approve gates and move phases through the workspace's tools/spec.py,
// read the subagent runs the workspace's agent-log hook records, and run read-only agents
// (on-call, one per module) and the team agents in the workspace's .claude/agents/ through the
// local Claude Code login. A team agent in propose mode edits an isolated git worktree of one
// repo on a local agent/ branch and shows the diff; nothing is pushed. Mounted only on the dev and
// preview servers, loopback clients only. A statically served hub has no /api/loop, so the
// front-end shows the same views read-only, with the commands to run instead.

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const KEY = /^[A-Z][A-Z0-9]*-\d+$/;
const APPROVABLE = ['intent', 'spec', 'design'];
const PHASES = ['intent', 'spec', 'design', 'build', 'test', 'deploy', 'maintain'];
const MAX_QUESTION = 4000;
const RUN_LIMIT_MS = 10 * 60 * 1000;
// Agents read code; they never read secrets, personal test data or key material.
const DENY_READ = ['**/.env', '**/.env.*', '**/*.pem', '**/*.key', '**/*.p12', '**/*.pfx', '**/*.jks', '**/credentials*', '**/secrets/**',
  '**/test-data/**', '**/local-env/backups/**', '**/*.bak'];
// No shell: Claude Code auto-approves read-only commands such as cat, which would get past the Read
// deny rules. Recent git history goes into the prompt instead (history()). The read tools are not
// pre-approved: Claude Code allows them inside the working and added directories only, so a read
// anywhere else on the laptop is refused (and shown on the run as blocked).
const TOOLS = ['Read', 'Grep', 'Glob'];

interface RunRec { ts: string; event: 'start' | 'end'; id: string; agent: string; description: string; key: string | null; source: string; ok?: boolean }
interface Step { tool: string; target: string; at: string; path?: string }
/** What a run can reach, stated by the server so the hub never guesses: code, docs, edits, and the systems it cannot touch. */
interface Reach { repos: string[]; docs: boolean; edits: string | null; shell: false; mcp: string[]; databases: boolean; clusters: boolean; network: false }
interface Live {
  id: string; agent: string; module?: string; key: string | null; question: string; state: 'running' | 'done' | 'failed';
  started: string; ended?: string; text: string; steps: Step[]; error?: string; cost?: number;
  mode?: string; repo?: string; worktree?: string; branch?: string; base?: string; diffStat?: string; diff?: string; reach?: Reach;
  /** Exactly how the run was started: the directory, the command line, and the instructions appended to the system prompt. */
  launch?: { cwd: string; command: string; instructions: string };
}

const live = new Map<string, Live>();
const children = new Map<string, ReturnType<typeof spawn>>();
const AGENT_NAME = /^[a-z][a-z0-9-]{2,40}$/;
const MODES = ['ask', 'plan', 'propose'];
const OPEN_PHASES = ['build', 'test', 'deploy', 'maintain'];
const MAX_DIFF = 300 * 1024;
let claudeVersion: string | null | undefined;

function readBody(req: any): Promise<string> {
  return new Promise((ok, fail) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => { size += c.length; if (size > 64 * 1024) { fail(new Error('body too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')));
    req.on('error', fail);
  });
}

function workspaceOf(hubDir: string): string | null {
  try {
    const brand = JSON.parse(readFileSync(join(hubDir, 'content', 'brand.json'), 'utf8'));
    return brand.workspace ? resolve(hubDir, brand.workspace) : null;
  } catch { return null; }
}

const run = (cmd: string, args: string[], cwd: string) => {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout: 120000 });
  return { code: r.status ?? 1, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
};

function logRun(ws: string, rec: RunRec) {
  const f = join(ws, '.claude', 'state', 'agent-runs.jsonl');
  mkdirSync(dirname(f), { recursive: true });
  appendFileSync(f, JSON.stringify(rec) + '\n');
}

/** Pairs start and end lines into runs; a start with no end for six hours is shown as lost. */
function runs(ws: string, key?: string) {
  const f = join(ws, '.claude', 'state', 'agent-runs.jsonl');
  const by = new Map<string, any>();
  if (existsSync(f)) {
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let r: RunRec;
      try { r = JSON.parse(line); } catch { continue; }
      const cur = by.get(r.id) || { id: r.id, agent: r.agent, description: r.description, key: r.key, source: r.source };
      if (r.event === 'start') cur.started = r.ts; else { cur.ended = r.ts; cur.ok = r.ok !== false; }
      by.set(r.id, cur);
    }
  }
  const stale = Date.now() - 6 * 3600 * 1000;
  return [...by.values()]
    .filter((r) => r.started && (!key || r.key === key))
    .map((r) => ({ ...r, state: r.ended ? (r.ok ? 'done' : 'failed') : Date.parse(r.started) < stale ? 'lost' : 'running' }))
    .sort((a, b) => b.started.localeCompare(a.started))
    .slice(0, 200);
}

interface TeamAgent { name: string; description: string; team: string; family: string; scope: string[]; modes: string[]; starters: string[]; mcp: string[]; prompt: string; path: string }

/** The workspace's team agents: .claude/agents/*.md with team: in the front matter (flat key: value lines). */
function teamAgents(ws: string): TeamAgent[] {
  const dir = join(ws, '.claude', 'agents');
  if (!existsSync(dir)) return [];
  const out: TeamAgent[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.md')).sort()) {
    const text = readFileSync(join(dir, f), 'utf8');
    const m = text.match(/^---\n([\s\S]*?)\n---\n/);
    if (!m) continue;
    const fm: Record<string, string> = {};
    for (const line of m[1].split('\n')) { const i = line.indexOf(':'); if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"|"$/g, ''); }
    if (!fm.team) continue;
    const list = (v = '', sep = ',') => v.split(sep).map((x) => x.trim()).filter(Boolean);
    out.push({ name: fm.name || f.slice(0, -3), description: fm.description || '', team: fm.team, family: fm.family || '', scope: list(fm.scope),
      modes: list(fm.modes).filter((x) => MODES.includes(x)).length ? list(fm.modes).filter((x) => MODES.includes(x)) : ['ask'],
      starters: list(fm.starters, '|'), mcp: list(fm.mcp), prompt: text.slice(m[0].length).trim(), path: `.claude/agents/${f}` });
  }
  return out;
}

/** Propose mode changes code, so it follows the spec gate: a work item in build or later with intent, spec and design approved. */
function openSpec(ws: string, key: string | null): string | null {
  if (!key) return 'propose mode needs a work item: pick the one this change belongs to';
  const dir = readdirSync(join(ws, 'specs')).find((d) => d.startsWith(`${key}-`));
  if (!dir) return `no work item ${key} in specs/`;
  try {
    const st = JSON.parse(readFileSync(join(ws, 'specs', dir, 'status.json'), 'utf8'));
    const ap = st.approved || {};
    if (!OPEN_PHASES.includes(st.phase)) return `${key} is in ${st.phase}; changes start in build (nothing is built that is not in an approved spec)`;
    if (!['intent', 'spec', 'design'].every((k) => ap[k])) return `${key} needs intent, spec and design approved before code changes`;
  } catch { return `${key}: status.json could not be read`; }
  return null;
}

function createAgent(ws: string, b: any) {
  const name = String(b.name || '').trim();
  if (!AGENT_NAME.test(name)) throw new Error('name: 3 to 41 characters, lower case letters, digits and hyphens, starting with a letter');
  const file = join(ws, '.claude', 'agents', `${name}.md`);
  if (existsSync(file)) throw new Error(`.claude/agents/${name}.md already exists`);
  const line = (v: unknown, max: number) => String(v || '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);
  const description = line(b.description, 600), team = line(b.team, 60), instructions = String(b.instructions || '').trim().slice(0, 20000);
  if (!description || !team || !instructions) throw new Error('description, team and instructions are required');
  const modes = (Array.isArray(b.modes) ? b.modes : ['ask']).filter((x: string) => MODES.includes(x));
  const scope = (Array.isArray(b.scope) ? b.scope : []).map((x: string) => line(x, 80)).filter((x: string) => /^[\w.-]+$/.test(x));
  const starters = (Array.isArray(b.starters) ? b.starters : []).map((x: string) => line(x, 300).replace(/\|/g, '/')).filter(Boolean);
  const text = ['---', `name: ${name}`, `description: ${description}`, 'tools: Read, Grep, Glob, Bash', `team: ${team}`,
    `family: ${line(b.family, 40)}`, `scope: ${scope.join(', ')}`, `modes: ${(modes.length ? modes : ['ask']).join(', ')}`,
    `starters: ${starters.join(' | ')}`, '---', '', instructions, ''].join('\n');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  return { path: `.claude/agents/${name}.md`, share: `git add .claude/agents/${name}.md && git commit -m "Team agent: ${name}" && git pull --rebase && git push` };
}

function modulesOf(hubDir: string): any[] {
  try { return JSON.parse(readFileSync(join(hubDir, 'content', 'data', 'modules.json'), 'utf8')).modules || []; } catch { return []; }
}

const COMMON = [
  'Back every claim with a file path and line number (path:line). If the code does not show it, say you could not find it.',
  'Never print a secret value (password, token, key, connection string): name the setting instead.',
  'Never output customer personal data.',
  'Answer in short Markdown: the answer first, then the evidence, then "Where to look next".',
];
const bullets = (xs: string[]) => xs.map((r) => `- ${r}`).join('\n');
const RULES = bullets(['You only read. Never write or edit files, never run a command that changes anything.', ...COMMON]);
const MODE_RULES: Record<string, string> = {
  ask: RULES,
  plan: bullets(['You only read. Never write or edit files, never run a command that changes anything.',
    'Produce a plan: numbered steps, each small enough for one pull request, with the files it touches (path:line), how to verify it, the risk and the rollback. End with open questions for the engineer.', ...COMMON]),
  propose: bullets(['You may edit files only inside the current directory, an isolated worktree on a local branch. Nothing you do is pushed; an engineer reviews the diff.',
    'Keep the change to what was asked, follow the existing patterns of the repo, and add or update tests next to the code you change.',
    'Never edit configuration for production, never write a secret value, never delete files you did not create.',
    'Finish with: what you changed and why (path:line), how to verify it, and what else must change outside this repo.', ...COMMON]),
};

function teamPrompt(a: TeamAgent, mode: string, brand: string, focus: string | undefined, key: string | null, repos: string[]) {
  return `${a.prompt}\n\nYou are running from the ${brand} Engineering Hub in ${mode} mode`
    + `${focus ? `, focused on the ${focus} repository` : ''}${key ? `, for work item ${key} (specs/${key}-*/ has its intent, spec and design)` : ''}. `
    + (mode === 'propose' ? `The current directory is the worktree of ${focus}; the workspace documents and work items are added directories. `
      : `Your repositories are cloned at ${repos.map((r) => `code/${r}/`).join(', ') || '(none cloned)'}. code/ is gitignored, so a search of the workspace root skips them: `
      + `always pass one of these paths to Grep and Glob. The workspace documents are under docs/ and the work items under specs/. `)
    + `You have no shell here: the recent commits are listed below, and builds and tests are left to the engineer (say which to run).\n\nRules:\n${MODE_RULES[mode]}`;
}

function modulePrompt(m: any, brand: string) {
  const pack = {
    module: m.name, stack: m.stack, layer: m.component?.layer, summary: m.component?.summary || m.summary, runtime: m.runtime,
    folders: m.folders, entryPoints: m.entryPoints, routeFiles: m.routeFiles, talksTo: m.talksTo, calledBy: m.calledBy,
    changedBy: m.changedBy, branch: m.branch, head: m.head,
  };
  return `You are the ${m.name} module agent for the ${brand} engineering team. The current directory is the ${m.name} repository; `
    + `answer questions about it from its code. The workspace documents (architecture, runbooks, configuration catalog, decisions) are in the added directory.\n\n`
    + `Knowledge pack (where to start looking; the code is the truth):\n${JSON.stringify(pack, null, 1)}\n\nRules:\n${RULES}`;
}

function oncallPrompt(mods: any[], brand: string) {
  const map = mods.map((m) => `- ${m.name} (${m.component?.layer || m.group}): ${m.stack}${m.talksTo?.length ? `; calls ${m.talksTo.slice(0, 8).join(', ')}` : ''}`).join('\n');
  return `You are the on-call support agent for the ${brand} engineering team, working in the engineering workspace. `
    + `Repositories are cloned under code/<name>/ (each one is also an added directory, so search it by that path), runbooks under docs/runbook/, configuration names under docs/env-catalog/, the system model in `
    + `docs/architecture/baseline.json and specs/*/outputs/impact.json, and recent work in specs/.\n\n`
    + `For a symptom or an alert: 1) name the components most likely involved, from the call paths; 2) check what changed recently `
    + `(git log in those repos, specs in build or deploy); 3) follow the code path and its error handling; 4) give the likely causes, most likely first; `
    + `5) list diagnostic steps the engineer can run (logs, Argo CD, kubectl get or describe, health endpoints), read-only; `
    + `6) mitigation options and who to involve. Do not run anything yourself beyond reading.\n\nModules:\n${map}\n\nRules:\n${RULES}`;
}

/** The last commits of each repo, so agents without a shell still see what changed recently. */
function history(ws: string, repos: string[]) {
  const out = repos.filter((r) => existsSync(join(ws, 'code', r, '.git')) || existsSync(join(ws, 'code', r))).slice(0, 12).map((r) => {
    const log = run('git', ['log', '-n', '12', '--since=60.days', '--date=short', '--format=%h %ad %an: %s'], join(ws, 'code', r));
    return log.code === 0 && log.out ? `${r} (${run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], join(ws, 'code', r)).out}):\n${log.out}` : '';
  }).filter(Boolean);
  return out.length ? `\n\nRecent commits (last 60 days, newest first):\n${out.join('\n\n')}` : '';
}

/** Where a tool call looked, relative to the workspace (code/<repo>/..., docs/, specs/) or worktree/ for a propose run. '' is the whole working directory. */
function where(input: any, cwd: string, ws: string, worktree: boolean): string {
  const p = String(input?.file_path || input?.path || '');
  const abs = !p ? cwd : p.startsWith('/') ? p : join(cwd, p);
  if (worktree && (abs === cwd || abs.startsWith(cwd + '/'))) return `worktree/${abs.slice(cwd.length + 1)}`;
  if (abs === ws) return '';
  if (abs === ws || abs.startsWith(ws + '/')) return abs.slice(ws.length + 1);
  return abs;
}

function target(input: any, base: string): string {
  return String(input?.file_path || input?.pattern || input?.path || input?.command || '').split(base + '/').join('').slice(0, 160);
}

const specDirOf = (ws: string, key: string) => { try { return readdirSync(join(ws, 'specs')).find((d) => d.startsWith(`${key}-`)) || null; } catch { return null; } };
// /intent from the hub reads its sources with these read tools only: no Jira or Confluence writes, no Figma edits
const INTENT_MCP: Record<string, string[]> = {
  atlassian: ['getAccessibleAtlassianResources', 'getJiraIssue', 'searchJiraIssuesUsingJql', 'getJiraIssueRemoteIssueLinks', 'getConfluencePage', 'getConfluencePageDescendants', 'searchConfluenceUsingCql', 'search', 'fetch'],
  figma: ['whoami', 'create_session', 'get_metadata', 'get_screenshot', 'get_design_context'],
};

/** Creates a work item with the workspace's own tools/spec.py (which commits and shares the new folder). */
function startWork(hubDir: string, ws: string, b: any) {
  const key = String(b.key || '').trim().toUpperCase(), slug = String(b.slug || '').trim().toLowerCase();
  const kind = String(b.kind || 'jira'), line = (v: unknown, n: number) => String(v || '').replace(/[\r\n]+/g, ' ').trim().slice(0, n);
  if (!KEY.test(key)) throw new Error('key: a tracker key such as TELCO-2513');
  if (!/^[a-z0-9][a-z0-9-]{1,59}$/.test(slug)) throw new Error('short name: lower case letters, digits and hyphens');
  if (!['idea', 'jira', 'github-issue', 'pr'].includes(kind)) throw new Error('kind must be idea, jira, github-issue or pr');
  const args = ['tools/spec.py', 'new', key, slug, '--intake', kind];
  const title = line(b.title, 120), ref = line(b.ref, 300) || (kind === 'jira' ? key : '');
  if (title) args.push('--title', title);
  if (ref) args.push(kind === 'idea' ? '--summary' : '--ref', ref);
  const r = run('python3', args, ws);
  if (r.code !== 0) throw new Error(r.out || 'tools/spec.py refused');
  if (existsSync(join(hubDir, 'tools', 'sync_loop.py'))) run('python3', ['tools/sync_loop.py'], hubDir);
  return { ok: true, dir: specDirOf(ws, key), output: r.out, shared: /share: .* pushed/.test(r.out) };
}

function launch(hubDir: string, ws: string, body: any): Live {
  if (body.agent === 'intent') {
    const k = String(body.key || ''), dir = KEY.test(k) ? specDirOf(ws, k) : null;
    if (!dir) throw new Error(`no work item ${k} in specs/: create it first`);
    let st: any = {};
    try { st = JSON.parse(readFileSync(join(ws, 'specs', dir, 'status.json'), 'utf8')); } catch { /* new folder */ }
    const ref = st.intake?.ref || st.intake?.summary || k;
    body = { ...body, question: `/intent ${k} ${dir.slice(k.length + 1)} ${ref}` };
  }
  const question = String(body.question || '').trim();
  if (!question || question.length > MAX_QUESTION) throw new Error(`the question must be 1 to ${MAX_QUESTION} characters`);
  const key = body.key && KEY.test(body.key) ? body.key : null;
  const brand = (() => { try { return JSON.parse(readFileSync(join(hubDir, 'content', 'brand.json'), 'utf8')).name || 'the'; } catch { return 'the'; } })();
  const mods = modulesOf(hubDir);
  let cwd = ws, system = '', agent = 'oncall', module: string | undefined;
  if (body.agent === 'module') {
    const m = mods.find((x) => x.id === body.module);
    if (!m) throw new Error(`no module ${body.module}; run sync.sh to build the knowledge packs`);
    cwd = join(ws, 'code', m.id);
    if (!existsSync(cwd)) throw new Error(`${m.id} is not cloned under code/`);
    system = modulePrompt(m, brand); agent = `module:${m.id}`; module = m.id;
  } else if (body.agent === 'oncall') {
    system = oncallPrompt(mods, brand);
  } else if (body.agent !== 'team' && body.agent !== 'intent') throw new Error('agent must be oncall, module, team or intent');

  const id = randomUUID();
  let mcpFile: string | undefined, mcpNames: string[] = [];
  let tools: string[] = [], dirs: string[] = [], mode: string | undefined, repo: string | undefined, wt: string | undefined, branch: string | undefined, base: string | undefined;
  if (body.agent === 'intent') {
    const dir = specDirOf(ws, key!)!;
    agent = 'intent'; mode = 'intent';
    tools = [`Edit(./specs/${dir}/**)`];
    let all: Record<string, unknown> = {};
    try { all = JSON.parse(readFileSync(join(ws, '.mcp.json'), 'utf8')).mcpServers || {}; } catch { /* no .mcp.json */ }
    const picked = Object.fromEntries(Object.keys(INTENT_MCP).filter((n) => all[n]).map((n) => [n, all[n]]));
    if (Object.keys(picked).length) {
      mcpFile = join(tmpdir(), `engineering-hub-mcp-${id.slice(0, 8)}.json`);
      writeFileSync(mcpFile, JSON.stringify({ mcpServers: picked }));
      mcpNames = Object.keys(picked);
      tools.push(...mcpNames.flatMap((n) => INTENT_MCP[n].map((t) => `mcp__${n}__${t}`)));
    }
    system = `You are running /intent from the ${brand} Engineering Hub, without a shell. Write only inside specs/${dir}/: the dated source snapshots in inputs/ and intent.md. `
      + `You cannot run tools/spec.py, git or /gap here: list the links you would record (initiative, epics, stories, source URLs) under a "Links to record" heading at the end of intent.md, and say whether /gap is needed. `
      + `Do not approve anything and do not move the phase: the owner reviews intent.md in the hub and approves there. If Jira, Confluence or Figma is not signed in, say so and write what you can.\n\nRules:\n${bullets(COMMON)}`;
  } else if (body.agent === 'team') {
    const a = teamAgents(ws).find((x) => x.name === body.name);
    if (!a) throw new Error(`no team agent ${body.name} in .claude/agents/`);
    mode = String(body.mode || 'ask');
    if (!a.modes.includes(mode)) throw new Error(`${a.name} runs in ${a.modes.join(', ')} mode`);
    const cloned = a.scope.filter((r) => existsSync(join(ws, 'code', r)));
    repo = body.repo ? String(body.repo) : undefined;
    if (repo && !cloned.includes(repo)) throw new Error(`${repo} is not in ${a.name}'s scope or not cloned under code/`);
    agent = `team:${a.name}`;
    if (mode === 'propose') {
      if (!repo) throw new Error('propose mode works on one repository: pick it');
      const why = openSpec(ws, key);
      if (why) throw new Error(why);
      const src = join(ws, 'code', repo);
      base = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], src).out;
      branch = `agent/${a.name}/${key || 'change'}-${id.slice(0, 6)}`;
      // outside the workspace: Claude Code refuses edits under any .claude/ folder
      wt = join(tmpdir(), 'engineering-hub-agents', `${repo}-${id.slice(0, 6)}`);
      const add = run('git', ['worktree', 'add', '-b', branch, wt, 'HEAD'], src);
      if (add.code !== 0) throw new Error(`could not create a worktree of ${repo}: ${add.out}`);
      cwd = wt;
      tools = ['Edit(./**)'];
      dirs = ['docs', 'specs'].map((d) => join(ws, d));
    } else {
      cwd = ws;
      dirs = [...(repo ? [repo] : []), ...cloned.filter((r) => r !== repo)].map((r) => join(ws, 'code', r));
    }
    // MCP servers the agent file names (mcp: in the front matter), taken from the workspace's .mcp.json; no other server is loaded
    if (a.mcp.length) {
      let all: Record<string, unknown> = {};
      try { all = JSON.parse(readFileSync(join(ws, '.mcp.json'), 'utf8')).mcpServers || {}; } catch { /* no .mcp.json */ }
      const picked = Object.fromEntries(a.mcp.filter((n) => all[n]).map((n) => [n, all[n]]));
      const missing = a.mcp.filter((n) => !all[n]);
      if (missing.length) throw new Error(`${a.name} names MCP servers that .mcp.json does not define: ${missing.join(', ')}`);
      mcpFile = join(tmpdir(), `engineering-hub-mcp-${id.slice(0, 8)}.json`);
      writeFileSync(mcpFile, JSON.stringify({ mcpServers: picked }));
      mcpNames = Object.keys(picked);
      tools.push(...mcpNames.map((n) => `mcp__${n}`));
    }
    system = teamPrompt(a, mode, brand, repo, key, repo ? [repo, ...cloned.filter((r) => r !== repo)] : cloned) + history(ws, repo ? [repo] : cloned);
  } else if (agent !== 'oncall') dirs = [join(ws, 'docs')];
  // code/ is gitignored in the workspace, so search tools skip it unless each clone is its own added directory
  else dirs = mods.filter((m) => existsSync(join(ws, 'code', m.id))).map((m) => join(ws, 'code', m.id));
  if (agent === 'oncall') system += history(ws, mods.map((m) => m.id));
  else if (module) system += history(ws, [module]);

  const deny = [...DENY_READ.map((p) => `Read(${p})`), ...(mode === 'propose' || mode === 'intent' ? DENY_READ.map((p) => `Edit(${p})`) : [])];
  const settings = JSON.stringify({ permissions: { deny } });
  const args = ['-p', question, '--output-format', 'stream-json', '--verbose', '--no-session-persistence', '--strict-mcp-config',
    '--settings', settings, '--setting-sources', 'project', '--append-system-prompt', system,
    '--tools', ...TOOLS, ...(mode === 'propose' || mode === 'intent' ? ['Edit', 'Write'] : []), ...(tools.length ? ['--allowedTools', ...tools] : [])];
  for (const d of dirs) args.push('--add-dir', d);
  if (mcpFile) args.push('--mcp-config', mcpFile);
  const home = (x: string) => x.split(process.env.HOME || '\u0000').join('~');
  const shown = args.map((a) => (a === question ? '"<the task>"' : a === system ? '"<the instructions below>"' : /[\s{}"*()]/.test(a) ? `'${a}'` : a));
  const reach: Reach = { repos: wt && repo ? [repo] : dirs.filter((d) => d.startsWith(join(ws, 'code') + '/')).map((d) => d.slice(join(ws, 'code').length + 1)),
    docs: true, edits: wt ? `${repo} worktree on ${branch}` : mode === 'intent' ? `specs/${specDirOf(ws, key!)}/` : null, shell: false, mcp: mcpNames,
    // only through an MCP server the agent file names; the server's name says what it reaches
    databases: mcpNames.some((n) => /db|sql|maria|mysql|postgres|database/i.test(n)), clusters: mcpNames.some((n) => /k8s|kube|argo|rancher|okd|openshift/i.test(n)), network: false };
  if (module) reach.repos = [module];
  const r: Live = { id, agent, module, key, question, state: 'running', started: new Date().toISOString(), text: '', steps: [], mode, repo, worktree: wt, branch, base, reach,
    launch: { cwd: home(cwd), command: home(`claude ${shown.join(' ')}`), instructions: home(system) } };
  live.set(r.id, r);
  logRun(ws, { ts: r.started, event: 'start', id: r.id, agent, description: question.slice(0, 200), key, source: 'hub' });
  const child = spawn('claude', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  children.set(r.id, child);
  const timer = setTimeout(() => { r.error = 'stopped after 10 minutes'; child.kill('SIGTERM'); }, RUN_LIMIT_MS);
  let buf = '', err = '';
  child.stdout.on('data', (c: Buffer) => {
    buf += c.toString('utf8');
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      let ev: any;
      try { ev = JSON.parse(line); } catch { continue; }
      if (ev.type === 'assistant') {
        for (const b of ev.message?.content || []) {
          const at = new Date().toISOString();
          if (b.type === 'tool_use') r.steps.push({ tool: b.name, target: target(b.input, cwd), at, path: where(b.input, cwd, ws, !!wt) });
          else if (b.type === 'text' && String(b.text || '').trim()) r.steps.push({ tool: 'note', target: String(b.text).trim().split('\n')[0].slice(0, 200), at });
        }
      } else if (ev.type === 'result') {
        r.text = String(ev.result || r.text);
        r.cost = ev.total_cost_usd;
        for (const d of ev.permission_denials || []) r.steps.push({ tool: 'blocked', target: `${d.tool_name} ${target(d.tool_input, cwd)}`, at: new Date().toISOString(), path: where(d.tool_input, cwd, ws, !!wt) });
        if (ev.is_error) r.error = r.text || 'the agent reported an error';
      }
    }
  });
  child.stderr.on('data', (c: Buffer) => { err = (err + c.toString('utf8')).slice(-2000); });
  const finish = (ok: boolean, why?: string) => {
    if (r.state !== 'running') return;
    clearTimeout(timer);
    children.delete(r.id);
    if (r.worktree) {
      run('git', ['add', '-A', '-N', '.'], r.worktree);
      r.diffStat = run('git', ['diff', '--stat'], r.worktree).out;
      const d = run('git', ['diff'], r.worktree).out;
      r.diff = d.length > MAX_DIFF ? `${d.slice(0, MAX_DIFF)}\n... diff cut at 300 KB; see the worktree` : d;
    }
    r.state = ok && !r.error ? 'done' : 'failed';
    if (!ok && !r.error) r.error = why || err.trim() || 'the agent stopped';
    r.ended = new Date().toISOString();
    logRun(ws, { ts: r.ended, event: 'end', id: r.id, agent, description: question.slice(0, 200), key, source: 'hub', ok: r.state === 'done' });
  };
  child.on('error', (e) => finish(false, `could not start claude: ${e.message}`));
  child.on('close', (code) => finish(code === 0));
  return r;
}

/** Removes an agent's worktree and its local branch (the engineer chose to discard the change). */
function discard(ws: string, r: Live) {
  if (!r.worktree || !r.repo || !r.branch) throw new Error('this run has no worktree');
  if (r.state === 'running') throw new Error('stop the run first');
  const src = join(ws, 'code', r.repo);
  const rm = run('git', ['worktree', 'remove', '--force', r.worktree], src);
  if (rm.code !== 0) throw new Error(rm.out);
  run('git', ['branch', '-D', r.branch], src);
  r.worktree = undefined; r.diff = undefined; r.diffStat = 'discarded';
}

export function hubLoopApi(hubDir: string): Plugin {
  const send = (res: any, code: number, body: unknown) => {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
  };
  const handle = async (req: any, res: any, next: () => void) => {
    const [path, query = ''] = (req.url || '').split('?');
    if (!path.startsWith('/api/loop')) return next();
    if (!LOOPBACK.has(req.socket?.remoteAddress)) return send(res, 403, { error: 'local only' });
    const origin = req.headers.origin;
    if (origin && !/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(origin)) return send(res, 403, { error: 'cross-origin requests are refused' });
    const ws = workspaceOf(hubDir);
    if (!ws || !existsSync(join(ws, 'tools', 'spec.py'))) return send(res, 404, { error: 'this hub has no workspace with tools/spec.py' });
    const q = new URLSearchParams(query);
    try {
      if (req.method === 'GET') {
        if (path === '/api/loop') {
          const who = run('git', ['config', 'user.name'], ws).out;
          if (claudeVersion === undefined) {
            const c = spawnSync('claude', ['--version'], { encoding: 'utf8', timeout: 15000 });
            claudeVersion = c.status === 0 ? (c.stdout || '').trim() : null;
          }
          return send(res, 200, { writable: true, approver: who, agents: !!claudeVersion, claude: claudeVersion || '' });
        }
        if (path === '/api/loop/agents') {
          return send(res, 200, { agents: teamAgents(ws).map((a) => ({ ...a, cloned: a.scope.filter((x) => existsSync(join(ws, 'code', x))) })) });
        }
        if (path === '/api/loop/runs') return send(res, 200, { runs: runs(ws, q.get('key') || undefined), live: [...live.values()].map(({ text, diff, launch, ...r }) => r) });
        if (path.startsWith('/api/loop/agent/')) {
          const r = live.get(path.slice('/api/loop/agent/'.length));
          return r ? send(res, 200, r) : send(res, 404, { error: 'no such run (runs are kept until the hub server restarts)' });
        }
        if (path === '/api/loop/check') {
          const key = q.get('key') || '';
          if (!KEY.test(key)) return send(res, 400, { error: 'key is required' });
          const r = run('python3', ['tools/spec.py', 'check', key], ws);
          return send(res, 200, { ok: r.code === 0, output: r.out });
        }
        return send(res, 404, { error: 'unknown path' });
      }
      if (req.method !== 'POST') return send(res, 405, { error: 'GET or POST' });
      if (!String(req.headers['content-type'] || '').startsWith('application/json')) return send(res, 415, { error: 'send application/json' });
      const body = JSON.parse(await readBody(req));
      if (path === '/api/loop/approve' || path === '/api/loop/phase') {
        if (!KEY.test(body.key || '')) throw new Error('key is required');
        const approve = path.endsWith('approve');
        if (approve && !APPROVABLE.includes(body.what)) throw new Error(`what must be one of ${APPROVABLE.join(', ')}`);
        if (!approve && !PHASES.includes(body.phase)) throw new Error(`phase must be one of ${PHASES.join(', ')}`);
        const who = run('git', ['config', 'user.name'], ws).out;
        if (approve && !who) throw new Error('set git config user.name in the workspace first: approvals carry a name');
        const r = run('python3', approve ? ['tools/spec.py', 'approve', body.key, body.what, '--by', who] : ['tools/spec.py', 'phase', body.key, body.phase], ws);
        if (r.code !== 0) return send(res, 409, { error: r.out || 'tools/spec.py refused' });
        // refresh the hub's copy of the loop so the page shows the new state
        const sync = existsSync(join(hubDir, 'tools', 'sync_loop.py')) ? run('python3', ['tools/sync_loop.py'], hubDir) : { code: 0, out: '' };
        return send(res, 200, { ok: true, output: r.out, synced: sync.code === 0, note: /share: .* pushed/.test(r.out) ? 'Shared with the team: tools/spec.py committed and pushed the work item.' : 'status.json changed in the workspace; tools/spec.py did not push it (see above), so push the work item yourself.' });
      }
      if (path === '/api/loop/agent') {
        const r = launch(hubDir, ws, body);
        return send(res, 200, { id: r.id });
      }
      if (path === '/api/loop/agents') return send(res, 200, createAgent(ws, body));
      if (path === '/api/loop/start') return send(res, 200, startWork(hubDir, ws, body));
      if (path === '/api/loop/agent/stop' || path === '/api/loop/agent/discard') {
        const r = live.get(String(body.id || ''));
        if (!r) throw new Error('no such run');
        if (path.endsWith('stop')) { r.error = 'stopped from the hub'; children.get(r.id)?.kill('SIGTERM'); }
        else discard(ws, r);
        return send(res, 200, { ok: true });
      }
      return send(res, 404, { error: 'unknown path' });
    } catch (e) {
      return send(res, 400, { error: (e as Error).message });
    }
  };
  return {
    name: 'hub-loop-api',
    configureServer: (s) => { s.middlewares.use(handle); },
    configurePreviewServer: (s) => { s.middlewares.use(handle); },
  };
}
