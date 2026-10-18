#!/usr/bin/env node
/* ============================================================
   Engineering Hub — content build.
   - Copies every local doc into content/kb-src/ so the hub can
     render it (so ALL local files are linked and viewable).
   - Auto-generates the knowledge-base index from that scan.
   - Assembles content/manifest.json from the data + config files.
   Run from outputs/engineer-guide/:  node build.mjs
   Then re-sync the folder to S3.
   ============================================================ */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, statSync, rmSync, copyFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const C = join(ROOT, 'content');
const D = join(C, 'data');
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const readIf = p => existsSync(p) ? read(p) : null;

const brand = readIf(join(C, 'brand.json')) || { docsDir: 'docs' };
// repo root: brand.json "repoRoot" (relative to this folder), default two levels up
// (outputs/engineer-guide -> project root).
const REPO = join(ROOT, brand.repoRoot || join('..', '..'));
const DOCS = join(REPO, brand.docsDir || 'docs');

/* ---- 1. mirror all docs into content/kb-src and build the kb index ---- */
const KBSRC = join(C, 'kb-src', brand.docsDir || 'docs');
const GROUPS = {
  'knowledge-base': 'Knowledge base', 'architecture': 'Architecture',
  'adr': 'Decisions (ADR)', 'requirements': 'Requirements',
  'developer-guide': 'Developer guide'
};
const kb = [];
function titleOf(txt, fallback) {
  const m = txt.match(/^#\s+(.+)$/m);
  return (m ? m[1] : fallback).replace(/[#*`]/g, '').trim().slice(0, 90);
}
function summaryOf(txt) {
  const lines = txt.split('\n').map(l => l.trim());
  for (const l of lines) {
    if (!l || l.startsWith('#') || l.startsWith('>') || l.startsWith('|') || l.startsWith('```') || l.startsWith('-')) continue;
    return l.replace(/[*`\[\]]/g, '').replace(/\(.*?\)/g, '').slice(0, 130);
  }
  return '';
}
function walk(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) { walk(p); continue; }
    if (!name.endsWith('.md')) continue;
    const relFromRepo = relative(REPO, p);           // e.g. docs/knowledge-base/x.md
    const relFromDocs = relative(DOCS, p);           // e.g. knowledge-base/x.md
    const txt = readFileSync(p, 'utf8');
    // copy into kb-src preserving the docs-relative path
    const dest = join(KBSRC, relFromDocs);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, txt);
    const top = relFromDocs.split('/')[0];
    kb.push({
      title: titleOf(txt, name.replace(/\.md$/, '')),
      path: relFromRepo.replace(/\\/g, '/'),
      group: GROUPS[top] || 'Docs',
      summary: summaryOf(txt)
    });
  }
}
// refresh kb-src cleanly
if (existsSync(join(C, 'kb-src'))) rmSync(join(C, 'kb-src'), { recursive: true, force: true });
walk(DOCS);

/* ---- 1b. extra knowledge-base roots (brand.json "kbRoots") ----
   [{ "dir": "streams/x/output/html", "group": "X documents", "types": ["md","html","pdf"],
      "latestOnly": true, "exclude": ["drafts"] }]
   Versioned folders (v<N>-<date>.html + index.html) contribute only their highest version
   when latestOnly is true, and their index.html is skipped. */
const htmlTitle = t => ((t.match(/<title[^>]*>([^<]+)<\/title>/i) || t.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const htmlSummary = t => { const m = t.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').match(/<p[^>]*>([\s\S]*?)<\/p>/i); return m ? m[1].replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, 140) : ''; };
const VRE = /^v(\d+)-[\d-]+\.(html?|md|pdf)$/i;
(brand.kbRoots || []).forEach((root, order) => {
  const base = join(REPO, root.dir);
  const types = root.types || ['md', 'html', 'pdf'];
  const excl = root.exclude || [];
  const visit = dir => {
    if (!existsSync(dir)) return;
    const names = readdirSync(dir);
    const versioned = names.filter(n => VRE.test(n));
    const latest = versioned.sort((a, b) => +b.match(VRE)[1] - +a.match(VRE)[1])[0];
    for (const name of names) {
      const p = join(dir, name);
      if (excl.some(x => p.includes(x))) continue;
      if (statSync(p).isDirectory()) { visit(p); continue; }
      const ext = (name.split('.').pop() || '').toLowerCase();
      if (!types.includes(ext === 'htm' ? 'html' : ext)) continue;
      if (root.latestOnly !== false && versioned.length && (name === 'index.html' || (VRE.test(name) && name !== latest))) continue;
      const rel = relative(REPO, p).replace(/\\/g, '/');
      const dest = join(C, 'kb-src', rel);
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(p, dest);
      let title = '', summary = '';
      const folder = dir.split(/[\\/]/).pop().replace(/[-_]/g, ' ');
      if (ext === 'md') { const t = readFileSync(p, 'utf8'); title = titleOf(t, name); summary = summaryOf(t); }
      else if (ext.startsWith('htm')) { const t = readFileSync(p, 'utf8'); title = htmlTitle(t) || folder; summary = htmlSummary(t); }
      else title = name.replace(/\.[a-z]+$/i, '').replace(/^\d+\s*-\s*/, '');
      const vm = name.match(VRE);
      kb.push({ title: title.slice(0, 100), path: rel, group: root.group || 'Docs', summary, version: vm ? 'v' + vm[1] : '', order: order + 1 });
    }
  };
  visit(base);
});
kb.sort((a, b) => ((a.order || 0) - (b.order || 0)) || (a.group + a.title).localeCompare(b.group + b.title));

/* ---- 2. assemble manifest ---- */
const nav = read(join(C, 'nav.json'));
const overview = read(join(C, 'overview.json'));
const sections = read(join(C, 'sections.json'));
const features = read(join(D, 'features.json'));
const roadmapExtra = readIf(join(D, 'roadmapExtra.json')) || [];
const adrs = readIf(join(D, 'adrs.json')) || [];
const gaps = readIf(join(D, 'gaps.json')) || [];
const security = readIf(join(D, 'security.json')) || [];
const performance = readIf(join(D, 'performance.json')) || [];
const gtm = readIf(join(D, 'gtm.json')) || [];
const summary = readIf(join(D, 'summary.json')) || { defects: {} };

const warns = [];

/* ---- learning paths: content/learning/paths.json + content/learning/courses/*.json ----
   A lesson either has "src" (a file inside this folder, usually markdown) or "from"
   (a file elsewhere in the repo, relative to the repo root, usually an HTML lesson):
   "from" files are copied into content/learning-src/ so the hub deploys self-contained. */
const LDIR = join(C, 'learning');
const LSRC = join(C, 'learning-src');
if (existsSync(LSRC)) rmSync(LSRC, { recursive: true, force: true });
let learning = null;
if (existsSync(join(LDIR, 'paths.json'))) {
  const lp = read(join(LDIR, 'paths.json'));
  const cdir = join(LDIR, 'courses');
  const all = existsSync(cdir) ? readdirSync(cdir).filter(n => n.endsWith('.json')).map(n => read(join(cdir, n))) : [];
  const order = lp.courseOrder || [];
  all.sort((a, b) => ((order.indexOf(a.id) + 1 || 999) - (order.indexOf(b.id) + 1 || 999)) || a.id.localeCompare(b.id));
  for (const c of all) {
    for (const l of c.lessons || []) {
      if (l.from) {
        const srcAbs = join(REPO, l.from);
        if (!existsSync(srcAbs)) { warns.push(`missing lesson source: ${l.from} (${c.id}/${l.id})`); continue; }
        const dest = join(LSRC, l.from);
        mkdirSync(dirname(dest), { recursive: true });
        copyFileSync(srcAbs, dest);
        l.src = 'content/learning-src/' + l.from.replace(/\\/g, '/');
        delete l.from;
      } else if (!l.src || !existsSync(join(ROOT, l.src))) warns.push(`missing lesson: ${l.src || '(no src)'} (${c.id}/${l.id})`);
    }
    for (const pre of c.prereqs || []) if (!all.find(x => x.id === pre)) warns.push(`course ${c.id}: unknown prereq ${pre}`);
  }
  for (const p of lp.paths || []) for (const st of p.steps || p.courses || []) {
    const [cid, lid] = String(st).split('/'); const c = all.find(x => x.id === cid);
    if (!c || (lid && !c.lessons.find(l => l.id === lid))) warns.push(`path ${p.id}: unknown step ${st}`);
  }
  learning = { ...lp, courses: all };
}
for (const f of features) {
  if (!existsSync(join(C, 'features', `${f.id}.md`))) warns.push(`missing dossier: content/features/${f.id}.md`);
  if (f.mockup && !existsSync(join(ROOT, f.mockup))) warns.push(`missing mockup: ${f.mockup}`);
}

/* ---- traceability: link each feature to the real code under code/, flag drift ---- */
const CODE = join(REPO, brand.codeDir || 'code');
// repo list: brand.repos allowlist if given (recommended, excludes dead clones),
// else auto-derive from the directories present in code/ (generic default).
const REPOS = Array.isArray(brand.repos) && brand.repos.length
  ? brand.repos
  : (existsSync(CODE) ? readdirSync(CODE).filter(d => { try { return statSync(join(CODE, d)).isDirectory(); } catch (_) { return false; } }) : []);
const repoBase = brand.repoBase || '';
const headCache = {};
const repoHead = r => { if (r in headCache) return headCache[r]; let h = ''; try { h = execSync(`git -C "${join(CODE, r)}" rev-parse --short HEAD`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (_) {} return headCache[r] = h; };
const refRe = new RegExp('(' + REPOS.join('|') + ')/[A-Za-z0-9._/-]+\\.(?:vue|ts|js)', 'g');
const traceability = {};
const drift = [];
if (existsSync(CODE) && REPOS.length) {
  for (const f of features) {
    const p = join(C, 'features', `${f.id}.md`);
    if (!existsSync(p)) continue;
    const refs = Array.from(new Set(readFileSync(p, 'utf8').match(refRe) || []));
    const files = refs.map(ref => {
      const repo = ref.split('/')[0], rel = ref.slice(repo.length + 1);
      const exists = existsSync(join(CODE, repo, rel));
      const head = repoHead(repo);
      return { path: ref, repo, exists, url: (repoBase && head) ? `${repoBase}/${repo}/blob/${head}/${rel}` : '' };
    });
    const missing = files.filter(x => !x.exists).length;
    const built = ['built', 'partial'].includes((f.status || '').toLowerCase());
    let state = 'none';
    if (files.length) state = missing ? 'drift' : 'linked';
    else if (built) state = 'unlinked';
    traceability[f.id] = { files, total: files.length, missing, state, status: f.status };
    if (state === 'drift') drift.push(`${f.id}: ${missing}/${files.length} referenced files not found in code/`);
    else if (state === 'unlinked') drift.push(`${f.id}: status "${f.status}" but no code file referenced in the dossier`);
  }
}

const manifest = {
  meta: { generated: new Date().toISOString().slice(0, 10), version: 'v1', brand: brand.name || '' },
  overview, nav, sections, features, roadmapExtra, adrs, gaps, security, performance, gtm, kb, traceability, learning,
  defectsSummary: { total: summary.defects?.total || 0, critical: summary.defects?.critical || 0, high: summary.defects?.high || 0, medium: summary.defects?.medium || 0, low: summary.defects?.low || 0 },
  counts: { gaps: summary.gaps || null, security: summary.security || null }
};
writeFileSync(join(C, 'manifest.json'), JSON.stringify(manifest, null, 0));

console.log(`manifest.json written: ${learning ? learning.courses.length + ' courses, ' + learning.courses.reduce((n, c) => n + c.lessons.length, 0) + ' lessons, ' : ''}${features.length} features, ${adrs.length} ADRs, ${gaps.length} gaps, ${security.length} security, ${gtm.length} GTM actions, ${kb.length} docs linked.`);
if (warns.length) { console.log('\nWARNINGS:'); warns.forEach(w => console.log('  - ' + w)); }
else console.log('All feature dossiers and mockups present.');
if (existsSync(CODE) && REPOS.length) {
  const linked = Object.values(traceability).filter(t => t.state === 'linked').length;
  console.log(`code traceability: ${linked} features linked to code, ${drift.length} with drift or unlinked.`);
  if (drift.length) { console.log('\nTRACEABILITY DRIFT (dossier vs code/):'); drift.forEach(d => console.log('  - ' + d)); }
} else {
  console.log('code traceability: skipped (no code/ clones found next to the hub).');
}
