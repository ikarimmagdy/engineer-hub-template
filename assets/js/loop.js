/* ============================================================
   Engineering Hub, loop pages (template v4).
   The agentic engineering loop as the hub's front door:
     #/loop                  the loop, how work enters it, every spec by phase
     #/spec/<dir>/<tab>      one piece of work, fixed tabs in loop order
     #/findings/<area>       findings across specs, by review area
   Data: content/data/loop.json (tools/sync_loop.py, from the workspace's spec.py json)
   and content/data/loop-config.json (the loop, intakes, tools; project-specific).
   Status comes only from spec.py. This file is an engine file: fix it in the template.
   ============================================================ */
(() => {
  'use strict';
  const H = () => window.Hub;
  const esc = s => H().esc(s);
  const $ = (s, r) => H().$(s, r);
  const $$ = (s, r) => H().$$(s, r);

  const DEFAULT_PHASES = ['intent', 'spec', 'design', 'build', 'test', 'deploy', 'maintain'];
  const SEV = ['critical', 'high', 'medium', 'low'];
  const SEV_LBL = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', none: 'Not set' };
  const INTAKE_LBL = { idea: 'Idea', jira: 'Jira', 'github-issue': 'GitHub issue', pr: 'Pull request' };
  const TABS = [
    ['overview', 'Overview'], ['intent', 'Intent'], ['review', 'Code review'], ['findings', 'Findings'],
    ['feedback', 'Feedback'], ['spec', 'Spec'], ['design', 'Design'], ['tasks', 'Tasks'], ['tests', 'Tests'], ['history', 'History']
  ];

  const D = () => H().DATA || {};
  const loop = () => D().loop || { specs: [] };
  const cfg = () => D().loopConfig || {};
  const specs = () => loop().specs || [];
  const phases = () => (cfg().phases && cfg().phases.length) ? cfg().phases : DEFAULT_PHASES.map(k => ({ key: k, title: k[0].toUpperCase() + k.slice(1) }));
  const areas = () => ((cfg().review || {}).areas || []);
  const areaTitle = k => (areas().find(a => a.key === k) || {}).title || k;
  const phaseTitle = k => (phases().find(p => p.key === k) || {}).title || k || 'Not set';
  const trackerUrl = key => { const b = cfg().trackerBase || ''; return b && key ? b.replace(/\/$/, '') + '/' + encodeURIComponent(key) : ''; };
  const cmd = (c, key) => String(c || '').replace(/<KEY>/g, key || '<KEY>');
  const pill = (txt, cls) => `<span class="lp-pill ${cls || ''}">${esc(txt)}</span>`;
  const sevPill = s => pill(SEV_LBL[s] || s || 'n/a', 'sev-' + (s || 'none'));
  const copyBtn = text => `<button class="lp-copy" type="button" data-copy="${esc(text)}" title="Copy">${esc(text)}</button>`;

  function head(eyebrow, title, lede) {
    return `<div class="page-head"><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(title)}</h1>${lede ? `<p class="lede">${esc(lede)}</p>` : ''}</div>`;
  }
  function wireCopy(root) {
    $$('[data-copy]', root).forEach(b => b.addEventListener('click', () => {
      navigator.clipboard && navigator.clipboard.writeText(b.dataset.copy);
      b.classList.add('done'); setTimeout(() => b.classList.remove('done'), 900);
    }));
  }
  function findingsCount(s) { return (s.findings || {}); }
  function sevTiles(f) {
    const by = (f && f.bySeverity) || {};
    return SEV.filter(k => by[k]).map(k => `<span class="lp-count sev-${k}" title="${SEV_LBL[k]}">${by[k]} ${SEV_LBL[k]}</span>`).join('') || '<span class="lp-muted">No findings recorded</span>';
  }

  /* ---------- #/loop ---------- */
  function renderLoop() {
    const c = $('#content'), C = cfg(), S = specs();
    const byPhase = Object.fromEntries(phases().map(p => [p.key, S.filter(s => s.phase === p.key)]));
    const tools = C.tools || [];
    c.innerHTML = `${head('Agentic engineering', C.title || 'Agentic engineering loop', C.lede || '')}
      <section class="lp-block">
        <h2 class="lp-h2"><span class="lp-step">1</span> Work enters through an intake</h2>
        <div class="lp-intake">${(C.intake || []).map(i => `
          <div class="lp-card">
            <div class="lp-card__top"><b>${esc(i.title)}</b>${pill(INTAKE_LBL[i.key] || i.key, 'k-' + i.key)}</div>
            <p>${esc(i.what || '')}</p>
            ${copyBtn(i.command || '')}
            <p class="lp-via">via ${esc(i.via || '')}</p>
          </div>`).join('')}</div>
      </section>
      <section class="lp-block">
        <h2 class="lp-h2"><span class="lp-step">2</span> It moves through the loop, one gate per step</h2>
        <div class="lp-loop">${phases().map((p, i) => `
          <div class="lp-phase">
            <div class="lp-phase__n">${i + 1}</div>
            <div class="lp-phase__title">${esc(p.title)} <span class="lp-phase__count" title="Specs in this phase">${(byPhase[p.key] || []).length}</span></div>
            <code class="lp-phase__cmd">${esc(p.command || '')}</code>
            <p>${esc(p.does || '')}</p>
            ${(p.tools || []).length ? `<div class="lp-tools">${p.tools.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
            <p class="lp-gate"><b>Gate</b> ${esc(p.gate || '')}</p>
          </div>`).join('')}
          <div class="lp-loop__back">Maintain feeds new intents: incidents, feedback and review findings start the loop again.</div>
        </div>
        ${C.review ? `<p class="lp-note"><b>Code review of existing code</b> runs inside Intent, one area at a time: ${copyBtn(C.review.command || '/gap <KEY> <area>')} areas: ${areas().map(a => esc(a.title)).join(', ')}.</p>` : ''}
      </section>
      ${tools.length ? `<section class="lp-block">
        <h2 class="lp-h2"><span class="lp-step">3</span> What Claude uses at each step</h2>
        <div class="lp-tooltable"><table><thead><tr><th>Tool</th><th>Kind</th><th>Used for</th><th>Example</th></tr></thead><tbody>
          ${tools.map(t => `<tr><td><b>${esc(t.name)}</b></td><td>${esc(t.kind || '')}</td><td>${esc(t.use || '')}</td><td>${t.example ? `<code>${esc(t.example)}</code>` : ''}</td></tr>`).join('')}
        </tbody></table></div>
      </section>` : ''}
      <section class="lp-block">
        <h2 class="lp-h2"><span class="lp-step">${tools.length ? 4 : 3}</span> Where every piece of work is now</h2>
        <p class="lp-muted">From <code>spec.py</code> in ${esc(loop().workspace || 'the workspace')}, synced ${esc(loop().generated || 'never')}. ${S.length} spec${S.length === 1 ? '' : 's'}.</p>
        ${S.length ? `<div class="lp-board">${phases().map(p => `
          <div class="lp-col"><div class="lp-col__head">${esc(p.title)} <span>${(byPhase[p.key] || []).length}</span></div>
            ${(byPhase[p.key] || []).map(specCard).join('') || '<div class="lp-empty">None</div>'}</div>`).join('')}</div>`
          : `<div class="callout"><b>No specs yet.</b> Start one with an intake above, then run the hub sync.</div>`}
      </section>`;
    wireCopy(c);
  }
  function specCard(s) {
    const f = findingsCount(s);
    const it = s.intake || {};
    return `<a class="lp-spec" href="#/spec/${esc(s.dir)}/overview">
      <div class="lp-spec__key">${esc(s.key)} ${it.kind ? pill(INTAKE_LBL[it.kind] || it.kind, 'k-' + it.kind) : ''}</div>
      <div class="lp-spec__title">${esc(s.title || s.dir)}</div>
      <div class="lp-spec__meta">${sevTiles(f)}</div>
      ${s.next ? `<div class="lp-spec__next">Next: ${esc(s.next)}</div>` : ''}
    </a>`;
  }

  /* ---------- #/spec/<dir>/<tab> ---------- */
  async function renderSpec(arg) {
    const [dir, tab = 'overview', sub = ''] = String(arg || '').split('/');
    const s = specs().find(x => x.dir === dir || x.key === dir);
    const c = $('#content');
    if (!s) { c.innerHTML = head('Spec', 'Not found', '') + `<div class="callout warn">No spec <code>${esc(dir)}</code> in loop.json. Run the hub sync.</div>`; return; }
    const base = `content/specs/${s.dir}/`;
    const at = phases().findIndex(p => p.key === s.phase);
    const appr = s.approved || {};
    const tabs = TABS.map(([k, t]) => `<a href="#/spec/${esc(s.dir)}/${k}" class="${k === tab ? 'on' : ''}">${t}${tabBadge(s, k)}</a>`).join('');
    c.innerHTML = `<div class="page-head"><p class="eyebrow">${esc(s.key)} · ${esc(phaseTitle(s.phase))}</p><h1>${esc(s.title || s.dir)}</h1></div>
      <div class="lp-stepper">${phases().map((p, i) => `<div class="lp-stepper__s ${i < at ? 'past' : i === at ? 'now' : ''}"><span>${i + 1}</span>${esc(p.title)}${appr[p.key] ? ' ✓' : ''}</div>`).join('')}</div>
      <nav class="lp-tabs">${tabs}</nav><div id="lpTab"></div>`;
    const m = $('#lpTab');
    const doc = async (file, empty) => {
      if (!file) { m.innerHTML = empty; return; }
      try { m.innerHTML = '<div class="md" id="lpmd"></div>'; H().renderMarkdown(await H().loadMD(base + file), $('#lpmd'), base + file); }
      catch (_) { m.innerHTML = empty; }
    };
    const notYet = (what, command) => `<div class="callout"><b>${esc(what)} not written yet.</b> ${command ? 'Next: ' + copyBtn(cmd(command, s.key)) : ''}</div>`;
    const F = s.files || {};
    if (tab === 'overview') m.innerHTML = overviewTab(s);
    else if (tab === 'intent') await doc(F.intent ? 'intent.md' : '', notYet('Intent', '/intent <KEY>'));
    else if (tab === 'spec') await doc(F.spec ? 'spec.md' : '', notYet('Spec', '/spec <KEY>'));
    else if (tab === 'tasks') await doc(F.tasks ? 'tasks.md' : '', notYet('Tasks', '/tasks <KEY>'));
    else if (tab === 'tests') await doc(F['test-plan'] ? 'test-plan.md' : '', notYet('Test plan', '/test <KEY>'));
    else if (tab === 'design') {
      if (!F.plan && !F['data-model']) { m.innerHTML = notYet('Design', '/design <KEY>'); }
      else {
        m.innerHTML = '<div class="md" id="lpmd"></div><div class="md" id="lpmd2"></div>';
        if (F.plan) H().renderMarkdown(await H().loadMD(base + 'plan.md'), $('#lpmd'), base + 'plan.md');
        if (F['data-model']) H().renderMarkdown(await H().loadMD(base + 'data-model.md'), $('#lpmd2'), base + 'data-model.md');
      }
    }
    else if (tab === 'review') await reviewTab(s, sub, m, base);
    else if (tab === 'feedback') {
      const fb = s.feedback || [];
      if (!fb.length) { m.innerHTML = `<div class="callout"><b>No feedback batches.</b> Customer or QA feedback goes in <code>outputs/feedback/</code>: ${copyBtn(cmd('/feedback <KEY>', s.key))}</div>`; }
      else {
        const pick = fb.includes(sub) ? sub : fb[0];
        m.innerHTML = `<div class="lp-subtabs">${fb.map(f => `<a href="#/spec/${esc(s.dir)}/feedback/${esc(f)}" class="${f === pick ? 'on' : ''}">${esc(f.replace(/\.md$/, ''))}</a>`).join('')}</div><div class="md" id="lpmd"></div>`;
        H().renderMarkdown(await H().loadMD(base + 'feedback/' + pick), $('#lpmd'), base + 'feedback/' + pick);
      }
    }
    else if (tab === 'findings') await findingsView(m, [s], { fixedSpec: true });
    else if (tab === 'history') {
      const h = (s.history || []).slice().reverse();
      m.innerHTML = h.length ? `<table class="lp-table"><thead><tr><th>Date</th><th>Event</th><th>Detail</th></tr></thead><tbody>${h.map(e => `<tr><td>${esc(e.date || '')}</td><td>${esc(e.event || '')}</td><td>${esc(Object.entries(e).filter(([k]) => !['date', 'event'].includes(k)).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · '))}</td></tr>`).join('')}</tbody></table>` : '<div class="callout">No history recorded.</div>';
    }
    wireCopy(c);
  }
  function tabBadge(s, k) {
    const f = s.findings || {};
    if (k === 'findings' && f.total) return ` <span class="lp-tabn">${f.total}</span>`;
    if (k === 'review' && (s.review || []).length) return ` <span class="lp-tabn">${s.review.length}</span>`;
    if (k === 'feedback' && (s.feedback || []).length) return ` <span class="lp-tabn">${s.feedback.length}</span>`;
    return '';
  }
  function overviewTab(s) {
    const it = s.intake || {}, tr = s.tracker || {}, f = s.findings || {}, F = s.files || {};
    const link = k => { const u = trackerUrl(k); return u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(k)}</a>` : esc(k); };
    const steps = [['intent', 'Intent', F.intent], ['review', 'Code review', (s.review || []).length], ['spec', 'Spec', F.spec],
      ['design', 'Design', F.plan], ['tasks', 'Tasks', F.tasks], ['tests', 'Test plan', F['test-plan']]];
    const appr = s.approved || {};
    return `<div class="lp-ov">
      <div class="lp-panel"><h3>Intake</h3>
        <p>${it.kind ? pill(INTAKE_LBL[it.kind] || it.kind, 'k-' + it.kind) : '<span class="lp-muted">Not recorded</span>'} ${it.ref ? link(it.ref) : ''}</p>
        ${it.summary ? `<p>${esc(it.summary)}</p>` : ''}
        ${tr.initiative || (tr.epics || []).length ? `<p><b>Tracker</b> ${[tr.initiative, ...(tr.epics || [])].filter(Boolean).map(link).join(', ')}${(tr.stories || []).length ? ` · ${tr.stories.length} stories` : ''}</p>` : ''}
        ${(s.repos || []).length ? `<p><b>Repos</b> ${s.repos.map(r => `<code>${esc(r)}</code>`).join(' ')}</p>` : ''}
        ${(s.inputs || []).length ? `<p><b>Inputs</b> ${s.inputs.map(esc).join(', ')}</p>` : ''}
      </div>
      <div class="lp-panel"><h3>Where it is</h3>
        <p>Phase <b>${esc(phaseTitle(s.phase))}</b>${s.next ? ` · next: ${esc(s.next)}` : ''}</p>
        <ul class="lp-check">${steps.map(([k, t, ok]) => `<li class="${ok ? 'ok' : ''}"><a href="#/spec/${esc(s.dir)}/${k}">${t}</a>${['intent', 'spec'].includes(k) ? (appr[k] ? ` <span class="lp-ok">approved${appr[k].by ? ' by ' + esc(appr[k].by) : ''}</span>` : ok ? ' <span class="lp-muted">awaiting approval</span>' : '') : ''}${k === 'design' && appr.design ? ' <span class="lp-ok">approved</span>' : ''}</li>`).join('')}</ul>
        ${s.tasks && F.tasks ? `<p><b>Tasks</b> ${Object.entries(s.tasks).filter(([, n]) => n).map(([k, n]) => `${n} ${esc(k)}`).join(' · ') || 'none'}</p>` : ''}
      </div>
      <div class="lp-panel"><h3>Findings</h3>
        <div class="lp-tiles">${SEV.map(k => `<a class="lp-tile sev-${k}" href="#/spec/${esc(s.dir)}/findings"><b>${(f.bySeverity || {})[k] || 0}</b>${SEV_LBL[k]}</a>`).join('')}</div>
        ${(f.bySeverity || {}).none ? `<p class="lp-muted">${f.bySeverity.none} without a severity (coverage gaps).</p>` : ''}
        <p class="lp-muted">${f.total ? `${f.total} total, ${f.open ?? f.total} open` : 'None recorded'}. Areas reviewed: ${(s.review || []).filter(a => a !== 'scope').map(areaTitle).join(', ') || 'none yet'}.</p>
      </div>
    </div>`;
  }
  async function reviewTab(s, sub, m, base) {
    const have = s.review || [];
    const all = ['scope', ...areas().map(a => a.key)];
    const pick = sub && all.includes(sub) ? sub : (have[0] || 'scope');
    m.innerHTML = `<div class="lp-subtabs">${all.map(a => `<a href="#/spec/${esc(s.dir)}/review/${a}" class="${a === pick ? 'on' : ''} ${have.includes(a) ? '' : 'missing'}">${esc(a === 'scope' ? 'Scope' : areaTitle(a))}</a>`).join('')}</div><div id="lprv"></div>`;
    const r = $('#lprv');
    if (!have.includes(pick)) { r.innerHTML = `<div class="callout"><b>${esc(pick === 'scope' ? 'Scope' : areaTitle(pick))} not reviewed yet.</b> Run ${copyBtn(cmd(pick === 'scope' ? '/gap <KEY>' : `/gap <KEY> ${pick}`, s.key))}</div>`; wireCopy(r); return; }
    r.innerHTML = '<div class="md" id="lpmd"></div>';
    H().renderMarkdown(await H().loadMD(base + 'review/' + pick + '.md'), $('#lpmd'), base + 'review/' + pick + '.md');
  }

  /* ---------- findings (one spec or all) ---------- */
  const FCACHE = {};
  async function loadFindings(s) {
    if (!s.findingsFile) return [];
    if (!FCACHE[s.dir]) FCACHE[s.dir] = fetch(s.findingsFile, { cache: 'no-cache' }).then(r => r.ok ? r.json() : { findings: [] }).catch(() => ({ findings: [] }));
    const j = await FCACHE[s.dir];
    // severity and dimension may be absent (e.g. coverage gaps); they group as 'none' / 'not set'
    return (j.findings || []).map(f => ({ ...f, severity: f.severity || 'none', dimension: f.dimension || 'not set', _spec: s }));
  }
  const FV = { sev: 'all', dim: 'all', area: 'all', layer: 'all', scope: 'all', status: 'all', q: '', open: new Set() };
  async function findingsView(m, specList, opt = {}) {
    const rows = (await Promise.all(specList.map(loadFindings))).flat();
    if (!rows.length) { m.innerHTML = `<div class="callout"><b>No findings recorded.</b> Findings come from <code>/gap</code>, <code>/pr-review</code> and <code>/feedback</code> into <code>outputs/findings.json</code>.</div>`; return; }
    const uniq = k => [...new Set(rows.map(r => r[k]).filter(Boolean))].sort();
    const dims = uniq('dimension'), layers = uniq('layer');
    const SEVS = rows.some(r => r.severity === 'none') ? [...SEV, 'none'] : SEV;
    const sel = (key, label, opts, fmt = x => x) => `<label>${label} <select data-f="${key}"><option value="all">All</option>${opts.map(o => `<option value="${esc(o)}" ${FV[key] === o ? 'selected' : ''}>${esc(fmt(o))}</option>`).join('')}</select></label>`;
    const draw = () => {
      const q = FV.q.toLowerCase();
      const list = rows.filter(r => (FV.sev === 'all' || r.severity === FV.sev) && (FV.dim === 'all' || r.dimension === FV.dim)
        && (FV.area === 'all' || (r.area || 'none') === FV.area) && (FV.layer === 'all' || r.layer === FV.layer)
        && (FV.scope === 'all' || (r.scope || 'none') === FV.scope) && (FV.status === 'all' || (r.status || 'open') === FV.status)
        && (!q || [r.id, r.title, r.location, r.detail, r.category].join(' ').toLowerCase().includes(q)))
        .sort((a, b) => SEVS.indexOf(a.severity) - SEVS.indexOf(b.severity));
      $('#lpGrid').innerHTML = `<table class="lp-grid"><thead><tr><th></th>${SEVS.map(k => `<th>${SEV_LBL[k]}</th>`).join('')}<th>Total</th></tr></thead><tbody>
        ${dims.map(d => { const r = rows.filter(x => x.dimension === d); return `<tr><th>${esc(d)}</th>${SEVS.map(k => { const n = r.filter(x => x.severity === k).length; return `<td><button class="lp-cell sev-${k} ${n ? '' : 'zero'}" data-dim="${esc(d)}" data-sev="${k}">${n || '·'}</button></td>`; }).join('')}<td>${r.length}</td></tr>`; }).join('')}
      </tbody></table>`;
      $('#lpList').innerHTML = `<p class="lp-muted">${list.length} of ${rows.length} shown</p>
        <table class="lp-table lp-findings"><thead><tr><th>ID</th><th>Severity</th><th>Finding</th><th>Layer</th><th>Dimension</th><th>Area</th><th>Scope</th>${opt.fixedSpec ? '' : '<th>Spec</th>'}<th>Status</th></tr></thead><tbody>
        ${list.map(r => { const k = r._spec.dir + ':' + r.id; const open = FV.open.has(k); return `<tr class="lp-frow" data-k="${esc(k)}"><td><b>${esc(r.id)}</b></td><td>${sevPill(r.severity)}</td><td>${esc(r.title || '')}</td><td>${esc(r.layer || '')}</td><td>${esc(r.dimension || '')}</td><td>${esc(r.area ? areaTitle(r.area) : '')}</td><td>${esc(r.scope || '')}</td>${opt.fixedSpec ? '' : `<td><a href="#/spec/${esc(r._spec.dir)}/findings">${esc(r._spec.key)}</a></td>`}<td>${esc(r.status || 'open')}</td></tr>
          ${open ? `<tr class="lp-fdetail"><td colspan="9"><dl>${[['Location', r.location], ['Finding', r.detail], ['Impact', r.impact], ['Fix', r.fix], ['Category', r.category], ['Source', r.source]].filter(([, v]) => v).map(([t, v]) => `<dt>${t}</dt><dd>${esc(v)}</dd>`).join('')}</dl></td></tr>` : ''}`; }).join('')}
        </tbody></table>`;
      $$('.lp-cell', m).forEach(b => b.onclick = () => { FV.dim = b.dataset.dim; FV.sev = b.dataset.sev; sync(); draw(); });
      $$('.lp-frow', m).forEach(tr => tr.onclick = e => { if (e.target.closest('a')) return; const k = tr.dataset.k; FV.open.has(k) ? FV.open.delete(k) : FV.open.add(k); draw(); });
    };
    const sync = () => $$('[data-f]', m).forEach(s => { s.value = FV[s.dataset.f]; });
    m.innerHTML = `<div id="lpGrid"></div>
      <div class="lp-filters">
        ${sel('sev', 'Severity', SEVS, x => SEV_LBL[x])}
        ${sel('dim', 'Dimension', dims)}
        ${sel('area', 'Area', ['none', ...areas().map(a => a.key)], x => x === 'none' ? 'Not set' : areaTitle(x))}
        ${sel('layer', 'Layer', layers)}
        ${sel('scope', 'Scope', ['vnet', 'legacy', 'mixed', 'none'].filter(x => x === 'none' || rows.some(r => r.scope === x)), x => x === 'none' ? 'Not set' : x)}
        ${sel('status', 'Status', uniq('status').length ? uniq('status') : ['open'])}
        <label>Search <input type="search" data-q value="${esc(FV.q)}" placeholder="ID, file, text"></label>
        <button type="button" class="lp-reset">Reset</button>
      </div><div id="lpList"></div>`;
    $$('[data-f]', m).forEach(s => s.onchange = () => { FV[s.dataset.f] = s.value; draw(); });
    $('[data-q]', m).oninput = e => { FV.q = e.target.value; draw(); };
    $('.lp-reset', m).onclick = () => { Object.assign(FV, { sev: 'all', dim: 'all', area: 'all', layer: 'all', scope: 'all', status: 'all', q: '' }); FV.open.clear(); sync(); $('[data-q]', m).value = ''; draw(); };
    draw();
  }

  /* ---------- #/findings/<area> ---------- */
  async function renderFindings(arg) {
    const area = arg || 'all';
    const S = specs(), c = $('#content');
    const tabs = [['all', 'All findings'], ...areas().map(a => [a.key, a.title])];
    c.innerHTML = `${head('Findings', area === 'all' ? 'Findings across all work' : areaTitle(area), 'Every finding from code review, PR review and feedback, from each spec\'s outputs/findings.json. Pick an area to see which work has been reviewed for it.')}
      <nav class="lp-tabs">${tabs.map(([k, t]) => `<a href="#/findings/${k}" class="${k === area ? 'on' : ''}">${esc(t)}</a>`).join('')}</nav><div id="lpF"></div>`;
    const m = $('#lpF');
    if (area === 'all') { FV.area = 'all'; await findingsView(m, S); return; }
    const reviewed = S.filter(s => (s.review || []).includes(area));
    const notYet = S.filter(s => !(s.review || []).includes(area));
    m.innerHTML = `<div class="lp-coverage"><table class="lp-table"><thead><tr><th>Spec</th><th>${esc(areaTitle(area))} review</th><th>Findings in this area</th></tr></thead><tbody>
      ${S.map(s => `<tr><td><a href="#/spec/${esc(s.dir)}/review/${area}">${esc(s.key)}</a> ${esc(s.title || '')}</td><td>${(s.review || []).includes(area) ? '<span class="lp-ok">done</span>' : `not yet · ${copyBtn(`/gap ${s.key} ${area}`)}`}</td><td>${((s.findings || {}).byArea || {})[area] || 0}</td></tr>`).join('')}
    </tbody></table></div><div id="lpF2"></div>`;
    wireCopy(m);
    FV.area = area;
    if (reviewed.length) await findingsView($('#lpF2'), reviewed);
    else $('#lpF2').innerHTML = `<div class="callout"><b>No ${esc(areaTitle(area))} review yet</b> on ${notYet.length} spec${notYet.length === 1 ? '' : 's'}.</div>`;
  }

  window.HUB_ROUTES = Object.assign(window.HUB_ROUTES || {}, { loop: renderLoop, spec: renderSpec, findings: renderFindings });
  window.HUB_WIDE = (window.HUB_WIDE || []).concat(['loop', 'spec', 'findings']);
  window.HUB_SEARCH = (window.HUB_SEARCH || []).concat([data => ((data.loop || {}).specs || []).map(s => ({ kind: 'Spec', title: `${s.key} ${s.title || ''}`, sub: `${s.phase || ''} ${(s.intake || {}).ref || ''}`, href: `#/spec/${s.dir}/overview` }))]);
})();
