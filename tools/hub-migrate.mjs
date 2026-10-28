#!/usr/bin/env node
/* ============================================================
   Engineering Hub, content migration (run by tools/hub-update.sh
   BEFORE the engine files are replaced, so it can read the old ones).
   Moves settings that older hubs kept inside engine files into
   content/brand.json. Only ADDS keys that are missing; never removes
   or overwrites content. Safe to run any number of times.
   ============================================================ */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HUB = process.argv[2] || '.';
const rd = p => existsSync(join(HUB, p)) ? readFileSync(join(HUB, p), 'utf8') : '';
const bp = join(HUB, 'content', 'brand.json');
const brand = JSON.parse(readFileSync(bp, 'utf8'));
const js = rd('assets/js/hub.js'), html = rd('index.html'), css = rd('assets/css/hub.css'), sync = rd('sync.sh');
const added = [];
const add = (k, v) => { if (v === undefined || v === null || v === '' || k in brand) return; brand[k] = v; added.push(k); };

// soft-gate passcode hardcoded in old engines
const pc = (js.match(/(?:let|const)\s+PASSCODE\s*=\s*'([^']+)'/) || [])[1];
if (pc && pc !== 'changeme') add('passcode', pc);

// index.html: base href, web fonts, logo, gate mark
const base = (html.match(/<base href="([^"]*)">/) || [])[1];
if (base && base !== './') add('baseHref', base);
const fonts = (html.match(/<link href="(https:\/\/fonts\.googleapis\.com\/css2[^"]*)" rel="stylesheet">/) || [])[1];
if (fonts && !/family=Inter:wght@400;500;600;700;800&family=JetBrains/.test(fonts)) add('fontsUrl', fonts.replace(/&amp;/g, '&'));
const logo = (html.match(/<img src="([^"]*)" alt="" class="brand-logo"/) || [])[1];
if (logo) add('logo', logo);
const gate = (html.match(/<div class="gate__mark"[^>]*>\s*<svg[^>]*>([\s\S]*?)<\/svg>/) || [])[1] || '';
const rx = (gate.match(/<rect[^>]*rx="(\d+)"/) || [])[1];
if (rx && !['8', '9'].includes(rx)) add('markRadius', +rx);
const stroke = (gate.match(/<path[^>]*stroke="([^"]+)"/) || [])[1];
if (stroke && !/^(#fff|#ffffff|white)$/i.test(stroke)) add('markStroke', stroke);

// parties hardcoded as a partyLabel map, colours from .p-<key> rules in the old CSS
const pl = (js.match(/function partyLabel\(p\)\s*\{\s*return\s*(\{[^}]*\})\[p\]/) || [])[1];
if (pl && !brand.parties) {
  const labels = {}; for (const m of pl.matchAll(/(\w+)\s*:\s*'([^']*)'/g)) labels[m[1]] = m[2];
  const varVal = n => (css.match(new RegExp('--' + n + '\\s*:\\s*([^;]+);')) || [])[1];
  const colour = k => {
    let v = (css.match(new RegExp('\\.p-' + k + '\\s*\\{\\s*background\\s*:\\s*([^;}]+)')) || [])[1];
    if (!v) return undefined;
    v = v.trim();
    const vm = v.match(/^var\(--([\w-]+)\)$/);
    if (vm) v = vm[1] === 'tb-blue-700' ? (brand.primary || varVal(vm[1])) : varVal(vm[1]);
    return v ? v.trim() : undefined;
  };
  const parties = {};
  for (const [k, label] of Object.entries(labels)) { const c = colour(k); parties[k] = c ? { label, color: c } : { label }; }
  add('parties', parties);
}

// sync.sh: deploy target defaults baked into the old script
// (only literal defaults: a v3 sync.sh reads brand.json and has nothing to migrate)
const bucket = (sync.match(/HUB_BUCKET:=([^}$]+)\}/) || [])[1];
if (bucket && !brand.deploy) {
  const d = { bucket };
  const pre = (sync.match(/s3:\/\/\$HUB_BUCKET\/([\w./-]+)"/) || [])[1]; if (pre) d.prefix = pre;
  const cf = (sync.match(/HUB_CF:=([^}$]+)\}/) || [])[1]; if (cf) d.cloudfront = cf;
  const url = (sync.match(/(https:\/\/[^\s"]+)/) || [])[1]; if (url) d.url = url;
  add('deploy', d);
}

// loop hubs (brand.json "workspace"): add the template's loop nav groups and loop-config sections that are missing
if (brand.workspace) {
  const TPL = join(dirname(fileURLToPath(import.meta.url)), '..', 'content');
  const tplNav = JSON.parse(readFileSync(join(TPL, 'nav.json'), 'utf8'));
  const isLoop = g => g.fromLoop || (g.items || []).some(i => /^#\/(start|loop|findings)/.test(i.route || ''));
  const np = join(HUB, 'content', 'nav.json');
  const nav = existsSync(np) ? JSON.parse(readFileSync(np, 'utf8')) : [];
  if (!nav.some(g => (g.items || []).some(i => i.route === '#/loop'))) {
    writeFileSync(np, JSON.stringify([...tplNav.filter(isLoop), ...nav], null, 2) + '\n');
    console.log('  nav.json: added the loop groups (Agentic loop, Work, Review areas)');
  }
  const cp = join(HUB, 'content', 'data', 'loop-config.json');
  const tplCfg = JSON.parse(readFileSync(join(TPL, 'data', 'loop-config.json'), 'utf8'));
  const cfg = existsSync(cp) ? JSON.parse(readFileSync(cp, 'utf8')) : {};
  const missing = Object.keys(tplCfg).filter(k => cfg[k] === undefined || (Array.isArray(cfg[k]) && !cfg[k].length));
  if (missing.length) {
    missing.forEach(k => { cfg[k] = tplCfg[k]; });
    writeFileSync(cp, JSON.stringify(cfg, null, 2) + '\n');
    console.log('  loop-config.json: added ' + missing.join(', '));
  }
}

if (added.length) {
  writeFileSync(bp, JSON.stringify(brand, null, 2) + '\n');
  console.log('  brand.json: added ' + added.join(', '));
} else console.log('  brand.json: nothing to migrate');
