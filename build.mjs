#!/usr/bin/env node
/* ============================================================
   Engineering Hub, content build (template v3).
   - Copies every local doc into content/kb-src/ so the hub can
     render it (so ALL local files are linked and viewable).
   - Auto-generates the knowledge-base index from that scan.
   - Assembles content/manifest.json from the data + config files.
   - Brands index.html from content/brand.json (title, base href,
     fonts, favicon, logo, optional content/brand.css).
   Run from the hub folder:  node build.mjs   (or ./sync.sh)
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
const IMG = /\.(png|jpe?g|gif|svg|webp)$/i;
function titleOf(txt, fallback) {
  const m = txt.match(/^#\s+(.+)$/m);
  // no heading: the file name, readable ("selfcare-apis.md" -> "Selfcare apis")
  const name = String(fallback).replace(/\.[a-z]+$/i, '').replace(/[-_]+/g, ' ').trim();
  return (m ? m[1] : name.charAt(0).toUpperCase() + name.slice(1)).replace(/[#*`]/g, '').trim().slice(0, 90);
}
// every file copied into kb-src (repo-relative), so the hub can tell a working relative link from a dead one
const kbFiles = [];
function summaryOf(txt) {
  const lines = txt.split('\n').map(l => l.trim());
  for (const l of lines) {
    if (!l || l.startsWith('#') || l.startsWith('>') || l.startsWith('|') || l.startsWith('```') || l.startsWith('-')) continue;
    return clip(l.replace(/[*`\[\]]/g, '').replace(/\(.*?\)/g, ''), 130);
  }
  return '';
}
// cut at a word boundary with an ellipsis, never mid-word
function clip(t, n) { t = String(t).replace(/\s+/g, ' ').trim(); if (t.length <= n) return t; const c = t.slice(0, n); return c.slice(0, Math.max(c.lastIndexOf(' '), n * .6)).replace(/[\s,;:.\-]+$/, '') + '…'; }
// exact version files (v<N>-<YYYY-MM-DD>.<ext>); run logs such as v3-<date>-run.md do not match
const EXACT_V = /^v(\d+)-\d{4}-\d{2}-\d{2}\.(md|html?|pdf)$/i;
const latestExact = (names, ext) => names.filter(n => EXACT_V.test(n) && n.toLowerCase().endsWith(ext))
  .sort((a, b) => +b.match(EXACT_V)[1] - +a.match(EXACT_V)[1])[0];
function walk(dir) {
  if (!existsSync(dir)) return;
  const names = readdirSync(dir);
  // a versioned folder lists only its highest version (plus README.md / index.html, its version
  // index); older versions are still copied so the index links keep working
  const latestMd = latestExact(names, '.md');
  for (const name of names) {
    const p = join(dir, name);
    // the hub may live inside docsDir; never walk its own output
    if (p === ROOT || name.startsWith('.') || name === 'test-data') continue;   // test-data holds personal data, never mirrored
    const st = statSync(p);
    if (st.isDirectory()) { walk(p); continue; }
    // images, PDFs and JSON records referenced by the docs travel with them (PDFs open in the hub's document view)
    if (IMG.test(name) || /\.(pdf|json)$/i.test(name)) { const d = join(KBSRC, relative(DOCS, p)); mkdirSync(dirname(d), { recursive: true }); copyFileSync(p, d); kbFiles.push(relative(REPO, p).replace(/\\/g, '/')); continue; }
    if (!name.endsWith('.md') || name === 'CLAUDE.md') continue;
    const relFromRepo = relative(REPO, p);           // e.g. docs/knowledge-base/x.md
    const relFromDocs = relative(DOCS, p);           // e.g. knowledge-base/x.md
    const txt = readFileSync(p, 'utf8');
    // copy into kb-src preserving the docs-relative path
    const dest = join(KBSRC, relFromDocs);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, txt);
    kbFiles.push(relFromRepo.replace(/\\/g, '/'));
    if (latestMd && EXACT_V.test(name) && name !== latestMd) continue;
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
   Versioned folders (v<N>-<date>.html + index.html) list only their highest version plus
   index.html (the version index) when latestOnly is true; older versions are still copied so its links work. */
const htmlTitle = t => ((t.match(/<title[^>]*>([^<]+)<\/title>/i) || t.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const htmlSummary = t => { const m = t.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').match(/<p[^>]*>([\s\S]*?)<\/p>/i); return m ? m[1].replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim() : ''; };
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
      if (IMG.test(name)) { const d = join(C, 'kb-src', relative(REPO, p)); mkdirSync(dirname(d), { recursive: true }); copyFileSync(p, d); kbFiles.push(relative(REPO, p).replace(/\\/g, '/')); continue; }
      if (!types.includes(ext === 'htm' ? 'html' : ext) || name === 'CLAUDE.md') continue;
      const rel = relative(REPO, p).replace(/\\/g, '/');
      const dest = join(C, 'kb-src', rel);
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(p, dest);
      kbFiles.push(rel);
      // older versions are copied (the version index links to them) but not listed
      if (root.latestOnly !== false && versioned.length && VRE.test(name) && name !== latest) continue;
      let title = '', summary = '';
      const folder = dir.split(/[\\/]/).pop().replace(/[-_]/g, ' ');
      if (ext === 'md') { const t = readFileSync(p, 'utf8'); title = titleOf(t, name); summary = summaryOf(t); }
      else if (ext.startsWith('htm')) { const t = readFileSync(p, 'utf8'); title = htmlTitle(t) || folder; summary = htmlSummary(t); }
      else title = name.replace(/\.[a-z]+$/i, '').replace(/^\d+\s*-\s*/, '');
      const vm = name.match(VRE);
      kb.push({ title: title.slice(0, 100), path: rel, group: root.group || 'Docs', summary: clip(summary, 140), version: vm ? 'v' + vm[1] : '', order: order + 1 });
    }
  };
  visit(base);
});
kb.sort((a, b) => ((a.order || 0) - (b.order || 0)) || (a.group + a.title).localeCompare(b.group + b.title));

/* ---- 1c. spec documents (loop-config "docs", listed in loop.json by tools/sync_loop.py) ----
   mirrored too when they sit outside docsDir and kbRoots, so every one opens on its phase tab */
{
  const have = new Set(kbFiles);
  ((readIf(join(D, 'loop.json')) || {}).specs || []).forEach(s => (s.docs || []).forEach(d => [...(d.versions || []), ...(d.images || [])].forEach(v => {
    const rel = String(v.file || '').replace(/^content\/kb-src\//, '');
    if (!rel || have.has(rel) || !existsSync(join(REPO, rel))) return;
    mkdirSync(dirname(join(C, 'kb-src', rel)), { recursive: true }); copyFileSync(join(REPO, rel), join(C, 'kb-src', rel));
    kbFiles.push(rel); have.add(rel);
  })));
}

/* ---- 2. assemble manifest ---- */
const nav = read(join(C, 'nav.json'));
const overview = read(join(C, 'overview.json'));
const sections = read(join(C, 'sections.json'));
const features = readIf(join(D, 'features.json')) || [];   // optional since v4: a loop hub may have no roadmap features
const roadmapExtra = readIf(join(D, 'roadmapExtra.json')) || [];
let adrs = readIf(join(D, 'adrs.json')) || [];
// ADR files (docs/adr/NNNN-slug.md, the /adr command's format) win over adrs.json when present.
const ADRDIR = join(REPO, brand.adrDir || 'docs/adr');
let adrSource = '';
// keep the id width an existing adrs.json uses (ADR-0001 vs ADR-001); otherwise the file numbers' four digits
const adrPad = ((adrs.map(a => (String(a.id || '').match(/^ADR-(\d+)$/) || [])[1]).find(Boolean)) || '0000').length;
if (existsSync(ADRDIR)) {
  const fromFiles = readdirSync(ADRDIR).filter(n => /^\d{4}-.+\.md$/.test(n) && !n.startsWith('0000-')).sort().map(n => {
    const t = readFileSync(join(ADRDIR, n), 'utf8');
    const num = +n.slice(0, 4);
    const field = k => ((t.match(new RegExp('\\*\\*' + k + ':\\*\\*\\s*(.+)')) || [])[1] || '').trim();
    const title = ((t.match(/^#\s+\d{4}\s*[:.\-\u2013\u2014]?\s*(.+)$/m) || [])[1] || n).trim();
    // mirrored into kb-src/adr/ so each decision opens in the hub (and links to docs/adr/ resolve to it)
    mkdirSync(join(C, 'kb-src', 'adr'), { recursive: true }); writeFileSync(join(C, 'kb-src', 'adr', n), t); kbFiles.push('adr/' + n);
    const sec = h => ((t.split(new RegExp('^## ' + h + '\\s*$', 'm'))[1] || '').split(/^## /m)[0] || '').trim().replace(/\s+/g, ' ');
    return { id: 'ADR-' + String(num).padStart(adrPad, '0'), title, status: field('Status') || 'Proposed', date: field('Date'), summary: (x => x.length > 420 ? x.slice(0, 420).replace(/\s+\S*$/, '') + ' …' : x)(sec('Decision') || sec('Context')), file: relative(REPO, join(ADRDIR, n)).replace(/\\/g, '/'), doc: 'adr/' + n };
  });
  if (fromFiles.length) { adrs = fromFiles; adrSource = (brand.adrDir || 'docs/adr').replace(/^(\.\.\/)+/, ''); }
}
const gaps = readIf(join(D, 'gaps.json')) || [];
const security = readIf(join(D, 'security.json')) || [];
const performance = readIf(join(D, 'performance.json')) || [];
const gtm = readIf(join(D, 'gtm.json')) || [];
const vendors = readIf(join(D, 'vendors.json')) || [];
const questions = readIf(join(D, 'questions.json')) || [];
const summary = readIf(join(D, 'summary.json')) || { defects: {} };
const releases = readIf(join(D, 'releases.json'));
const architecture = readIf(join(D, 'architecture.json'));
const lifecycle = readIf(join(D, 'lifecycle.json')) || { stages: [] };
const feedback = readIf(join(D, 'feedback.json')) || { batches: [], items: [] };

const warns = [];
for (const it of feedback.items || []) {
  if (!features.find(f => f.fid === it.fid)) warns.push(`feedback ${it.id}: unknown feature ${it.fid}`);
}

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
/* ---- user stories: content/stories/<feature-id>.json ----
   { "codeStatus": { "status", "evidence": [paths], "notes" },
     "stories": [{ id, persona, asA, iWant, soThat, acceptance: [], priority, phase, status, tests: [] }] }
   Merged into each feature so stories, status and the dossier stay together. */
const SDIR = join(C, 'stories');
const STORY_STATUS = ['todo', 'partial', 'done'];
let storyCount = 0;
for (const f of features) {
  const sp = join(SDIR, `${f.id}.json`);
  if (!existsSync(sp)) continue;
  let d; try { d = read(sp); } catch (e) { warns.push(`stories ${f.id}: invalid JSON (${e.message})`); continue; }
  f.stories = (d.stories || []).map(x => ({ ...x, feature: f.id, fid: f.fid }));
  if (d.codeStatus) f.codeStatus = d.codeStatus;
  for (const x of f.stories) {
    storyCount++;
    if (!x.id || !x.iWant) warns.push(`stories ${f.id}: story without id or iWant`);
    if (x.status && !STORY_STATUS.includes(x.status)) warns.push(`stories ${f.id}/${x.id}: status "${x.status}" not one of ${STORY_STATUS.join('/')}`);
  }
}
const ids = new Set(); for (const f of features) for (const x of f.stories || []) { if (ids.has(x.id)) warns.push(`duplicate story id ${x.id}`); ids.add(x.id); }

for (const f of features) {
  // a mockup at content/mockups/<id>.html is picked up without listing it in features.json
  if (!f.mockup && existsSync(join(C, 'mockups', `${f.id}.html`))) f.mockup = `content/mockups/${f.id}.html`;
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
// repo web URL: brand.repoUrls[repo] if given ("" = no remote, no links), else repoBase + the last path segment
// (so a repo listed as "mobile/code/app-android" maps to <repoBase>/app-android)
const repoUrl = r => (brand.repoUrls && r in brand.repoUrls) ? brand.repoUrls[r] : (repoBase ? `${repoBase}/${String(r).split('/').pop()}` : '');
const reEsc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const headCache = {};
const repoHead = r => { if (r in headCache) return headCache[r]; let h = ''; try { h = execSync(`git -C "${join(CODE, r)}" rev-parse --short HEAD`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (_) {} return headCache[r] = h; };
const refRe = new RegExp('(' + REPOS.slice().sort((a, b) => b.length - a.length).map(reEsc).join('|') + ')/(?:[A-Za-z0-9._/-]+\\.(?:vue|tsx|ts|jsx|mjs|json|js|sql|kt|kts|java|py|go|swift|dart|cs|yml|yaml|toml|gradle)|(?:[A-Za-z0-9._-]+/)*Dockerfile)(?![A-Za-z0-9])', 'g');
const traceability = {};
const drift = [];
if (existsSync(CODE) && REPOS.length) {
  for (const f of features) {
    const p = join(C, 'features', `${f.id}.md`);
    if (!existsSync(p)) continue;
    const refs = Array.from(new Set((readFileSync(p, 'utf8') + '\n' + JSON.stringify(f.codeStatus || {})).match(refRe) || []));
    const files = refs.map(ref => {
      const repo = REPOS.filter(r => ref.startsWith(r + '/')).sort((x, y) => y.length - x.length)[0], rel = ref.slice(repo.length + 1);
      const exists = existsSync(join(CODE, repo, rel));
      const head = repoHead(repo);
      return { path: ref, repo, exists, url: (repoUrl(repo) && head) ? `${repoUrl(repo)}/blob/${head}/${rel}` : '' };
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
  meta: { generated: new Date().toISOString().slice(0, 10), version: 'v4', template: (existsSync(join(C, '.template-version')) ? readFileSync(join(C, '.template-version'), 'utf8').split(/\s+/)[0] : ''), brand: brand.name || '', hubDir: relative(REPO, ROOT).replace(/\\/g, '/') || '.', adrSource },
  overview, nav, sections, features, loop: readIf(join(D, 'loop.json')), loopConfig: readIf(join(D, 'loop-config.json')), agentic: readIf(join(D, 'agentic.json')), roadmapExtra, adrs, gaps, security, performance, gtm, vendors, questions, lifecycle, kb, kbFiles, traceability, feedback, learning, releases, architecture,
  defectsSummary: { total: summary.defects?.total || 0, critical: summary.defects?.critical || 0, high: summary.defects?.high || 0, medium: summary.defects?.medium || 0, low: summary.defects?.low || 0 },
  counts: { gaps: summary.gaps || null, security: summary.security || null }
};
writeFileSync(join(C, 'manifest.json'), JSON.stringify(manifest, null, 0));

/* ---- 3. brand index.html from brand.json (idempotent; index.html is an engine file) ----
   name, baseHref ("./" default; "/hub/" when served under a path without a trailing slash),
   fontsUrl (Google Fonts css2 URL), primary (favicon + gate mark), markStroke, markRadius,
   logo, description. content/brand.css, if present, is linked after hub.css. */
const IDX = join(ROOT, 'index.html');
if (existsSync(IDX)) {
  const ea = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const title = brand.name ? `${brand.name} Engineering Hub` : 'Engineering Hub';
  const fill = brand.primary || '#2563eb', stroke = brand.markStroke || '#ffffff', rx = brand.markRadius ?? 8;
  // brand.json "markSvg": path to an SVG used as favicon and gate mark (its viewBox is kept); otherwise the generated plus mark
  const markFile = brand.markSvg && existsSync(join(ROOT, brand.markSvg)) ? readFileSync(join(ROOT, brand.markSvg), 'utf8') : '';
  const markBox = (markFile.match(/viewBox="([^"]+)"/) || [])[1] || '0 0 32 32';
  const markInner = markFile ? markFile.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '').trim() : '';
  const mark = markInner || `<rect width="32" height="32" rx="${rx}" fill="${fill}"/><path d="M9 16h14M16 9v14" stroke="${stroke}" stroke-width="3" stroke-linecap="round"/>`;
  const fav = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${markBox}">${markInner ? mark : mark.replace('stroke-linecap', 'fill="none" stroke-linecap')}</svg>`).replace(/'/g, '%27');
  let h = readFileSync(IDX, 'utf8'); const before = h;
  h = h.replace(/<base href="[^"]*">/, `<base href="${ea(brand.baseHref || './')}">`)
    .replace(/<title>[^<]*<\/title>/, `<title>${ea(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${ea(brand.description || title + ': the single place the team reviews what is built, planned, the architecture, infrastructure, ADRs, gaps, security, and every feature dossier.')}">`)
    .replace(/<link rel="icon" href="[^"]*">/, `<link rel="icon" href="${fav}">`)
    .replace(/(<div class="gate__mark"[^>]*>\s*<svg viewBox=")[^"]*(">)[\s\S]*?(<\/svg>)/, `$1${markBox}$2${mark}$3`)
    .replace(/(<a class="topbar__brand" href=")#\/[^"]*(")/, `$1#/${ea(brand.home || 'overview')}$2`)
    .replace(/(<form id="gateForm"[\s\S]*?<h1>)[^<]*(<\/h1>)/, `$1${ea(title)}$2`)
    .replace(/aria-label="[^"]*Engineering Hub home"/, `aria-label="${ea(title)} home"`)
    .replace(/<img (?:src="[^"]*" )?alt="" class="brand-logo"[^>]*>/, existsSync(join(ROOT, brand.logo || 'assets/img/logo.png'))
      ? `<img src="${ea(brand.logo || 'assets/img/logo.png')}" alt="" class="brand-logo" onerror="this.remove()">`
      : '<img alt="" class="brand-logo" data-nologo="1" hidden>');
  if (brand.fontsUrl) h = h.replace(/<link href="https:\/\/fonts\.googleapis\.com\/css2[^"]*" rel="stylesheet">/, `<link href="${ea(brand.fontsUrl)}" rel="stylesheet">`);
  h = h.replace(/\n\s*<link rel="stylesheet" href="content\/brand\.css(?:\?v=\w+)?"[^>]*>/g, '');
  if (existsSync(join(C, 'brand.css'))) h = h.replace(/(<link rel="stylesheet" href="assets\/css\/hub\.css(?:\?v=\w+)?">)/, '$1\n  <link rel="stylesheet" href="content/brand.css">');
  // cache-bust engine and brand assets on every build, so a browser never runs an old hub.js against new content
  const stamp = Date.now().toString(36);
  h = h.replace(/((?:src|href)="(?:assets\/(?:js|css)\/[\w-]+\.(?:js|css)|content\/brand\.css))(?:\?v=[\w]+)?"/g, `$1?v=${stamp}"`);
  if (h !== before) writeFileSync(IDX, h);
}

console.log(`manifest.json written: ${storyCount ? storyCount + ' user stories, ' : ''}${learning ? learning.courses.length + ' courses, ' + learning.courses.reduce((n, c) => n + c.lessons.length, 0) + ' lessons, ' : ''}${features.length} features, ${adrs.length} ADRs, ${gaps.length} gaps, ${security.length} security, ${gtm.length} GTM actions, ${kb.length} docs linked.`);
if (warns.length) { console.log('\nWARNINGS:'); warns.forEach(w => console.log('  - ' + w)); }
else console.log('All feature dossiers and mockups present.');
if (existsSync(CODE) && REPOS.length) {
  const linked = Object.values(traceability).filter(t => t.state === 'linked').length;
  console.log(`code traceability: ${linked} features linked to code, ${drift.length} with drift or unlinked.`);
  if (drift.length) { console.log('\nTRACEABILITY DRIFT (dossier vs code/):'); drift.forEach(d => console.log('  - ' + d)); }
} else {
  console.log('code traceability: skipped (no code/ clones found next to the hub).');
}
