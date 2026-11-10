import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { Plugin } from 'vite';

// The loop on this laptop: approve gates and move phases through the workspace's tools/spec.py,
// read the subagent runs the workspace's agent-log hook records, and run read-only agents
// (on-call, one per module) through the local Claude Code login. Mounted only on the dev and
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
const TOOLS = ['Read', 'Grep', 'Glob', 'Bash(git log:*)', 'Bash(git show:*)', 'Bash(git blame:*)', 'Bash(git grep:*)', 'Bash(git diff:*)'];

interface RunRec { ts: string; event: 'start' | 'end'; id: string; agent: string; description: string; key: string | null; source: string; ok?: boolean }
interface Step { tool: string; target: string }
interface Live {
  id: string; agent: string; module?: string; key: string | null; question: string; state: 'running' | 'done' | 'failed';
  started: string; ended?: string; text: string; steps: Step[]; error?: string; cost?: number;
}

const live = new Map<string, Live>();
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

function modulesOf(hubDir: string): any[] {
  try { return JSON.parse(readFileSync(join(hubDir, 'content', 'data', 'modules.json'), 'utf8')).modules || []; } catch { return []; }
}

const RULES = [
  'You only read. Never write or edit files, never run a command that changes anything.',
  'Back every claim with a file path and line number (path:line). If the code does not show it, say you could not find it.',
  'Never print a secret value (password, token, key, connection string): name the setting instead.',
  'Never output customer personal data.',
  'Answer in short Markdown: the answer first, then the evidence, then "Where to look next".',
].map((r) => `- ${r}`).join('\n');

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

function target(input: any, base: string): string {
  return String(input?.file_path || input?.pattern || input?.path || input?.command || '').split(base + '/').join('').slice(0, 160);
}

function launch(hubDir: string, ws: string, body: any): Live {
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
  } else throw new Error('agent must be oncall or module');

  const settings = JSON.stringify({ permissions: { deny: DENY_READ.map((p) => `Read(${p})`) } });
  const args = ['-p', question, '--output-format', 'stream-json', '--verbose', '--no-session-persistence', '--strict-mcp-config',
    '--settings', settings, '--setting-sources', 'project', '--append-system-prompt', system, '--allowedTools', ...TOOLS];
  // code/ is gitignored in the workspace, so search tools skip it unless each clone is its own added directory
  if (agent !== 'oncall') args.push('--add-dir', join(ws, 'docs'));
  else for (const m of mods) if (existsSync(join(ws, 'code', m.id))) args.push('--add-dir', join(ws, 'code', m.id));
  const r: Live = { id: randomUUID(), agent, module, key, question, state: 'running', started: new Date().toISOString(), text: '', steps: [] };
  live.set(r.id, r);
  logRun(ws, { ts: r.started, event: 'start', id: r.id, agent, description: question.slice(0, 200), key, source: 'hub' });
  const child = spawn('claude', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
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
          if (b.type === 'tool_use') r.steps.push({ tool: b.name, target: target(b.input, cwd) });
        }
      } else if (ev.type === 'result') {
        r.text = String(ev.result || r.text);
        r.cost = ev.total_cost_usd;
        if (ev.is_error) r.error = r.text || 'the agent reported an error';
      }
    }
  });
  child.stderr.on('data', (c: Buffer) => { err = (err + c.toString('utf8')).slice(-2000); });
  const finish = (ok: boolean, why?: string) => {
    if (r.state !== 'running') return;
    clearTimeout(timer);
    r.state = ok && !r.error ? 'done' : 'failed';
    if (!ok && !r.error) r.error = why || err.trim() || 'the agent stopped';
    r.ended = new Date().toISOString();
    logRun(ws, { ts: r.ended, event: 'end', id: r.id, agent, description: question.slice(0, 200), key, source: 'hub', ok: r.state === 'done' });
  };
  child.on('error', (e) => finish(false, `could not start claude: ${e.message}`));
  child.on('close', (code) => finish(code === 0));
  return r;
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
        if (path === '/api/loop/runs') return send(res, 200, { runs: runs(ws, q.get('key') || undefined), live: [...live.values()].map(({ text, ...r }) => r) });
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
        return send(res, 200, { ok: true, output: r.out, synced: sync.code === 0, note: 'status.json changed in the workspace; review and commit it yourself' });
      }
      if (path === '/api/loop/agent') {
        const r = launch(hubDir, ws, body);
        return send(res, 200, { id: r.id });
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
