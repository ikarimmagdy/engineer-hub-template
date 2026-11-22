import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { useHub, type Hub, type NavItem } from '../lib/data';
import { legacyRoute } from '../lib/routes';
import { renderInline } from '../lib/markdown';
import { MarkdownFile } from '../components/Markdown';
import { AgenticGraph, phaseWiring, SdlcOverview, useModel, type GraphState } from '../components/Sdlc';
import { CopyButton, cx, Empty, ErrorNote, fmtDate, PageHeader, Pill, TabBar } from '../components/ui';
import { startAgent, startWork, useLoopApi } from '../lib/loop';
import { RunView, useRun } from '../components/RunView';

function target(item: NavItem, hub: Hub): { to?: string; href?: string } {
  if (/^https?:/.test(item.route)) return { href: item.route };
  const mapped = legacyRoute(item.route.replace(/^#/, ''), hub);
  if (mapped && mapped !== '/knowledge/archive') return { to: mapped };
  return {};
}

function NavCard({ item, hub, note }: { item: NavItem; hub: Hub; note?: string }) {
  const t = target(item, hub);
  const body = (
    <>
      <div className="text-sm font-medium">{item.title}</div>
      {note && <div className="mt-0.5 text-xs text-ink-3">{note}</div>}
    </>
  );
  const cls = 'block rounded-lg border border-line bg-paper px-4 py-3 hover:border-line-2';
  if (t.to) return <Link to={t.to} className={cls}>{body}</Link>;
  if (t.href) return <a href={t.href} target="_blank" rel="noopener" className={cls}>{body}</a>;
  return <div className={cx(cls, 'opacity-60')}>{body}<div className="text-xs text-ink-3">Retired with the v4 hub</div></div>;
}

export function Knowledge() {
  const { page, id } = useParams();
  const hub = useHub();
  if (page === 'how-we-work') return <HowWeWork />;
  if (page === 'decisions') return id ? <Decision id={id} /> : <Decisions />;
  if (page === 'library') return <Library />;
  if (page === 'archive') return <Archive />;
  if (page) return <Navigate to="/knowledge" replace />;

  const groups = hub.manifest.nav.filter((g) => /engineering|knowledge/i.test(g.label));
  const items = groups.flatMap((g) => g.items).filter((i) => !['#/adr', '#/kb'].includes(i.route));
  return (
    <div>
      <PageHeader title="Knowledge" lede="How the team works, the architecture and platform, every decision, and the library of documents behind the hub." />
      {hub.system && (
        <Link to="/system" className="mb-3 block rounded-lg border border-ink bg-paper px-4 py-4 hover:bg-sunk">
          <div className="font-semibold">System</div>
          <div className="mt-1 text-xs text-ink-2">
            The architecture, communication matrix, infrastructure, screens and use cases, built up by every work item: {hub.system.components.length} components, {hub.system.flows.length} flows, {hub.system.works.length} work items recorded
          </div>
        </Link>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link to="/knowledge/how-we-work" className="rounded-lg border border-ink bg-paper px-4 py-4 hover:bg-sunk">
          <div className="font-semibold">How we work</div><div className="mt-1 text-xs text-ink-2">The delivery loop, its gates, and how to start a work item</div>
        </Link>
        <Link to="/knowledge/decisions" className="rounded-lg border border-line bg-paper px-4 py-4 hover:border-line-2">
          <div className="font-semibold">Decision log</div><div className="mt-1 text-xs text-ink-2">{hub.manifest.adrs.length} architecture decisions</div>
        </Link>
        <Link to="/knowledge/library" className="rounded-lg border border-line bg-paper px-4 py-4 hover:border-line-2">
          <div className="font-semibold">Library</div><div className="mt-1 text-xs text-ink-2">{hub.manifest.kb.length} documents, searchable</div>
        </Link>
        <Link to="/knowledge/archive" className="rounded-lg border border-line bg-paper px-4 py-4 hover:border-line-2">
          <div className="font-semibold">Archive</div><div className="mt-1 text-xs text-ink-2">Pages from before the delivery loop</div>
        </Link>
      </div>
      {hub.loop.specs.some((s) => s.pages?.length) && (
        <>
          <h2 className="mb-3 mt-8 text-sm font-semibold text-ink-2">Architecture by work item</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {hub.loop.specs.flatMap((s) => (s.pages || []).map((p) => (
              <Link key={`${s.key}-${p.id}`} to={`/work/${s.key}/design?doc=page:${p.id}`} className="block rounded-lg border border-line bg-paper px-4 py-3 hover:border-line-2">
                <div className="font-mono text-[11px] text-ink-3">{s.key} · {s.title}</div>
                <div className="mt-0.5 text-sm font-medium">{p.title}</div>
                <div className="mt-0.5 text-xs text-ink-3">{p.version.replace(/\.html$/, '')}</div>
              </Link>
            )))}
          </div>
        </>
      )}
      {items.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-sm font-semibold text-ink-2">Architecture and platform</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((i) => {
              const s = hub.manifest.sections.find((x) => `#/${x.id}` === i.route);
              return <NavCard key={i.route} item={i} hub={hub} note={s?.lede?.replace(/[*`]/g, '').slice(0, 110)} />;
            })}
          </div>
        </>
      )}
    </div>
  );
}

function focusGraph(id: string | null, smooth = false) {
  const g = document.getElementById('how-graph');
  if (!g) return;
  const top = (el: Element) => el.getBoundingClientRect().top + scrollY - 80;
  const n = id ? g.querySelector(`[data-id="${CSS.escape(id)}"]`) : null;
  // the graph's top, or the selected box when that would still be below the fold
  scrollTo({ top: n && top(n) - top(g) > innerHeight * 0.6 ? top(n) - innerHeight * 0.25 : top(g), behavior: smooth ? 'smooth' : 'auto' });
  const sc = n?.closest('[data-scroll]');
  if (n && sc) {
    const r = n.getBoundingClientRect(), b = sc.getBoundingClientRect();
    sc.scrollLeft += r.left - b.left - (b.width - r.width) / 2;
  }
}

function HowWeWork() {
  const hub = useHub();
  const { manifest, loop } = hub;
  const c = manifest.loopConfig;
  const ag = manifest.agentic;
  const model = useModel(hub);
  const { id: mode, sub } = useParams();
  const navigate = useNavigate();
  // ADR 0029: the page is three tabs; the graph's deep links (cmd, node, flow) open In detail
  const tab = mode === 'start' ? 'start' : mode === 'detail' || mode === 'cmd' || mode === 'node' || mode === 'flow' ? 'detail' : 'overview';
  const [params] = useSearchParams();
  const asked = mode === 'cmd' && sub ? sub : params.get('cmd');
  const target = asked ? `cmd:${asked.replace(/^\//, '')}` : mode === 'node' && sub ? sub : null;
  const flow = mode === 'flow' && sub ? sub : null;
  const [graph, setGraph] = useState<GraphState>({ sel: target, flow, step: 0 });
  useEffect(() => {
    setGraph({ sel: target, flow, step: 0 });
    if (!target && !flow) return;
    const t = setTimeout(() => focusGraph(target), 80);
    return () => clearTimeout(t);
  }, [target, flow, mode]);
  const go = (id: string) => {
    if (tab !== 'detail') { navigate(`/knowledge/how-we-work/node/${encodeURIComponent(id)}`); return; }
    setGraph({ sel: id, flow: null, step: 0 }); requestAnimationFrame(() => focusGraph(id, true));
  };
  const unused = ag ? ag.tools.filter((t) => t.configured && !t.used) : [];
  const idle = ag ? ag.commands.filter((x) => !x.agents.length && !x.tools.length) : [];
  const start = c.start as { title: string; lede: string; steps: { title: string; where?: string; text?: string[]; commands?: { cmd: string; note?: string }[] }[] } | undefined;
  return (
    <div>
      <PageHeader crumb={<Link to="/knowledge" className="hover:underline">Knowledge</Link>} title="How we work" lede={c.lede} />
      <TabBar label="How we work" className="mb-6" tabs={[
        { to: '/knowledge/how-we-work', label: 'How it works', end: true },
        { to: '/knowledge/how-we-work/detail', label: 'In detail' },
        ...(start ? [{ to: '/knowledge/how-we-work/start', label: 'Start a work item' }] : []),
      ]} />
      {tab === 'overview' && model && (
        <>
          <h2 className="mb-1 text-lg font-semibold">{c.sdlc?.title || 'The SDLC at a glance'}</h2>
          <p className="mb-3 max-w-3xl text-sm text-ink-2">Where work comes from, what Claude Code does with it in the workspace, and what it delivers. Click a box to see it in detail.</p>
          <SdlcOverview hub={hub} model={model} onGo={go} />
        </>
      )}
      {tab === 'detail' && model && (
        <>
          <h2 id="how-graph" className="mb-1 mt-10 scroll-mt-20 text-lg font-semibold">How it works, in detail</h2>
          <p className="mb-3 max-w-3xl text-sm text-ink-2">
            Read from <code className="font-mono text-[12px]">{model.ag.workspace}/.claude</code> and <code className="font-mono text-[12px]">.mcp.json</code> on {fmtDate(model.ag.generated)}.
            A line means the command file names that agent, tool or file. Click any box, or pick an entry point to walk through its flow.
          </p>
          <AgenticGraph hub={hub} model={model} state={graph} setState={setGraph} />
        </>
      )}

      {tab === 'overview' && <>
      <h2 className="mb-1 mt-10 text-lg font-semibold">The loop, one gate per step</h2>
      <p className="mb-3 text-sm text-ink-2">{loop.specs.length} work items are in it now: see them by phase on the <Link to="/work" className="underline decoration-line-2 underline-offset-4 hover:decoration-ink">Work board</Link>.</p>
      <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {(c.phases || []).map((p, i) => {
          const w = phaseWiring(ag, p.command, i);
          return (
            <li key={p.key} className="rounded-lg border border-line bg-paper px-4 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold"><span className="mr-1.5 tabular-nums text-ink-3">{i + 1}</span>{p.title}</span>
                <span className="flex flex-wrap justify-end gap-1">
                  {p.command.split(/[,\s]+/).filter((x) => x.startsWith('/')).map((x) => (
                    model?.all[`cmd:${x.slice(1)}`]
                      ? <button key={x} type="button" onClick={() => go(`cmd:${x.slice(1)}`)} title="Show it in the diagram" className="font-mono text-[11.5px] text-ink-2 underline decoration-line-2 underline-offset-4 hover:decoration-ink">{x}</button>
                      : <code key={x} className="font-mono text-[11.5px] text-ink-2">{x}</code>
                  ))}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-ink-2 text-pretty" dangerouslySetInnerHTML={{ __html: renderInline(p.does) }} />
              {(w.agents.length > 0 || w.tools.length > 0) && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {w.agents.map((a) => <span key={a} className="rounded border border-line border-l-[3px] border-l-ok px-1.5 py-px text-[11.5px] text-ink-2">{a}</span>)}
                  {w.tools.map((t) => <span key={t} className="rounded border border-line border-l-[3px] border-l-sev-high px-1.5 py-px text-[11.5px] text-ink-2">{t}</span>)}
                </div>
              )}
              {p.gate && <p className="mt-2 text-xs"><span className="font-medium">Gate:</span> <span className="text-ink-2">{p.gate}</span></p>}
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-xs text-ink-3">↺ Maintain feeds new intents: incidents, feedback and review findings start the loop again. <Link to="/knowledge/how-we-work/start" className="underline">Start a work item</Link>.</p>
      </>}

      {tab === 'detail' && unused.length > 0 && (
        <>
          <h2 className="mb-3 mt-10 text-lg font-semibold">Wiring gaps</h2>
          <div className="max-w-3xl rounded-lg border border-line-2 bg-sunk px-4 py-3 text-sm">
            <span className="font-medium">Installed, but no command uses them yet:</span>{' '}
            {unused.map((t, i) => <span key={t.id}>{i > 0 && ', '}{t.name} <span className="text-ink-3">({t.source || t.kind})</span></span>)}.
            {' '}Until a command names them, Claude only uses them when someone asks in the session.
          </div>
          {idle.length > 0 && <p className="mt-2 text-sm text-ink-3">Commands that call no agent or tool: {idle.map((x) => <code key={x.id} className="mr-1.5 font-mono text-[12px]">{x.name}</code>)}</p>}
        </>
      )}


      {tab === 'start' && start && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <h2 id="start" className="mb-1 text-lg font-semibold">{start.title}</h2>
            <p className="mb-4 max-w-3xl text-sm text-ink-2">{start.lede}</p>
            <StartForm />
          </div>
          <div className="min-w-0 space-y-3">
          {!!c.intake?.length && (
            <div className="rounded-lg border border-line bg-paper px-4 py-3">
              <div className="mb-2 text-sm font-semibold">Where work comes from</div>
              <ul className="space-y-1.5 text-sm">{c.intake.map((e) => <li key={e.key}><span className="font-medium">{e.title}</span> <span className="text-ink-2">{e.what}</span></li>)}</ul>
            </div>
          )}
          <details className="min-w-0 rounded-lg border border-line bg-paper px-4 py-3 open:pb-4">
          <summary className="cursor-pointer text-sm font-semibold">The steps, in a terminal ({start.steps.length}): first-time setup to the first gate</summary>
          <ol className="mt-4 space-y-4">
            {start.steps.map((s, i) => (
              <li key={i} className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[32px_minmax(0,1fr)]">
                <span className="grid size-7 place-items-center rounded-full border border-line-2 text-xs font-semibold tabular-nums">{i + 1}</span>
                <div className="min-w-0">
                  <div className="font-medium">{s.title}{s.where && <span className="ml-2 text-xs font-normal text-ink-3">{s.where}</span>}</div>
                  {s.text?.map((t, j) => <p key={j} className="mt-1 max-w-3xl text-sm text-ink-2" dangerouslySetInnerHTML={{ __html: renderInline(t) }} />)}
                  {!!s.commands?.length && (
                    <ul className="mt-2 space-y-1.5">
                      {s.commands.map((cmd) => <li key={cmd.cmd} className="flex flex-wrap items-center gap-2"><CopyButton text={cmd.cmd} className="max-w-full [&_code]:truncate" />{cmd.note && <span className="text-xs text-ink-3">{cmd.note}</span>}</li>)}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ol>
          </details>
          </div>
        </div>
      )}
      {tab === 'start' && !start && <Empty>This hub's loop-config has no start steps.</Empty>}
    </div>
  );
}

const KINDS: [string, string, string][] = [
  ['jira', 'Jira ticket', 'Jira key, e.g. TELCO-2513'],
  ['idea', 'Idea', 'One or two sentences'],
  ['github-issue', 'GitHub issue', 'your-org/<repo>#<n>'],
  ['pr', 'Pull request', 'your-org/<repo>#<n>'],
];

function StartForm() {
  const { loop } = useHub();
  const api = useLoopApi();
  const [kind, setKind] = useState('jira');
  const [key, setKey] = useState('');
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [src, setSrc] = useState('');
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<{ dir: string | null; output: string; shared: boolean } | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { run } = useRun(runId);
  const k = key.trim().toUpperCase() || '<KEY>';
  const s = slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || '<short-name>';
  const exists = loop.specs.some((x) => x.key === key.trim().toUpperCase());
  const source = kind === 'jira' ? (src.trim() || k) : kind === 'idea' ? `"${src.trim() || '<the idea>'}"` : (src.trim() || 'your-org/<repo>#<n>');
  const cmds = kind === 'pr'
    ? [`/pr-review ${source}`]
    : [`/intent ${k} ${s} ${source}`, `/gap ${k} all`, `python3 tools/spec.py approve ${k} intent --by "<your name>"`, `/spec ${k}`];
  const field = 'mt-1 h-9 w-full rounded-md border border-line-2 bg-sunk px-2.5 text-sm';
  const ready = kind !== 'pr' && /^[A-Z][A-Z0-9]*-\d+$/.test(key.trim().toUpperCase()) && /^[a-z0-9][a-z0-9-]+$/.test(s);
  const create = () => {
    setErr(null); setBusy(true);
    startWork({ kind, key: key.trim().toUpperCase(), slug: s, title: title.trim() || undefined, ref: src.trim() || undefined })
      .then(setMade, (e) => setErr((e as Error).message)).finally(() => setBusy(false));
  };
  const intent = () => {
    setErr(null);
    startAgent({ agent: 'intent', key: key.trim().toUpperCase(), question: 'intent' }).then((r) => setRunId(r.id), (e) => setErr((e as Error).message));
  };
  return (
    <form className="rounded-lg border border-line bg-paper p-4" onSubmit={(e) => e.preventDefault()}>
      <div className="grid gap-3 md:grid-cols-[180px_160px_minmax(0,1fr)]">
        <label className="text-xs font-medium">Comes from
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={field}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </label>
        {kind !== 'pr' && <label className="text-xs font-medium">Work key<input value={key} onChange={(e) => setKey(e.target.value)} placeholder="PROJ-123" className={field} /></label>}
        {kind !== 'pr' && <label className="text-xs font-medium">Short name<input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="promissory-cap" className={field} /></label>}
        {kind !== 'pr' && <label className="text-xs font-medium md:col-span-3">Title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What the work is, in a few words" className={field} /></label>}
        <label className="text-xs font-medium md:col-span-3">Source
          <input value={src} onChange={(e) => setSrc(e.target.value)} placeholder={KINDS.find(([v]) => v === kind)![2]} className={field} />
        </label>
      </div>

      {api?.writable && kind !== 'pr' ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={!ready || busy || !!made || exists} onClick={create}
              className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-paper disabled:opacity-50">1. Create the work item</button>
            <button type="button" disabled={!(made || exists) || !api.agents || run?.state === 'running'} onClick={intent}
              className="rounded-md border border-ink px-3 py-1.5 text-sm font-medium disabled:opacity-40">2. Write the intent with Claude</button>
            {exists && !made && <span className="text-xs text-ink-3">{key.trim().toUpperCase()} already exists: step 2 writes or rewrites its intent. <Link to={`/work/${key.trim().toUpperCase()}`} className="underline">Open it</Link></span>}
          </div>
          <p className="text-xs text-ink-3">Step 1 runs <code>tools/spec.py new</code> in the workspace, which creates <code>specs/{k}-{s}/</code> and shares it with the team. Step 2 runs <code>/intent</code> as an agent: it reads the sources (Jira, Confluence, Figma, read-only), writes only inside that folder, and cannot approve or move the phase; you review and approve on the work item.</p>
          {made && <div className="rounded-md bg-sunk p-3 text-xs"><div className="mb-1 font-medium">{made.shared ? 'Created and shared with the team.' : 'Created; tools/spec.py did not push it (see below).'} <Link to={`/work/${key.trim().toUpperCase()}`} className="underline">Open the work item</Link></div><pre className="max-h-32 overflow-auto whitespace-pre-wrap">{made.output}</pre></div>}
          {err && <ErrorNote>{err}</ErrorNote>}
          {run && <RunView run={run} />}
        </div>
      ) : (
        <>
          <p className="mt-4 text-xs text-ink-3">{kind === 'pr' ? 'Paste into Claude Code in the workspace:' : 'On the hub on your laptop this form creates the work item and writes the intent for you. Here, paste these into Claude Code in the workspace:'}</p>
          <ol className="mt-2 space-y-1.5">
            {cmds.map((c, i) => <li key={i} className="flex items-center gap-2"><span className="w-4 text-xs tabular-nums text-ink-3">{i + 1}</span><CopyButton text={c} className="max-w-full [&_code]:truncate" /></li>)}
          </ol>
        </>
      )}
      {api?.writable && kind !== 'pr' && (
        <details className="mt-3"><summary className="cursor-pointer text-xs text-ink-2">Or in Claude Code</summary>
          <ol className="mt-2 space-y-1.5">{cmds.map((c, i) => <li key={i} className="flex items-center gap-2"><span className="w-4 text-xs tabular-nums text-ink-3">{i + 1}</span><CopyButton text={c} className="max-w-full [&_code]:truncate" /></li>)}</ol>
        </details>
      )}
    </form>
  );
}

function Decisions() {
  const { manifest } = useHub();
  const [q, setQ] = useState('');
  const list = manifest.adrs.filter((a) => !q || `${a.id} ${a.title} ${a.summary}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageHeader crumb={<Link to="/knowledge" className="hover:underline">Knowledge</Link>} title="Decision log" lede="Every architecture decision, newest first. Each is written with /adr in the engineering workspace." />
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search decisions" aria-label="Search decisions" className="mb-4 h-8 w-64 rounded-md border border-line-2 bg-paper px-2.5 text-sm" />
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-paper">
        {[...list].sort((a, b) => b.id.localeCompare(a.id)).map((a) => (
          <li key={a.id}>
            <Link to={`/knowledge/decisions/${a.id}`} className="grid gap-x-4 gap-y-1 px-4 py-3 hover:bg-sunk md:grid-cols-[88px_minmax(0,1fr)_120px]">
              <span className="font-mono text-[11.5px] text-ink-3">{a.id}</span>
              <span className="min-w-0">
                <span className="block font-medium" dangerouslySetInnerHTML={{ __html: renderInline(a.title) }} />
                <span className="mt-0.5 line-clamp-2 block text-sm text-ink-2" dangerouslySetInnerHTML={{ __html: renderInline(a.summary) }} />
              </span>
              <span className="flex items-start gap-2 md:justify-end"><Pill tone={a.status === 'Accepted' ? 'ok' : 'wait'}>{a.status}</Pill><span className="text-xs text-ink-3">{fmtDate(a.date)}</span></span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Decision({ id }: { id: string }) {
  const { manifest } = useHub();
  const a = manifest.adrs.find((x) => x.id === id);
  if (!a) return <Empty action={<Link to="/knowledge/decisions" className="underline">All decisions</Link>}>No decision {id}.</Empty>;
  const file = a.file || a.doc;
  return (
    <div>
      <div className="mb-4 text-xs text-ink-3"><Link to="/knowledge/decisions" className="hover:underline">Decision log</Link> / <span className="font-mono">{a.id}</span></div>
      <div className="mb-4 flex flex-wrap gap-2"><Pill tone={a.status === 'Accepted' ? 'ok' : 'wait'}>{a.status}</Pill><span className="text-xs text-ink-3">{a.date}</span></div>
      {file ? <MarkdownFile path={file.startsWith('content/') ? file : `content/kb-src/${file}`} sectioned /> : <p className="max-w-3xl" dangerouslySetInnerHTML={{ __html: renderInline(a.summary) }} />}
    </div>
  );
}

function Library() {
  const { manifest } = useHub();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('');
  const groups = useMemo(() => [...new Set(manifest.kb.map((k) => k.group))].sort(), [manifest]);
  const list = manifest.kb.filter((k) => (!group || k.group === group) && (!q || `${k.title} ${k.path} ${k.summary}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <div>
      <PageHeader crumb={<Link to="/knowledge" className="hover:underline">Knowledge</Link>} title="Library" lede="Every document the hub links, by stream." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles and paths" aria-label="Search the library" className="h-8 w-64 rounded-md border border-line-2 bg-paper px-2.5 text-sm" />
        <div className="flex flex-wrap gap-1.5">
          <button type="button" aria-pressed={!group} onClick={() => setGroup('')} className={cx('rounded-full border px-2.5 py-0.5 text-xs', !group ? 'border-ink bg-ink text-paper' : 'border-line-2 bg-paper')}>All</button>
          {groups.map((g) => <button key={g} type="button" aria-pressed={group === g} onClick={() => setGroup(group === g ? '' : g)} className={cx('rounded-full border px-2.5 py-0.5 text-xs', group === g ? 'border-ink bg-ink text-paper' : 'border-line-2 bg-paper')}>{g}</button>)}
        </div>
        <span className="text-xs text-ink-3">{list.length}</span>
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-paper">
        {list.slice(0, 200).map((k) => (
          <li key={k.path}>
            <Link to={`/doc/${k.path}`} className="grid gap-x-4 px-4 py-2.5 hover:bg-sunk md:grid-cols-[minmax(0,1fr)_200px]">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{k.title}</span>
                <span className="block truncate font-mono text-[11px] text-ink-3">{k.path}</span>
              </span>
              <span className="text-xs text-ink-3 md:text-right">{k.group}</span>
            </Link>
          </li>
        ))}
        {list.length > 200 && <li className="px-4 py-3 text-sm text-ink-3">Showing 200 of {list.length}. Search to narrow it down.</li>}
      </ul>
    </div>
  );
}

function Archive() {
  const hub = useHub();
  const items = hub.manifest.nav.filter((g) => /archive/i.test(g.label)).flatMap((g) => g.items);
  return (
    <div>
      <PageHeader crumb={<Link to="/knowledge" className="hover:underline">Knowledge</Link>} title="Archive" lede="Pages from before the delivery loop, kept for reference until their content moves into a work item." />
      {items.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map((i) => <NavCard key={i.route} item={i} hub={hub} />)}</div> : <Empty>Nothing archived.</Empty>}
    </div>
  );
}
