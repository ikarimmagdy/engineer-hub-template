import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

// Local write path for the hub's data files: POST /api/data/<file> with one operation as JSON.
// Mounted only on the dev and preview servers and answers loopback clients only. A statically
// served hub has no /api, so the front-end shows the data read-only.

type Item = Record<string, unknown>;
type Op =
  | { op: 'update'; id: string; set: Item }
  | { op: 'append'; id: string; field: string; text: string }
  | { op: 'add'; item: Item };

interface FileRule {
  /** Fields an update may set, each with a check that returns an error or null. */
  set: Record<string, (v: unknown, ctx: Ctx) => string | null>;
  /** Text fields a note may be appended to. */
  append?: string[];
  /** Whether new items may be added (questions only). */
  add?: boolean;
}
interface Ctx { items: Item[]; field: string; dataDir: string }

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const MAX_BODY = 256 * 1024;

const str = (max: number) => (v: unknown) => (typeof v === 'string' && v.length <= max ? null : `must be text of at most ${max} characters`);
const date = (v: unknown) => (v === '' || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) ? null : 'must be YYYY-MM-DD or empty');
const ids = (v: unknown) =>
  Array.isArray(v) && v.length <= 50 && v.every((x) => typeof x === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/.test(x)) ? null : 'must be a list of ids';
/** A value the file already uses for this field (plus any listed), so typos cannot invent new states. */
const known = (...extra: string[]) => (v: unknown, ctx: Ctx) => {
  const used = new Set([...extra, ...ctx.items.map((i) => i[ctx.field]).filter((x): x is string => typeof x === 'string')]);
  return typeof v === 'string' && used.has(v) ? null : `must be one of: ${[...used].sort().join(', ')}`;
};
const stage = (v: unknown, ctx: Ctx) => {
  const f = join(ctx.dataDir, 'lifecycle.json');
  const keys: string[] = existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')).stages || []).map((s: { key: string }) => s.key) : [];
  return keys.length ? (typeof v === 'string' && keys.includes(v) ? null : `must be one of: ${keys.join(', ')}`) : known()(v, ctx);
};

const RULES: Record<string, FileRule> = {
  'questions.json': {
    set: {
      status: known('open', 'answered'), answer: str(4000), answeredOn: date, priority: known('P0', 'P1', 'P2'),
      blocks: ids, question: str(1000), askWho: str(80), category: known(), why: str(2000),
    },
    add: true,
  },
  'gaps.json': { set: { status: known('open', 'fixed') }, append: ['summary'] },
  'features.json': { set: { lifecycle: stage, status: known() } },
};

function format(text: string, data: unknown): string {
  const indent = (text.match(/^[[{]\n( +)/) || [])[1]?.length || 2;
  let out = JSON.stringify(data, null, indent);
  // Keep \u escapes only where the file already used them (files written with ensure_ascii).
  if (text.includes('\\u')) out = out.replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  return text.endsWith('\n') ? out + '\n' : out;
}

const today = () => new Date().toISOString().slice(0, 10);
const findItem = (items: Item[], id: string) => items.find((i) => i.id === id || i.fid === id);

function apply(file: string, items: Item[], body: Op, dataDir: string): Item {
  const rule = RULES[file];
  const check = (set: Item) => {
    for (const [k, v] of Object.entries(set)) {
      const fn = rule.set[k];
      if (!fn) throw new Error(`${k} cannot be changed in ${file}`);
      const err = fn(v, { items, field: k, dataDir });
      if (err) throw new Error(`${k} ${err}`);
    }
  };
  if (body.op === 'update') {
    const item = findItem(items, body.id);
    if (!item) throw new Error(`no item ${body.id} in ${file}`);
    const set = body.set || {};
    check(set);
    for (const [k, v] of Object.entries(set)) {
      if (v === '' && k !== 'answer') delete item[k];
      else item[k] = v;
    }
    return item;
  }
  if (body.op === 'append') {
    const item = findItem(items, body.id);
    if (!item) throw new Error(`no item ${body.id} in ${file}`);
    if (!rule.append?.includes(body.field)) throw new Error(`${body.field} cannot be appended to in ${file}`);
    const text = String(body.text || '').trim();
    if (!text || text.length > 2000) throw new Error('the note must be 1 to 2000 characters');
    const prev = typeof item[body.field] === 'string' ? (item[body.field] as string) : '';
    item[body.field] = `${prev}${prev ? ' ' : ''}${today()}: ${text}`;
    return item;
  }
  if (body.op === 'add') {
    if (!rule.add) throw new Error(`items cannot be added to ${file}`);
    const src = { ...(body.item || {}) };
    for (const k of ['question', 'askWho', 'category', 'priority']) if (!src[k]) throw new Error(`${k} is required`);
    delete src.id; delete src.raised; delete src.status;
    check(src);
    const prefix = String((items.find((i) => typeof i.id === 'string')?.id as string | undefined)?.replace(/\d+$/, '') || 'Q-');
    const next = 1 + Math.max(0, ...items.map((i) => Number(String(i.id || '').replace(/^\D+/, '')) || 0));
    const width = String(items[0]?.id || '').replace(/^\D+/, '').length || 3;
    const item: Item = { id: `${prefix}${String(next).padStart(width, '0')}`, ...src, status: 'open', raised: today() };
    if (!Array.isArray(item.blocks)) item.blocks = [];
    items.push(item);
    return item;
  }
  throw new Error('op must be update, append or add');
}

function readBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('body too large')); req.destroy(); } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function hubDataApi(hubDir: string): Plugin {
  const dataDir = join(hubDir, 'content', 'data');
  const send = (res: any, code: number, body: unknown) => {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
  };
  const handle = async (req: any, res: any, next: () => void) => {
    const [path, query = ''] = (req.url || '').split('?');
    if (!path.startsWith('/api/data')) return next();
    if (!LOOPBACK.has(req.socket?.remoteAddress)) return send(res, 403, { error: 'local only' });
    const origin = req.headers.origin;
    if (origin && !/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(origin)) return send(res, 403, { error: 'cross-origin writes are refused' });

    if (req.method === 'GET' && (path === '/api/data' || path === '/api/data/')) {
      return send(res, 200, {
        writable: true,
        files: Object.fromEntries(Object.entries(RULES).map(([f, r]) => [f, { set: Object.keys(r.set), append: r.append || [], add: !!r.add }])),
      });
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) return send(res, 415, { error: 'send application/json' });

    const file = decodeURIComponent(path.slice('/api/data/'.length));
    if (!RULES[file]) return send(res, 404, { error: `${file} is not writable; allowed: ${Object.keys(RULES).join(', ')}` });
    const target = join(dataDir, file);
    try {
      const body = JSON.parse(await readBody(req)) as Op;
      const text = readFileSync(target, 'utf8');
      const items = JSON.parse(text);
      if (!Array.isArray(items)) throw new Error(`${file} is not a list`);
      const item = apply(file, items, body, dataDir);
      const out = format(text, items);
      JSON.parse(out);
      if (/(^|&)dryRun=1(&|$)/.test(query)) return send(res, 200, { ok: true, dryRun: true, item, changed: out !== text });
      const tmp = `${target}.${process.pid}.tmp`;
      writeFileSync(tmp, out);
      renameSync(tmp, target);
      return send(res, 200, { ok: true, item });
    } catch (e) {
      return send(res, 400, { error: String((e as Error).message || e) });
    }
  };
  return {
    name: 'hub-data-api',
    configureServer: (s) => { s.middlewares.use(handle); },
    configurePreviewServer: (s) => { s.middlewares.use(handle); },
  };
}
