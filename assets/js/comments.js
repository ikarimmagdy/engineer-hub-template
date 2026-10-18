/* ============================================================
   Engineering Hub — comment widget.
   Per-page comments the team can leave, with accept / resolve
   and replies. Backend is pluggable:
     - content/comments-config.json { enabled, apiUrl, reviewerPasscode }
     - if apiUrl is set, talks to that REST API (see backend/).
     - if not, falls back to a LOCAL demo (localStorage) so the
       widget is usable before the backend is deployed. Local
       comments live only in that browser and are not shared.
   The REST API shape (what the page expects):
     GET    {apiUrl}?page=<route>        -> [{id,page,author,text,status,replies,ts}]
     POST   {apiUrl}  {page,author,text} -> {id,...}
     PATCH  {apiUrl}/<id> {status?,reply?}-> {ok}
   ============================================================ */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const now = () => new Date().toISOString();
  const rel = ts => { const d = (Date.now() - new Date(ts)) / 1000; if (d < 60) return 'just now'; if (d < 3600) return Math.floor(d / 60) + 'm ago'; if (d < 86400) return Math.floor(d / 3600) + 'h ago'; return new Date(ts).toLocaleDateString(); };
  const page = () => (location.hash || '#/overview').split('?')[0];

  let CFG = { enabled: true, apiUrl: '', reviewerPasscode: 'changeme' };
  let reviewer = false;
  try { reviewer = localStorage.getItem('tb-hub-reviewer') === '1'; } catch (_) {}

  /* ---- storage adapters ---- */
  const local = {
    all() { try { return JSON.parse(localStorage.getItem('tb-hub-comments') || '[]'); } catch (_) { return []; } },
    save(a) { try { localStorage.setItem('tb-hub-comments', JSON.stringify(a)); } catch (_) {} },
    async list(p) { return this.all().filter(c => c.page === p); },
    async add(c) { const a = this.all(); const n = { ...c, id: 'c' + Date.now(), status: 'open', replies: [], ts: now() }; a.push(n); this.save(a); return n; },
    async patch(id, u) { const a = this.all(); const c = a.find(x => x.id === id); if (c) { if (u.status) c.status = u.status; if (u.reply) (c.replies = c.replies || []).push({ ...u.reply, ts: now() }); this.save(a); } return c; }
  };
  const api = {
    async list(p) { const r = await fetch(`${CFG.apiUrl}?page=${encodeURIComponent(p)}`); return r.ok ? r.json() : []; },
    async add(c) { const r = await fetch(CFG.apiUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(c) }); return r.json(); },
    async patch(id, u) { const r = await fetch(`${CFG.apiUrl}/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(u) }); return r.json(); }
  };
  const store = () => (CFG.apiUrl ? api : local);
  const isLocal = () => !CFG.apiUrl;

  /* ---- UI ---- */
  let open = false;
  function mount() {
    if ($('#tbc-btn')) return;
    const b = document.createElement('button');
    b.id = 'tbc-btn'; b.className = 'tbc-btn'; b.type = 'button'; b.setAttribute('aria-label', 'Comments');
    b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span id="tbc-count" class="tbc-count" hidden>0</span>`;
    const panel = document.createElement('div');
    panel.id = 'tbc-panel'; panel.className = 'tbc-panel'; panel.hidden = true;
    document.body.append(b, panel);
    b.addEventListener('click', () => { open = !open; panel.hidden = !open; if (open) render(); });
    window.addEventListener('hashchange', () => { if (open) render(); else refreshCount(); });
    refreshCount();
    // deep link: ...?comments=open opens the panel for the current page
    try { if (new URLSearchParams(location.search).get('comments') === 'open') { open = true; panel.hidden = false; render(); } } catch (_) {}
  }
  async function refreshCount() {
    try { const list = await store().list(page()); const n = list.filter(c => c.status !== 'resolved').length; const el = $('#tbc-count'); if (el) { el.textContent = n; el.hidden = n === 0; } } catch (_) {}
  }
  async function render() {
    const panel = $('#tbc-panel');
    let list = [];
    try { list = await store().list(page()); } catch (_) {}
    list.sort((a, b) => new Date(b.ts) - new Date(a.ts));
    panel.innerHTML = `
      <div class="tbc-head">
        <div><b>Comments</b><div class="tbc-sub">on <code>${esc(page())}</code></div></div>
        <button class="tbc-x" type="button" aria-label="Close">&times;</button>
      </div>
      ${isLocal() ? `<div class="tbc-note">Local demo mode: comments are saved in this browser only and are not shared. Deploy the backend and set <code>apiUrl</code> in <code>content/comments-config.json</code> to make them shared and readable by the team.</div>` : ''}
      <div class="tbc-list">
        ${list.length ? list.map(cItem).join('') : '<p class="tbc-empty">No comments on this page yet. Be the first.</p>'}
      </div>
      <form class="tbc-form" id="tbc-form">
        <input id="tbc-name" class="tbc-inp" placeholder="Your name" autocomplete="name" required>
        <textarea id="tbc-text" class="tbc-inp" rows="3" placeholder="Leave a comment on this page…" required></textarea>
        <div class="tbc-row">
          <label class="tbc-rev"><input type="checkbox" id="tbc-revchk" ${reviewer ? 'checked' : ''}> Reviewer mode</label>
          <button class="tbc-send" type="submit">Comment</button>
        </div>
      </form>`;
    panel.querySelector('.tbc-x').addEventListener('click', () => { open = false; panel.hidden = true; refreshCount(); });
    panel.querySelector('#tbc-form').addEventListener('submit', onAdd);
    panel.querySelector('#tbc-revchk').addEventListener('change', onReviewerToggle);
    panel.querySelectorAll('[data-act]').forEach(el => el.addEventListener('click', onAct));
  }
  function cItem(c) {
    const st = c.status || 'open';
    const badge = st === 'accepted' ? 'tbc-b-ok' : st === 'resolved' ? 'tbc-b-done' : 'tbc-b-open';
    return `<div class="tbc-item">
      <div class="tbc-top"><span class="tbc-av">${esc((c.author || '?').slice(0, 1).toUpperCase())}</span>
        <div><b>${esc(c.author || 'Someone')}</b><span class="tbc-time">${esc(rel(c.ts))}</span></div>
        <span class="tbc-badge ${badge}">${esc(st)}</span></div>
      <div class="tbc-body">${esc(c.text)}</div>
      ${(c.replies || []).map(r => `<div class="tbc-reply"><b>${esc(r.author || 'Reply')}:</b> ${esc(r.text)} <span class="tbc-time">${esc(rel(r.ts))}</span></div>`).join('')}
      ${reviewer ? `<div class="tbc-acts">
        ${st !== 'accepted' ? `<button class="tbc-act" data-act="accept" data-id="${esc(c.id)}">Accept</button>` : ''}
        ${st !== 'resolved' ? `<button class="tbc-act" data-act="resolve" data-id="${esc(c.id)}">Resolve</button>` : ''}
        <button class="tbc-act" data-act="reply" data-id="${esc(c.id)}">Reply</button>
      </div>` : ''}
    </div>`;
  }
  async function onAdd(e) {
    e.preventDefault();
    const name = $('#tbc-name').value.trim(), text = $('#tbc-text').value.trim();
    if (!name || !text) return;
    await store().add({ page: page(), author: name, text });
    try { localStorage.setItem('tb-hub-name', name); } catch (_) {}
    render(); refreshCount();
  }
  function onReviewerToggle(e) {
    if (e.target.checked) {
      const p = prompt('Reviewer passcode (lets you accept and resolve comments):') || '';
      if (p === (CFG.reviewerPasscode || 'changeme')) { reviewer = true; try { localStorage.setItem('tb-hub-reviewer', '1'); } catch (_) {} }
      else { e.target.checked = false; reviewer = false; alert('Incorrect passcode.'); }
    } else { reviewer = false; try { localStorage.removeItem('tb-hub-reviewer'); } catch (_) {} }
    render();
  }
  async function onAct(e) {
    const id = e.target.dataset.id, act = e.target.dataset.act;
    if (act === 'accept') await store().patch(id, { status: 'accepted' });
    else if (act === 'resolve') await store().patch(id, { status: 'resolved' });
    else if (act === 'reply') { const t = prompt('Your reply:'); if (t) await store().patch(id, { reply: { author: (localStorage.getItem('tb-hub-name') || 'Reviewer'), text: t } }); }
    render(); refreshCount();
  }

  /* ---- init after the hub unlocks ---- */
  async function init() {
    try { const c = await fetch('content/comments-config.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null); if (c) CFG = { ...CFG, ...c }; } catch (_) {}
    if (CFG.enabled === false) return;
    // wait until the app shell is visible (gate passed)
    const ready = () => { const app = $('#app'); return app && !app.hidden; };
    if (ready()) mount();
    else { const iv = setInterval(() => { if (ready()) { clearInterval(iv); mount(); } }, 500); setTimeout(() => clearInterval(iv), 60000); }
  }
  if (document.readyState !== 'loading') init(); else document.addEventListener('DOMContentLoaded', init);
})();
