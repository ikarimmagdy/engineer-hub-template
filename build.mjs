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
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, statSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const C = join(ROOT, 'content');
const D = join(C, 'data');
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const readIf = p => existsSync(p) ? read(p) : null;

const brand = readIf(join(C, 'brand.json')) || { docsDir: 'docs' };
// repo root = two levels up from outputs/engineer-guide (outputs/ -> project root)
const REPO = join(ROOT, '..', '..');
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
kb.sort((a, b) => (a.group + a.title).localeCompare(b.group + b.title));

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
for (const f of features) {
  if (!existsSync(join(C, 'features', `${f.id}.md`))) warns.push(`missing dossier: content/features/${f.id}.md`);
  if (f.mockup && !existsSync(join(ROOT, f.mockup))) warns.push(`missing mockup: ${f.mockup}`);
}

const manifest = {
  meta: { generated: new Date().toISOString().slice(0, 10), version: 'v1', brand: brand.name || '' },
  overview, nav, sections, features, roadmapExtra, adrs, gaps, security, performance, gtm, kb,
  defectsSummary: { total: summary.defects?.total || 0, critical: summary.defects?.critical || 0, high: summary.defects?.high || 0, medium: summary.defects?.medium || 0, low: summary.defects?.low || 0 },
  counts: { gaps: summary.gaps || null, security: summary.security || null }
};
writeFileSync(join(C, 'manifest.json'), JSON.stringify(manifest, null, 0));

console.log(`manifest.json written — ${features.length} features, ${adrs.length} ADRs, ${gaps.length} gaps, ${security.length} security, ${gtm.length} GTM actions, ${kb.length} docs linked.`);
if (warns.length) { console.log('\nWARNINGS:'); warns.forEach(w => console.log('  - ' + w)); }
else console.log('All feature dossiers and mockups present.');
