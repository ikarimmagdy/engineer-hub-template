/* ============================================================
   Engineering Hub — single-page engine
   Content is DATA: manifest.json + markdown under content/.
   Edit the files, re-sync to S3, the hub updates. No rebuild
   of this file is needed to change content.
   ============================================================ */
(() => {
  'use strict';
  // Soft gate passcode: brand.json "passcode" overrides this default.
  let PASSCODE = 'changeme';
  const SKEY = 'tb-hub-ok';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const ICONS = {
    overview: '<path d="M3 13h8V3H3zM13 21h8V3h-8zM3 21h8v-6H3z"/>',
    board: '<rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="11" rx="1"/>',
    feature: '<path d="M4 4h16v6H4zM4 14h10v6H4z"/>',
    product: '<path d="M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7"/>',
    arch: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><path d="M6.5 10v4h11"/>',
    infra: '<rect x="3" y="4" width="18" height="5" rx="1"/><rect x="3" y="15" width="18" height="5" rx="1"/><path d="M7 9v6M17 9v6"/>',
    cicd: '<path d="M4 12a8 8 0 0 1 14-5l2 2M20 12a8 8 0 0 1-14 5l-2-2"/><path d="M18 3v4h-4M6 21v-4h4"/>',
    adr: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h7M9 17h7"/>',
    gaps: '<path d="M12 2L2 20h20z"/><path d="M12 9v5M12 17v.5"/>',
    security: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    perf: '<path d="M3 17l5-5 4 3 7-8"/><path d="M14 4h6v6"/>',
    obs: '<circle cx="12" cy="12" r="3"/><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/>',
    kb: '<path d="M4 4h10a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2z"/><path d="M16 6h4v14H8"/>',
    accounts: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    changelog: '<path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/>',
    gtm: '<path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2 0-2.8a2 2 0 0 0-3 0zM12 15l-3-3a12 12 0 0 1 8-8l3 .5.5 3a12 12 0 0 1-8 8zM15 9h.01"/>',
    trace: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9M19 13v6H5V5h6"/>',
    partner: '<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2 20c0-3 3-5 6-5s6 2 6 5M12 20c0-3 2-5 4-5s6 2 6 5"/>',
    story: '<path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/><circle cx="17" cy="15" r="0"/>',
    learn: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6"/>'
  };
  const ico = (name, cls = 'nav-ico') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.overview}</svg>`;

  let DATA = null;

  /* ---------- gate ---------- */
  function initGate() {
    const gate = $('#gate'), app = $('#app');
    // Convenience: a pre-unlocked link (?pass=<passcode>) opens straight in.
    // Same shared passcode, so this is not a weaker gate, just a shareable link.
    try {
      const qp = new URLSearchParams(location.search).get('pass');
      if (qp && qp === PASSCODE) { sessionStorage.setItem(SKEY, '1'); }
    } catch (_) {}
    if (sessionStorage.getItem(SKEY) === '1') { gate.hidden = true; app.hidden = false; return boot(); }
    gate.hidden = false;
    $('#gateForm').addEventListener('submit', e => {
      e.preventDefault();
      if ($('#gatePass').value.trim() === PASSCODE) {
        try { sessionStorage.setItem(SKEY, '1'); } catch (_) {}
        gate.hidden = true; app.hidden = false; boot();
      } else { $('#gateErr').textContent = 'Incorrect passcode. Try again.'; }
    });
  }
  $('#signout')?.addEventListener('click', () => { try { sessionStorage.removeItem(SKEY); } catch (_) {} location.reload(); });

  /* ---------- theme ---------- */
  function initTheme() {
    const saved = (() => { try { return localStorage.getItem('tb-hub-theme'); } catch (_) { return null; } })();
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    $('#themeToggle')?.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme');
      const isDark = cur === 'dark' || (!cur && matchMedia('(prefers-color-scheme:dark)').matches);
      const next = isDark ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('tb-hub-theme', next); } catch (_) {}
    });
  }
  /* ---------- brand (template config) ---------- */
  async function applyBrand() {
    let b = null;
    try { b = await fetch('content/brand.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null); } catch (_) {}
    if (!b) return;
    const r = document.documentElement.style;
    const map = { '--tb-blue-700': b.primary, '--tb-blue-500': b.primaryFill, '--tb-blue-300': b.primaryLight, '--tb-blue-900': b.primaryDark, '--tb-blue-800': b.primaryDark };
    Object.entries(map).forEach(([k, v]) => { if (v) r.setProperty(k, v); });
    if (b.font) r.setProperty('--font', b.font);
    if (b.passcode) PASSCODE = b.passcode;
    if (b.name) { document.title = `${b.name} Engineering Hub`; const el = $('.brand-sub'); if (el) el.textContent = `${b.name} Engineering Hub`; }
    const logo = $('.brand-logo'); if (logo && b.logo) logo.src = b.logo;
    const gm = $('.gate__card h1'); if (gm && b.name) gm.textContent = `${b.name} Engineering Hub`;
    const gmk = $('.gate__mark svg rect'); if (gmk && b.primary) gmk.setAttribute('fill', b.primary);
    window.__BRAND = b;
  }

  function mermaidTheme() {
    const cur = document.documentElement.getAttribute('data-theme');
    const dark = cur === 'dark' || (!cur && matchMedia('(prefers-color-scheme:dark)').matches);
    return dark ? 'dark' : 'neutral';
  }

  /* ---------- boot ---------- */
  async function boot() {
    initTheme();
    try {
      DATA = await fetch('content/manifest.json', { cache: 'no-cache' }).then(r => r.json());
    } catch (e) {
      $('#content').innerHTML = `<div class="callout danger"><b>Could not load content.</b> manifest.json failed to load. If you are opening the file directly, serve the folder over HTTP (for example <code>python3 -m http.server</code>) so fetch works.</div>`;
      return;
    }
    if (window.mermaid) mermaid.initialize({ startOnLoad: false, theme: mermaidTheme(), securityLevel: 'loose', flowchart: { useMaxWidth: true }, themeVariables: { fontFamily: 'var(--font), Montserrat, sans-serif' } });
    if (window.marked) marked.setOptions({ breaks: false, gfm: true });
    buildNav();
    initSearch();
    initMobileNav();
    window.addEventListener('hashchange', route);
    route();
  }

  /* ---------- nav ---------- */
  function buildNav() {
    const counts = {
      '#/features': (DATA.features || []).length,
      '#/adr': (DATA.adrs || []).length,
      '#/gaps': (DATA.gaps || []).length,
      '#/security': (DATA.security || []).length,
      '#/kb': (DATA.kb || []).length,
      '#/vendors': (DATA.vendors || []).length,
      '#/stories': (DATA.features || []).reduce((n, f) => n + (f.stories || []).length, 0),
      '#/learn': ((DATA.learning || {}).courses || []).reduce((n, c) => n + (c.lessons || []).length, 0)
    };
    $('#sidebar').innerHTML = (DATA.nav || []).map(g => `
      <div class="nav-group">
        <div class="nav-group__label">${esc(g.label)}</div>
        ${g.items.map(it => `<a class="nav-link" data-route="${esc(it.route)}" href="${esc(it.route)}">
          ${ico(it.icon)}<span>${esc(it.title)}</span>
          ${counts[it.route] ? `<span class="nav-count">${counts[it.route]}</span>` : ''}
        </a>`).join('')}
      </div>`).join('');
  }
  function setActive() {
    const base = '#/' + (location.hash.replace(/^#\//, '').split('/')[0] || 'overview');
    $$('.nav-link').forEach(a => a.classList.toggle('active', a.getAttribute('data-route') === base));
  }

  /* ---------- router ---------- */
  const ROUTES = {
    overview: renderOverview, roadmap: renderRoadmap, features: renderFeatures,
    feature: renderFeature, product: md('product'), architecture: md('architecture'),
    infra: md('infra'), cicd: md('cicd'), adr: renderADR, gaps: renderGaps,
    security: renderSecurity, performance: renderPerformance, observability: md('observability'),
    kb: renderKB, doc: renderDoc, gtm: renderGTM, traceability: renderTrace, accounts: renderAccounts, changelog: renderChangelog, dispatch: renderDispatch, stories: renderStories, vendors: renderVendors,
    learn: renderLearn, course: renderCourse, lesson: renderLesson
  };
  async function route() {
    if (!location.hash || location.hash === '#') { location.hash = '#/overview'; return; }
    const parts = location.hash.replace(/^#\//, '').split('/');
    const key = parts[0] || 'overview';
    const arg = parts.slice(1).join('/');
    const fn = ROUTES[key] || renderOverview;
    setActive();
    $('#content').classList.toggle('main--wide', key === 'roadmap' || key === 'dispatch');
    $('#content').scrollTop = 0; window.scrollTo(0, 0);
    $('#content').innerHTML = `<div class="loading"><span class="spinner"></span> Loading…</div>`;
    try { await fn(arg); } catch (e) { $('#content').innerHTML = `<div class="callout danger"><b>Render error.</b> ${esc(e.message)}</div>`; }
    closeMobileNav();
  }

  /* ---------- markdown helpers ---------- */
  async function loadMD(path) {
    const r = await fetch(path, { cache: 'no-cache' });
    if (!r.ok) throw new Error('Missing file: ' + path);
    return r.text();
  }
  function renderMarkdown(mdText, mount) {
    mount.innerHTML = window.marked ? marked.parse(mdText) : `<pre>${esc(mdText)}</pre>`;
    // convert ```mermaid blocks
    $$('code.language-mermaid', mount).forEach(code => {
      const pre = code.closest('pre');
      const div = document.createElement('div'); div.className = 'mermaid'; div.textContent = code.textContent;
      pre.replaceWith(div);
    });
    runMermaid(mount);
    // external links new tab
    $$('a[href^="http"]', mount).forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });
  }
  function runMermaid(scope) {
    if (!window.mermaid) return;
    const nodes = $$('.mermaid', scope).filter(n => !n.dataset.done);
    if (!nodes.length) return;
    try { mermaid.run({ nodes }); nodes.forEach(n => n.dataset.done = '1'); } catch (e) { /* ignore */ }
  }
  function md(sectionId) {
    return async () => {
      const sec = (DATA.sections || []).find(s => s.id === sectionId) || { title: sectionId, doc: `content/sections/${sectionId}.md`, lede: '' };
      const c = $('#content');
      c.innerHTML = `<div class="page-head"><p class="eyebrow">${esc(sec.eyebrow || 'Reference')}</p><h1>${esc(sec.title)}</h1>${sec.lede ? `<p class="lede">${esc(sec.lede)}</p>` : ''}</div><div class="md" id="mdmount"></div>`;
      try { renderMarkdown(await loadMD(sec.doc), $('#mdmount')); }
      catch (e) { $('#mdmount').innerHTML = `<div class="callout warn"><b>Not written yet.</b> <code>${esc(sec.doc)}</code> is missing.</div>`; }
    };
  }

  /* ---------- CHANGELOG: client feedback list + fix log + sequence ---------- */
  const FB = { q: '', batch: 'all', type: 'all', priority: 'all', stage: 'all', fixed: 'all', sort: 'newest', open: new Set() };
  const PRIO = { P0: 0, P1: 1, P2: 2, P3: 3 };
  function fbRows() {
    const fb = DATA.feedback || { items: [] };
    const stages = (DATA.lifecycle && DATA.lifecycle.stages) || [];
    return (fb.items || []).map(it => {
      const f = (DATA.features || []).find(x => x.fid === it.fid) || {};
      const st = stages.find(s => s.key === (f.lifecycle || 'backlog'));
      return { ...it, f, type: f.type || '', priority: f.priority || '', seq: f.seq || 0, version: f.version || '', party: f.party || '',
        stage: f.lifecycle || 'backlog', stageTitle: st ? st.title : (f.lifecycle || 'backlog'), fixes: it.fixes || [] };
    });
  }
  async function renderChangelog() {
    const fb = DATA.feedback || { batches: [], items: [] };
    if (!(fb.items || []).length) return md('changelog')();
    const rows = fbRows();
    const uniq = k => ['all', ...Array.from(new Set(rows.map(r => r[k]).filter(Boolean))).sort()];
    const stages = (DATA.lifecycle && DATA.lifecycle.stages) || [];
    const chips = (k, vals, label, fmt) => `<div class="rm-group"><span class="rm-lbl">${label}</span>${vals.map(v => `<button class="chip ${FB[k] === v ? 'active' : ''}" data-fb="${k}" data-v="${esc(v)}">${v === 'all' ? 'All' : esc(fmt ? fmt(v) : v)}</button>`).join('')}</div>`;
    const batchLbl = id => { const b = (fb.batches || []).find(x => x.id === id); return b ? `${b.date} · ${b.title}` : id; };
    const stageVals = ['all', ...stages.map(s => s.key).filter(k => rows.some(r => r.stage === k))];
    $('#content').innerHTML = `
      <div class="page-head"><p class="eyebrow">Reference</p><h1>Changelog &amp; client feedback</h1>
      <p class="lede">Every client report, what the code showed when it was reported, what we found, the order we build it in, and what was fixed for it. Click a report to expand it.</p></div>
      <div class="rm-toolbar">
        <div class="rm-group"><input id="fbSearch" class="rm-search" type="search" placeholder="Search feedback, analysis, ID…" value="${esc(FB.q)}">
          <span class="rm-lbl">Sort</span><select id="fbSort" class="rm-select">
            ${[['newest', 'Newest first'], ['oldest', 'Oldest first'], ['seq', 'Dev sequence'], ['priority', 'Priority'], ['fid', 'Feature ID']].map(([v, l]) => `<option value="${v}" ${FB.sort === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
          <button class="chip" id="fbExpand" type="button">Expand all</button><button class="chip" id="fbCollapse" type="button">Collapse all</button></div>
        ${chips('batch', uniq('batch'), 'Batch', batchLbl)}
        ${chips('type', uniq('type'), 'Type')}
        ${chips('priority', uniq('priority'), 'Priority')}
        ${chips('stage', stageVals, 'Status', k => (stages.find(s => s.key === k) || {}).title || k)}
        ${chips('fixed', ['all', 'fixed', 'not-fixed'], 'Fixes', v => v === 'fixed' ? 'Has fixes' : 'No fix yet')}
      </div>
      <p class="hint" id="fbCount"></p>
      <div id="fbList" class="fb-list"></div>
      <h2 class="fb-h2">Development sequence</h2>
      <div id="fbSeq"></div>
      <h2 class="fb-h2">Fix log</h2>
      <div id="fbFixes"></div>
      <div class="md" id="mdmount"></div>`;
    paintFeedback();
    paintSeqAndFixes();
    $$('#content .chip[data-fb]').forEach(b => b.addEventListener('click', () => { FB[b.dataset.fb] = b.dataset.v; renderChangelog(); }));
    $('#fbSort').addEventListener('change', e => { FB.sort = e.target.value; paintFeedback(); });
    const si = $('#fbSearch'); si.addEventListener('input', () => { FB.q = si.value; paintFeedback(); });
    $('#fbExpand').addEventListener('click', () => { fbFiltered().forEach(r => FB.open.add(r.id)); paintFeedback(); });
    $('#fbCollapse').addEventListener('click', () => { FB.open.clear(); paintFeedback(); });
    const sec = (DATA.sections || []).find(s => s.id === 'changelog') || { doc: 'content/sections/changelog.md' };
    try { renderMarkdown(await loadMD(sec.doc), $('#mdmount')); } catch (e) { /* optional */ }
  }
  function fbFiltered() {
    const q = FB.q.trim().toLowerCase();
    let list = fbRows();
    ['batch', 'type', 'priority', 'stage'].forEach(k => { if (FB[k] !== 'all') list = list.filter(r => r[k] === FB[k]); });
    if (FB.fixed === 'fixed') list = list.filter(r => r.fixes.length);
    if (FB.fixed === 'not-fixed') list = list.filter(r => !r.fixes.length);
    if (q) list = list.filter(r => [r.id, r.fid, r.title, r.client, r.feedback, r.today, r.analysis, (r.defects || []).join(' '), r.reported,
      r.fixes.map(x => [x.what, x.commit, (x.closes || []).join(' ')].join(' ')).join(' ')].join(' ').toLowerCase().includes(q));
    const by = {
      newest: (a, b) => (b.reported || '').localeCompare(a.reported || '') || a.id.localeCompare(b.id),
      oldest: (a, b) => (a.reported || '').localeCompare(b.reported || '') || a.id.localeCompare(b.id),
      seq: (a, b) => (a.seq || 999) - (b.seq || 999),
      priority: (a, b) => (PRIO[a.priority] ?? 9) - (PRIO[b.priority] ?? 9) || (a.seq || 999) - (b.seq || 999),
      fid: (a, b) => a.fid.localeCompare(b.fid)
    };
    return list.sort(by[FB.sort] || by.newest);
  }
  function paintFeedback() {
    const fb = DATA.feedback || { batches: [] };
    const list = fbFiltered();
    const total = (fb.items || []).length;
    $('#fbCount').textContent = `${list.length} of ${total} reports`;
    const groupByBatch = FB.sort === 'newest' || FB.sort === 'oldest';
    let html = '', lastBatch = null;
    list.forEach(r => {
      if (groupByBatch && r.batch !== lastBatch) {
        lastBatch = r.batch;
        const b = (fb.batches || []).find(x => x.id === r.batch) || { id: r.batch };
        const n = list.filter(x => x.batch === r.batch).length;
        html += `<details class="fb-batch"><summary><span class="fb-date">${esc(b.date || '')}</span><b>${esc(b.title || b.id)}</b><span class="rm-lbl">${n} report${n === 1 ? '' : 's'}</span><span class="fb-more">batch notes</span></summary>
          <div class="fb-body">
            ${b.source ? `<p><b>Source:</b> ${esc(b.source)}</p>` : ''}${b.summary ? `<p>${esc(b.summary)}</p>` : ''}
            ${(b.security || []).length ? `<p><b>Security issues to raise with the client</b></p><ul>${b.security.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
            ${(b.questions || []).length ? `<p><b>Open questions for the client</b></p><ul>${b.questions.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
            ${(b.reopened || []).length ? `<p><b>Reopened:</b> ${b.reopened.map(x => `<code>${esc(x)}</code>`).join(' ')}${b.newDefects ? ` · <b>New defects:</b> ${esc(b.newDefects)}` : ''}</p>` : ''}
          </div></details>`;
      }
      const fixed = r.fixes.length;
      html += `<details class="fb-item" data-id="${esc(r.id)}" ${FB.open.has(r.id) ? 'open' : ''}>
        <summary>
          <code class="fid">${esc(r.fid)}</code>
          <span class="fb-title">${esc(r.title)}</span>
          <span class="fb-tags">
            ${r.type ? `<span class="badge ${TYPE_BADGE[r.type] || 'b-low'}">${esc(r.type)}</span>` : ''}
            ${r.priority ? `<span class="badge ${r.priority === 'P0' ? 'b-critical' : 'b-high'}">${esc(r.priority)}</span>` : ''}
            ${r.seq ? `<span class="vbadge">seq ${r.seq}</span>` : ''}
            <span class="vbadge">${esc(r.stageTitle)}</span>
            <span class="badge ${fixed ? 'b-fixed' : 'b-backlog'}">${fixed ? fixed + ' fix' + (fixed > 1 ? 'es' : '') : 'no fix yet'}</span>
            <span class="fb-date">${esc(r.reported)}</span>
          </span>
        </summary>
        <div class="fb-body">
          <p class="fb-quote">“${esc(r.client)}”</p>
          <table><tbody>
            <tr><td><b>Report</b></td><td><code>${esc(r.id)}</code> · ${esc(r.reported)} · ${esc(r.version)}</td></tr>
            <tr><td><b>Today in the code</b></td><td>${esc(r.today)}</td></tr>
            <tr><td><b>Analysis</b></td><td>${esc(r.analysis)}</td></tr>
            <tr><td><b>Defects</b></td><td>${(r.defects || []).map(d => `<a href="#/gaps"><code>${esc(d)}</code></a>`).join(' ') || 'none'}</td></tr>
            <tr><td><b>Depends on</b></td><td>${(r.f.dependsOn || []).map(d => `<code>${esc(d)}</code>`).join(' ') || 'none'}</td></tr>
          </tbody></table>
          <p style="margin:10px 0 4px"><b>Fix record</b></p>
          ${fixed ? `<table><thead><tr><th>Date</th><th>What was fixed</th><th>Closes</th><th>Commit</th><th>Env</th><th>Verified by</th></tr></thead><tbody>${r.fixes.map(x => `<tr><td>${esc(x.date || '')}</td><td>${esc(x.what || '')}</td><td>${(x.closes || []).map(c => `<code>${esc(c)}</code>`).join(' ')}</td><td><code>${esc(x.commit || '')}</code></td><td>${esc(x.env || '')}</td><td>${esc(x.verifiedBy || '')}</td></tr>`).join('')}</tbody></table>` : '<p class="hint">None yet.</p>'}
          <p style="margin-top:10px"><a href="#/feature/${esc(r.feature)}">Open the full dossier and its Claude prompt →</a></p>
        </div>
      </details>`;
    });
    $('#fbList').innerHTML = html || '<p class="hint">No reports match these filters.</p>';
    $$('#fbList .fb-item').forEach(d => d.addEventListener('toggle', () => { d.open ? FB.open.add(d.dataset.id) : FB.open.delete(d.dataset.id); }));
  }
  function paintSeqAndFixes() {
    const seq = (DATA.features || []).filter(f => f.seq).sort((a, b) => a.seq - b.seq);
    $('#fbSeq').innerHTML = seq.length ? `<p class="hint">Build in this order. Sort the roadmap board by Dev sequence to see the same order, or copy a ticket's prompt from the Dispatch board.</p>
      <table><thead><tr><th>Seq</th><th>FID</th><th>Item</th><th>Status</th><th>Depends on</th><th>Why this position</th></tr></thead><tbody>
      ${seq.map(f => { const st = ((DATA.lifecycle || {}).stages || []).find(s => s.key === f.lifecycle); return `<tr><td><b>${f.seq}</b></td><td><a href="#/feature/${esc(f.id)}"><code>${esc(f.fid)}</code></a></td><td>${esc(f.title)}</td><td>${esc(st ? st.title : f.lifecycle)}</td><td>${(f.dependsOn || []).map(d => `<code>${esc(d)}</code>`).join(' ') || 'none'}</td><td>${esc(f.seqNote || '')}</td></tr>`; }).join('')}
      </tbody></table>` : '<p class="hint">No sequenced items.</p>';
    const fixes = fbRows().flatMap(r => r.fixes.map(x => ({ ...x, fid: r.fid, fb: r.id, feature: r.feature }))).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    $('#fbFixes').innerHTML = `<table><thead><tr><th>Date</th><th>What was fixed</th><th>For</th><th>Closes</th><th>Commit</th><th>Env</th><th>Verified by</th></tr></thead><tbody>
      ${fixes.map(x => `<tr><td>${esc(x.date || '')}</td><td>${esc(x.what || '')}</td><td><a href="#/feature/${esc(x.feature)}"><code>${esc(x.fid)}</code></a> <code>${esc(x.fb)}</code></td><td>${(x.closes || []).map(c => `<code>${esc(c)}</code>`).join(' ')}</td><td><code>${esc(x.commit || '')}</code></td><td>${esc(x.env || '')}</td><td>${esc(x.verifiedBy || '')}</td></tr>`).join('') || '<tr><td colspan="7" class="hint">No fixes recorded yet.</td></tr>'}
      </tbody></table>`;
  }

  /* ---------- DISPATCH: what to run next, what can run in parallel ---------- */
  // Stage order comes from content/data/lifecycle.json; this is only the fallback.
  const STAGE_ORDER = ['backlog', 'in-progress', 'dev-complete', 'verified', 'deployed-dev', 'deployed-demo', 'deployed-prod'];
  const stageKeys = () => { const s = (DATA.lifecycle || {}).stages; return s && s.length ? s.map(x => x.key) : STAGE_ORDER; };
  const stageRank = k => { const ks = stageKeys(), i = ks.indexOf(k || 'backlog'); return i < 0 ? 0 : i; };
  // "Done" = at or past dev-complete (or past the doneStage set in lifecycle.json).
  const doneRank = () => stageRank((DATA.lifecycle || {}).doneStage || 'dev-complete');
  function dispatchState() {
    const F = DATA.features || [];
    const byFid = Object.fromEntries(F.map(f => [f.fid, f]));
    const tickets = F.filter(f => f.seq || (f.repos && f.repos.length));
    const running = F.filter(f => f.lifecycle === 'in-progress');
    const held = {};
    running.forEach(f => (f.repos || []).forEach(r => { (held[r] = held[r] || []).push(f.fid); }));
    // "repo:area" locks only that area; a bare "repo" locks the whole repo
    const split = x => { const i = x.indexOf(':'); return i > 0 && !x.startsWith('aws:') ? [x.slice(0, i), x.slice(i + 1)] : [x, '']; };
    const clashes = (a, b) => { const [ra, aa] = split(a), [rb, ab] = split(b); return ra === rb && (!aa || !ab || aa === ab); };
    const holdersOf = x => Object.entries(held).filter(([k]) => clashes(k, x)).flatMap(([k, v]) => v.map(h => [h, k]));
    const rows = tickets.map(f => {
      const r = { f, repos: f.repos || [], stage: f.lifecycle || 'backlog' };
      if (r.stage === 'in-progress') { r.state = 'running'; r.label = 'Running now'; }
      else if (f.paused && stageRank(r.stage) < doneRank()) { r.state = 'paused'; r.label = 'Paused (not offered)'; }
      else if (stageRank(r.stage) >= doneRank()) { r.state = 'done'; r.label = 'Done: ' + r.stage; }
      else {
        const unmet = (f.dependsOn || []).filter(d => stageRank((byFid[d] || {}).lifecycle) < doneRank());
        const byHolder = {}; r.repos.forEach(x => holdersOf(x).forEach(([h]) => { if (h !== f.fid) (byHolder[h] = byHolder[h] || []).push(x); }));
        const clash = Object.entries(byHolder).map(([h, xs]) => `${h} (${xs.join(', ')})`);
        if (unmet.length) { r.state = 'wait'; r.label = 'Wait: needs ' + unmet.join(', ') + ' dev-complete'; }
        else if (clash.length) { r.state = 'wait'; r.label = 'Wait: repos in use by ' + clash.join('; '); }
        else if (f.gate === 'cost-approval') { r.state = 'go-gated'; r.label = 'Yes, start now (stops at cost approval)'; }
        else { r.state = 'go'; r.label = 'Yes, start now'; }
      }
      return r;
    });
    // runnable tickets that clash with each other: only one of them should start
    const go = rows.filter(r => r.state.startsWith('go'));
    go.forEach(a => { a.pairClash = go.filter(b => b !== a && b.repos.some(x => a.repos.some(y => clashes(x, y)))).map(b => b.f.fid); });
    rows.forEach(r => { r.parallelWith = running.filter(x => x !== r.f && !(x.repos || []).some(rp => r.repos.some(y => clashes(rp, y)))).map(x => x.fid); });
    rows.forEach(r => { r.sharedRepo = [...new Set(r.repos.map(x => split(x)).filter(([, a]) => a).map(([rp]) => rp))]; });
    return { rows: rows.sort((a, b) => (a.f.seq || 999) - (b.f.seq || 999)), running, held };
  }
  function renderDispatch() {
    const { rows, running, held } = dispatchState();
    const badge = { running: 'b-in-progress', done: 'b-fixed', wait: 'b-backlog', go: 'b-new', 'go-gated': 'b-high', paused: 'b-low' };
    const goNow = rows.filter(r => r.state.startsWith('go'));
    $('#content').innerHTML = `
      <div class="page-head"><p class="eyebrow">Delivery</p><h1>Dispatch board</h1>
      <p class="lede">Which ticket to give Claude next, in sequence. Computed live from the roadmap: a ticket can start when its dependencies are dev-complete and none of its repos is held by a ticket in progress. Run each ticket in its <b>own</b> Claude Code session opened in ${esc(cfg().workspace || 'the project root')}; the session plans and fans out its own subagents.</p></div>
      <div class="cards" style="margin-bottom:18px">
        <div class="card"><h3>Running now (${running.length})</h3><p>${running.map(f => `<code>${esc(f.fid)}</code> ${esc(f.title)}`).join('<br>') || '-'}</p></div>
        <div class="card"><h3>Start now in parallel (${goNow.length})</h3><p>${goNow.map(r => `<code>${esc(r.f.fid)}</code> ${esc(r.f.title)}${r.pairClash.length ? ` <span class="hint">(not together with ${r.pairClash.join(', ')})</span>` : ''}`).join('<br>') || 'Nothing free right now.'}</p></div>
        <div class="card"><h3>Repos locked</h3><p>${Object.entries(held).map(([k, v]) => `<code>${esc(k)}</code> by ${v.join(', ')}`).join('<br>') || '-'}</p></div>
      </div>
      <div class="table-wrap"><table class="dispatch">
        <thead><tr><th>Seq</th><th>Wave</th><th>Ticket</th><th>Status</th><th>Repos it holds</th><th>Depends on</th><th>Can run now?</th><th>Parallel with (running)</th><th>Text for Claude</th></tr></thead>
        <tbody>${rows.map((r, i) => `<tr>
          <td><b>${r.f.seq || '-'}</b></td>
          <td>${r.f.wave || '-'}</td>
          <td><a href="#/feature/${esc(r.f.id)}"><code class="fid">${esc(r.f.fid)}</code></a> ${esc(r.f.title)}</td>
          <td><span class="badge ${badge[r.state]}">${esc(r.stage)}</span></td>
          <td>${r.repos.map(x => `<code>${esc(x)}</code>`).join(' ')}${r.sharedRepo.length ? `<br><span class="hint">own worktree for ${esc(r.sharedRepo.join(', '))}</span>` : ''}</td>
          <td>${(r.f.dependsOn || []).map(x => `<code>${esc(x)}</code>`).join(' ') || '-'}</td>
          <td><span class="badge ${badge[r.state]}">${esc(r.label)}</span>${r.pairClash && r.pairClash.length ? `<br><span class="hint">only one of: ${esc([r.f.fid, ...r.pairClash].join(', '))}</span>` : ''}</td>
          <td>${r.state === 'running' || r.state === 'done' ? '-' : (r.parallelWith.join(', ') || 'none')}</td>
          <td>${r.state === 'go' || r.state === 'go-gated' || r.state === 'wait' ? `<button class="chip dp-copy" data-i="${i}" type="button">Copy prompt</button>` : '-'}</td>
        </tr>`).join('')}</tbody></table></div>
      <div class="callout" style="margin-top:18px"><b>How to use</b><ol style="margin:6px 0 0 18px">
        <li>For every row that says <b>Yes, start now</b>: open a new Claude Code session in <code>${esc(cfg().workspace || 'the project root')}</code>, click <b>Copy prompt</b>, paste. One ticket per session.</li>
        <li>The session marks the ticket in progress first, which locks its repos here; refresh this page before starting the next one.</li>
        <li>When a ticket reaches dev-complete its repos unlock and waiting tickets turn to <b>Yes</b>.</li>
        <li>Rows marked "only one of" share a repo area: start one, the other waits.</li>
        <li><code>repo:area</code> locks only that area of the repo, so tickets in different areas run together; each such session works in its own git worktree (the prompt says how). A bare repo name locks the whole repo.</li>
      </ol></div>`;
    $$('.dp-copy').forEach(b => b.addEventListener('click', async () => {
      const r = rows[+b.dataset.i];
      try { await navigator.clipboard.writeText(kickoffPrompt(r.f)); const t = b.textContent; b.textContent = 'Copied ✓'; setTimeout(() => b.textContent = t, 1300); } catch (_) {}
    }));
  }

  /* ---------- OVERVIEW ---------- */
  function statusBadge(s) { const k = (s || '').toLowerCase().replace(/\s+/g, '-'); return `<span class="badge b-${k}">${esc(s)}</span>`; }
  async function renderOverview() {
    const f = DATA.features || [], o = DATA.overview || {};
    const by = s => f.filter(x => (x.status || '').toLowerCase() === s).length;
    const sh = by('built') + by('shipped'), pa = by('partial'), ne = f.filter(x => ['new', 'next', 'planned'].includes((x.status || '').toLowerCase())).length;
    const adrN = (DATA.adrs || []).length, gapN = (DATA.gaps || []).length, secN = (DATA.security || []).length;
    $('#content').innerHTML = `
      <div class="page-head">
        <p class="eyebrow">${esc(o.eyebrow || 'Engineering')}</p>
        <h1>${esc(o.title || 'Engineering Hub')}</h1>
        <p class="lede">${esc(o.lede || '')}</p>
      </div>
      <div class="stat-row">
        <div class="stat"><div class="n">${f.length}</div><div class="l">Documented features</div><div class="bar"><i style="width:${f.length ? Math.round(sh / f.length * 100) : 0}%;background:var(--tb-success-fill)"></i></div></div>
        <div class="stat"><div class="n">${sh}</div><div class="l">Shipped / built</div></div>
        <div class="stat"><div class="n">${pa}</div><div class="l">Partial</div></div>
        <div class="stat"><div class="n">${ne}</div><div class="l">Planned / next</div></div>
        <div class="stat"><div class="n">${adrN}</div><div class="l">Architecture decisions</div></div>
        <div class="stat"><div class="n">${gapN}</div><div class="l">Tracked gaps</div></div>
      </div>
      ${o.intro ? `<div class="md" style="margin:6px 0 26px">${window.marked ? marked.parse(o.intro) : esc(o.intro)}</div>` : ''}
      <h2 style="color:var(--heading);font-size:1.15rem;margin:10px 0 14px">Jump in</h2>
      <div class="cards">
        ${overviewCards().map(([i, t, d, r]) => `<a class="card" href="${r}"><div class="card__top"><div class="card__ico">${ico(i, '')}</div><h3>${t}</h3></div><p>${d}</p></a>`).join('')}
      </div>
      <p class="footer-note">${esc(o.footer || '')}</p>`;
    $$('.card__ico svg').forEach(s => { s.setAttribute('viewBox', '0 0 24 24'); });
  }

  /* ---------- ROADMAP BOARD ---------- */
  const RM = { party: 'all', version: 'all', type: 'all', run: 'all', sort: 'fid', reopened: false, hideEmpty: true, q: '' };
  const RUN_LBL = { running: 'Running', go: 'Can start now', 'go-gated': 'Can start (cost gate)', wait: 'Waiting', paused: 'Paused', done: 'Done' };
  const RUN_BADGE = { running: 'b-in-progress', go: 'b-new', 'go-gated': 'b-high', wait: 'b-backlog', paused: 'b-low', done: 'b-fixed' };
  let DS = null; const dsRow = fid => DS && DS.byFid[fid];
  const TYPE_BADGE = { feature: 'b-new', bug: 'b-open', test: 'b-low', audit: 'b-backlog', change: 'b-new' };
  const slugify = s => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  const branchName = it => it.fid ? `feature/${it.fid}-${slugify(it.title)}` : '';
  // status -> lifecycle for data written before lifecycle.json existed (override in lifecycle.json "fromStatus")
  function lifecycleOf(f) {
    if (f.lifecycle) return f.lifecycle;
    const m = Object.assign({ built: 'dev-complete', shipped: 'deployed-prod', partial: 'in-progress', planned: 'backlog', next: 'backlog', future: 'backlog' }, (DATA.lifecycle || {}).fromStatus || {});
    return m[(f.status || '').toLowerCase()] || 'backlog';
  }
  function roadmapItems() {
    return [
      ...(DATA.features || []).map(f => ({ ...f, link: `#/feature/${f.id}`, lifecycle: lifecycleOf(f), version: f.version || 'V1' })),
      ...(DATA.roadmapExtra || []).map(r => ({ ...r, link: r.link || '#/product', lifecycle: 'backlog', version: r.milestone || 'V3', concept: true }))
    ];
  }
  function renderRoadmap() {
    { const st = dispatchState(); DS = { ...st, byFid: Object.fromEntries(st.rows.map(r => [r.f.fid, r])) }; }
    const stages = (DATA.lifecycle && DATA.lifecycle.stages && DATA.lifecycle.stages.length) ? DATA.lifecycle.stages
      : [{ key: 'backlog', title: 'Backlog' }, { key: 'in-progress', title: 'In progress' }, { key: 'dev-complete', title: 'Dev complete' }, { key: 'verified', title: 'Verified' }, { key: 'deployed-dev', title: 'Deployed: Dev' }, { key: 'deployed-demo', title: 'Deployed: Demo' }, { key: 'deployed-prod', title: 'Deployed: Prod' }];
    const all = roadmapItems();
    const versions = Array.from(new Set(all.map(i => i.version))).filter(Boolean).sort();
    const partyKeys = Object.keys(parties()).length ? Object.keys(parties()) : Array.from(new Set(all.map(i => i.party).filter(Boolean)));
    const types = Array.from(new Set(all.map(i => i.type).filter(Boolean))).sort();
    const ids = k => DS.rows.filter(r => k.includes(r.state)).map(r => r.f.fid);
    const runOpts = [['all', 'All', all.length, ''], ['running', 'Running', ids(['running']).length, ids(['running'])], ['go', 'Can start now', ids(['go', 'go-gated']).length, ids(['go', 'go-gated'])],
      ['active', 'Running + can start', ids(['running', 'go', 'go-gated']).length, ''], ['wait', 'Waiting', ids(['wait']).length, ids(['wait'])], ['paused', 'Paused', ids(['paused']).length, ids(['paused'])], ['done', 'Done', ids(['done']).length, ids(['done'])]];
    const sel = (id, cur, opts, allLbl) => `<select id="${id}" class="rm-select">${[['all', allLbl], ...opts].map(([v, l]) => `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    $('#content').innerHTML = `
      <div class="rm-head"><h1>Roadmap board</h1><span class="hint">${esc((DATA.lifecycle && DATA.lifecycle.promotion) || 'Local -> Dev -> Prod')} · click a card for its dossier and Claude prompt</span><a class="rm-link" href="#/dispatch">Dispatch board →</a></div>
      <div class="rm-toolbar rm-compact">
        <div class="rm-seg" role="tablist">${runOpts.map(([v, l, n, list]) => `<button class="rm-segbtn ${RM.run === v ? 'active' : ''}" data-run="${v}" title="${esc(Array.isArray(list) ? (list.join(', ') || 'none') : '')}">${l}<b>${n}</b></button>`).join('')}</div>
        <div class="rm-row">
          ${sel('rmParty', RM.party, partyKeys.map(p => [p, partyLabel(p)]), 'All areas')}
          ${sel('rmVersion', RM.version, versions.map(v => [v, v]), 'All versions')}
          ${types.length ? sel('rmType', RM.type, types.map(t => [t, t]), 'All types') : ''}
          <select id="rmSort" class="rm-select" title="Sort">
            ${[['fid', 'Sort: Feature ID'], ['seq', 'Sort: Dev sequence'], ['run', 'Sort: Dispatch status'], ['party', 'Sort: Party'], ['title', 'Sort: Title'], ['version', 'Sort: Version']].map(([v, l]) => `<option value="${v}" ${RM.sort === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
          <label class="rm-chk"><input type="checkbox" id="rmReopen" ${RM.reopened ? 'checked' : ''}> Reopened</label>
          <label class="rm-chk"><input type="checkbox" id="rmHide" ${RM.hideEmpty ? 'checked' : ''}> Hide empty columns</label>
          <input id="rmSearch" class="rm-search" type="search" placeholder="Search text, ID, repo…" value="${esc(RM.q)}">
          ${(RM.run !== 'all' || RM.party !== 'all' || RM.version !== 'all' || RM.type !== 'all' || RM.reopened || RM.q) ? '<button class="chip" id="rmReset" type="button">Reset</button>' : ''}
        </div>
      </div>
      <div id="rmBoard" class="board"></div>`;
    paintBoard(stages);
    const set = (k, v) => { RM[k] = v; renderRoadmap(); };
    $$('#content .rm-segbtn').forEach(b => b.addEventListener('click', () => set('run', b.dataset.run)));
    $('#rmParty').addEventListener('change', e => set('party', e.target.value));
    $('#rmVersion').addEventListener('change', e => set('version', e.target.value));
    if ($('#rmType')) $('#rmType').addEventListener('change', e => set('type', e.target.value));
    $('#rmReopen').addEventListener('change', e => set('reopened', e.target.checked));
    $('#rmHide').addEventListener('change', e => set('hideEmpty', e.target.checked));
    if ($('#rmReset')) $('#rmReset').addEventListener('click', () => { Object.assign(RM, { run: 'all', party: 'all', version: 'all', type: 'all', reopened: false, q: '' }); renderRoadmap(); });
    $('#rmSort').addEventListener('change', e => { RM.sort = e.target.value; paintBoard(stages); wireCards(); });
    const si = $('#rmSearch'); si.addEventListener('input', () => { RM.q = si.value; paintBoard(stages); wireCards(); });
    wireCards();
  }
  function filteredItems() {
    const q = RM.q.trim().toLowerCase();
    let list = roadmapItems();
    if (RM.party !== 'all') list = list.filter(i => i.party === RM.party);
    if (RM.version !== 'all') list = list.filter(i => i.version === RM.version);
    if (RM.type !== 'all') list = list.filter(i => i.type === RM.type);
    if (RM.run !== 'all') list = list.filter(i => { const r = dsRow(i.fid); const st = r ? r.state : (i.lifecycle === 'in-progress' ? 'running' : ''); 
      return RM.run === 'go' ? (st === 'go' || st === 'go-gated') : RM.run === 'active' ? ['running', 'go', 'go-gated'].includes(st) : st === RM.run; });
    if (RM.reopened) list = list.filter(i => i.reopened);
    if (q) list = list.filter(i => ((i.fid || '') + ' ' + i.title + ' ' + (i.summary || '') + ' ' + (i.source || '') + ' ' + (i.reported || '') + ' ' + (i.repos || []).join(' ')).toLowerCase().includes(q));
    const by = { fid: (a, b) => (a.fid || 'zz').localeCompare(b.fid || 'zz'), party: (a, b) => (a.party || '').localeCompare(b.party || ''), title: (a, b) => a.title.localeCompare(b.title), version: (a, b) => (a.version || '').localeCompare(b.version || ''), seq: (a, b) => (a.seq || 999) - (b.seq || 999) || (a.fid || 'zz').localeCompare(b.fid || 'zz'), run: (a, b) => { const o = { running: 0, go: 1, 'go-gated': 2, wait: 3, paused: 4, done: 5 }; const sa = (dsRow(a.fid) || {}).state, sb = (dsRow(b.fid) || {}).state; return (o[sa] ?? 9) - (o[sb] ?? 9) || (a.seq || 999) - (b.seq || 999); } };
    return list.sort(by[RM.sort] || by.fid);
  }
  function paintBoard(stages) {
    const items = filteredItems();
    const cols = stages.map(c => ({ c, list: items.filter(i => i.lifecycle === c.key) })).filter(x => !RM.hideEmpty || x.list.length);
    const board = $('#rmBoard');
    board.style.gridTemplateColumns = `repeat(${Math.max(cols.length, 1)},minmax(240px,1fr))`;
    board.classList.toggle('board--few', cols.length <= 2);
    board.innerHTML = cols.map(({ c, list }) => `<div class="board__col">
        <h2 title="${esc(c.hint || '')}"><span class="colmark" style="background:${c.mark || 'var(--text-muted)'}"></span>${esc(c.title)}<span class="k">${list.length}</span></h2>
        ${list.map(rmCard).join('') || '<p class="colhint">-</p>'}
      </div>`).join('') || '<p class="hint">No tickets match these filters.</p>';
  }
  function rmCard(it) {
    const br = branchName(it);
    const r = dsRow(it.fid);
    const why = !r ? '' : r.state === 'wait' ? r.label.replace(/^Wait: /, '') : (r.state === 'go' || r.state === 'go-gated') ? (r.pairClash && r.pairClash.length ? 'not together with ' + r.pairClash.join(', ') : 'parallel-safe with running tickets') : '';
    return `<a class="tcard" href="${esc(it.link)}">
      <div class="tcard-top">${it.fid ? `<code class="fid">${esc(it.fid)}</code>` : '<span class="fid fid--concept">concept</span>'}${r ? `<span class="badge ${RUN_BADGE[r.state]}" style="font-size:.58rem">${esc(RUN_LBL[r.state])}</span>` : ''}<span class="vbadge">${esc(it.version || '')}</span>${it.seq ? `<span class="vbadge" title="Development sequence">#${it.seq}</span>` : ''}${it.wave ? `<span class="vbadge">w${it.wave}</span>` : ''}${it.type ? `<span class="badge ${TYPE_BADGE[it.type] || 'b-low'}" style="font-size:.58rem">${esc(it.type)}</span>` : ''}${it.reopened ? '<span class="badge b-open" style="font-size:.58rem">reopened</span>' : ''}</div>
      <h4>${esc(it.title)}</h4>
      ${why ? `<p class="tcard-why">${esc(why)}</p>` : (it.summary ? `<p>${esc(it.summary)}</p>` : '')}
      <div class="meta">${it.party ? `<span class="party-chip p-${esc(it.party)}"${partyStyle(it.party)}>${esc(partyLabel(it.party))}</span>` : ''}${it.reported ? `<span class="rm-lbl" style="margin-left:6px">${esc(it.reported)}</span>` : ''}</div>
      ${br ? `<button class="branch" type="button" data-branch="${esc(br)}" title="Copy branch name">${esc(br)}</button>` : ''}
    </a>`;
  }
  function wireCards() {
    $$('#rmBoard .branch').forEach(b => b.addEventListener('click', async e => {
      e.preventDefault(); e.stopPropagation();
      try { await navigator.clipboard.writeText(b.dataset.branch); const t = b.textContent; b.textContent = 'copied ✓'; setTimeout(() => b.textContent = t, 1200); } catch (_) {}
    }));
  }
  // Parties (who/which area a feature belongs to) come from brand.json "parties":
  // { "key": "Label" } or { "key": { "label": "Label", "color": "#hex" } }.
  function parties() { return (window.__BRAND || {}).parties || {}; }
  // Prompt / dispatch settings: brand.json "prompt": { workspace, worklog, evidenceDir, deploy, agents: { validator, tests, behavior, uiux, review } }
  function cfg() { return (window.__BRAND || {}).prompt || {}; }
  function partyLabel(p) { const v = parties()[p]; return (v && typeof v === 'object' ? v.label : v) || p; }
  function partyStyle(p) { const v = parties()[p]; return v && v.color ? ` style="background:${esc(v.color)}"` : ''; }
  function overviewCards() {
    const o = DATA.overview || {};
    const def = [
      ['board', 'Roadmap board', 'What is shipped, in progress, next and on the horizon.', '#/roadmap'],
      ['feature', 'Feature dossiers', 'Every feature with product view, plan, technical design and test cases.', '#/features'],
      ['arch', 'Architecture', 'How the system is put together: services, data and flows.', '#/architecture'],
      ['adr', 'Decision log (ADR)', 'Every architecture decision and its status.', '#/adr'],
      ['gaps', 'Gaps & quality', 'Known defects, code gaps, security and performance findings.', '#/gaps'],
      ['kb', 'Knowledge base', 'Every document behind this hub, readable in place.', '#/kb']
    ];
    const list = Array.isArray(o.cards) ? o.cards.map(c => [c.icon, c.title, c.text, c.route]) : def;
    if (!Array.isArray(o.cards) && ((DATA.learning || {}).courses || []).length) list.unshift(['learn', 'Learning paths', 'Courses in sequence that take you from zero to working on the platform.', '#/learn']);
    return list;
  }

  /* ---------- FEATURES LIST ---------- */
  function renderFeatures(arg) {
    const f = DATA.features || [];
    const keys = Object.keys(parties()).length ? Object.keys(parties()) : Array.from(new Set(f.map(x => x.party).filter(Boolean)));
    const partiesList = ['all', ...keys];
    const active = (sessionStorage.getItem('tb-feat-filter') || 'all');
    const list = active === 'all' ? f : f.filter(x => x.party === active);
    $('#content').innerHTML = `
      <div class="page-head"><p class="eyebrow">Features</p><h1>Feature dossiers</h1>
      <p class="lede">Each feature has a dossier: product view, planning, UX, technical design, implementation status and test cases.</p></div>
      <div class="filterbar">${partiesList.map(p => `<button class="chip ${p === active ? 'active' : ''}" data-p="${p}">${p === 'all' ? 'All' : partyLabel(p)} ${p === 'all' ? `(${f.length})` : `(${f.filter(x => x.party === p).length})`}</button>`).join('')}</div>
      <div class="cards">
        ${list.map(x => `<a class="card" href="#/feature/${esc(x.id)}">
          <div class="card__top"><span class="party-chip p-${esc(x.party)}"${partyStyle(x.party)}>${esc(partyLabel(x.party))}</span></div>
          <h3>${esc(x.title)}</h3>
          <p>${esc(x.summary || '')}</p>
          <div class="meta" style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap">${statusBadge(x.status)}${x.milestone ? `<span class="badge b-new">${esc(x.milestone)}</span>` : ''}</div>
        </a>`).join('') || '<p>No features in this group.</p>'}
      </div>`;
    $$('.chip').forEach(c => c.addEventListener('click', () => { sessionStorage.setItem('tb-feat-filter', c.dataset.p); renderFeatures(); }));
  }

  /* ---------- FEATURE DOSSIER ---------- */
  async function renderFeature(id) {
    const x = (DATA.features || []).find(f => f.id === id);
    if (!x) { $('#content').innerHTML = `<div class="callout danger">Unknown feature: ${esc(id)}</div>`; return; }
    const c = $('#content');
    c.innerHTML = `
      <div class="breadcrumb"><a href="#/features">Features</a> › ${esc(x.title)}</div>
      <div class="page-head">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
          <span class="party-chip p-${esc(x.party)}"${partyStyle(x.party)}>${esc(partyLabel(x.party))}</span>${statusBadge(x.status)}
          ${x.milestone ? `<span class="badge b-new">${esc(x.milestone)}</span>` : ''}${x.priority ? `<span class="badge b-low">${esc(x.priority)}</span>` : ''}
        </div>
        <h1>${esc(x.title)}</h1><p class="lede">${esc(x.summary || '')}</p>
      </div>
      <div class="subnav">
        <a href="#prod">Product</a><a href="#brd">BRD</a><a href="#prd">PRD</a>
        <a href="#ux">UX &amp; UI</a><a href="#tech">Technical</a><a href="#impl">Status</a>
        <a href="#secperf">Security &amp; perf</a><a href="#test">Tests</a>
      </div>
      ${trackCard(x)}
      ${storiesCard(x)}
      ${promptCard(x)}
      ${traceCard(id)}
      <div class="md" id="mdmount"></div>`;
    let mdText;
    try { mdText = await loadMD(`content/features/${id}.md`); }
    catch (e) { $('#mdmount').innerHTML = `<div class="callout warn"><b>Dossier not written yet.</b> <code>content/features/${esc(id)}.md</code></div>`; return; }
    renderMarkdown(mdText, $('#mdmount'));
    // inject the mockup iframe where the marker <!--MOCKUP--> or #mock heading sits
    if (x.mockup) injectMockup(x.mockup);
    // smooth in-page anchors
    $$('.subnav a').forEach(a => a.addEventListener('click', ev => {
      const t = document.getElementById(a.getAttribute('href').slice(1));
      if (t) { ev.preventDefault(); t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    }));
  }
  function injectMockup(path) {
    const anchor = document.getElementById('mockup-slot');
    if (!anchor) return;
    const frame = document.createElement('iframe');
    frame.className = 'mock-frame'; frame.loading = 'lazy'; frame.title = 'UI mockup';
    frame.style.height = (anchor.dataset.h || '620') + 'px';
    frame.src = path;
    anchor.innerHTML = `<div class="mock-toolbar"><span class="mock-dot r"></span><span class="mock-dot y"></span><span class="mock-dot g"></span><span class="mock-url">${esc(anchor.dataset.url || 'app · mockup')}</span></div>`;
    anchor.appendChild(frame);
  }

  /* ---------- tracking (type, report source, scope + version history) ---------- */
  function trackCard(x) {
    if (!x.type && !x.reported && !(x.scopeLog || []).length) return '';
    const st = ((DATA.lifecycle && DATA.lifecycle.stages) || []).find(s => s.key === x.lifecycle);
    const kv = [['Feature ID', x.fid ? `<code class="fid">${esc(x.fid)}</code>` : '-'], ['Type', x.type ? `<span class="badge ${TYPE_BADGE[x.type] || 'b-low'}">${esc(x.type)}</span>` : '-'],
      ['Lifecycle', esc(st ? st.title : (x.lifecycle || 'backlog'))], ['Dev sequence', x.seq ? `<b>#${x.seq}</b>${x.seqNote ? ' · ' + esc(x.seqNote) : ''}` : '-'],
      ['Depends on', (x.dependsOn || []).map(r => `<code>${esc(r)}</code>`).join(' ') || 'none'], ['Version', esc(x.version || '-')], ['Priority', esc(x.priority || '-')],
      ['Reported', esc(x.reported || '-')], ['Source', esc(x.source || '-')], ['Related', (x.related || []).map(r => `<code>${esc(r)}</code>`).join(' ') || '-'],
      ['Branch', x.fid ? `<code>${esc(branchName(x))}</code>` : '-']];
    const log = (x.scopeLog || []).map(l => `<tr><td>${esc(l.date || '')}</td><td>${esc(l.version || '')}</td><td>${esc(l.event || '')}</td><td>${esc(l.change || '')}</td></tr>`).join('');
    return `<div class="callout" style="margin:0 0 18px"><b>Tracking</b>
      <table style="margin-top:8px"><tbody>${kv.map(([k, v]) => `<tr><td style="width:130px"><b>${k}</b></td><td>${v}</td></tr>`).join('')}</tbody></table>
      ${log ? `<p style="margin:12px 0 4px"><b>Scope &amp; version history</b></p><table><thead><tr><th>Date</th><th>Version</th><th>Event</th><th>Change</th></tr></thead><tbody>${log}</tbody></table>` : ''}
    </div>`;
  }

  /* ---------- Claude kickoff prompt (generated per ticket from its data) ---------- */
  function kickoffPrompt(x) {
    const fb = ((DATA.feedback || {}).items || []).find(i => i.fid === x.fid);
    const deps = (x.dependsOn || []);
    const L = [], c = cfg(), HUB = (DATA.meta || {}).hubDir || 'hub', EV = c.evidenceDir || 'evidence', AG = c.agents || {};
    const ag = (k, fb) => AG[k] ? `${AG[k]}` : fb;
    L.push(`Implement ${x.fid}: ${x.title}`);
    L.push(`(${x.version || 'V1'}${x.seq ? `, development sequence #${x.seq}` : ''}${x.priority ? `, ${x.priority}` : ''}) per its Engineering Hub dossier:`);
    L.push(`${HUB}/content/features/${x.id}.md and its entry in ${HUB}/content/data/features.json.`);
    L.push('');
    L.push('Scope:');
    (x.promptScope && x.promptScope.length ? x.promptScope : ['Everything in the dossier PRD (section 3); fix the findings in section 6.']).forEach(l => L.push(`- ${l}`));
    const areas = (x.repos && x.repos.length) ? x.repos : (x.services || []);
    if (areas.length) L.push(`- Repos / areas you may touch (Dispatch locks): ${areas.join(', ')}.`);
    L.push(deps.length ? `- Depends on: ${deps.join(', ')}. Check their lifecycle on the roadmap; do not start a gated part until its dependency is dev-complete or later.` : '- Depends on: none.');
    L.push('');
    L.push('How to work:');
    L.push('- Treat this ticket as ONE GOAL and run it non-stop to completion: implemented, every section 8 test case passing in each environment in turn, hub updated. Do not pause for confirmation between steps.');
    L.push('- Only stop for these hard gates: (a) creating any AWS resource or adding cost, (b) git push, (c) a dependency gate that is not met, (d) a destructive change to shared data. For any other open question, choose the safest option, record the assumption in the ticket scopeLog, and keep going.');
    L.push('- Act as the orchestrator. Keep your own context for planning, integration and verification; delegate the work to subagents (Agent tool):');
    L.push('  - Explore agents to map the code for each part before changing it (run them in parallel).');
    L.push('  - One implementation subagent per repo under code/ (each clone is its own git repo, so parallel subagents in different repos never collide), launched in parallel; give each its repo path, exact files, the dossier section and the acceptance tests. If two parts must change the same repo, create a separate checkout first (git -C code/<repo> worktree add ../<repo>-<fid>-<part> <branch>) and give each subagent its own path. Do not rely on the Agent "worktree" isolation option: it copies the workspace, not the code/ clones.');
    L.push(`  - ${ag('tests', 'a test-writing subagent')} for unit/e2e tests, then ${ag('behavior', 'a behaviour-testing subagent')} for the section 8 cases, ${ag('uiux', 'a UI/UX reviewer')} for any UI change, ${ag('review', 'a code reviewer and a security reviewer')} on the final diff, in parallel.`);
    L.push('  - Merge any extra worktree branches into the ticket branch yourself, remove the worktrees, resolve conflicts, rerun the tests.');
    L.push('- Do small, tightly coupled edits inline; never let two subagents edit the same file.');
    L.push('- If something fails, diagnose and fix it, then continue. Report progress with short updates, not questions.');
    L.push('');
    L.push('Workflow:');
    L.push(`1. ${AG.validator ? AG.validator + ': c' : 'C'}onfirm ${x.fid}, its lifecycle and dependencies. Open the hub Dispatch board (${HUB}, #/dispatch, or python3 ${HUB}/tools/dispatch.py): if it does not say this ticket can run now, stop and tell me why.`);
    L.push('   Immediately after this check, set lifecycle to in-progress in features.json, add a scopeLog row "Picked up", rebuild + deploy the hub, so the Dispatch board locks your repos before you plan.');
    L.push(`   Plan first: use a Plan agent (fed by parallel Explore agents) to write the implementation plan, split into parts per repo with owner subagent, files, tests and risks; save it to ${EV}/<date>/${x.fid.toLowerCase()}/plan.md and add a scopeLog row "Planned". Then execute the plan without waiting for approval.`);
    L.push(`2. Branch ${branchName(x)} in each repo you change${x.baseBranch ? `, from ${x.baseBranch}` : ''}.`);
    L.push('3. Confirm the ticket is in-progress (step 1) before touching any repo. Touch only the repos listed in this ticket ("repos" in features.json).');
    L.push(`4. Plan the parts, fan out the subagents, integrate, then run every test case in dossier section 8 in each environment in turn (${(DATA.lifecycle || {}).promotion || 'Local -> Dev'}); save evidence under ${EV}/<date>/${x.fid.toLowerCase()}/.`);
    L.push(`5. At dev-complete run the reviews (${[AG.behavior, AG.uiux, AG.review].filter(Boolean).join(', ') || 'behaviour, UI/UX if UI, code and security'}); fix what they find; advance lifecycle through the stages in lifecycle.json.`);
    L.push(fb ? `6. After each fix append to ${fb.id}'s "fixes" in ${HUB}/content/data/feedback.json (date, what, closes, commit, env, verifiedBy) and close the matching DEFs in gaps.json.`
              : '6. After each fix add a scopeLog row and close the matching DEFs in gaps.json.');
    L.push('7. Hub data files are shared with other sessions: re-read features.json, feedback.json and gaps.json right before each edit, change only your own entries, keep the formatting, commit only your own files.');
    L.push(`8. Update ${c.worklog || 'the work log'}, rebuild${c.deploy === false ? '' : ' + deploy'} the hub, commit locally only (no push without my approval). Finish with a short summary: what changed, test results, evidence path, anything left for me.`);
    return L.join('\n');
  }
  function promptCard(x) {
    if (!x.fid) return '';
    const txt = kickoffPrompt(x);
    setTimeout(() => {
      const b = document.getElementById('kpCopy'); if (!b) return;
      b.addEventListener('click', async () => { try { await navigator.clipboard.writeText(txt); b.textContent = 'Copied ✓'; setTimeout(() => b.textContent = 'Copy prompt', 1400); } catch (_) {} });
    }, 0);
    return `<details class="callout kp" style="margin:0 0 18px"><summary><b>Claude prompt</b> <span class="hint">paste into a new Claude Code session opened in ${esc(cfg().workspace || 'the project root')} to implement this ticket</span></summary>
      <div style="display:flex;justify-content:flex-end;margin:8px 0"><button class="chip" id="kpCopy" type="button">Copy prompt</button></div>
      <pre class="kp-pre">${esc(txt)}</pre></details>`;
  }



  /* ---------- THIRD PARTIES: vendors and partners under evaluation (content/data/vendors.json) ---------- */
  const VP = { adopt: 'b-fixed', pilot: 'b-new', evaluate: 'b-progress', hold: 'b-backlog', reject: 'b-open' };
  function renderVendors(arg) {
    const V = DATA.vendors || [];
    if (arg) {
      const v = V.find(x => x.id === arg);
      if (!v) { $('#content').innerHTML = `<div class="callout danger">Unknown third party: ${esc(arg)}</div>`; return; }
      const list = (t, a) => (a || []).length ? `<h2>${t}</h2><ul>${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
      $('#content').innerHTML = `<div class="breadcrumb"><a href="#/vendors">Third parties</a> › ${esc(v.name)}</div>
        <div class="page-head"><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><span class="badge ${VP[(v.position || '').toLowerCase()] || 'b-low'}">${esc(v.position || '')}</span><span class="badge b-low">${esc(v.category || '')}</span>${v.status ? `<span class="badge b-backlog">${esc(v.status)}</span>` : ''}</div>
        <h1>${esc(v.name)}</h1><p class="lede">${esc(v.role || '')}</p></div>
        <div class="md">
          ${v.positionWhy ? `<div class="callout"><b>Our position:</b> ${esc(v.positionWhy)}</div>` : ''}
          ${(v.capabilities || []).length ? `<h2>Capabilities and where its adapter sits</h2><p>${v.capabilities.map(c => `<code>${esc(c)}</code>`).join(' ')}</p>${v.adapter ? `<p>${esc(v.adapter)}</p>` : ''}` : ''}
          ${list('Strengths', v.strengths)}${list('Risks', v.risks)}
          ${list('Questions to ask them', v.questions)}${list('Conflicts with our documents, decisions or code', v.conflicts)}
          ${(v.decisions || []).length ? `<h2>Decisions</h2><p>${v.decisions.map(d => `<a href="#/adr"><code>${esc(d)}</code></a>`).join(' ')}</p>` : ''}
          ${(v.features || []).length ? `<h2>Roadmap items</h2><p>${v.features.map(f => { const x = (DATA.features || []).find(y => y.fid === f); return x ? `<a href="#/feature/${esc(x.id)}"><code>${esc(f)}</code> ${esc(x.title)}</a>` : `<code>${esc(f)}</code>`; }).join('<br>')}</p>` : ''}
          ${list('Source documents', v.docs)}
          ${v.updated ? `<p class="footer-note">Last evaluated ${esc(v.updated)}.</p>` : ''}
        </div>`;
      return;
    }
    const cats = Array.from(new Set(V.map(v => v.category || 'Other')));
    const open = V.reduce((n, v) => n + (v.questions || []).length, 0), conf = V.reduce((n, v) => n + (v.conflicts || []).length, 0);
    $('#content').innerHTML = `<div class="page-head"><p class="eyebrow">Partners</p><h1>Third parties</h1>
      <p class="lede">Every provider, vendor and partner we use or are evaluating: its role, where its adapter sits, our position, the questions to ask them and the conflicts to resolve.</p></div>
      <div class="stat-row"><div class="stat"><div class="n">${V.length}</div><div class="l">Third parties</div></div>
        <div class="stat"><div class="n">${V.filter(v => (v.position || '').toLowerCase() === 'adopt').length}</div><div class="l">Adopted</div></div>
        <div class="stat"><div class="n">${V.filter(v => ['pilot', 'evaluate'].includes((v.position || '').toLowerCase())).length}</div><div class="l">Piloting or evaluating</div></div>
        <div class="stat"><div class="n">${open}</div><div class="l">Open questions</div></div>
        <div class="stat"><div class="n" style="color:var(--tb-danger)">${conf}</div><div class="l">Conflicts</div></div></div>
      <div class="md" id="vendorIntro"></div>
      ${cats.map(c => `<h2 style="color:var(--heading);font-size:1.1rem;margin:22px 0 12px">${esc(c)}</h2><div class="cards">${V.filter(v => (v.category || 'Other') === c).map(v => `<a class="card" href="#/vendors/${esc(v.id)}">
        <div class="card__top"><span class="badge ${VP[(v.position || '').toLowerCase()] || 'b-low'}">${esc(v.position || '')}</span>${v.status ? `<span class="badge b-backlog">${esc(v.status)}</span>` : ''}</div>
        <h3>${esc(v.name)}</h3><p>${esc(v.role || '')}</p>
        <p style="margin-top:8px">${(v.questions || []).length} questions · ${(v.conflicts || []).length} conflicts</p></a>`).join('')}</div>`).join('')}`;
    // optional write-up: content/sections/third-parties.md (how we evaluate, positions, top questions)
    loadMD('content/sections/third-parties.md').then(t => renderMarkdown(t, $('#vendorIntro'))).catch(() => {});
  }

  /* ---------- USER STORIES (content/stories/<feature>.json, merged by build.mjs) ---------- */
  const US = { q: '', persona: 'all', phase: 'all', status: 'all', priority: 'all', feature: 'all' };
  const US_BADGE = { done: 'b-fixed', partial: 'b-progress', todo: 'b-backlog' };
  function allStories() { return (DATA.features || []).flatMap(f => (f.stories || []).map(x => ({ ...x, f }))); }
  function storyLine(x) { return `As ${x.asA || 'a user'}, I want ${x.iWant}${x.soThat ? `, so that ${x.soThat}` : ''}.`; }
  function storyRows(list) {
    return list.map(x => `<tr>
      <td><code>${esc(x.id)}</code></td>
      <td><a href="#/feature/${esc(x.f.id)}"><code class="fid">${esc(x.f.fid || x.f.id)}</code></a><br><span class="hint">${esc(x.f.title)}</span></td>
      <td><b>${esc(x.persona || '')}</b></td>
      <td>${esc(storyLine(x))}${(x.acceptance || []).length ? `<details class="us-acc"><summary>${x.acceptance.length} acceptance criteria</summary><ul>${x.acceptance.map(a => `<li>${esc(a)}</li>`).join('')}</ul></details>` : ''}</td>
      <td>${esc(x.priority || '')}</td><td>${esc(x.phase || x.f.version || '')}</td>
      <td><span class="badge ${US_BADGE[x.status] || 'b-backlog'}">${esc(x.status || 'todo')}</span></td>
      <td>${(x.tests || []).map(t => `<code>${esc(t)}</code>`).join(' ')}</td></tr>`).join('');
  }
  function renderStories() {
    const all = allStories();
    const uniq = k => Array.from(new Set(all.map(k).filter(Boolean))).sort();
    const sel = (id, cur, vals, lbl) => `<select id="${id}" class="rm-select"><option value="all">${lbl}</option>${vals.map(v => `<option value="${esc(v)}" ${cur === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
    const n = st => all.filter(x => (x.status || 'todo') === st).length;
    const feats = (DATA.features || []).filter(f => (f.stories || []).length);
    const missing = (DATA.features || []).filter(f => !(f.stories || []).length);
    $('#content').innerHTML = `
      <div class="page-head"><p class="eyebrow">Product</p><h1>User stories</h1>
      <p class="lede">Every user story across the roadmap, with its persona, acceptance criteria, phase, status and the test cases that prove it. Each feature's stories also appear on its dossier.</p></div>
      <div class="stat-row">
        <div class="stat"><div class="n">${all.length}</div><div class="l">Stories</div></div>
        <div class="stat"><div class="n" style="color:var(--tb-success)">${n('done')}</div><div class="l">Done</div>${bar(all.length ? Math.round(n('done') / all.length * 100) : 0)}</div>
        <div class="stat"><div class="n" style="color:var(--tb-warning)">${n('partial')}</div><div class="l">Partial</div></div>
        <div class="stat"><div class="n">${n('todo')}</div><div class="l">To do</div></div>
        <div class="stat"><div class="n">${feats.length}/${(DATA.features || []).length}</div><div class="l">Features with stories</div></div>
      </div>
      ${missing.length ? `<div class="callout warn"><b>${missing.length} features have no stories yet:</b> ${missing.map(f => `<a href="#/feature/${esc(f.id)}"><code>${esc(f.fid || f.id)}</code></a>`).join(' ')}</div>` : ''}
      <div class="rm-toolbar rm-compact"><div class="rm-row">
        ${sel('usPersona', US.persona, uniq(x => x.persona), 'All personas')}
        ${sel('usPhase', US.phase, uniq(x => x.phase || x.f.version), 'All phases')}
        ${sel('usStatus', US.status, ['todo', 'partial', 'done'], 'All statuses')}
        ${sel('usPriority', US.priority, uniq(x => x.priority), 'All priorities')}
        ${sel('usFeature', US.feature, feats.map(f => f.fid || f.id), 'All features')}
        <input id="usSearch" class="rm-search" type="search" placeholder="Search stories, criteria, ID…" value="${esc(US.q)}">
      </div></div>
      <p class="hint" id="usCount"></p>
      <div class="tbl-wrap"><table class="data us-table"><thead><tr><th>ID</th><th>Feature</th><th>Persona</th><th>Story</th><th>Priority</th><th>Phase</th><th>Status</th><th>Tests</th></tr></thead><tbody id="usBody"></tbody></table></div>`;
    const paint = () => {
      const q = US.q.trim().toLowerCase();
      const list = all.filter(x => (US.persona === 'all' || x.persona === US.persona) && (US.phase === 'all' || (x.phase || x.f.version) === US.phase)
        && (US.status === 'all' || (x.status || 'todo') === US.status) && (US.priority === 'all' || x.priority === US.priority)
        && (US.feature === 'all' || (x.f.fid || x.f.id) === US.feature)
        && (!q || [x.id, x.f.fid, x.f.title, x.persona, storyLine(x), (x.acceptance || []).join(' ')].join(' ').toLowerCase().includes(q)));
      $('#usCount').textContent = `${list.length} of ${all.length} stories`;
      $('#usBody').innerHTML = storyRows(list) || '<tr><td colspan="8" class="hint">No stories match.</td></tr>';
    };
    paint();
    [['usPersona', 'persona'], ['usPhase', 'phase'], ['usStatus', 'status'], ['usPriority', 'priority'], ['usFeature', 'feature']].forEach(([id, k]) => $('#' + id).addEventListener('change', e => { US[k] = e.target.value; paint(); }));
    const si = $('#usSearch'); si.addEventListener('input', () => { US.q = si.value; paint(); });
  }
  function storiesCard(x) {
    const st = x.stories || [], cs = x.codeStatus;
    if (!st.length && !cs) return '';
    return `<details class="callout us-card" open style="margin:0 0 18px"><summary><b>User stories</b> <span class="hint">${st.length} stories · ${st.filter(s => s.status === 'done').length} done · ${st.filter(s => s.status === 'partial').length} partial</span></summary>
      ${cs ? `<p style="margin:10px 0 6px"><b>Status from the code:</b> <span class="badge ${({ built: 'b-fixed', partial: 'b-progress', planned: 'b-backlog' })[cs.status] || 'b-low'}">${esc(cs.status || '')}</span> ${esc(cs.notes || '')}${(cs.evidence || []).length ? `<br><span class="hint">Evidence: ${cs.evidence.map(e => `<code>${esc(e)}</code>`).join(' ')}</span>` : ''}</p>` : ''}
      ${st.length ? `<div class="tbl-wrap"><table class="data us-table"><thead><tr><th>ID</th><th>Persona</th><th>Story</th><th>Priority</th><th>Phase</th><th>Status</th><th>Tests</th></tr></thead><tbody>${storyRows(st.map(s => ({ ...s, f: x }))).replace(/<td><a href="#\/feature[\s\S]*?<\/td>/g, '')}</tbody></table></div>` : ''}
    </details>`;
  }

  /* ---------- traceability (feature <-> code) ---------- */
  const TSTATE = { linked: ['Code linked', 'b-fixed'], drift: ['Code drift', 'b-open'], unlinked: ['No code link', 'b-backlog'], none: ['', 'b-backlog'] };
  function traceCard(id) {
    const t = (DATA.traceability || {})[id];
    if (!t) return '';
    const [label, cls] = TSTATE[t.state] || TSTATE.none;
    if (!t.total) return `<div class="trace-card"><span class="badge ${cls}">${esc(label || 'No code link')}</span> <span class="trace-hint">This dossier does not cite a specific source file yet. Add a repo-prefixed path such as <code>transactions-api/src/...</code> so it links to the implementation.</span></div>`;
    const found = t.files.filter(f => f.exists).length;
    return `<div class="trace-card">
      <div class="trace-head"><span class="badge ${cls}">${esc(label)}</span><span class="trace-hint">${found}/${t.total} referenced files found in <code>code/</code></span></div>
      <ul class="trace-files">${t.files.map(f => `<li>${f.exists ? '<span class="tf-ok">&#10003;</span>' : '<span class="tf-no">&#10007;</span>'} ${f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.path)}</a>` : `<code>${esc(f.path)}</code>`}</li>`).join('')}</ul>
    </div>`;
  }
  function renderTrace() {
    const tr = DATA.traceability || {}, feats = DATA.features || [];
    const rows = feats.map(f => ({ ...f, t: tr[f.id] || { state: 'none', total: 0, files: [] } }));
    const rank = { drift: 0, unlinked: 1, none: 1, linked: 2 };
    rows.sort((a, b) => (rank[a.t.state] ?? 3) - (rank[b.t.state] ?? 3));
    const n = s => rows.filter(r => r.t.state === s).length;
    $('#content').innerHTML = `
      <div class="page-head"><p class="eyebrow">Engineering</p><h1>Traceability</h1>
      <p class="lede">Every feature checked against the real code in <code>code/</code>. "Linked" means the files the dossier cites exist; "drift" means a cited file is missing; "no link" means the dossier has not yet cited a source path. Run <code>node build.mjs</code> to refresh.</p></div>
      <div class="stat-row">
        <div class="stat"><div class="n" style="color:var(--tb-success)">${n('linked')}</div><div class="l">Linked to code</div></div>
        <div class="stat"><div class="n" style="color:var(--tb-danger)">${n('drift')}</div><div class="l">Drift (file missing)</div></div>
        <div class="stat"><div class="n" style="color:var(--text-muted)">${n('unlinked') + n('none')}</div><div class="l">No code link yet</div></div>
        <div class="stat"><div class="n">${feats.length}</div><div class="l">Features</div></div>
      </div>
      <div class="tbl-wrap"><table class="data">
        <thead><tr><th>Feature</th><th>Status</th><th>Code link</th><th>Files</th></tr></thead>
        <tbody>${rows.map(r => {
          const [label, cls] = TSTATE[r.t.state] || TSTATE.none;
          return `<tr>
            <td><a href="#/feature/${esc(r.id)}"><b>${esc(r.title)}</b></a> <span class="party-chip p-${esc(r.party)}"${partyStyle(r.party)}>${esc(partyLabel(r.party))}</span></td>
            <td>${statusBadge(r.status)}</td>
            <td><span class="badge ${cls}">${esc(label || 'No code link')}</span></td>
            <td>${r.t.total ? `${r.t.files.filter(f => f.exists).length}/${r.t.total}` : '<span style="color:var(--text-muted)">add a path</span>'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
      <p class="footer-note">Generated by <code>build.mjs</code> from the dossiers + the <code>code/</code> clones. Links point at each repo's current HEAD on GitHub.</p>`;
  }

  /* ---------- ADR ---------- */
  function renderADR() {
    const a = DATA.adrs || [];
    $('#content').innerHTML = `
      <div class="page-head"><p class="eyebrow">Decisions</p><h1>Architecture Decision Records</h1>
      <p class="lede">Every significant decision, why it was made, and its status. ${a.length} records.</p></div>
      <div class="tbl-wrap"><table class="data">
        <thead><tr><th>#</th><th>Decision</th><th>Status</th><th>Summary</th></tr></thead>
        <tbody>${a.map(r => `<tr>
          <td><code>${esc(r.id)}</code></td>
          <td><b>${esc(r.title)}</b>${r.date ? `<br><span style="color:var(--text-muted);font-size:.8em">${esc(r.date)}</span>` : ''}</td>
          <td>${statusBadge(r.status)}</td>
          <td>${esc(r.summary || '')}</td>
        </tr>`).join('')}</tbody>
      </table></div>
      <p class="footer-note">Source: <code>content/data/adrs.json</code>.</p>`;
  }

  /* ---------- GAPS ---------- */
  function renderGaps() {
    const g = DATA.gaps || [], ds = DATA.defectsSummary || null;
    const areas = ['all', ...Array.from(new Set(g.map(x => x.area))).filter(Boolean)];
    const active = sessionStorage.getItem('tb-gap-filter') || 'all';
    const list = active === 'all' ? g : g.filter(x => x.area === active);
    const sevRank = { critical: 0, high: 1, medium: 2, low: 3 };
    list.sort((a, b) => (sevRank[(a.severity || '').toLowerCase()] ?? 9) - (sevRank[(b.severity || '').toLowerCase()] ?? 9));
    $('#content').innerHTML = `
      <div class="page-head"><p class="eyebrow">Quality</p><h1>Gaps &amp; quality board</h1>
      <p class="lede">Known code gaps, defects and risks, grouped by area and sorted by severity.</p></div>
      ${ds ? `<div class="stat-row">
        <div class="stat"><div class="n">${ds.total}</div><div class="l">Total defects</div></div>
        <div class="stat"><div class="n" style="color:var(--tb-danger)">${ds.critical || 0}</div><div class="l">Critical</div></div>
        <div class="stat"><div class="n" style="color:var(--tb-warning)">${ds.high || 0}</div><div class="l">High</div></div>
        <div class="stat"><div class="n">${ds.medium || 0}</div><div class="l">Medium</div></div>
        <div class="stat"><div class="n">${ds.low || 0}</div><div class="l">Low</div></div>
      </div>` : ''}
      <div class="filterbar">${areas.map(ar => `<button class="chip ${ar === active ? 'active' : ''}" data-a="${esc(ar)}">${ar === 'all' ? 'All areas' : esc(ar)}</button>`).join('')}</div>
      <div class="tbl-wrap"><table class="data">
        <thead><tr><th>ID</th><th>Title</th><th>Area</th><th>Severity</th><th>Status</th><th>Reference</th></tr></thead>
        <tbody>${list.map(r => `<tr>
          <td><code>${esc(r.id)}</code></td>
          <td><b>${esc(r.title)}</b>${r.summary ? `<br><span style="color:var(--text-muted);font-size:.85em">${esc(r.summary)}</span>` : ''}</td>
          <td>${esc(r.area || '')}</td>
          <td><span class="sev-dot sev-${esc((r.severity || '').toLowerCase())}"></span>${esc(r.severity || '')}</td>
          <td>${statusBadge(r.status || 'open')}</td>
          <td><code style="font-size:.78em">${esc(r.ref || '')}</code></td>
        </tr>`).join('')}</tbody>
      </table></div>
      <p class="footer-note">Source: <code>content/data/gaps.json</code>.</p>`;
    $$('.chip').forEach(c => c.addEventListener('click', () => { sessionStorage.setItem('tb-gap-filter', c.dataset.a); renderGaps(); }));
  }

  function secLede(id, fb) { const s = (DATA.sections || []).find(x => x.id === id); return (s && s.lede) || fb; }

  /* ---------- SECURITY ---------- */
  async function renderSecurity() {
    const s = DATA.security || [];
    const c = $('#content');
    c.innerHTML = `
      <div class="page-head"><p class="eyebrow">Security</p><h1>Security</h1>
      <p class="lede">${esc(secLede('security', 'The security model and the security findings.'))}</p></div>
      ${s.length ? `<div class="tbl-wrap"><table class="data">
        <thead><tr><th>Finding</th><th>Severity</th><th>Status</th><th>Summary</th><th>Area</th></tr></thead>
        <tbody>${s.map(r => `<tr><td><b>${esc(r.title)}</b></td><td><span class="sev-dot sev-${esc((r.severity || '').toLowerCase())}"></span>${esc(r.severity || '')}</td><td>${statusBadge(r.status || 'open')}</td><td>${esc(r.summary || '')}</td><td><code style="font-size:.78em">${esc(r.ref || '')}</code></td></tr>`).join('')}</tbody>
      </table></div>` : ''}
      <div class="md" id="mdmount" style="margin-top:20px"></div>`;
    try { renderMarkdown(await loadMD('content/sections/security.md'), $('#mdmount')); } catch (e) {}
  }

  /* ---------- PERFORMANCE ---------- */
  async function renderPerformance() {
    const p = DATA.performance || [];
    const c = $('#content');
    c.innerHTML = `
      <div class="page-head"><p class="eyebrow">Performance</p><h1>Performance</h1>
      <p class="lede">${esc(secLede('performance', 'Performance findings, budgets and the signals that track them.'))}</p></div>
      ${p.length ? `<div class="tbl-wrap"><table class="data">
        <thead><tr><th>Finding</th><th>Severity</th><th>Status</th><th>Summary</th></tr></thead>
        <tbody>${p.map(r => `<tr><td><b>${esc(r.title)}</b></td><td><span class="sev-dot sev-${esc((r.severity || '').toLowerCase())}"></span>${esc(r.severity || '')}</td><td>${statusBadge(r.status || 'open')}</td><td>${esc(r.summary || '')}</td></tr>`).join('')}</tbody>
      </table></div>` : ''}
      <div class="md" id="mdmount" style="margin-top:20px"></div>`;
    try { renderMarkdown(await loadMD('content/sections/performance.md'), $('#mdmount')); } catch (e) {}
  }

  /* ---------- KNOWLEDGE BASE ---------- */
  function renderKB() {
    const kb = DATA.kb || [];
    const groups = {};
    kb.forEach(k => { (groups[k.group || 'Reference'] = groups[k.group || 'Reference'] || []).push(k); });
    $('#content').innerHTML = `
      <div class="page-head"><p class="eyebrow">Reference</p><h1>Knowledge base</h1>
      <p class="lede">The reference material behind this hub: ${kb.length} documents, each readable in place.</p></div>
      ${Object.keys(groups).map(g => `
        <h2 style="color:var(--heading);font-size:1.1rem;margin:22px 0 12px">${esc(g)}</h2>
        <div class="cards">${groups[g].map(k => `<a class="card" href="#/doc/${esc(k.path)}"><div class="card__top"><span class="badge b-low">${esc((k.path.split('.').pop() || '').toUpperCase())}</span>${k.version ? `<span class="badge b-new">${esc(k.version)}</span>` : ''}</div><h3>${esc(k.title)}</h3><p>${esc(k.summary || '')}</p><p style="margin-top:8px"><code style="font-size:.76em">${esc(k.path)}</code></p></a>`).join('')}</div>`).join('')}`;
  }

  /* ---------- DOC VIEWER (renders any local markdown linked into the hub) ---------- */
  async function renderDoc(arg) {
    const c = $('#content');
    const k = (DATA.kb || []).find(x => x.path === arg);
    const src = 'content/kb-src/' + arg.split('/').map(encodeURIComponent).join('/');
    c.innerHTML = `<div class="breadcrumb"><a href="#/kb">Knowledge base</a> › <code style="font-size:.9em">${esc(arg)}</code> · <a href="${src}" target="_blank" rel="noopener">open in a new tab</a></div><div id="mdmount" class="md"><div class="loading"><span class="spinner"></span> Loading…</div></div>`;
    const mount = $('#mdmount');
    if (/\.(html?|pdf)$/i.test(arg)) {
      // HTML and PDF documents render as they were published, in a frame.
      mount.className = '';
      mount.innerHTML = `${k ? `<div class="page-head"><h1>${esc(k.title)}</h1>${k.summary ? `<p class="lede">${esc(k.summary)}</p>` : ''}</div>` : ''}<iframe class="docframe" title="${esc(k ? k.title : arg)}" src="${src}"></iframe>`;
      return;
    }
    try { renderMarkdown(await loadMD(src), mount); }
    catch (e) { mount.innerHTML = `<div class="callout warn"><b>Could not load</b> <code>${esc(arg)}</code>. It may be a binary file; see it in the repo.</div>`; }
  }

  /* ---------- GTM / production-readiness board ---------- */
  function renderGTM() {
    const items = DATA.gtm || [];
    const streams = Array.from(new Set(items.map(i => i.workstream)));
    const sev = { blocker: 0, high: 1, medium: 2, low: 3 };
    const chip = s => { const k = (s || 'todo').toLowerCase().replace(/\s+/g, '-'); return `<span class="badge b-${k === 'done' ? 'fixed' : k === 'in-progress' ? 'progress' : k === 'blocker' ? 'open' : 'new'}">${esc(s)}</span>`; };
    const done = items.filter(i => (i.status || '').toLowerCase() === 'done').length;
    $('#content').innerHTML = `
      <div class="page-head"><p class="eyebrow">Go to market</p><h1>Production readiness board</h1>
      <p class="lede">Everything that must be done before ${esc((window.__BRAND || {}).name || 'the platform')} goes to production, grouped by workstream. ${done} of ${items.length} complete.</p></div>
      <div class="stat-row">
        <div class="stat"><div class="n">${items.length}</div><div class="l">Total actions</div></div>
        <div class="stat"><div class="n" style="color:var(--tb-danger)">${items.filter(i => (i.priority || '').toLowerCase() === 'blocker').length}</div><div class="l">Blockers</div></div>
        <div class="stat"><div class="n" style="color:var(--tb-warning)">${items.filter(i => (i.status || '').toLowerCase() === 'in-progress').length}</div><div class="l">In progress</div></div>
        <div class="stat"><div class="n" style="color:var(--tb-success)">${done}</div><div class="l">Done</div></div>
      </div>
      <div class="board" style="grid-template-columns:repeat(${Math.min(streams.length,5)},minmax(230px,1fr))">
        ${streams.map(st => {
          const list = items.filter(i => i.workstream === st).sort((a, b) => (sev[(a.priority || '').toLowerCase()] ?? 9) - (sev[(b.priority || '').toLowerCase()] ?? 9));
          return `<div class="board__col"><h2>${esc(st)}<span class="k">${list.length}</span></h2>
            ${list.map(i => `<div class="tcard"><h4>${esc(i.title)}</h4>${i.summary ? `<p>${esc(i.summary)}</p>` : ''}<div class="meta">${chip(i.status || 'todo')}${i.priority ? `<span class="badge b-${(i.priority||'').toLowerCase()==='blocker'?'open':'low'}">${esc(i.priority)}</span>` : ''}${i.ref ? `<span class="badge b-low">${esc(i.ref)}</span>` : ''}</div></div>`).join('')}
          </div>`;
        }).join('')}
      </div>
      <p class="footer-note">Sourced from the gaps board, security findings, the infrastructure plan and the accounts/licence checklist. Edit <code>content/data/gtm.json</code> to update.</p>`;
  }

  /* ---------- ACCOUNTS ---------- */
  async function renderAccounts() {
    const c = $('#content');
    c.innerHTML = `<div class="page-head"><p class="eyebrow">Access</p><h1>Accounts &amp; access</h1>
      <p class="lede">Demo logins, environment URLs and third-party accounts. Secrets are never shown here.</p></div>
      <div class="md" id="mdmount"></div>`;
    try { renderMarkdown(await loadMD('content/sections/accounts.md'), $('#mdmount')); }
    catch (e) { $('#mdmount').innerHTML = `<div class="callout warn">accounts.md not written yet.</div>`; }
  }

  /* ---------- LEARNING PATHS (courses in sequence) ----------
     Data: manifest.learning = { intro, paths:[{id,title,summary,steps:[courseId | "course/lesson"]}],
     courses:[{id,code,title,level,goal,outcomes,prereqs,lessons:[{id,title,minutes,src,objectives,checks}]}] }.
     Progress is per browser (localStorage), so it never needs a backend. */
  const LKEY = () => 'hub-learn:' + ((window.__BRAND || {}).name || 'hub');
  function lprog() { try { return JSON.parse(localStorage.getItem(LKEY()) || '{}'); } catch (_) { return {}; } }
  function lsave(p) { try { localStorage.setItem(LKEY(), JSON.stringify(p)); } catch (_) {} }
  function isDone(c, l) { return !!((lprog().done || {})[c + '/' + l]); }
  function setDone(c, l, v) { const p = lprog(); p.done = p.done || {}; if (v) p.done[c + '/' + l] = new Date().toISOString().slice(0, 10); else delete p.done[c + '/' + l]; lsave(p); }
  function setLast(c, l) { const p = lprog(); p.last = c + '/' + l; lsave(p); }
  const L = () => DATA.learning || { paths: [], courses: [] };
  const courseById = id => (L().courses || []).find(c => c.id === id);
  function courseStats(c) {
    const n = (c.lessons || []).length, d = (c.lessons || []).filter(l => isDone(c.id, l.id)).length;
    const mins = (c.lessons || []).reduce((m, l) => m + (+l.minutes || 0), 0);
    return { n, d, pct: n ? Math.round(d / n * 100) : 0, mins };
  }
  const hrs = m => m >= 60 ? `${Math.round(m / 6) / 10} h` : `${m} min`;
  function nextLessonOf(c) { return (c.lessons || []).find(l => !isDone(c.id, l.id)) || (c.lessons || [])[0]; }
  function bar(pct) { return `<div class="lbar"><i style="width:${pct}%"></i></div>`; }
  function levelChip(lv) { return lv ? `<span class="badge b-${esc(lv)} lvl">${esc(lv)}</span>` : ''; }
  // Expand a path's steps to an ordered list of {course, lesson|null}.
  function pathSteps(p) {
    return (p.steps || p.courses || []).map(s => {
      const [cid, lid] = String(s).split('/');
      const c = courseById(cid); if (!c) return null;
      return { c, l: lid ? (c.lessons || []).find(x => x.id === lid) : null };
    }).filter(Boolean);
  }
  function stepDone(s) { return s.l ? isDone(s.c.id, s.l.id) : courseStats(s.c).pct === 100; }

  function renderLearn() {
    const lr = L(), prog = lprog();
    const total = (lr.courses || []).reduce((n, c) => n + c.lessons.length, 0);
    const done = Object.keys(prog.done || {}).length;
    let resume = '';
    if (prog.last) {
      const [cid, lid] = prog.last.split('/'); const c = courseById(cid); const l = c && c.lessons.find(x => x.id === lid);
      if (c && l) resume = `<a class="resume" href="#/lesson/${esc(cid)}/${esc(lid)}"><span class="resume__k">Continue where you left off</span><b>${esc(c.code || '')} · ${esc(l.title)}</b></a>`;
    }
    $('#content').innerHTML = `
      <div class="page-head"><p class="eyebrow">Learning</p><h1>${esc(lr.title || 'Learning paths')}</h1>
      <p class="lede">${esc(lr.lede || 'Courses in a deliberate order. Each lesson assumes only the ones before it.')}</p></div>
      <div class="stat-row">
        <div class="stat"><div class="n">${(lr.courses || []).length}</div><div class="l">Courses</div></div>
        <div class="stat"><div class="n">${total}</div><div class="l">Lessons</div></div>
        <div class="stat"><div class="n">${done}</div><div class="l">Completed by you</div>${bar(total ? Math.round(done / total * 100) : 0)}</div>
        <div class="stat"><div class="n">${hrs((lr.courses || []).reduce((m, c) => m + courseStats(c).mins, 0))}</div><div class="l">Total study time</div></div>
      </div>
      ${resume}
      ${lr.intro ? `<div class="md" style="margin:4px 0 18px">${window.marked ? marked.parse(lr.intro) : esc(lr.intro)}</div>` : ''}
      ${(lr.paths || []).map(p => {
        const steps = pathSteps(p), d = steps.filter(stepDone).length;
        return `<section class="lpath">
          <div class="lpath__head"><div><h2>${esc(p.title)}</h2>${p.summary ? `<p>${esc(p.summary)}</p>` : ''}</div>
          <span class="lpath__k">${d}/${steps.length} steps</span></div>
          <ol class="lsteps">${steps.map((s, i) => {
            const st = s.l ? null : courseStats(s.c), ok = stepDone(s);
            const href = s.l ? `#/lesson/${esc(s.c.id)}/${esc(s.l.id)}` : `#/course/${esc(s.c.id)}`;
            return `<li class="lstep ${ok ? 'done' : ''}"><a href="${href}">
              <span class="lstep__n">${ok ? '&#10003;' : i + 1}</span>
              <span class="lstep__body"><span class="lstep__code">${esc(s.c.code || s.c.id)}${s.l ? ' · lesson' : ''}</span>
              <b>${esc(s.l ? s.l.title : s.c.title)}</b>
              <span class="lstep__meta">${s.l ? `${esc(s.l.minutes || '')} min` : `${st.n} lessons · ${hrs(st.mins)} ${levelChip(s.c.level)}`}</span>
              ${st ? bar(st.pct) : ''}</span></a></li>`;
          }).join('')}</ol></section>`;
      }).join('')}
      <h2 style="color:var(--heading);font-size:1.1rem;margin:28px 0 12px">All courses</h2>
      <div class="cards">${(lr.courses || []).map(c => { const st = courseStats(c); return `<a class="card" href="#/course/${esc(c.id)}">
        <div class="card__top"><span class="lstep__code">${esc(c.code || c.id)}</span>${levelChip(c.level)}</div>
        <h3>${esc(c.title)}</h3><p>${esc(c.goal || '')}</p>
        <p style="margin-top:10px">${st.n} lessons · ${hrs(st.mins)} · ${st.pct}% done</p>${bar(st.pct)}</a>`; }).join('')}</div>
      <p class="footer-note">Progress is saved in this browser only. <a href="#" id="lreset">Reset my progress</a></p>`;
    $('#lreset')?.addEventListener('click', e => { e.preventDefault(); if (confirm('Clear your learning progress in this browser?')) { lsave({}); renderLearn(); } });
  }

  function renderCourse(id) {
    const c = courseById(id);
    if (!c) { $('#content').innerHTML = `<div class="callout danger">Unknown course: ${esc(id)}</div>`; return; }
    const st = courseStats(c), nxt = nextLessonOf(c);
    const pre = (c.prereqs || []).map(courseById).filter(Boolean);
    const preOpen = pre.filter(p => courseStats(p).pct < 100);
    $('#content').innerHTML = `
      <div class="breadcrumb"><a href="#/learn">Learning</a> › ${esc(c.code || c.id)}</div>
      <div class="page-head"><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><span class="lstep__code">${esc(c.code || c.id)}</span>${levelChip(c.level)}<span class="badge b-low">${st.n} lessons · ${hrs(st.mins)}</span></div>
        <h1>${esc(c.title)}</h1><p class="lede">${esc(c.goal || '')}</p></div>
      ${preOpen.length ? `<div class="callout warn"><b>Take these first:</b> ${preOpen.map(p => `<a href="#/course/${esc(p.id)}">${esc(p.title)}</a>`).join(', ')}. The lessons here assume them.</div>` : ''}
      <div class="lcourse">
        <div>
          ${(c.outcomes || []).length ? `<div class="lbox"><h3>By the end of this course you can</h3><ul>${c.outcomes.map(o => `<li>${esc(o)}</li>`).join('')}</ul></div>` : ''}
          <ol class="llist">${c.lessons.map((l, i) => `<li class="${isDone(c.id, l.id) ? 'done' : ''}"><a href="#/lesson/${esc(c.id)}/${esc(l.id)}">
            <span class="lstep__n">${isDone(c.id, l.id) ? '&#10003;' : String(i + 1).padStart(2, '0')}</span>
            <span><b>${esc(l.title)}</b><span class="lstep__meta">${esc(l.minutes || '')} min${(l.objectives || [])[0] ? ` · ${esc(l.objectives[0])}` : ''}</span></span></a></li>`).join('')}</ol>
        </div>
        <aside class="lside">
          <div class="lbox"><div class="n">${st.pct}%</div><div class="l">${st.d} of ${st.n} lessons done</div>${bar(st.pct)}
          ${nxt ? `<a class="lbtn" href="#/lesson/${esc(c.id)}/${esc(nxt.id)}">${st.d ? 'Continue' : 'Start the course'}</a>` : ''}</div>
          ${pre.length ? `<div class="lbox"><h3>Prerequisites</h3><ul class="plain">${pre.map(p => `<li>${courseStats(p).pct === 100 ? '&#10003;' : '&#9675;'} <a href="#/course/${esc(p.id)}">${esc(p.code || p.id)} ${esc(p.title)}</a></li>`).join('')}</ul></div>` : ''}
        </aside>
      </div>`;
  }

  async function renderLesson(arg) {
    const [cid, lid] = arg.split('/');
    const c = courseById(cid), i = c ? c.lessons.findIndex(l => l.id === lid) : -1;
    if (i < 0) { $('#content').innerHTML = `<div class="callout danger">Unknown lesson: ${esc(arg)}</div>`; return; }
    const l = c.lessons[i], prev = c.lessons[i - 1], next = c.lessons[i + 1];
    setLast(cid, lid);
    // the next course in the first path that contains this course
    let nextCourse = null;
    if (!next) for (const p of (L().paths || [])) { const ids = (p.steps || p.courses || []).map(s => String(s).split('/')[0]); const k = ids.indexOf(cid); if (k >= 0) { const nid = ids.slice(k + 1).find(x => x !== cid); if (nid) { nextCourse = courseById(nid); break; } } }
    const isHtml = /\.html?$/i.test(l.src || '');
    $('#content').innerHTML = `
      <div class="breadcrumb"><a href="#/learn">Learning</a> › <a href="#/course/${esc(cid)}">${esc(c.code || cid)}</a> › Lesson ${i + 1} of ${c.lessons.length} · ${esc(l.minutes || '')} min</div>
      <div class="ldots">${c.lessons.map((x, k) => `<a href="#/lesson/${esc(cid)}/${esc(x.id)}" class="${k === i ? 'cur' : ''} ${isDone(cid, x.id) ? 'done' : ''}" title="${esc(x.title)}"></a>`).join('')}</div>
      ${!isHtml && (l.objectives || []).length ? `<div class="lbox lobj"><h3>After this lesson you can</h3><ul>${l.objectives.map(o => `<li>${esc(o)}</li>`).join('')}</ul></div>` : ''}
      <div id="lmount" class="${isHtml ? '' : 'md'}"><div class="loading"><span class="spinner"></span> Loading…</div></div>
      ${(l.checks || []).length ? `<div class="lchecks"><h2>Check your understanding</h2><p class="hint">Answer in your own words first, then open the answer.</p><ol>${l.checks.map(q => `<li><p>${esc(q.q)}</p><details><summary>Show the answer</summary><p>${esc(q.a)}</p></details></li>`).join('')}</ol></div>` : ''}
      ${(l.sources || []).length ? `<p class="footer-note">Sources: ${l.sources.map(s => `<code>${esc(s)}</code>`).join(', ')}</p>` : ''}
      <div class="lnav">
        ${prev ? `<a class="lbtn ghost" href="#/lesson/${esc(cid)}/${esc(prev.id)}">&larr; ${esc(prev.title)}</a>` : `<a class="lbtn ghost" href="#/course/${esc(cid)}">&larr; Course outline</a>`}
        <button class="lbtn ${isDone(cid, lid) ? 'ok' : ''}" id="ldone" type="button">${isDone(cid, lid) ? '&#10003; Completed' : 'Mark complete'}</button>
        ${next ? `<a class="lbtn" href="#/lesson/${esc(cid)}/${esc(next.id)}" data-next>Next: ${esc(next.title)} &rarr;</a>`
          : nextCourse ? `<a class="lbtn" href="#/course/${esc(nextCourse.id)}" data-next>Next course: ${esc(nextCourse.code || '')} ${esc(nextCourse.title)} &rarr;</a>`
          : `<a class="lbtn" href="#/learn" data-next>Back to learning paths</a>`}
      </div>`;
    $('#ldone').addEventListener('click', () => { const v = !isDone(cid, lid); setDone(cid, lid, v); renderLesson(arg); });
    // Moving on counts as finishing the lesson.
    $('[data-next]')?.addEventListener('click', () => setDone(cid, lid, true));
    const mount = $('#lmount');
    if (isHtml) {
      const f = document.createElement('iframe');
      f.className = 'lframe'; f.title = l.title; f.src = l.src;
      f.addEventListener('load', () => {
        try {
          const d = f.contentDocument, t = document.documentElement.getAttribute('data-theme');
          if (t) d.documentElement.setAttribute('data-theme', t);
          const fit = () => { f.style.height = (d.documentElement.scrollHeight + 4) + 'px'; };
          fit(); setTimeout(fit, 400); setTimeout(fit, 1500);
          $$('a[href^="http"]', d).forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });
          // The lesson's own relative links (previous / next / course index) point at files
          // the hub may not carry: send them to the matching hub lesson, else the course page.
          const bySrc = {};
          (L().courses || []).forEach(cc => (cc.lessons || []).forEach(ll => { bySrc[new URL(ll.src, location.href).href] = `#/lesson/${cc.id}/${ll.id}`; }));
          $$('a[href]', d).forEach(a => {
            const h = a.getAttribute('href');
            if (/^(https?:|mailto:|#)/i.test(h)) return;
            const url = new URL(h, f.contentWindow.location.href).href;
            a.target = '_top'; a.href = location.href.split('#')[0] + (bySrc[url] || `#/course/${cid}`);
          });
        } catch (_) { f.style.height = '80vh'; }
      });
      mount.innerHTML = ''; mount.appendChild(f);
    } else {
      try { renderMarkdown(await loadMD(l.src), mount); }
      catch (e) { mount.innerHTML = `<div class="callout warn"><b>Lesson not written yet.</b> <code>${esc(l.src)}</code></div>`; }
    }
  }

  /* ---------- SEARCH ---------- */
  function initSearch() {
    const input = $('#globalSearch'), box = $('#searchResults');
    const idx = [];
    (DATA.features || []).forEach(f => idx.push({ kind: 'Feature', title: f.title, sub: f.summary, href: `#/feature/${f.id}` }));
    (DATA.adrs || []).forEach(a => idx.push({ kind: 'ADR', title: a.title, sub: a.summary, href: '#/adr' }));
    (DATA.gaps || []).forEach(g => idx.push({ kind: 'Gap', title: `${g.id} ${g.title}`, sub: g.summary, href: '#/gaps' }));
    (DATA.kb || []).forEach(k => idx.push({ kind: 'Doc', title: k.title, sub: k.summary, href: '#/doc/' + k.path }));
    (DATA.vendors || []).forEach(v => idx.push({ kind: 'Third party', title: v.name, sub: v.role, href: '#/vendors/' + v.id }));
    (DATA.features || []).forEach(f => (f.stories || []).forEach(x => idx.push({ kind: 'Story', title: `${x.id} ${x.iWant}`, sub: `${f.fid || ''} ${x.persona || ''}`, href: '#/feature/' + f.id })));
    ((DATA.learning || {}).courses || []).forEach(c => {
      idx.push({ kind: 'Course', title: `${c.code || ''} ${c.title}`, sub: c.goal, href: '#/course/' + c.id });
      (c.lessons || []).forEach(l => idx.push({ kind: 'Lesson', title: l.title, sub: (c.code || c.title) + ' ' + (l.objectives || []).join(' '), href: `#/lesson/${c.id}/${l.id}` }));
    });
    (DATA.sections || []).forEach(s => idx.push({ kind: 'Section', title: s.title, sub: s.lede, href: '#/' + s.id }));
    (DATA.nav || []).forEach(g => g.items.forEach(it => idx.push({ kind: 'Page', title: it.title, sub: '', href: it.route })));
    const run = q => {
      q = q.trim().toLowerCase();
      if (!q) { box.hidden = true; return; }
      const hits = idx.filter(i => (i.title + ' ' + (i.sub || '')).toLowerCase().includes(q)).slice(0, 12);
      box.hidden = false;
      box.innerHTML = hits.length ? hits.map(h => `<a href="${esc(h.href)}"><span class="sr-kind">${esc(h.kind)}</span><br>${esc(h.title)}</a>`).join('') : `<div class="sr-empty">No matches for “${esc(q)}”.</div>`;
    };
    input.addEventListener('input', () => run(input.value));
    input.addEventListener('focus', () => { if (input.value) run(input.value); });
    document.addEventListener('click', e => { if (!e.target.closest('.topbar__search')) box.hidden = true; });
    box.addEventListener('click', () => { box.hidden = true; input.value = ''; });
  }

  /* ---------- mobile nav ---------- */
  function initMobileNav() {
    $('#menuToggle')?.addEventListener('click', () => { $('#sidebar').classList.add('open'); $('#scrim').classList.add('show'); });
    $('#scrim')?.addEventListener('click', closeMobileNav);
  }
  function closeMobileNav() { $('#sidebar')?.classList.remove('open'); $('#scrim')?.classList.remove('show'); }

  (async () => { try { await applyBrand(); } catch (_) {} initGate(); })();
})();
