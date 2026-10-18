/* ============================================================
   Engineering Hub — single-page engine
   Content is DATA: manifest.json + markdown under content/.
   Edit the files, re-sync to S3, the hub updates. No rebuild
   of this file is needed to change content.
   ============================================================ */
(() => {
  'use strict';
  const PASSCODE = 'changeme';
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
    ext: '<path d="M14 4h6v6M20 4l-9 9M19 13v6H5V5h6"/>'
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
    if (b.name) { document.title = `${b.name} Engineering Hub`; const el = $('.brand-sub'); if (el) el.textContent = 'Engineering Hub'; }
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
      '#/kb': (DATA.kb || []).length
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
    kb: renderKB, doc: renderDoc, gtm: renderGTM, traceability: renderTrace, accounts: renderAccounts, changelog: md('changelog')
  };
  async function route() {
    if (!location.hash || location.hash === '#') { location.hash = '#/overview'; return; }
    const parts = location.hash.replace(/^#\//, '').split('/');
    const key = parts[0] || 'overview';
    const arg = parts.slice(1).join('/');
    const fn = ROUTES[key] || renderOverview;
    setActive();
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

  /* ---------- OVERVIEW ---------- */
  function statusBadge(s) { const k = (s || '').toLowerCase().replace(/\s+/g, '-'); return `<span class="badge b-${k}">${esc(s)}</span>`; }
  async function renderOverview() {
    const f = DATA.features || [], o = DATA.overview || {};
    const by = s => f.filter(x => (x.status || '').toLowerCase() === s).length;
    const sh = by('built') + by('shipped'), pa = by('partial'), ne = f.filter(x => ['new', 'next', 'planned'].includes((x.status || '').toLowerCase())).length;
    const adrN = (DATA.adrs || []).length, gapN = (DATA.gaps || []).length, secN = (DATA.security || []).length;
    $('#content').innerHTML = `
      <div class="page-head">
        <p class="eyebrow">Project Platform</p>
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
        ${[
          ['board', 'Roadmap board', 'What is shipped, in progress, next and on the North Star horizon.', '#/roadmap'],
          ['feature', 'Feature dossiers', 'Every feature with product view, plan, UI mockup, technical design and test cases.', '#/features'],
          ['arch', 'Architecture', 'The five services, how they connect, data model and workflows.', '#/architecture'],
          ['infra', 'Infrastructure & AWS', 'What runs in AWS today and the recommended demo / dev / prod split.', '#/infra'],
          ['adr', 'Decision log (ADR)', 'Every architecture decision and its status.', '#/adr'],
          ['gaps', 'Gaps & quality', 'Known defects, code gaps, security and performance findings.', '#/gaps'],
          ['security', 'Security', 'Auth model, PHI handling and the security findings.', '#/security'],
          ['product', 'Product (BRD / PRD)', 'Vision, journeys and the existing / new / future feature set.', '#/product']
        ].map(([i, t, d, r]) => `<a class="card" href="${r}"><div class="card__top"><div class="card__ico">${ico(i, '')}</div><h3>${t}</h3></div><p>${d}</p></a>`).join('')}
      </div>
      <p class="footer-note">${esc(o.footer || '')}</p>`;
    $$('.card__ico svg').forEach(s => { s.setAttribute('viewBox', '0 0 24 24'); });
  }

  /* ---------- ROADMAP BOARD ---------- */
  function renderRoadmap() {
    const cols = [
      { key: 'shipped', title: 'Shipped', hint: 'Live or built in the codebase', mark: 'var(--tb-success-fill)', match: s => ['built', 'shipped'].includes(s) },
      { key: 'progress', title: 'In progress', hint: 'Partially built / being worked', mark: 'var(--tb-warning-fill)', match: s => ['partial', 'in-progress', 'progress'].includes(s) },
      { key: 'next', title: 'Next', hint: 'Near-term plan (V1 / V2)', mark: 'var(--tb-blue-500)', match: s => ['new', 'next', 'planned'].includes(s) },
      { key: 'future', title: 'Future', hint: 'North Star horizon (V3+)', mark: 'var(--text-muted)', match: s => ['future', 'backlog'].includes(s) }
    ];
    const items = [
      ...(DATA.features || []).map(f => ({ ...f, link: `#/feature/${f.id}` })),
      ...(DATA.roadmapExtra || []).map(r => ({ ...r, link: r.link || '#/product' }))
    ];
    const card = it => `<a class="tcard" href="${esc(it.link)}">
      <h4>${esc(it.title)}</h4>
      ${it.summary ? `<p>${esc(it.summary)}</p>` : ''}
      <div class="meta">
        ${it.party ? `<span class="party-chip p-${esc(it.party)}">${esc(partyLabel(it.party))}</span>` : ''}
        ${it.milestone ? `<span class="badge b-new">${esc(it.milestone)}</span>` : ''}
        ${it.priority ? `<span class="badge b-low">${esc(it.priority)}</span>` : ''}
      </div></a>`;
    $('#content').innerHTML = `
      <div class="page-head"><p class="eyebrow">Delivery</p><h1>Roadmap board</h1>
      <p class="lede">What is done, what is moving, and what is on the North Star horizon. Cards link to the feature dossier or product view.</p></div>
      <div class="board">
        ${cols.map(c => {
          const list = items.filter(i => c.match((i.status || '').toLowerCase()));
          return `<div class="board__col">
            <h2><span class="colmark" style="background:${c.mark}"></span>${c.title}<span class="k">${list.length}</span></h2>
            <p class="colhint">${c.hint}</p>
            ${list.map(card).join('') || '<p class="colhint">Nothing here yet.</p>'}
          </div>`;
        }).join('')}
      </div>`;
  }
  function partyLabel(p) { return { patient: 'Patient', doctor: 'Doctor', establishment: 'Clinic', admin: 'Admin', cross: 'Platform' }[p] || p; }

  /* ---------- FEATURES LIST ---------- */
  function renderFeatures(arg) {
    const f = DATA.features || [];
    const parties = ['all', 'patient', 'doctor', 'establishment', 'admin', 'cross'];
    const active = (sessionStorage.getItem('tb-feat-filter') || 'all');
    const list = active === 'all' ? f : f.filter(x => x.party === active);
    $('#content').innerHTML = `
      <div class="page-head"><p class="eyebrow">Features</p><h1>Feature dossiers</h1>
      <p class="lede">Each existing feature has a full dossier: product view, planning, a branded UI mockup, technical design, implementation status and test cases.</p></div>
      <div class="filterbar">${parties.map(p => `<button class="chip ${p === active ? 'active' : ''}" data-p="${p}">${p === 'all' ? 'All' : partyLabel(p)} ${p === 'all' ? `(${f.length})` : `(${f.filter(x => x.party === p).length})`}</button>`).join('')}</div>
      <div class="cards">
        ${list.map(x => `<a class="card" href="#/feature/${esc(x.id)}">
          <div class="card__top"><span class="party-chip p-${esc(x.party)}">${esc(partyLabel(x.party))}</span></div>
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
          <span class="party-chip p-${esc(x.party)}">${esc(partyLabel(x.party))}</span>${statusBadge(x.status)}
          ${x.milestone ? `<span class="badge b-new">${esc(x.milestone)}</span>` : ''}${x.priority ? `<span class="badge b-low">${esc(x.priority)}</span>` : ''}
        </div>
        <h1>${esc(x.title)}</h1><p class="lede">${esc(x.summary || '')}</p>
      </div>
      <div class="subnav">
        <a href="#prod">Product</a><a href="#brd">BRD</a><a href="#prd">PRD</a>
        <a href="#ux">UX &amp; UI</a><a href="#tech">Technical</a><a href="#impl">Status</a>
        <a href="#secperf">Security &amp; perf</a><a href="#test">Tests</a>
      </div>
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
            <td><a href="#/feature/${esc(r.id)}"><b>${esc(r.title)}</b></a> <span class="party-chip p-${esc(r.party)}" style="transform:scale(.85)">${esc(partyLabel(r.party))}</span></td>
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
      <p class="footer-note">Source: <code>docs/adr/</code>. All records are currently <b>Proposed</b> pending team acceptance.</p>`;
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
      <p class="lede">Known code gaps, defects, and risks from the handover review, grouped by area and sorted by severity.</p></div>
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
      <p class="footer-note">Source: <code>docs/knowledge-base/code-gaps-register.md</code>, <code>defects.md</code>.</p>`;
    $$('.chip').forEach(c => c.addEventListener('click', () => { sessionStorage.setItem('tb-gap-filter', c.dataset.a); renderGaps(); }));
  }

  /* ---------- SECURITY ---------- */
  async function renderSecurity() {
    const s = DATA.security || [];
    const c = $('#content');
    c.innerHTML = `
      <div class="page-head"><p class="eyebrow">Security</p><h1>Security</h1>
      <p class="lede">The authentication model, PHI handling, and the security findings from the handover review.</p></div>
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
      <p class="lede">Performance findings, budgets and the observability signals that track them.</p></div>
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
      <p class="lede">The deep reference material behind this hub — ${kb.length} documents in <code>docs/knowledge-base/</code>.</p></div>
      ${Object.keys(groups).sort().map(g => `
        <h2 style="color:var(--heading);font-size:1.1rem;margin:22px 0 12px">${esc(g)}</h2>
        <div class="cards">${groups[g].map(k => `<a class="card" href="#/doc/${esc(k.path)}"><h3>${esc(k.title)}</h3><p>${esc(k.summary || '')}</p><p style="margin-top:8px"><code style="font-size:.76em">${esc(k.path)}</code></p></a>`).join('')}</div>`).join('')}`;
  }

  /* ---------- DOC VIEWER (renders any local markdown linked into the hub) ---------- */
  async function renderDoc(arg) {
    const c = $('#content');
    c.innerHTML = `<div class="breadcrumb"><a href="#/kb">Knowledge base</a> › <code style="font-size:.9em">${esc(arg)}</code></div><div class="md" id="mdmount"><div class="loading"><span class="spinner"></span> Loading…</div></div>`;
    try { renderMarkdown(await loadMD('content/kb-src/' + arg), $('#mdmount')); }
    catch (e) { $('#mdmount').innerHTML = `<div class="callout warn"><b>Could not load</b> <code>${esc(arg)}</code>. It may be a binary or non-markdown file; see it in the repo.</div>`; }
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
      <p class="lede">Everything that must be done before Project goes to production, grouped by workstream. ${done} of ${items.length} complete.</p></div>
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

  /* ---------- SEARCH ---------- */
  function initSearch() {
    const input = $('#globalSearch'), box = $('#searchResults');
    const idx = [];
    (DATA.features || []).forEach(f => idx.push({ kind: 'Feature', title: f.title, sub: f.summary, href: `#/feature/${f.id}` }));
    (DATA.adrs || []).forEach(a => idx.push({ kind: 'ADR', title: a.title, sub: a.summary, href: '#/adr' }));
    (DATA.gaps || []).forEach(g => idx.push({ kind: 'Gap', title: `${g.id} ${g.title}`, sub: g.summary, href: '#/gaps' }));
    (DATA.kb || []).forEach(k => idx.push({ kind: 'Doc', title: k.title, sub: k.summary, href: '#/kb' }));
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
