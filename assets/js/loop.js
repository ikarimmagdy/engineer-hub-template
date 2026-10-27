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
  const AX = { sel: null, flow: null, step: 0 };
  const A = () => D().agentic || null;
  // phase tools and agents come from the command files (agentic.json), never from hand-written lists
  function phaseWiring(p, i) {
    const ag = A(); if (!ag) return { agents: [], tools: [] };
    const cmds = ag.commands.filter(c => c.phase === i + 1 || String(p.command || '').split(/[,\s]+/).includes(c.name));
    const uniqTools = [...new Set(cmds.flatMap(c => c.tools))].filter(t => t !== 'spec-py');
    return { agents: [...new Set(cmds.flatMap(c => c.agents))], tools: uniqTools.map(t => (ag.tools.find(x => x.id === 'tool:' + t) || {}).name || t) };
  }
  function renderLoop(arg) {
    // #/loop/flow/<key> opens a walkthrough, #/loop/node/<id> selects a box (shareable links)
    const [mode, ...rest] = String(arg || '').split('/');
    if (mode === 'flow') { AX.flow = rest[0]; AX.sel = null; AX.step = 0; } else if (mode === 'node') { AX.sel = rest.join('/'); AX.flow = null; }
    const c = $('#content'), C = cfg(), S = specs(), ag = A();
    const byPhase = Object.fromEntries(phases().map(p => [p.key, S.filter(s => s.phase === p.key)]));
    const unused = ag ? ag.tools.filter(t => t.configured && !t.used) : [];
    let n = 0; const step = () => ++n;
    c.innerHTML = `${head('Beyond One agentic engineering', C.title || 'Agentic engineering loop', C.lede || '')}
      ${ag ? `<section class="lp-block">
        <h2 class="lp-h2"><span class="lp-step">${step()}</span> ${esc((C.sdlc || {}).title || 'The SDLC at a glance')}</h2>
        ${sdlcOverview()}
      </section>` : ''}
      ${ag ? `<section class="lp-block">
        <h2 class="lp-h2"><span class="lp-step">${step()}</span> How it works, in detail</h2>
        <p class="lp-muted">Read from <code>${esc(ag.workspace)}/.claude</code> and <code>.mcp.json</code> on ${esc(ag.generated)}. A line means the command file names that agent, tool or file. Click any box, or pick an entry point to walk through its flow.</p>
        <div class="ax-flows"><span class="ax-flows__label">Walk through</span>${(C.flows || []).map(f => `<button type="button" class="ax-flowbtn" data-flow="${esc(f.key)}">${esc(f.title)}</button>`).join('')}</div>
        <div class="ax-wrap"><div class="ax" id="ax"></div><aside class="ax-panel" id="axPanel"></aside></div>
      </section>` : ''}
      <section class="lp-block">
        <h2 class="lp-h2"><span class="lp-step">${step()}</span> The loop, one gate per step</h2>
        <div class="lp-loop">${phases().map((p, i) => { const w = phaseWiring(p, i); return `
          <div class="lp-phase">
            <div class="lp-phase__n">${i + 1}</div>
            <div class="lp-phase__title">${esc(p.title)} <span class="lp-phase__count" title="Specs in this phase">${(byPhase[p.key] || []).length}</span></div>
            <code class="lp-phase__cmd">${esc(p.command || '')}</code>
            <p>${esc(p.does || '')}</p>
            ${w.agents.length ? `<div class="lp-tools">${w.agents.map(t => `<span class="ag">${esc(t)}</span>`).join('')}</div>` : ''}
            ${w.tools.length ? `<div class="lp-tools">${w.tools.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
            <p class="lp-gate"><b>Gate</b> ${esc(p.gate || '')}</p>
          </div>`; }).join('')}
          <div class="lp-loop__back">Maintain feeds new intents: incidents, feedback and review findings start the loop again.</div>
        </div>
      </section>
      ${unused.length ? `<section class="lp-block">
        <h2 class="lp-h2"><span class="lp-step">${step()}</span> Wiring gaps</h2>
        <div class="callout warn"><b>Installed, but no command uses them yet:</b> ${unused.map(t => `${esc(t.name)} <span class="lp-muted">(${esc(t.source || t.kind)})</span>`).join(', ')}. Until a command names them, Claude only uses them when someone asks in the session.</div>
        ${ag.commands.filter(x => !x.agents.length && !x.tools.length).length ? `<p class="lp-muted">Commands that call no agent or tool: ${ag.commands.filter(x => !x.agents.length && !x.tools.length).map(x => `<code>${esc(x.name)}</code>`).join(' ')}.</p>` : ''}
      </section>` : ''}
      <section class="lp-block">
        <h2 class="lp-h2"><span class="lp-step">${step()}</span> Where every piece of work is now</h2>
        <p class="lp-muted">From <code>spec.py</code> in ${esc(loop().workspace || 'the workspace')}, synced ${esc(loop().generated || 'never')}. ${S.length} spec${S.length === 1 ? '' : 's'}.</p>
        ${S.length ? `<div class="lp-board">${phases().map(p => `
          <div class="lp-col"><div class="lp-col__head">${esc(p.title)} <span>${(byPhase[p.key] || []).length}</span></div>
            ${(byPhase[p.key] || []).map(specCard).join('') || '<div class="lp-empty">None</div>'}</div>`).join('')}</div>`
          : `<div class="callout"><b>No specs yet.</b> Start one from an entry point above, then run the hub sync.</div>`}
      </section>`;
    wireCopy(c);
    if (ag) drawArch();
    $$('[data-axgo]', c).forEach(b => b.onclick = () => { AX.flow = null; AX.sel = b.dataset.axgo; const x = $('#ax'); if (x) { x.scrollIntoView({ behavior: 'smooth', block: 'start' }); paint(archModel()); } });
  }

  /* ---------- high-level SDLC picture (top of #/loop) ---------- */
  function sdlcOverview() {
    const C = cfg(), ag = A(), S = C.sdlc || {};
    if (!ag) return '';
    const go = (id, inner, cls = '') => id ? `<button type="button" class="sd-b ${cls}" data-axgo="${esc(id)}">${inner}</button>` : `<div class="sd-b ${cls}">${inner}</div>`;
    const usedBy = t => ag.commands.filter(c => c.tools.includes(t.id.slice(5))).map(c => c.name);
    const ph = phases();
    return `<div class="sd">
      <div class="sd-col"><div class="sd-h">Work comes from</div>${(S.sources || (C.entries || []).map(e => ({ t: e.title, d: e.via, go: 'entry:' + e.key }))).map(x => go(x.go, `<b>${esc(x.t)}</b><span>${esc(x.d || '')}</span>`)).join('')}</div>
      <div class="sd-arrow" aria-hidden="true">→</div>
      <div class="sd-ws"><div class="sd-h">Claude Code in ${esc(S.workspace || ag.workspace)}</div>
        <div class="sd-guard"><span class="sd-lbl">Guardrails, every session</span>
          ${(ag.constitution || []).length ? go('', `constitution <small>${ag.constitution.length} files</small>`, 'g') : ''}
          ${go(ag.rules[0] ? ag.rules[0].id : '', `path rules <small>${ag.rules.length}</small>`, 'g')}
          ${ag.hooks.map(h => go(h.id, `${esc(h.name.replace(/\.py$/, ''))} <small>${esc(h.event)}</small>`, 'g')).join('')}
          ${ag.skills.map(k => go(k.id, `${esc(k.name)} <small>skill</small>`, 'g')).join('')}
        </div>
        <div class="sd-loop">${ph.map((p, i) => `${i ? '<i>→</i>' : ''}${go('cmd:' + String(p.command || '').split(/[,\s]+/)[0].replace('/', ''), `<b>${i + 1}. ${esc(p.title)}</b><code>${esc(String(p.command || '').split(',')[0])}</code>`, 'p')}`).join('')}</div><div class="sd-back">↺ Maintain loops back: findings and feedback start a new intent</div>
        <div class="sd-agents"><span class="sd-lbl">Subagents</span>${ag.agents.map(a => go(a.id, esc(a.name), 'a')).join('')}</div>
      </div>
      <div class="sd-arrow" aria-hidden="true">→</div>
      <div class="sd-col"><div class="sd-h">It delivers</div>${(S.delivers || []).map(x => go(x.go, `<b>${esc(x.t)}</b><span>${esc(x.d || '')}</span>`)).join('')}</div>
      <div class="sd-mcp"><span class="sd-lbl">MCP servers and tools Claude calls</span>${ag.tools.filter(t => t.id !== 'tool:spec-py').map(t => { const u = usedBy(t);
        return go(t.id, `<b>${esc(t.name)}</b><span>${u.length ? 'used by ' + esc(u.join(', ')) : 'installed, no command uses it yet'}</span>`, 't' + (u.length ? '' : ' unused')); }).join('')}</div>
    </div>`;
  }

  /* ---------- architecture view ---------- */
  function archModel() {
    const ag = A(), C = cfg();
    const entries = (C.entries || C.intake || []).map(e => ({ id: 'entry:' + e.key, name: e.title, kind: 'entry', e }));
    // commands in loop order: the order the phases list them (loop-config "command"), then the rest
    const seq = phases().flatMap(p => String(p.command || '').split(/[,\s]+/).filter(x => x.startsWith('/')));
    const order = c => { const i = seq.indexOf(c.name); return i >= 0 ? i : (c.phase || 50) * 100 + ag.commands.indexOf(c); };
    const cols = [
      ['Entry points', entries],
      ['Commands', ag.commands.slice().sort((a, b) => order(a) - order(b)).map(x => ({ ...x, kind: 'command', label: x.name }))],
      ['Agents', ag.agents.map(x => ({ ...x, kind: 'agent' }))],
      ['MCP and tools', ag.tools.map(x => ({ ...x, kind: 'tool' }))],
      ['Spec files', ag.files.map(x => ({ ...x, kind: 'file' }))]
    ];
    const guard = [...ag.hooks.map(x => ({ ...x, kind: 'hook' })), ...ag.skills.map(x => ({ ...x, kind: 'skill' })), ...ag.rules.map(x => ({ ...x, kind: 'rule' }))];
    const edges = [...ag.edges, ...entries.filter(e => e.e.command).map(e => [e.id, e.e.command])];
    if (ag.hooks.some(h => h.id === 'hook:spec-gate')) edges.push(['cmd:build', 'hook:spec-gate']);
    const all = Object.fromEntries([...cols.flatMap(([, l]) => l), ...guard].map(x => [x.id, x]));
    return { cols, guard, edges, all };
  }
  function drawArch() {
    const m = archModel(), box = $('#ax');
    const nodeHtml = x => `<button type="button" class="ax-n ax-${x.kind}${x.kind === 'tool' && !x.used ? ' ax-unused' : ''}" data-id="${esc(x.id)}" title="${esc(x.description || x.name)}">${esc(x.label || x.name)}</button>`;
    box.innerHTML = `<svg class="ax-svg" aria-hidden="true"></svg>
      <div class="ax-cols">${m.cols.map(([t, l]) => `<div class="ax-col"><div class="ax-col__h">${esc(t)} <span>${l.length}</span></div>${l.map(nodeHtml).join('')}</div>`).join('')}</div>
      <div class="ax-guard"><div class="ax-col__h">Guardrails on every session: hooks, skills, path rules${(A().constitution || []).length ? ', constitution' : ''}</div><div class="ax-guard__row">${m.guard.map(nodeHtml).join('')}${(A().constitution || []).length ? `<span class="ax-n ax-const">constitution/ (${A().constitution.length} files)</span>` : ''}</div></div>`;
    $$('.ax-n[data-id]', box).forEach(b => b.onclick = () => { AX.flow = null; AX.sel = AX.sel === b.dataset.id ? null : b.dataset.id; paint(m); });
    $$('.ax-flowbtn').forEach(b => b.onclick = () => { AX.sel = null; AX.flow = AX.flow === b.dataset.flow ? null : b.dataset.flow; AX.step = 0; paint(m); });
    paint(m);
    if (!window.__axResize) { window.__axResize = true; window.addEventListener('resize', () => { if ($('#ax')) paint(archModel()); }); }
  }
  function lines(m, hot) {
    const box = $('#ax'), svg = $('.ax-svg', box); if (!svg) return;
    const r0 = box.getBoundingClientRect();
    svg.setAttribute('width', r0.width); svg.setAttribute('height', r0.height);
    const pos = id => { const el = box.querySelector(`[data-id="${CSS.escape(id)}"]`); if (!el) return null; const r = el.getBoundingClientRect(); return { l: r.left - r0.left, r: r.right - r0.left, y: r.top - r0.top + r.height / 2, t: r.top - r0.top, b: r.bottom - r0.top, cx: r.left - r0.left + r.width / 2 }; };
    // a walkthrough step may pair boxes that no command file links directly; draw those dashed
    const known = new Set(m.edges.map(([a, b]) => a + '>' + b));
    const extra = [...hot].filter(k => !known.has(k) && !known.has(k.split('>').reverse().join('>'))).filter((k, i, l) => !l.includes(k.split('>').reverse().join('>')) || l.indexOf(k) < l.indexOf(k.split('>').reverse().join('>'))).map(k => [...k.split('>'), 'x']);
    svg.innerHTML = [...m.edges, ...extra].map(([a, b, x]) => {
      const p = pos(a), q = pos(b); if (!p || !q) return '';
      const on = hot.has(a + '>' + b) || hot.has(b + '>' + a);
      const sameCol = Math.abs(p.cx - q.cx) < 40;
      const below = q.t > p.b + 40 && !sameCol && Math.abs(p.cx - q.cx) < 260;
      const d = sameCol ? `M${p.r},${p.y} C${p.r + 70},${p.y} ${q.r + 70},${q.y} ${q.r},${q.y}`
        : below ? `M${p.cx},${p.b} C${p.cx},${p.b + 60} ${q.cx},${q.t - 60} ${q.cx},${q.t}`
        : (q.l >= p.r ? `M${p.r},${p.y} C${p.r + 50},${p.y} ${q.l - 50},${q.y} ${q.l},${q.y}` : `M${p.l},${p.y} C${p.l - 50},${p.y} ${q.r + 50},${q.y} ${q.r},${q.y}`);
      return `<path d="${d}" class="${on ? 'on' : ''}${x ? ' x' : ''}"/>`;
    }).sort((x, y) => x.includes('class="on"') - y.includes('class="on"')).join('');
  }
  function paint(m) {
    const box = $('#ax'), panel = $('#axPanel'); if (!box) return;
    const hot = new Set(), lit = new Set();
    const flow = AX.flow ? (cfg().flows || []).find(f => f.key === AX.flow) : null;
    if (flow) {
      const st = flow.steps[AX.step] || {}; (st.nodes || []).forEach(id => lit.add(id));
      const ns = st.nodes || []; for (let i = 1; i < ns.length; i++) { hot.add(ns[0] + '>' + ns[i]); hot.add(ns[i] + '>' + ns[0]); }
    } else if (AX.sel) {
      lit.add(AX.sel);
      m.edges.forEach(([a, b]) => { if (a === AX.sel || b === AX.sel) { hot.add(a + '>' + b); lit.add(a); lit.add(b); } });
    }
    box.classList.toggle('dim', lit.size > 0);
    $$('.ax-n[data-id]', box).forEach(b => b.classList.toggle('lit', lit.has(b.dataset.id)));
    $$('.ax-n[data-id]', box).forEach(b => b.classList.toggle('sel', b.dataset.id === AX.sel || (flow && (flow.steps[AX.step].nodes || [])[0] === b.dataset.id)));
    $$('.ax-flowbtn').forEach(b => b.classList.toggle('on', b.dataset.flow === AX.flow));
    requestAnimationFrame(() => lines(m, hot));
    panel.innerHTML = flow ? flowPanel(flow, m) : AX.sel ? nodePanel(m.all[AX.sel], m) : `<h3>Select something</h3><p class="lp-muted">Click a box to see what it does, which file defines it and what it connects to. Or pick a walkthrough above.</p>
      <ul class="ax-legend"><li><i class="ax-entry"></i>Entry point</li><li><i class="ax-command"></i>Slash command</li><li><i class="ax-agent"></i>Subagent</li><li><i class="ax-tool"></i>MCP server or CLI</li><li><i class="ax-file"></i>File in specs/&lt;KEY&gt;/</li><li><i class="ax-hook"></i>Hook, skill or rule</li></ul>`;
    $$('[data-go]', panel).forEach(b => b.onclick = () => { AX.flow = null; AX.sel = b.dataset.go; paint(m); });
    $$('[data-step]', panel).forEach(b => b.onclick = () => { AX.step = Math.max(0, Math.min(flow.steps.length - 1, AX.step + Number(b.dataset.step))); paint(m); });
    $$('[data-jump]', panel).forEach(b => b.onclick = () => { AX.step = Number(b.dataset.jump); paint(m); });
    wireCopy(panel);
  }
  function flowPanel(f, m) {
    return `<h3>${esc(f.title)}</h3>
      <ol class="ax-steps">${f.steps.map((s, i) => `<li class="${i === AX.step ? 'on' : i < AX.step ? 'past' : ''}" data-jump="${i}">${esc(s.text)}</li>`).join('')}</ol>
      <div class="ax-stepnav"><button type="button" data-step="-1" ${AX.step ? '' : 'disabled'}>Back</button><span>${AX.step + 1} / ${f.steps.length}</span><button type="button" data-step="1" ${AX.step < f.steps.length - 1 ? '' : 'disabled'}>Next</button></div>`;
  }
  function nodePanel(x, m) {
    if (!x) return '';
    const links = m.edges.filter(([a, b]) => a === x.id || b === x.id).map(([a, b]) => a === x.id ? b : a);
    const linkList = links.length ? `<p><b>Connected to</b></p><div class="ax-links">${links.map(id => `<button type="button" class="ax-n ax-${(m.all[id] || {}).kind || ''}" data-go="${esc(id)}">${esc((m.all[id] || {}).label || (m.all[id] || {}).name || id)}</button>`).join('')}</div>` : '<p class="lp-muted">Nothing connects to it in the command files.</p>';
    const KIND = { entry: 'Entry point', command: 'Slash command', agent: 'Subagent', tool: 'MCP server or tool', file: 'Spec file', hook: 'Hook', skill: 'Skill', rule: 'Path rule' };
    let more = '';
    if (x.kind === 'entry') more = `<p>${esc(x.e.what || '')}</p>${copyBtn(x.e.example || '')}<p class="lp-muted">via ${esc(x.e.via || '')}</p>`;
    if (x.kind === 'command') more = `<p>${esc(x.description)}</p>${x.args ? copyBtn(x.name + ' ' + x.args) : ''}`;
    if (x.kind === 'agent') more = `<p>${esc(x.description)}</p><p><b>Allowed tools</b> ${esc(x.tools || 'all')}</p>`;
    if (x.kind === 'tool') more = `<p>${esc(x.kind)}${x.source ? ' · configured in <code>' + esc(x.source) + '</code>' : ''}</p>${x.used ? '' : '<div class="callout warn">Installed, but no command file uses it yet.</div>'}`;
    if (x.kind === 'hook') more = `<p><b>${esc(x.event)}</b>${x.matcher ? ' on ' + esc(x.matcher) : ''}</p><p>${esc(x.description)}</p>`;
    if (x.kind === 'skill' || x.kind === 'rule') more = `<p>${esc(x.description)}</p>`;
    return `<p class="eyebrow">${esc(KIND[x.kind] || x.kind)}</p><h3>${esc(x.label || x.name)}</h3>${more}${x.path ? `<p class="lp-muted"><code>${esc(x.path)}</code></p>` : ''}${linkList}`;
  }

  function specCard(s) {
    const f = findingsCount(s);
    const it = s.intake || {};
    return `<a class="lp-spec" href="#/spec/${esc(s.dir)}">
      <div class="lp-spec__key">${esc(s.key)} ${it.kind ? pill(INTAKE_LBL[it.kind] || it.kind, 'k-' + it.kind) : ''}</div>
      <div class="lp-spec__title">${esc(s.title || s.dir)}</div>
      <div class="lp-spec__meta">${sevTiles(f)}</div>
      ${s.next ? `<div class="lp-spec__next">Next: ${esc(s.next)}</div>` : ''}
    </a>`;
  }

  /* ---------- #/spec/<dir>/<phase>/<section>/<item> ----------
     One tab bar in loop order. Each tab shows the phase's status from spec.py; each phase has a side menu
     for its sections (Intent: intent, code review areas, findings, feedback). The findings dashboard sits on top. */
  function phaseState(s, key) {
    const F = s.files || {}, appr = s.approved || {};
    const at = phases().findIndex(p => p.key === s.phase), i = phases().findIndex(p => p.key === key);
    const written = { intent: F.intent, spec: F.spec, design: F.plan || F['data-model'], build: F.tasks, test: F['test-plan'],
      deploy: (s.outputs || []).includes('release-notes.md'), maintain: (s.outputs || []).includes('runbook.md') }[key];
    if (appr[key]) return { cls: 'done', label: 'approved' };
    if (i < at) return { cls: 'done', label: 'done' };
    // later phases stay "not started" even when an earlier phase wrote their file (/design writes test-plan.md)
    if (i > at) return { cls: 'todo', label: 'not started' };
    if (written && ['intent', 'spec', 'design'].includes(key)) return { cls: 'review', label: 'awaiting approval' };
    const tk = s.tasks || {}, total = Object.values(tk).reduce((a, b) => a + b, 0);
    if (key === 'build' && total) return { cls: 'now', label: `current · ${tk.done || 0}/${total} tasks done` };
    if (key === 'test' && s.criteria) return { cls: 'now', label: `current · ${s.criteria_passing || 0}/${s.criteria} passing` };
    return { cls: 'now', label: 'current' };
  }
  function sections(s, phase) {
    const F = s.files || {};
    const rv = ['scope', ...areas().map(a => a.key)];
    const S = {
      intent: [['intent', 'Intent', F.intent], ['review', 'Code review', (s.review || []).length, rv], ['findings', 'Findings', (s.findings || {}).total], ['feedback', 'Feedback', (s.feedback || []).length]],
      spec: [['spec', 'Requirements and criteria', F.spec]],
      design: [['plan', 'Design', F.plan], ['data-model', 'Data model', F['data-model']], ['contracts', 'Contracts', (s.contracts || []).length]],
      build: [['tasks', 'Tasks', F.tasks]],
      test: [['test-plan', 'Test plan', F['test-plan']]],
      deploy: [['release', 'Release notes', (s.outputs || []).includes('release-notes.md')]],
      maintain: [['runbook', 'Runbook', (s.outputs || []).includes('runbook.md')], ['history', 'History', (s.history || []).length]]
    };
    return S[phase] || [];
  }
  async function renderSpec(arg) {
    const parts = String(arg || '').split('/');
    const dir = parts[0];
    const s = specs().find(x => x.dir === dir || x.key === dir);
    const c = $('#content');
    if (!s) { c.innerHTML = head('Work', 'Not found', '') + `<div class="callout warn">No spec <code>${esc(dir)}</code> in loop.json. Run the hub sync.</div>`; return; }
    const keys = phases().map(p => p.key);
    const phase = keys.includes(parts[1]) ? parts[1] : (keys.includes(s.phase) ? s.phase : 'intent');
    const secs = sections(s, phase);
    const sec = secs.some(x => x[0] === parts[2]) ? parts[2] : (secs[0] || [''])[0];
    const item = parts.slice(3).join('/');
    const it = s.intake || {}, tr = s.tracker || {}, f = s.findings || {};
    const link = k => { const u = trackerUrl(k); return u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(k)}</a>` : esc(k); };
    const by = f.bySeverity || {};
    c.innerHTML = `<div class="page-head"><p class="eyebrow">Work · ${esc(s.key)}</p><h1>${esc(s.title || s.dir)}</h1>
        <p class="ws-meta">${it.kind ? pill(INTAKE_LBL[it.kind] || it.kind, 'k-' + it.kind) : ''} ${it.ref ? link(it.ref) : ''}
        ${(tr.epics || []).length ? ' · epics ' + tr.epics.map(link).join(', ') : ''} · phase <b>${esc(phaseTitle(s.phase))}</b>${s.next ? ` · next: <code>${esc(s.next)}</code>` : ''}</p></div>
      <section class="ws-dash">
        <a class="ws-dash__total" href="#/spec/${esc(s.dir)}/intent/findings"><b>${f.total || 0}</b>findings<span>${f.open ?? f.total ?? 0} open</span></a>
        ${[...SEV, ...(by.none ? ['none'] : [])].map(k => `<a class="lp-tile sev-${k}" href="#/spec/${esc(s.dir)}/intent/findings/sev:${k}"><b>${by[k] || 0}</b>${SEV_LBL[k]}</a>`).join('')}
        <div class="ws-dash__types">${Object.entries(f.byType || {}).map(([k, n]) => `<a href="#/spec/${esc(s.dir)}/intent/findings/type:${encodeURIComponent(k)}"><span>${esc(k)}</span><b>${n}</b></a>`).join('')}</div>
        <div class="ws-dash__areas">${areas().map(a => { const n = (f.byArea || {})[a.key] || 0; const done = (s.review || []).includes(a.key);
          return `<a href="#/spec/${esc(s.dir)}/intent/review/${a.key}" class="${done ? 'done' : ''}" title="${done ? 'Reviewed' : 'Not reviewed yet'}"><span>${esc(a.title)}</span><b>${done ? n : '–'}</b></a>`; }).join('')}</div>
      </section>
      <nav class="ws-phases">${phases().map((p, i) => { const st = phaseState(s, p.key);
        return `<a href="#/spec/${esc(s.dir)}/${p.key}" class="${p.key === phase ? 'on' : ''} st-${st.cls}"><span class="n">${i + 1}</span><span class="t">${esc(p.title)}</span><span class="s">${esc(st.label)}</span></a>`; }).join('')}</nav>
      <div class="ws-body"><aside class="ws-side">${secs.map(([k, t, n, subs]) => `
          <a href="#/spec/${esc(s.dir)}/${phase}/${k}" class="${k === sec ? 'on' : ''} ${n ? '' : 'empty'}">${esc(t)}${typeof n === 'number' && n ? ` <span>${n}</span>` : ''}</a>
          ${k === sec && subs ? `<div class="ws-sub">${subs.map(a => `<a href="#/spec/${esc(s.dir)}/${phase}/${k}/${a}" class="${(item || 'scope') === a ? 'on' : ''} ${(s.review || []).includes(a) ? '' : 'empty'}">${esc(a === 'scope' ? 'Scope' : areaTitle(a))}</a>`).join('')}</div>` : ''}`).join('')}
          <p class="ws-gate"><b>Gate</b> ${esc((phases().find(p => p.key === phase) || {}).gate || '')}</p>
          ${phaseState(s, phase).cls === 'review' && ['intent', 'spec', 'design'].includes(phase) ? `<div class="ws-approve"><b>Approve ${esc(phaseTitle(phase))}</b>
            <p>Read it here, then run in the workspace terminal:</p>
            ${copyBtn(`python3 tools/spec.py approve ${s.key} ${phase} --by "<your name>"`)}
            ${(() => { const nx = phases()[phases().findIndex(p => p.key === phase) + 1]; return nx ? copyBtn(`python3 tools/spec.py phase ${s.key} ${nx.key}`) : ''; })()}
            <p class="lp-muted">Then refresh the hub (${esc((cfg().start || {}).refresh || './sync.sh')}). Approvals live in status.json, in git: who and when.</p></div>` : ''}
          <p class="ws-cmd">${copyBtn(cmd((phases().find(p => p.key === phase) || {}).command ? String(phases().find(p => p.key === phase).command).split(',')[0].trim() + ' <KEY>' : '', s.key))}</p>
        </aside><div class="ws-main" id="lpTab"></div></div>`;
    wireCopy(c);
    const m = $('#lpTab'), base = `content/specs/${s.dir}/`;
    const doc = async (file, empty) => {
      if (!file) { m.innerHTML = empty; return; }
      try { m.innerHTML = '<div class="md" id="lpmd"></div>'; H().renderMarkdown(await H().loadMD(base + file), $('#lpmd'), base + file); }
      catch (_) { m.innerHTML = empty; }
    };
    const notYet = (what, command) => `<div class="ws-empty"><b>${esc(what)}: not started.</b>${command ? `<p>Next: ${copyBtn(cmd(command, s.key))}</p>` : ''}</div>`;
    const F = s.files || {};
    if (sec === 'intent') await doc(F.intent && 'intent.md', notYet('Intent', '/intent <KEY>'));
    else if (sec === 'review') await reviewArea(s, item || 'scope', m, base);
    else if (sec === 'findings') { const [fk, fv] = item.split(':'); resetFV(); if (fk === 'sev') FV.sev = fv; else if (['type', 'component', 'team'].includes(fk)) { FV[fk] = decodeURIComponent(fv); FV.group = fk; } await findingsView(m, [s], { fixedSpec: true }); }
    else if (sec === 'feedback') {
      const fb = s.feedback || [];
      if (!fb.length) m.innerHTML = notYet('Feedback batches', '/feedback <KEY>');
      else { const pick = fb.includes(item) ? item : fb[0];
        m.innerHTML = `${fb.length > 1 ? `<p class="lp-muted">${fb.map(x => `<a href="#/spec/${esc(s.dir)}/intent/feedback/${esc(x)}">${esc(x.replace(/\.md$/, ''))}</a>`).join(' · ')}</p>` : ''}<div class="md" id="lpmd"></div>`;
        H().renderMarkdown(await H().loadMD(base + 'feedback/' + pick), $('#lpmd'), base + 'feedback/' + pick); }
    }
    else if (sec === 'spec') await doc(F.spec && 'spec.md', notYet('Spec', '/spec <KEY>'));
    else if (sec === 'plan') await doc(F.plan && 'plan.md', notYet('Design', '/design <KEY>'));
    else if (sec === 'data-model') await doc(F['data-model'] && 'data-model.md', notYet('Data model', '/design <KEY>'));
    else if (sec === 'contracts') {
      const cs = s.contracts || [];
      if (!cs.length) m.innerHTML = notYet('Contracts', '/design <KEY>');
      else { const pick = cs.includes(item) ? item : cs[0];
        m.innerHTML = `<p class="lp-muted">${cs.map(x => `<a href="#/spec/${esc(s.dir)}/design/contracts/${esc(x)}" class="${x === pick ? 'on' : ''}">${esc(x)}</a>`).join(' · ')}</p><div class="md" id="lpmd"></div>`;
        const t = await H().loadMD(base + 'contracts/' + pick);
        H().renderMarkdown(/\.md$/.test(pick) ? t : '```yaml\n' + t + '\n```', $('#lpmd'), base + 'contracts/' + pick); }
    }
    else if (sec === 'tasks') await doc(F.tasks && 'tasks.md', notYet('Tasks', '/tasks <KEY>'));
    else if (sec === 'test-plan') await doc(F['test-plan'] && 'test-plan.md', notYet('Test plan', '/test <KEY>'));
    else if (sec === 'release') await doc((s.outputs || []).includes('release-notes.md') && 'outputs/release-notes.md', notYet('Release', '/deploy <KEY> <env>'));
    else if (sec === 'runbook') await doc((s.outputs || []).includes('runbook.md') && 'outputs/runbook.md', notYet('Runbook', '/maintain <KEY>'));
    else if (sec === 'history') {
      const h = (s.history || []).slice().reverse();
      m.innerHTML = h.length ? `<table class="lp-table"><thead><tr><th>Date</th><th>Event</th><th>Detail</th></tr></thead><tbody>${h.map(e => `<tr><td>${esc(e.date || '')}</td><td>${esc(e.event || '')}</td><td>${esc(Object.entries(e).filter(([k]) => !['date', 'event'].includes(k)).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · '))}</td></tr>`).join('')}</tbody></table>` : notYet('History', '');
    }
    else m.innerHTML = notYet(phaseTitle(phase), (phases().find(p => p.key === phase) || {}).command);
    wireCopy(m);
  }
  async function reviewArea(s, area, m, base) {
    if (!(s.review || []).includes(area)) {
      m.innerHTML = `<div class="ws-empty"><b>${esc(area === 'scope' ? 'Scope' : areaTitle(area))}: not reviewed yet.</b><p>Run ${copyBtn(cmd(area === 'scope' ? '/gap <KEY>' : `/gap <KEY> ${area}`, s.key))}</p></div>`;
      return;
    }
    // sections of existing documents distributed onto this area (tools/sync_loop.py, loop-config "attachments"), shown natively
    const blocks = (((loop().figures || {})[s.dir] || {})[area] || []).concat((((loop().figures || {})['*'] || {})[area] || []));
    m.innerHTML = `${blocks.map(b => `<style>${b.css}</style>
      <section class="ws-docpart first"><p class="ws-docsrc">From <a href="${esc(b.src)}" target="_blank" rel="noopener">${esc(b.title)}</a></p>
      <div class="ws-doc ${esc(b.scope)}">${b.figures.map(f => f.html).join('')}</div></section>`).join('')}
      ${blocks.length ? '<p class="ws-docsrc ws-docpart">Review of this area: findings, gaps and unknowns</p>' : ''}<div class="md" id="lpmd"></div>`;
    H().renderMarkdown(await H().loadMD(base + 'review/' + area + '.md'), $('#lpmd'), base + 'review/' + area + '.md');
  }

  /* ---------- findings (one spec or all) ---------- */
  const FCACHE = {};
  async function loadFindings(s) {
    if (!s.findingsFile) return [];
    if (!FCACHE[s.dir]) FCACHE[s.dir] = fetch(s.findingsFile, { cache: 'no-cache' }).then(r => r.ok ? r.json() : { findings: [] }).catch(() => ({ findings: [] }));
    const j = await FCACHE[s.dir];
    // severity and dimension may be absent (e.g. coverage gaps); they group as 'none' / 'not set'
    return (j.findings || []).map(f => ({ ...f, severity: f.severity || 'none', dimension: f.dimension || 'not set', type: f.type || 'Not set', component: f.component || 'Not set', team: f.team || 'Not set', _spec: s }));
  }
  const FV = { sev: 'all', dim: 'all', area: 'all', layer: 'all', scope: 'all', status: 'all', type: 'all', component: 'all', team: 'all', group: 'type', q: '', open: new Set() };
  const GROUPS = { type: 'Type', component: 'Component', team: 'Team', dimension: 'Dimension', area: 'Area' };
  // every findings view starts unfiltered, so a filter set on another page never hides rows here
  const resetFV = () => { Object.assign(FV, { sev: 'all', dim: 'all', area: 'all', layer: 'all', scope: 'all', status: 'all', type: 'all', component: 'all', team: 'all', q: '' }); FV.open.clear(); };
  async function findingsView(m, specList, opt = {}) {
    const rows = (await Promise.all(specList.map(loadFindings))).flat();
    if (!rows.length) { m.innerHTML = `<div class="callout"><b>No findings recorded.</b> Findings come from <code>/gap</code>, <code>/pr-review</code> and <code>/feedback</code> into <code>outputs/findings.json</code>.</div>`; return; }
    const uniq = k => [...new Set(rows.map(r => r[k]).filter(Boolean))].sort();
    const gkey = FV.group, gval = r => gkey === 'area' ? (r.area ? areaTitle(r.area) : 'Not set') : r[gkey];
    const count = k => { const c = {}; rows.forEach(r => { c[r[k]] = (c[r[k]] || 0) + 1; }); return c; };
    const byCount = k => { const c = count(k); return Object.keys(c).sort((a, b) => c[b] - c[a]); };
    const dims = [...new Set(rows.map(gval))].sort((a, b) => rows.filter(r => gval(r) === b).length - rows.filter(r => gval(r) === a).length), layers = uniq('layer');
    const SEVS = rows.some(r => r.severity === 'none') ? [...SEV, 'none'] : SEV;
    const sel = (key, label, opts, fmt = x => x) => `<label>${label} <select data-f="${key}"><option value="all">All</option>${opts.map(o => `<option value="${esc(o)}" ${FV[key] === o ? 'selected' : ''}>${esc(fmt(o))}</option>`).join('')}</select></label>`;
    const draw = () => {
      const q = FV.q.toLowerCase();
      const list = rows.filter(r => (FV.sev === 'all' || r.severity === FV.sev) && (FV.dim === 'all' || r.dimension === FV.dim)
        && (FV.area === 'all' || (r.area || 'none') === FV.area) && (FV.layer === 'all' || r.layer === FV.layer)
        && (FV.scope === 'all' || (r.scope || 'none') === FV.scope) && (FV.status === 'all' || (r.status || 'open') === FV.status)
        && (FV.type === 'all' || r.type === FV.type) && (FV.component === 'all' || r.component === FV.component) && (FV.team === 'all' || r.team === FV.team)
        && (!q || [r.id, r.title, r.location, r.detail, r.category].join(' ').toLowerCase().includes(q)))
        .sort((a, b) => SEVS.indexOf(a.severity) - SEVS.indexOf(b.severity));
      $('#lpGrid').innerHTML = `<table class="lp-grid"><thead><tr><th></th>${SEVS.map(k => `<th>${SEV_LBL[k]}</th>`).join('')}<th>Total</th></tr></thead><tbody>
        ${dims.map(d => { const r = rows.filter(x => gval(x) === d); return `<tr><th>${esc(d)}</th>${SEVS.map(k => { const n = r.filter(x => x.severity === k).length; return `<td><button class="lp-cell sev-${k} ${n ? '' : 'zero'}" data-g="${esc(d)}" data-sev="${k}">${n || '·'}</button></td>`; }).join('')}<td>${r.length}</td></tr>`; }).join('')}
      </tbody></table>`;
      $('#lpList').innerHTML = `<p class="lp-muted">${list.length} of ${rows.length} shown</p>
        <table class="lp-table lp-findings"><thead><tr><th>ID</th><th>Severity</th><th>Finding</th><th>Type</th><th>Component</th><th>Team</th><th>Scope</th>${opt.fixedSpec ? '' : '<th>Spec</th>'}<th>Status</th></tr></thead><tbody>
        ${list.map(r => { const k = r._spec.dir + ':' + r.id; const open = FV.open.has(k); return `<tr class="lp-frow" data-k="${esc(k)}"><td><b>${esc(r.id)}</b></td><td>${sevPill(r.severity)}</td><td>${esc(r.title || '')}</td><td>${esc(r.type)}</td><td>${esc(r.component)}</td><td>${esc(r.team)}</td><td>${esc(r.scope || '')}</td>${opt.fixedSpec ? '' : `<td><a href="#/spec/${esc(r._spec.dir)}/intent/findings">${esc(r._spec.key)}</a></td>`}<td>${esc(r.status || 'open')}</td></tr>
          ${open ? `<tr class="lp-fdetail"><td colspan="9"><dl>${[['Location', r.location], ['Finding', r.detail], ['Impact', r.impact], ['Fix', r.fix], ['Layer', r.layer], ['Dimension', r.dimension], ['Area', r.area ? areaTitle(r.area) : ''], ['Category', r.category], ['Source', r.source]].filter(([, v]) => v).map(([t, v]) => `<dt>${t}</dt><dd>${esc(v)}</dd>`).join('')}</dl></td></tr>` : ''}`; }).join('')}
        </tbody></table>`;
      $$('.lp-cell', m).forEach(b => b.onclick = () => { const v = b.dataset.g; if (gkey === 'dimension') FV.dim = v; else if (gkey === 'area') FV.area = (areas().find(a => a.title === v) || {}).key || 'none'; else FV[gkey] = v; FV.sev = b.dataset.sev; sync(); draw(); });
      $$('.lp-frow', m).forEach(tr => tr.onclick = e => { if (e.target.closest('a')) return; const k = tr.dataset.k; FV.open.has(k) ? FV.open.delete(k) : FV.open.add(k); draw(); });
    };
    const sync = () => $$('[data-f]', m).forEach(s => { s.value = FV[s.dataset.f]; });
    m.innerHTML = `<div class="lp-groupby">Group by ${Object.entries(GROUPS).map(([k, t]) => `<button type="button" data-group="${k}" class="${FV.group === k ? 'on' : ''}">${t}</button>`).join('')}</div><div id="lpGrid"></div>
      <div class="lp-filters">
        ${sel('type', 'Type', byCount('type'))}
        ${sel('component', 'Component', byCount('component'))}
        ${sel('team', 'Team', byCount('team'))}
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
    $$('[data-group]', m).forEach(b => b.onclick = () => { FV.group = b.dataset.group; findingsView(m, specList, opt); });
    $('[data-q]', m).oninput = e => { FV.q = e.target.value; draw(); };
    $('.lp-reset', m).onclick = () => { Object.assign(FV, { sev: 'all', dim: 'all', area: 'all', layer: 'all', scope: 'all', status: 'all', type: 'all', component: 'all', team: 'all', q: '' }); FV.open.clear(); sync(); $('[data-q]', m).value = ''; draw(); };
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
    resetFV();
    if (area === 'all') { await findingsView(m, S); return; }
    const reviewed = S.filter(s => (s.review || []).includes(area));
    const notYet = S.filter(s => !(s.review || []).includes(area));
    m.innerHTML = `<div class="lp-coverage"><table class="lp-table"><thead><tr><th>Spec</th><th>${esc(areaTitle(area))} review</th><th>Findings in this area</th></tr></thead><tbody>
      ${S.map(s => `<tr><td><a href="#/spec/${esc(s.dir)}/intent/review/${area}">${esc(s.key)}</a> ${esc(s.title || '')}</td><td>${(s.review || []).includes(area) ? '<span class="lp-ok">done</span>' : `not yet · ${copyBtn(`/gap ${s.key} ${area}`)}`}</td><td>${((s.findings || {}).byArea || {})[area] || 0}</td></tr>`).join('')}
    </tbody></table></div><div id="lpF2"></div>`;
    wireCopy(m);
    FV.area = area;
    if (reviewed.length) await findingsView($('#lpF2'), reviewed);
    else $('#lpF2').innerHTML = `<div class="callout"><b>No ${esc(areaTitle(area))} review yet</b> on ${notYet.length} spec${notYet.length === 1 ? '' : 's'}.</div>`;
  }

  /* ---------- #/start: how to run the loop, and a builder for the first command ---------- */
  function renderStart() {
    const c = $('#content'), S = cfg().start || {};
    const kinds = [['jira', 'Jira ticket'], ['idea', 'Idea'], ['github-issue', 'GitHub issue'], ['pr', 'Pull request to review']];
    c.innerHTML = `${head('Start here', S.title || 'How to run the loop', S.lede || '')}
      <section class="st-builder"><h2 class="lp-h2"><span class="lp-step">+</span> Add a new work item</h2>
        <div class="st-form">
          <label>Comes from <select id="stKind">${kinds.map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select></label>
          <label>Work key <input id="stKey" placeholder="TELCO-1234" autocomplete="off"></label>
          <label>Short name <input id="stSlug" placeholder="promissory-cap" autocomplete="off"></label>
          <label class="wide">Source <input id="stRef" placeholder="Jira key, idea text, owner/repo#n or PR URL" autocomplete="off"></label>
        </div>
        <div id="stOut"></div>
      </section>
      ${(S.steps || []).map((st, i) => `<section class="st-step"><div class="st-n">${i + 1}</div><div class="st-b">
        <h3>${esc(st.title)}</h3>${st.where ? `<p class="st-where">${esc(st.where)}</p>` : ''}
        ${(st.text || []).map(t => `<p>${esc(t)}</p>`).join('')}
        ${(st.commands || []).map(x => `<div class="st-cmd">${copyBtn(x.cmd)}${x.note ? `<span>${esc(x.note)}</span>` : ''}</div>`).join('')}
        ${st.link ? `<p><a href="${esc(st.link.href)}">${esc(st.link.text)}</a></p>` : ''}</div></section>`).join('')}`;
    const out = () => {
      const k = $('#stKind').value, key = ($('#stKey').value || 'TELCO-1234').trim().toUpperCase(), slug = ($('#stSlug').value || 'short-name').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), ref = ($('#stRef').value || '').trim();
      const okKey = /^[A-Z][A-Z0-9_]*-\d+$/.test(key);
      const first = k === 'pr' ? `/pr-review ${ref || 'BeyondOneGroup/<repo>#<n>'}` : k === 'idea' ? `/intent ${key} ${slug} "${ref || 'the idea, in a few sentences'}"` : `/intent ${key} ${slug} ${ref || (k === 'jira' ? key : 'BeyondOneGroup/<repo>#<n>')}`;
      const steps = k === 'pr' ? [[first, 'reviews the PR; findings go to the spec it belongs to']] : [
        [first, k === 'jira' ? 'pulls the ticket, its epics and stories and the Confluence PRD into inputs/, writes intent.md' : 'saves the source into inputs/, writes intent.md'],
        [`/gap ${key} all`, 'reviews the existing code area by area: architecture, infra, APIs, data, localization, UI/UX, security, tests'],
        [`python3 tools/findings.py classify ${key}`, 'sets type, component and team on every finding'],
        [(S.refresh || './sync.sh'), 'refreshes this hub (run in the hub folder)'],
        [`python3 tools/spec.py approve ${key} intent --by "<your name>"`, 'after the owner reads the intent here'],
        [`/spec ${key}`, 'then /design, /tasks, /build, /test, /deploy']];
      $('#stOut').innerHTML = `${okKey ? '' : '<div class="callout warn">Work key must look like PROJ-123 (a Jira key, or a placeholder such as IDEA-1).</div>'}
        <ol class="st-seq">${steps.map(([cm, note]) => `<li>${copyBtn(cm)}<span>${esc(note)}</span></li>`).join('')}</ol>`;
      wireCopy($('#stOut'));
    };
    ['stKind', 'stKey', 'stSlug', 'stRef'].forEach(id => $('#' + id).addEventListener('input', out));
    out(); wireCopy(c);
  }

  window.HUB_ROUTES = Object.assign(window.HUB_ROUTES || {}, { start: renderStart, loop: renderLoop, spec: renderSpec, findings: renderFindings });
  window.HUB_WIDE = (window.HUB_WIDE || []).concat(['loop', 'spec', 'findings']);
  window.HUB_SEARCH = (window.HUB_SEARCH || []).concat([data => ((data.loop || {}).specs || []).map(s => ({ kind: 'Spec', title: `${s.key} ${s.title || ''}`, sub: `${s.phase || ''} ${(s.intake || {}).ref || ''}`, href: `#/spec/${s.dir}` }))]);
})();
