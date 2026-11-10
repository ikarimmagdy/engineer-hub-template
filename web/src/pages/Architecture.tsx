import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { trackerUrl, useHub } from '../lib/data';
import {
  archOf, archRoute, containersOn, contextEdges, indexArch, KIND_LABEL, nodeRoute, resourceNeighbours, searchText, VIEWS,
  type ArchAdapter, type ArchContainer, type ArchExternal, type ArchIndex, type ArchLink, type ArchModule, type ArchNode,
  type ArchRegion, type ArchResource, type ArchActor, type ArchFlow, type View,
} from '../lib/architecture';
import { MarkdownText } from '../components/Markdown';
import { cx, Dot, Empty, fmtDate, PageHeader, Panel, Pill, Segmented, TabBar, type Tone } from '../components/ui';

const DATA_PATH = 'content/data/architecture.json';
const KEEP = { state: { keepScroll: true } };

/** A short status is a pill; a sentence wraps inside the box instead of running past it. */
function StatusLine({ status, className }: { status: string; className?: string }) {
  const tone = statusTone(status);
  if (status.length <= 40) return <Pill tone={tone} className={className}>{status}</Pill>;
  return (
    <span className={cx('inline-flex min-w-0 max-w-full items-start gap-1.5 rounded-lg border border-line-2 px-2 py-0.5 text-xs text-ink-2', className)}>
      {tone && <Dot tone={tone} className="mt-1.5 shrink-0" />}
      <span className="min-w-0 break-words">{status}</span>
    </span>
  );
}

const statusTone = (s?: string): Tone | undefined =>
  !s ? undefined : /^(live|active|prod|running|ok|up)/i.test(s) ? 'ok' : /(plan|propos|future|draft)/i.test(s) ? 'wait' : /(down|fail|retired|block)/i.test(s) ? 'block' : 'run';

/** Moves within a view without scrolling the page to the top and without filling the history. */
function useSelect(view: View) {
  const nav = useNavigate();
  const loc = useLocation();
  const { id } = useParams();
  return (next?: string) => nav({ pathname: archRoute(view, next && next !== id ? next : undefined), search: loc.search }, { ...KEEP, replace: true });
}

export function Architecture() {
  const hub = useHub();
  const { view, id } = useParams();
  const arch = archOf(hub);
  const idx = useMemo(() => (arch ? indexArch(arch) : null), [arch]);
  if (!arch || !idx) return <Empty>This hub has no architecture map yet ({DATA_PATH}).</Empty>;
  if (!view) return <Navigate to={archRoute('overview')} replace />;
  if (!VIEWS.some(([v]) => v === view)) return <Navigate to={archRoute('overview')} replace />;
  if (view === 'modules' && id) return <ModulePage idx={idx} id={id} />;

  const count: Partial<Record<View, number>> = {
    infrastructure: (arch.regions || []).length || undefined,
    application: (arch.containers || []).length || undefined,
    modules: (arch.modules || []).length || undefined,
    flows: (arch.flows || []).length || undefined,
  };
  const lede = [arch.generated && `Generated ${fmtDate(arch.generated)}`, arch.sources?.length && `from ${arch.sources.length} ${arch.sources.length === 1 ? 'source' : 'sources'}`].filter(Boolean).join(' ');
  return (
    <div>
      <PageHeader
        title="Architecture"
        lede={lede ? <span className="text-sm text-ink-3" title={(arch.sources || []).join('\n')}>{lede}</span> : undefined}
        actions={<ArchSearch idx={idx} />}
      />
      <TabBar label="Architecture views" className="mb-6" tabs={VIEWS.map(([v, l]) => ({ to: archRoute(v), label: l, count: count[v] }))} />
      {view === 'overview' && <Overview idx={idx} />}
      {view === 'infrastructure' && <Infrastructure idx={idx} />}
      {view === 'application' && <Application idx={idx} />}
      {view === 'modules' && <Modules idx={idx} />}
      {view === 'flows' && <Flows idx={idx} />}
    </div>
  );
}

/* ---------- search across every node ---------- */

function ArchSearch({ idx }: { idx: ArchIndex }) {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [open, setOpen] = useState(false);
  const hits = useMemo(() => {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return idx.nodes
      .map((n) => ({ n, t: searchText(n), name: n.name.toLowerCase() }))
      .filter((x) => terms.every((t) => x.t.includes(t)))
      .sort((a, b) => Number(!a.name.startsWith(terms[0])) - Number(!b.name.startsWith(terms[0])) || a.name.localeCompare(b.name))
      .slice(0, 12)
      .map((x) => x.n);
  }, [q, idx]);
  const go = (n?: ArchNode) => { if (!n) return; setQ(''); setOpen(false); nav(nodeRoute(n, idx)); };
  return (
    <div className="relative w-full sm:w-72">
      <label className="sr-only" htmlFor="arch-search">Search the architecture</label>
      <input
        id="arch-search" type="search" value={q} placeholder="Find a service, module, resource"
        role="combobox" aria-expanded={open && hits.length > 0} aria-controls="arch-search-list" autoComplete="off"
        aria-activedescendant={open && hits[sel] ? `arch-hit-${sel}` : undefined}
        onChange={(e) => { setQ(e.target.value); setSel(0); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, hits.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
          else if (e.key === 'Enter') { e.preventDefault(); go(hits[sel]); }
          else if (e.key === 'Escape') { setQ(''); setOpen(false); }
        }}
        className="h-8 w-full rounded-md border border-line-2 bg-paper px-2.5 text-sm"
      />
      {open && q.trim() && (
        <div id="arch-search-list" role="listbox" className="absolute right-0 z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-md border border-line-2 bg-paper py-1 shadow-lg sm:w-96">
          {!hits.length && <p className="px-3 py-2 text-sm text-ink-3">Nothing matches.</p>}
          {hits.map((n, i) => (
            <div key={`${n.kind}:${n.id}`} id={`arch-hit-${i}`} role="option" aria-selected={i === sel}
              onMouseDown={(e) => { e.preventDefault(); go(n); }} onMouseMove={() => setSel(i)}
              className={cx('flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-sm', i === sel && 'bg-sunk')}>
              <span className="min-w-0 truncate">{n.name}</span>
              <span className="shrink-0 text-xs text-ink-3">{KIND_LABEL[n.kind]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- shared bits ---------- */

function Ext({ l }: { l: ArchLink }) {
  if (!l.url) return <span>{l.label}</span>;
  return <a href={l.url} target="_blank" rel="noopener" className="underline decoration-line-2 underline-offset-4 hover:decoration-ink">{l.label || l.url}</a>;
}

function Links({ links }: { links?: ArchLink[] }) {
  if (!links?.length) return null;
  return <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">{links.map((l, i) => <li key={i}><Ext l={l} /></li>)}</ul>;
}

function NodeChip({ id, idx, label }: { id: string; idx: ArchIndex; label?: string }) {
  const n = idx.get(id);
  if (!n) return <Pill className="font-mono">{label || id}</Pill>;
  return (
    <Link to={nodeRoute(n, idx)} className="inline-flex items-center rounded-full border border-line-2 px-2 py-px text-xs text-ink-2 hover:border-ink-3 hover:text-ink" title={KIND_LABEL[n.kind]}>
      {label || n.name}
    </Link>
  );
}

function Chips({ ids, idx }: { ids?: string[]; idx: ArchIndex }) {
  if (!ids?.length) return null;
  return <div className="flex flex-wrap gap-1.5">{ids.map((i) => <NodeChip key={i} id={i} idx={idx} />)}</div>;
}

function WorkLink({ k }: { k: string }) {
  const hub = useHub();
  if (hub.loop.specs.some((s) => s.key === k)) return <Link to={`/work/${k}/overview`} className="font-mono text-[12px] underline decoration-line-2 underline-offset-4 hover:decoration-ink">{k}</Link>;
  const t = trackerUrl(hub, k);
  if (t) return <a href={t} target="_blank" rel="noopener" className="font-mono text-[12px] underline decoration-line-2 underline-offset-4">{k}</a>;
  return <span className="font-mono text-[12px] text-ink-2">{k}</span>;
}

function AdrLink({ id }: { id: string }) {
  const hub = useHub();
  const a = hub.manifest.adrs.find((x) => x.id === id);
  if (!a) return <span className="font-mono text-[12px] text-ink-2">{id}</span>;
  return <Link to={`/knowledge/decisions/${a.id}`} className="text-sm hover:underline"><span className="font-mono text-[12px] text-ink-3">{a.id}</span> {a.title}</Link>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  if (children === undefined || children === null || children === '' || children === false) return null;
  return <><dt className="text-ink-3">{label}</dt><dd className="min-w-0 break-words">{children}</dd></>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  if (!children) return null;
  return <div><h3 className="mb-1.5 text-xs font-semibold text-ink-3">{title}</h3>{children}</div>;
}

const has = <T,>(a?: T[]) => (a?.length ? a : undefined);

/** What any node is, what it touches, and where to read more. */
function NodeDetail({ node, idx }: { node: ArchNode; idx: ArchIndex }) {
  const { arch } = idx;
  const d = node.data;
  const rows: ReactNode[] = [];
  const related: ReactNode[] = [];
  let links: ArchLink[] | undefined;
  let open: [string, string] | undefined;

  if (node.kind === 'actor') {
    const a = d as ArchActor;
    rows.push(<Field key="k" label="Kind">{a.kind}</Field>);
    const users = (arch.containers || []).filter((c) => (c.talksTo || []).includes(a.id)).map((c) => c.id);
    related.push(<Section key="u" title="Uses or is reached by">{has(users) && <Chips ids={users} idx={idx} />}</Section>);
  } else if (node.kind === 'external') {
    const e = d as ArchExternal;
    rows.push(<Field key="k" label="Kind">{e.kind}</Field>, <Field key="r" label="Regions">{has(e.regions)?.map((r) => idx.name(r)).join(', ')}</Field>);
    const ads = (arch.adapters || []).filter((x) => x.external === e.id).map((x) => x.id);
    const callers = (arch.containers || []).filter((c) => (c.talksTo || []).includes(e.id)).map((c) => c.id);
    related.push(
      <Section key="a" title="Adapters">{has(ads) && <Chips ids={ads} idx={idx} />}</Section>,
      <Section key="c" title="Called by">{has(callers) && <Chips ids={callers} idx={idx} />}</Section>,
    );
  } else if (node.kind === 'region') {
    const r = d as ArchRegion;
    rows.push(
      <Field key="c" label="Cloud">{r.cloud}</Field>, <Field key="l" label="Location">{r.location}</Field>,
      <Field key="a" label="Account"><span className="font-mono text-[12px]">{r.account}</span></Field>,
      <Field key="s" label="Status">{r.status && <StatusLine status={r.status} />}</Field>,
    );
    const cs = (arch.containers || []).filter((c) => (c.regions || []).includes(r.id)).map((c) => c.id);
    const n = (r.layers || []).reduce((s, l) => s + (l.resources || []).length, 0);
    related.push(<Section key="c" title="Runs here">{has(cs) && <Chips ids={cs} idx={idx} />}</Section>);
    open = ['infrastructure', `See its ${n} resources in Infrastructure`];
  } else if (node.kind === 'resource') {
    const x = d as ArchResource;
    rows.push(
      <Field key="t" label="Type">{x.type}</Field>, <Field key="s" label="Stack">{x.stack}</Field>,
      <Field key="r" label="Region">{node.region && <NodeChip id={node.region} idx={idx} />}</Field>, <Field key="l" label="Layer">{node.layer}</Field>,
    );
    const on = containersOn(arch, x.id).map((c) => c.id);
    related.push(
      <Section key="n" title="Connects to">{has([...resourceNeighbours(arch, x.id)]) && <Chips ids={[...resourceNeighbours(arch, x.id)]} idx={idx} />}</Section>,
      <Section key="o" title="Containers running on it">{has(on) && <Chips ids={on} idx={idx} />}</Section>,
    );
    links = x.links;
    open = ['infrastructure', 'Open in Infrastructure'];
  } else if (node.kind === 'container') {
    const c = d as ArchContainer;
    rows.push(
      <Field key="k" label="Kind">{c.kind}</Field>, <Field key="t" label="Tech">{c.tech}</Field>,
      <Field key="r" label="Repo">{c.repo && (/^https?:/.test(c.repo) ? <Ext l={{ label: c.repo.replace(/^https?:\/\/(www\.)?/, ''), url: c.repo }} /> : <span className="font-mono text-[12px]">{c.repo}</span>)}</Field>,
      <Field key="g" label="Regions">{has(c.regions) && <Chips ids={c.regions} idx={idx} />}</Field>,
    );
    const runs = Object.entries(c.runsOn || {});
    const callers = (arch.containers || []).filter((o) => (o.talksTo || []).includes(c.id)).map((o) => o.id);
    const mods = (arch.modules || []).filter((m) => m.container === c.id).map((m) => m.id);
    related.push(
      <Section key="ro" title="Runs on">{runs.length > 0 && (
        <ul className="space-y-1 text-sm">{runs.map(([r, res]) => <li key={r}><span className="text-ink-3">{idx.name(r)}:</span> <NodeChip id={res} idx={idx} /></li>)}</ul>
      )}</Section>,
      <Section key="t" title="Talks to">{has(c.talksTo) && <Chips ids={c.talksTo} idx={idx} />}</Section>,
      <Section key="b" title="Called by">{has(callers) && <Chips ids={callers} idx={idx} />}</Section>,
      <Section key="m" title={`Modules (${mods.length})`}>{has(mods) && <Chips ids={mods} idx={idx} />}</Section>,
    );
    links = c.urls;
    open = ['application', 'Open in Application'];
  } else if (node.kind === 'module') {
    const m = d as ArchModule;
    rows.push(
      <Field key="c" label="Container">{m.container && <NodeChip id={m.container} idx={idx} />}</Field>,
      <Field key="p" label="Package"><span className="font-mono text-[12px]">{m.package}</span></Field>,
      <Field key="e" label="Endpoints">{m.endpoints?.length}</Field>,
    );
    const users = (arch.modules || []).filter((o) => (o.dependsOn || []).includes(m.id)).map((o) => o.id);
    related.push(
      <Section key="d" title="Depends on">{has(m.dependsOn) && <Chips ids={m.dependsOn} idx={idx} />}</Section>,
      <Section key="u" title="Used by">{has(users) && <Chips ids={users} idx={idx} />}</Section>,
      <Section key="a" title="Adapters">{has(m.adapters) && <Chips ids={m.adapters} idx={idx} />}</Section>,
    );
    open = ['modules', 'Open the module page'];
  } else if (node.kind === 'adapter') {
    const a = d as ArchAdapter;
    rows.push(
      <Field key="e" label="External">{a.external && <NodeChip id={a.external} idx={idx} />}</Field>,
      <Field key="m" label="Module">{a.module && <NodeChip id={a.module} idx={idx} />}</Field>,
      <Field key="r" label="Regions">{has(a.regions)?.map((r) => idx.name(r)).join(', ')}</Field>,
      <Field key="p" label="Ports">{has(a.ports)?.join(', ')}</Field>,
    );
    related.push(<Section key="c" title="Code">{has(a.code) && <CodeList paths={a.code!} />}</Section>);
  } else if (node.kind === 'flow') {
    const f = d as ArchFlow;
    related.push(<Section key="m" title="Modules">{has(f.modules) && <Chips ids={f.modules} idx={idx} />}</Section>);
    open = ['flows', 'Open the flow diagram'];
  }

  const desc = (d as { description?: string }).description;
  const route = open && (open[0] === 'modules' || open[0] === 'flows' ? nodeRoute(node, idx) : archRoute(open[0] as View, node.kind === 'region' ? undefined : node.id));
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-ink-3">{KIND_LABEL[node.kind]}</div>
        <h2 className="text-lg font-semibold leading-snug">{node.name}</h2>
        {node.name !== node.id && <div className="font-mono text-[11.5px] text-ink-3">{node.id}</div>}
      </div>
      {desc && <MarkdownText src={desc} path={DATA_PATH} className="text-sm" />}
      {rows.some(Boolean) && <dl className="grid grid-cols-[84px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">{rows}</dl>}
      {links?.length ? <Section title="Links"><Links links={links} /></Section> : null}
      {related}
      {route && <Link to={route} className="inline-block text-sm font-medium underline decoration-line-2 underline-offset-4 hover:decoration-ink">{open![1]}</Link>}
    </div>
  );
}

function CodeList({ paths }: { paths: string[] }) {
  return <ul className="space-y-0.5">{paths.map((p) => <li key={p} className="break-all font-mono text-[12px] text-ink-2">{p}</li>)}</ul>;
}

/** The side detail column; on a phone it follows the content and scrolls into view when something is picked. */
function SidePanel({ node, idx, empty, onClose }: { node?: ArchNode; idx: ArchIndex; empty: string; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!node) return;
    const t = setTimeout(() => { if (matchMedia('(max-width: 1023px)').matches) ref.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 0);
    return () => clearTimeout(t);
  }, [node?.id]);
  useEffect(() => {
    if (!node) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !(e.target as HTMLElement).closest('input, dialog')) onClose(); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [node?.id]);
  return (
    <aside ref={ref} aria-label="Details" className={cx('scroll-mt-20 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto', !node && 'hidden lg:block')}>
      <div className="rounded-lg border border-line bg-paper px-4 py-3">
        {node ? (
          <>
            <div className="-mr-1 flex justify-end"><button type="button" onClick={onClose} className="rounded px-1.5 text-xs text-ink-3 hover:bg-sunk hover:text-ink" aria-label="Close details">Close</button></div>
            <NodeDetail node={node} idx={idx} />
          </>
        ) : <p className="py-4 text-sm text-ink-3">{empty}</p>}
      </div>
    </aside>
  );
}

const WITH_SIDE = 'grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_340px]';

function RegionFilter({ regions, value, onChange }: { regions: ArchRegion[]; value: string; onChange: (v: string) => void }) {
  if (regions.length < 2) return null;
  return (
    <div className="max-w-full overflow-x-auto">
      <Segmented label="Region" value={value} onChange={onChange} options={[['', 'All regions'], ...regions.map((r) => [r.id, r.name || r.id] as [string, string])]} />
    </div>
  );
}

function useParam(name: string): [string, (v: string) => void] {
  const [params, setParams] = useSearchParams();
  return [params.get(name) || '', (v: string) => setParams((p) => { if (v) p.set(name, v); else p.delete(name); return p; }, { replace: true, ...KEEP })];
}

/* ---------- Overview: context map ---------- */

function Overview({ idx }: { idx: ArchIndex }) {
  const { arch } = idx;
  const { id } = useParams();
  const select = useSelect('overview');
  const [region, setRegion] = useParam('region');
  const regions = arch.regions || [];
  const node = idx.get(id);
  return (
    <div className="space-y-5">
      {arch.summary && <MarkdownText src={arch.summary} path={DATA_PATH} />}
      <RegionFilter regions={regions} value={region} onChange={setRegion} />
      <div className={WITH_SIDE}>
        <ContextMap idx={idx} region={region} selected={node?.id} onSelect={select} />
        <SidePanel node={node} idx={idx} onClose={() => select()} empty="Select a person, service or external system to see what it is and what it talks to." />
      </div>
    </div>
  );
}

interface Edge { a: string; b: string; d: string; from: string; to: string }

function ContextMap({ idx, region, selected, onSelect }: { idx: ArchIndex; region: string; selected?: string; onSelect: (id?: string) => void }) {
  const { arch } = idx;
  const wrap = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<string, HTMLElement>());
  const [edges, setEdges] = useState<Edge[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const regions = (arch.regions || []).filter((r) => !region || r.id === region);
  const containers = arch.containers || [];
  const unplaced = region ? [] : containers.filter((c) => !(c.regions || []).some((r) => (arch.regions || []).some((x) => x.id === r)));
  const externals = (arch.externals || []).filter((e) => !region || !e.regions?.length || e.regions.includes(region));
  const actors = arch.actors || [];

  // talksTo may name a module or resource: draw it to the container that holds it
  const shown = useMemo(() => {
    const modC = new Map((arch.modules || []).map((m) => [m.id, m.container || '']));
    return contextEdges(arch).map(([a, b]) => [modC.get(a) || a, modC.get(b) || b] as [string, string]).filter(([a, b]) => a !== b);
  }, [arch]);

  const neighbours = useMemo(() => {
    const s = new Set<string>();
    if (!selected) return s;
    s.add(selected);
    for (const [a, b] of shown) { if (a === selected) s.add(b); if (b === selected) s.add(a); }
    const sel = idx.get(selected);
    if (sel?.kind === 'region') containers.filter((c) => (c.regions || []).includes(selected)).forEach((c) => s.add(c.id));
    return s;
  }, [selected, shown]);

  const reg = (key: string) => (el: HTMLElement | null) => { if (el) els.current.set(key, el); else els.current.delete(key); };

  useLayoutEffect(() => {
    const box = wrap.current;
    if (!box) return;
    const measure = () => {
      const o = box.getBoundingClientRect();
      const inst = new Map<string, { key: string; scope: string; r: DOMRect }[]>();
      for (const [key, el] of els.current) {
        const [scope, nid] = key.split('|');
        const list = inst.get(nid) || [];
        list.push({ key, scope, r: el.getBoundingClientRect() });
        inst.set(nid, list);
      }
      const out: Edge[] = [];
      const seen = new Set<string>();
      for (const [a, b] of shown) {
        const A = inst.get(a) || [], B = inst.get(b) || [];
        for (const x of A) {
          const same = B.filter((y) => y.scope === x.scope);
          for (const y of same.length ? same : B) {
            const k = `${x.key}>${y.key}`;
            if (seen.has(k)) continue;
            seen.add(k);
            out.push({ a, b, from: x.key, to: y.key, d: curve(x.r, y.r, o) });
          }
        }
      }
      setEdges(out);
      setSize({ w: box.scrollWidth, h: box.scrollHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [region, shown, arch]);

  const dim = (nid: string) => !!selected && !neighbours.has(nid);
  const nodeBtn = (scope: string, nid: string, name: string, sub?: string, extra?: string) => (
    <button
      key={`${scope}|${nid}`} ref={reg(`${scope}|${nid}`)} type="button"
      onClick={() => onSelect(nid)} aria-pressed={selected === nid}
      className={cx(
        'relative z-[1] min-w-0 rounded-md border bg-paper px-2.5 py-1.5 text-left text-sm transition-opacity',
        selected === nid ? 'border-ink ring-2 ring-ink' : 'border-line-2 hover:border-ink-3',
        dim(nid) && 'opacity-35', extra,
      )}
    >
      <span className="block truncate font-medium">{name}</span>
      {sub && <span className="block truncate text-[11px] text-ink-3">{sub}</span>}
    </button>
  );

  return (
    <div className="min-w-0 rounded-lg border border-line bg-sunk/40 p-3 md:p-4">
      <div ref={wrap} className="relative grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(120px,1fr)_minmax(0,3fr)_minmax(120px,1fr)] md:gap-8">
        <svg aria-hidden className="pointer-events-none absolute left-0 top-0 z-0" width={size.w} height={size.h}>
          <defs>
            <marker id="arch-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 8 4 0 8z" style={{ fill: 'var(--line-2)' }} /></marker>
            <marker id="arch-arrow-on" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 8 4 0 8z" style={{ fill: 'var(--brand)' }} /></marker>
          </defs>
          {edges.map((e) => {
            const on = !!selected && (e.a === selected || e.b === selected);
            return <path key={`${e.from}>${e.to}`} d={e.d} fill="none" className={on ? undefined : 'max-md:hidden'} markerEnd={`url(#${on ? 'arch-arrow-on' : 'arch-arrow'})`}
              style={{ stroke: on ? 'var(--brand)' : 'var(--line-2)', strokeWidth: on ? 2 : 1.2, opacity: selected && !on ? 0.25 : 1 }} />;
          })}
        </svg>

        <MapColumn title="People and partners">
          {actors.length ? actors.map((a) => nodeBtn('actors', a.id, a.name || a.id, a.kind)) : <p className="text-xs text-ink-3">None listed.</p>}
        </MapColumn>

        <div className="relative z-[1] min-w-0 space-y-4">
          {regions.map((r) => {
            const cs = containers.filter((c) => (c.regions || []).includes(r.id));
            return (
              <section key={r.id} aria-label={r.name || r.id} className={cx('rounded-lg border border-dashed bg-paper/70 p-3 transition-opacity', selected === r.id ? 'border-ink' : 'border-line-2', dim(r.id) && !cs.some((c) => neighbours.has(c.id)) && 'opacity-50')}>
                <button type="button" onClick={() => onSelect(r.id)} aria-pressed={selected === r.id} className="mb-2 flex w-full flex-wrap items-center gap-2 text-left">
                  <span className="text-sm font-semibold hover:underline">{r.name || r.id}</span>
                  <span className="text-xs text-ink-3">{[r.cloud, r.location].filter(Boolean).join(' · ')}</span>
                  {r.status && <StatusLine status={r.status} className="basis-full" />}
                </button>
                {cs.length ? (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
                    {cs.map((c) => nodeBtn(r.id, c.id, c.name || c.id, [c.kind, c.tech].filter(Boolean).join(' · ')))}
                  </div>
                ) : <p className="text-xs text-ink-3">No containers placed here.</p>}
              </section>
            );
          })}
          {unplaced.length > 0 && (
            <section aria-label="Not tied to a region" className="rounded-lg border border-dashed border-line-2 bg-paper/70 p-3">
              <div className="mb-2 text-sm font-semibold">Not tied to a region</div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
                {unplaced.map((c) => nodeBtn('free', c.id, c.name || c.id, [c.kind, c.tech].filter(Boolean).join(' · ')))}
              </div>
            </section>
          )}
          {!regions.length && !unplaced.length && <p className="text-sm text-ink-3">No regions or containers listed.</p>}
        </div>

        <MapColumn title="External systems">
          {externals.length ? externals.map((e) => nodeBtn('ext', e.id, e.name || e.id, e.kind)) : <p className="text-xs text-ink-3">None listed.</p>}
        </MapColumn>
      </div>
      <p className="mt-3 text-xs text-ink-3">Lines show who calls whom ({shown.length} links; on a phone only the picked box's lines show). Pick any box for details; press Escape to clear.</p>
    </div>
  );
}

function MapColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="relative z-[1] flex min-w-0 flex-col gap-2 md:justify-center">
      <h3 className="text-xs font-semibold text-ink-3">{title}</h3>
      <div className="flex flex-wrap gap-2 md:flex-col md:flex-nowrap">{children}</div>
    </div>
  );
}

function curve(a: DOMRect, b: DOMRect, o: DOMRect): string {
  const ax = a.left + a.width / 2 - o.left, ay = a.top + a.height / 2 - o.top;
  const bx = b.left + b.width / 2 - o.left, by = b.top + b.height / 2 - o.top;
  const dx = bx - ax, dy = by - ay;
  if (Math.abs(dx) > Math.abs(dy)) {
    const sx = dx > 0 ? ax + a.width / 2 : ax - a.width / 2, ex = dx > 0 ? bx - b.width / 2 : bx + b.width / 2;
    const m = (ex - sx) / 2;
    return `M${sx},${ay} C${sx + m},${ay} ${ex - m},${by} ${ex},${by}`;
  }
  const sy = dy > 0 ? ay + a.height / 2 : ay - a.height / 2, ey = dy > 0 ? by - b.height / 2 : by + b.height / 2;
  const m = (ey - sy) / 2;
  return `M${ax},${sy} C${ax},${sy + m} ${bx},${ey - m} ${bx},${ey}`;
}

/* ---------- Infrastructure ---------- */

function Infrastructure({ idx }: { idx: ArchIndex }) {
  const { arch } = idx;
  const { id } = useParams();
  const select = useSelect('infrastructure');
  const [mode, setMode] = useParam('mode');
  const regions = arch.regions || [];
  const node = idx.get(id);
  const sel = node?.kind === 'resource' ? node.id : undefined;
  const near = useMemo(() => (sel ? resourceNeighbours(arch, sel) : new Set<string>()), [sel, arch]);
  if (!regions.length) return <Empty>No regions in {DATA_PATH}.</Empty>;

  const card = (x: ArchResource) => (
    <ResourceCard key={x.id} x={x} running={containersOn(arch, x.id)} selected={sel === x.id} near={near.has(x.id)} dim={!!sel && sel !== x.id && !near.has(x.id)} onClick={() => select(x.id)} />
  );
  const layerKey = (l: { id?: string; name?: string }) => (l.name || l.id || '').trim().toLowerCase();
  const layerOrder: { key: string; name: string }[] = [];
  for (const r of regions) for (const l of r.layers || []) {
    const k = layerKey(l);
    if (!layerOrder.some((x) => x.key === k)) layerOrder.push({ key: k, name: l.name || l.id || 'Layer' });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented label="Layout" value={mode === 'compare' ? 'compare' : 'side'} onChange={(v) => setMode(v === 'compare' ? 'compare' : '')}
          options={[['side', 'Regions side by side'], ['compare', 'Compare layer by layer']]} />
        {sel && <span className="text-xs text-ink-3">Highlighted: what {node!.name} connects to.</span>}
      </div>
      <div className={WITH_SIDE}>
        {mode === 'compare' ? (
          <div className="min-w-0 space-y-4">
            {layerOrder.map((L) => (
              <section key={L.key} className="rounded-lg border border-line bg-paper">
                <h3 className="border-b border-line px-4 py-2 text-sm font-semibold">{L.name}</h3>
                <div className="grid gap-4 p-3 md:[grid-template-columns:repeat(var(--n),minmax(0,1fr))]" style={{ ['--n' as string]: regions.length }}>
                  {regions.map((r) => {
                    const res = (r.layers || []).filter((l) => layerKey(l) === L.key).flatMap((l) => l.resources || []);
                    return (
                      <div key={r.id} className="min-w-0">
                        <div className="mb-1.5 text-xs font-medium text-ink-3">{r.name || r.id}</div>
                        <div className="space-y-2">{res.length ? res.map(card) : <p className="rounded-md border border-dashed border-line-2 px-2 py-2 text-xs text-ink-3">Nothing in this layer.</p>}</div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 md:[grid-template-columns:repeat(var(--n),minmax(0,1fr))]" style={{ ['--n' as string]: Math.min(regions.length, 3) }}>
            {regions.map((r) => (
              <section key={r.id} aria-label={r.name || r.id} className="min-w-0 rounded-lg border border-line bg-paper">
                <header className="border-b border-line px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">{r.name || r.id}</h3>
                    {r.status && <StatusLine status={r.status} className="basis-full" />}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-3">{[r.cloud, r.location, r.account && `account ${r.account}`].filter(Boolean).join(' · ')}</div>
                  {r.description && <p className="mt-1.5 text-xs text-ink-2">{r.description}</p>}
                </header>
                <div className="space-y-3 p-3">
                  {(r.layers || []).map((l, i) => (
                    <div key={l.id || i}>
                      <div className="mb-1.5 text-xs font-medium text-ink-3">{l.name || l.id}</div>
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2">{(l.resources || []).map(card)}</div>
                    </div>
                  ))}
                  {!r.layers?.length && <p className="text-xs text-ink-3">No layers listed.</p>}
                </div>
              </section>
            ))}
          </div>
        )}
        <SidePanel node={sel ? node : undefined} idx={idx} onClose={() => select()} empty="Select a resource to see its type, stack, links, what runs on it and what it connects to." />
      </div>
    </div>
  );
}

function ResourceCard({ x, running, selected, near, dim, onClick }: { x: ArchResource; running: ArchContainer[]; selected: boolean; near: boolean; dim: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      className={cx(
        'block w-full min-w-0 rounded-md border bg-paper px-2.5 py-2 text-left transition-opacity',
        selected ? 'border-ink ring-2 ring-ink' : near ? 'border-brand ring-1 ring-brand' : 'border-line-2 hover:border-ink-3',
        dim && 'opacity-40',
      )}>
      <span className="block truncate text-sm font-medium">{x.name || x.id}</span>
      <span className="block truncate text-[11px] text-ink-3">{[x.type, x.stack].filter(Boolean).join(' · ')}</span>
      {running.length > 0 && <span className="mt-1 block truncate text-[11px] text-ink-2">runs {running.map((c) => c.name || c.id).join(', ')}</span>}
    </button>
  );
}

/* ---------- Application ---------- */

const KIND_ORDER = ['service', 'web', 'console', 'mobile', 'job', 'simulator', 'hub'];
const KIND_TITLE: Record<string, string> = { service: 'Services', web: 'Web apps', console: 'Consoles', mobile: 'Mobile apps', job: 'Jobs', simulator: 'Simulators', hub: 'Hubs' };

function Application({ idx }: { idx: ArchIndex }) {
  const { arch } = idx;
  const { id } = useParams();
  const select = useSelect('application');
  const containers = arch.containers || [];
  const node = idx.get(id);
  const modsOf = (c: string) => (arch.modules || []).filter((m) => m.container === c);
  const core = containers.reduce<ArchContainer | undefined>((best, c) => (modsOf(c.id).length > (best ? modsOf(best.id).length : 0) ? c : best), undefined);
  const kinds = [...new Set(containers.map((c) => c.kind || 'other'))].sort((a, b) => (KIND_ORDER.indexOf(a) + 1 || 99) - (KIND_ORDER.indexOf(b) + 1 || 99));
  if (!containers.length) return <Empty>No containers in {DATA_PATH}.</Empty>;
  return (
    <div className={WITH_SIDE}>
      <div className="min-w-0 space-y-6">
        {kinds.map((k) => {
          const list = containers.filter((c) => (c.kind || 'other') === k);
          return (
            <section key={k} aria-label={KIND_TITLE[k] || k}>
              <h3 className="mb-2 text-sm font-semibold">{KIND_TITLE[k] || k.charAt(0).toUpperCase() + k.slice(1)} <span className="font-normal text-ink-3">{list.length}</span></h3>
              <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((c) => (
                  <ContainerCard key={c.id} c={c} idx={idx} mods={modsOf(c.id)} core={core?.id === c.id} selected={node?.id === c.id} onSelect={() => select(c.id)} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <SidePanel node={node} idx={idx} onClose={() => select()} empty="Select a container to see where it runs, what it talks to and its modules." />
    </div>
  );
}

function ContainerCard({ c, idx, mods, core, selected, onSelect }: { c: ArchContainer; idx: ArchIndex; mods: ArchModule[]; core: boolean; selected: boolean; onSelect: () => void }) {
  const [open, setOpen] = useState(core || selected);
  useEffect(() => { if (selected) setOpen(true); }, [selected]);
  return (
    <article className={cx('flex min-w-0 flex-col rounded-lg border bg-paper', selected ? 'border-ink ring-2 ring-ink' : 'border-line')}>
      <div className="flex-1 px-4 py-3">
        <button type="button" onClick={onSelect} aria-pressed={selected} className="block w-full text-left">
          <span className="block font-semibold hover:underline">{c.name || c.id}</span>
          {c.tech && <span className="block text-xs text-ink-3">{c.tech}</span>}
        </button>
        {!!c.regions?.length && <div className="mt-2 flex flex-wrap gap-1">{c.regions.map((r) => <Pill key={r}>{idx.name(r)}</Pill>)}</div>}
        {c.description && <p className="mt-2 line-clamp-3 text-sm text-ink-2">{c.description}</p>}
        {c.repo && <div className="mt-2 truncate font-mono text-[11.5px] text-ink-3" title={c.repo}>{c.repo}</div>}
        {!!c.urls?.length && <div className="mt-2 text-xs"><Links links={c.urls} /></div>}
      </div>
      {mods.length > 0 && (
        <div className="border-t border-line">
          <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-2 text-left text-xs text-ink-2 hover:bg-sunk">
            <span>{mods.length} {mods.length === 1 ? 'module' : 'modules'}</span><span aria-hidden>{open ? '−' : '+'}</span>
          </button>
          {open && (
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-1 px-4 pb-3 sm:grid-cols-2">
              {mods.map((m) => (
                <li key={m.id}><Link to={archRoute('modules', m.id)} className="block truncate text-sm hover:underline" title={m.description || m.name}>{m.name || m.id}</Link></li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}

/* ---------- Modules ---------- */

function Modules({ idx }: { idx: ArchIndex }) {
  const { arch } = idx;
  const mods = arch.modules || [];
  const [q, setQ] = useParam('q');
  const [focus, setFocus] = useParam('focus');
  const match = (m: ArchModule) => {
    const t = [m.name, m.id, m.package, m.container, m.description, ...(m.endpoints || []).map((e) => e.path), ...(m.tables || [])].join(' ').toLowerCase();
    return q.trim().toLowerCase().split(/\s+/).every((w) => t.includes(w));
  };
  const shown = mods.filter(match);
  const groups = [...new Set(shown.map((m) => m.container || ''))];
  const node = idx.get(focus);
  if (!mods.length) return <Empty>No modules in {DATA_PATH}.</Empty>;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="w-full sm:w-80">
          <span className="sr-only">Filter modules</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter modules by name, package, endpoint, table" className="h-8 w-full rounded-md border border-line-2 bg-paper px-2.5 text-sm" />
        </label>
        <span className="text-xs text-ink-3">{shown.length} of {mods.length}</span>
      </div>
      <div className={WITH_SIDE}>
        <div className="min-w-0 space-y-5">
          <Panel title="Dependencies" action={<span className="text-xs text-ink-3">Arrows point at what a module depends on</span>}>
            <ModuleGraph mods={mods} matched={q ? new Set(shown.map((m) => m.id)) : undefined} focus={node?.kind === 'module' ? node.id : undefined} onFocus={(i) => setFocus(i === focus ? '' : i)} />
          </Panel>
          <div className="space-y-4">
            {groups.map((g) => (
              <section key={g} aria-label={g ? idx.name(g) : 'No container'}>
                <h3 className="mb-1.5 text-xs font-semibold text-ink-3">{g ? idx.name(g) : 'No container'}</h3>
                <ul className="divide-y divide-line rounded-lg border border-line bg-paper">
                  {shown.filter((m) => (m.container || '') === g).map((m) => (
                    <li key={m.id} className="flex items-start gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <Link to={archRoute('modules', m.id)} className="font-medium hover:underline">{m.name || m.id}</Link>
                        {m.package && <span className="ml-2 font-mono text-[11.5px] text-ink-3">{m.package}</span>}
                        {m.description && <p className="line-clamp-2 text-sm text-ink-2">{m.description}</p>}
                      </div>
                      <div className="hidden shrink-0 gap-1 sm:flex">
                        {!!m.endpoints?.length && <Pill>{m.endpoints.length} endpoints</Pill>}
                        {!!m.dependsOn?.length && <Pill>{m.dependsOn.length} {m.dependsOn.length === 1 ? 'dependency' : 'dependencies'}</Pill>}
                      </div>
                      <button type="button" onClick={() => setFocus(m.id)} className="shrink-0 rounded px-1.5 text-xs text-ink-3 hover:bg-sunk hover:text-ink" aria-label={`Show ${m.name || m.id} in the graph`}>Graph</button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {!shown.length && <Empty>No module matches.</Empty>}
          </div>
        </div>
        <SidePanel node={node?.kind === 'module' ? node : undefined} idx={idx} onClose={() => setFocus('')} empty="Pick a module in the graph to see its neighbours; open it for endpoints, tables and events." />
      </div>
    </div>
  );
}

const NW = 168, NH = 34, CG = 64, RG = 12, PAD = 12, TOP = 48;

function ModuleGraph({ mods, matched, focus, onFocus }: { mods: ArchModule[]; matched?: Set<string>; focus?: string; onFocus: (id: string) => void }) {
  const layout = useMemo(() => {
    const ids = new Set(mods.map((m) => m.id));
    const deps = new Map(mods.map((m) => [m.id, (m.dependsOn || []).filter((d) => ids.has(d) && d !== m.id)]));
    const depth = new Map<string, number>();
    const visiting = new Set<string>();
    const dfs = (id: string): number => {
      if (depth.has(id)) return depth.get(id)!;
      if (visiting.has(id)) return 0;
      visiting.add(id);
      const d = Math.max(-1, ...deps.get(id)!.map(dfs)) + 1;
      visiting.delete(id);
      depth.set(id, d);
      return d;
    };
    mods.forEach((m) => dfs(m.id));
    const max = Math.max(0, ...depth.values());
    const cols: string[][] = Array.from({ length: max + 1 }, () => []);
    mods.forEach((m) => cols[max - depth.get(m.id)!].push(m.id));
    const users = new Map<string, string[]>();
    for (const [a, ds] of deps) for (const d of ds) users.set(d, [...(users.get(d) || []), a]);
    const pos = new Map<string, number>();
    cols.forEach((c) => c.forEach((id, i) => pos.set(id, i)));
    for (let pass = 0; pass < 4; pass++) {
      for (const c of cols) {
        const bary = (id: string) => { const n = [...deps.get(id)!, ...(users.get(id) || [])].map((x) => pos.get(x)!); return n.length ? n.reduce((s, v) => s + v, 0) / n.length : pos.get(id)!; };
        c.sort((a, b) => bary(a) - bary(b));
        c.forEach((id, i) => pos.set(id, i));
      }
    }
    const rows = Math.max(...cols.map((c) => c.length));
    const xy = new Map<string, { x: number; y: number }>();
    cols.forEach((c, ci) => c.forEach((id, ri) => xy.set(id, { x: PAD + ci * (NW + CG), y: TOP + (ri + (rows - c.length) / 2) * (NH + RG) })));
    const edges = [...deps].flatMap(([a, ds]) => ds.map((d) => [a, d] as [string, string]));
    return { xy, edges, w: PAD * 2 + cols.length * NW + (cols.length - 1) * CG, h: TOP + PAD + rows * NH + (rows - 1) * RG };
  }, [mods]);

  const near = useMemo(() => {
    const s = new Set<string>();
    if (!focus) return s;
    s.add(focus);
    for (const [a, b] of layout.edges) { if (a === focus) s.add(b); if (b === focus) s.add(a); }
    return s;
  }, [focus, layout]);
  const name = new Map(mods.map((m) => [m.id, m.name || m.id]));
  const lit = (id: string) => (focus ? near.has(id) : !matched || matched.has(id));

  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <svg viewBox={`0 0 ${layout.w} ${layout.h}`} width="100%" style={{ maxWidth: layout.w, minWidth: Math.min(layout.w, 640) }} role="group" aria-label="Module dependency graph" className="block h-auto">
        <defs>
          <marker id="mod-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 8 4 0 8z" style={{ fill: 'var(--line-2)' }} /></marker>
          <marker id="mod-arrow-on" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 8 4 0 8z" style={{ fill: 'var(--brand)' }} /></marker>
        </defs>
        {layout.edges.map(([a, b]) => {
          const p = layout.xy.get(a)!, q = layout.xy.get(b)!;
          const on = !!focus && (a === focus || b === focus);
          const fwd = q.x > p.x;
          const sx = fwd ? p.x + NW : p.x, ex = fwd ? q.x : q.x + NW;
          const sy = p.y + NH / 2, ey = q.y + NH / 2;
          const m = Math.max(24, Math.abs(ex - sx) / 2) * (fwd ? 1 : -1);
          const span = Math.round(Math.abs(q.x - p.x) / (NW + CG));
          // an edge that skips a column arcs over the boxes between instead of running behind them
          const lift = span > 1 ? Math.min(sy, ey) - NH / 2 - 14 - 6 * Math.min(span, 4) : 0;
          const d = span > 1
            ? `M${sx},${sy - NH / 4} C${sx + m / 3},${lift} ${ex - m / 3},${lift} ${ex},${ey - NH / 4}`
            : `M${sx},${sy} C${sx + m},${sy} ${ex - m},${ey} ${ex},${ey}`;
          return <path key={`${a}>${b}`} d={d} fill="none" markerEnd={`url(#${on ? 'mod-arrow-on' : 'mod-arrow'})`}
            style={{ stroke: on ? 'var(--brand)' : 'var(--line-2)', strokeWidth: on ? 2 : 1, opacity: focus && !on ? 0.2 : 1 }} />;
        })}
        {mods.map((m) => {
          const p = layout.xy.get(m.id)!;
          const n = name.get(m.id)!;
          return (
            <g key={m.id} transform={`translate(${p.x},${p.y})`} role="button" tabIndex={0} aria-pressed={focus === m.id} aria-label={n}
              onClick={() => onFocus(m.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFocus(m.id); } }}
              className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-[3]" style={{ opacity: lit(m.id) ? 1 : 0.3 }}>
              <title>{n}{m.package ? ` (${m.package})` : ''}</title>
              <rect width={NW} height={NH} rx={6} style={{ fill: focus === m.id ? 'var(--ink)' : 'var(--paper)', stroke: focus === m.id ? 'var(--ink)' : near.has(m.id) ? 'var(--brand)' : 'var(--line-2)' }} strokeWidth={near.has(m.id) && focus !== m.id ? 2 : 1} />
              <text x={10} y={NH / 2 + 4} style={{ fill: focus === m.id ? 'var(--paper)' : 'var(--ink)', fontSize: 12.5 }}>{n.length > 22 ? n.slice(0, 21) + '…' : n}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ---------- Module page ---------- */

function ModulePage({ idx, id }: { idx: ArchIndex; id: string }) {
  const { arch } = idx;
  const loc = useLocation();
  const [ep, setEp] = useParam('ep');
  const [method, setMethod] = useParam('method');
  const m = (arch.modules || []).find((x) => x.id === id);
  useEffect(() => {
    if (!loc.hash) return;
    const t = setTimeout(() => document.getElementById(decodeURIComponent(loc.hash.slice(1)))?.scrollIntoView({ block: 'start' }), 0);
    return () => clearTimeout(t);
  }, [loc.hash, id]);
  const crumb = <><Link to={archRoute('overview')} className="hover:underline">Architecture</Link> / <Link to={archRoute('modules')} className="hover:underline">Modules</Link></>;
  if (!m) return <div><PageHeader crumb={crumb} title={id} /><Empty>No module {id} in {DATA_PATH}.</Empty></div>;

  const users = (arch.modules || []).filter((o) => (o.dependsOn || []).includes(m.id));
  const flows = (arch.flows || []).filter((f) => (f.modules || []).includes(m.id));
  const adapters = (m.adapters || []).map((a) => (arch.adapters || []).find((x) => x.id === a) || { id: a } as ArchAdapter)
    .concat((arch.adapters || []).filter((x) => x.module === m.id && !(m.adapters || []).includes(x.id)));
  const eps = m.endpoints || [];
  const methods = [...new Set(eps.map((e) => (e.method || '').toUpperCase()).filter(Boolean))];
  const shownEps = eps.filter((e) => (!method || (e.method || '').toUpperCase() === method) && (!ep || `${e.method} ${e.path} ${e.summary}`.toLowerCase().includes(ep.toLowerCase())));
  const pub = m.events?.publishes || [], con = m.events?.consumes || [];

  return (
    <div>
      <PageHeader crumb={crumb} title={m.name || m.id}
        lede={<span className="flex flex-wrap items-center gap-2 text-sm">
          {m.container && <NodeChip id={m.container} idx={idx} />}
          {m.package && <span className="font-mono text-[12px] text-ink-3">{m.package}</span>}
        </span>}
        actions={<ArchSearch idx={idx} />} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          {m.description && <MarkdownText src={m.description} path={DATA_PATH} />}
          <Panel title={`Endpoints${eps.length ? ` (${eps.length})` : ''}`}>
            {eps.length ? (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {methods.length > 1 && <Segmented label="Method" value={method} onChange={setMethod} options={[['', 'All'], ...methods.map((x) => [x, x] as [string, string])]} />}
                  <label className="min-w-0 flex-1 sm:max-w-xs">
                    <span className="sr-only">Filter endpoints</span>
                    <input type="search" value={ep} onChange={(e) => setEp(e.target.value)} placeholder="Filter endpoints" className="h-8 w-full rounded-md border border-line-2 bg-paper px-2.5 text-sm" />
                  </label>
                  <span className="text-xs text-ink-3">{shownEps.length} of {eps.length}</span>
                </div>
                <div className="-mx-4 overflow-x-auto px-4">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead><tr className="border-b border-line text-left text-xs text-ink-3"><th className="py-1.5 pr-3 font-medium">Method</th><th className="py-1.5 pr-3 font-medium">Path</th><th className="py-1.5 font-medium">What it does</th></tr></thead>
                    <tbody>
                      {shownEps.map((e, i) => (
                        <tr key={i} className="border-b border-line last:border-0 align-top">
                          <td className="py-1.5 pr-3 font-mono text-[12px] font-semibold">{(e.method || '').toUpperCase()}</td>
                          <td className="break-all py-1.5 pr-3 font-mono text-[12px]">{e.path}</td>
                          <td className="py-1.5 text-ink-2">{e.summary}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!shownEps.length && <p className="text-sm text-ink-3">No endpoint matches.</p>}
              </>
            ) : <p className="text-sm text-ink-3">No endpoints listed.</p>}
          </Panel>
          {(!!m.tables?.length || pub.length > 0 || con.length > 0) && (
            <div className="grid gap-6 sm:grid-cols-2">
              {!!m.tables?.length && (
                <Panel title={`Tables (${m.tables.length})`}>
                  <ul className="flex flex-wrap gap-1.5">{m.tables.map((t) => <li key={t}><Pill className="font-mono">{t}</Pill></li>)}</ul>
                </Panel>
              )}
              {(pub.length > 0 || con.length > 0) && (
                <Panel title="Events">
                  <div className="space-y-3">
                    <Section title="Publishes">{pub.length > 0 && <ul className="flex flex-wrap gap-1.5">{pub.map((t) => <li key={t}><Pill className="font-mono">{t}</Pill></li>)}</ul>}</Section>
                    <Section title="Consumes">{con.length > 0 && <ul className="flex flex-wrap gap-1.5">{con.map((t) => <li key={t}><Pill className="font-mono">{t}</Pill></li>)}</ul>}</Section>
                  </div>
                </Panel>
              )}
            </div>
          )}
          {adapters.length > 0 && (
            <Panel title={`Adapters (${adapters.length})`}>
              <ul className="space-y-4">
                {adapters.map((a) => (
                  <li key={a.id} id={`adapter-${a.id}`} className="scroll-mt-20">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{a.name || a.id}</span>
                      {a.external && <NodeChip id={a.external} idx={idx} />}
                      {a.regions?.map((r) => <Pill key={r}>{idx.name(r)}</Pill>)}
                    </div>
                    {a.description && <p className="mt-1 text-sm text-ink-2">{a.description}</p>}
                    {!!a.ports?.length && <div className="mt-1 text-xs text-ink-3">Ports: <span className="font-mono">{a.ports.join(', ')}</span></div>}
                    {!!a.code?.length && <div className="mt-1"><CodeList paths={a.code} /></div>}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {flows.length > 0 && (
            <Panel title="Flows through this module">
              <ul className="space-y-1">{flows.map((f) => <li key={f.id}><Link to={archRoute('flows', f.id)} className="text-sm hover:underline">{f.title || f.id}</Link></li>)}</ul>
            </Panel>
          )}
        </div>
        <div className="min-w-0 space-y-6">
          <Panel title="Related">
            <div className="space-y-4">
              <Section title="Depends on">{has(m.dependsOn) ? <Chips ids={m.dependsOn} idx={idx} /> : <p className="text-sm text-ink-3">Nothing.</p>}</Section>
              <Section title="Used by">{users.length ? <Chips ids={users.map((u) => u.id)} idx={idx} /> : <p className="text-sm text-ink-3">Nothing.</p>}</Section>
              <Link to={`${archRoute('modules')}?focus=${encodeURIComponent(m.id)}`} className="inline-block text-xs underline decoration-line-2 underline-offset-4">Show in the dependency graph</Link>
            </div>
          </Panel>
          {!!m.workItems?.length && (
            <Panel title="Work items">
              <ul className="flex flex-wrap gap-x-3 gap-y-1">{m.workItems.map((k) => <li key={k}><WorkLink k={k} /></li>)}</ul>
            </Panel>
          )}
          {!!m.adrs?.length && (
            <Panel title="Decisions">
              <ul className="space-y-1">{m.adrs.map((a) => <li key={a}><AdrLink id={a} /></li>)}</ul>
            </Panel>
          )}
          {!!m.code?.length && <Panel title="Code"><CodeList paths={m.code} /></Panel>}
        </div>
      </div>
    </div>
  );
}

/* ---------- Flows ---------- */

const fence = (src: string) => '```mermaid\n' + src.replace(/^\s*```(?:mermaid)?\s*\n?/, '').replace(/\n?```\s*$/, '') + '\n```';

function Flows({ idx }: { idx: ArchIndex }) {
  const flows = idx.arch.flows || [];
  const { id } = useParams();
  const [q, setQ] = useState('');
  if (!flows.length) return <Empty>No flows in {DATA_PATH}.</Empty>;
  const f = flows.find((x) => x.id === id) || flows[0];
  const shown = flows.filter((x) => !q.trim() || `${x.title} ${x.id} ${x.description}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <nav aria-label="Flows" className="lg:sticky lg:top-20 lg:self-start">
        {flows.length > 8 && <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a flow" aria-label="Find a flow" className="mb-2 h-8 w-full rounded-md border border-line-2 bg-paper px-2.5 text-sm" />}
        <ul className="max-h-60 space-y-0.5 overflow-y-auto lg:max-h-[calc(100dvh-9rem)]">
          {shown.map((x) => (
            <li key={x.id}>
              <Link to={archRoute('flows', x.id)} state={KEEP.state} replace aria-current={x.id === f.id ? 'page' : undefined}
                className={cx('block rounded-md px-3 py-1.5 text-sm', x.id === f.id ? 'bg-ink font-medium text-paper' : 'text-ink-2 hover:bg-sunk hover:text-ink')}>
                {x.title || x.id}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <article className="min-w-0 space-y-4" aria-label={f.title || f.id}>
        <h2 className="text-lg font-semibold">{f.title || f.id}</h2>
        {f.description && <MarkdownText src={f.description} path={DATA_PATH} />}
        {f.mermaid ? <div className="overflow-x-auto"><MarkdownText key={f.id} src={fence(f.mermaid)} path={DATA_PATH} wide /></div> : <p className="text-sm text-ink-3">No diagram for this flow.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          {!!f.modules?.length && <Panel title="Modules"><Chips ids={f.modules} idx={idx} /></Panel>}
          {!!f.workItems?.length && <Panel title="Work items"><ul className="flex flex-wrap gap-x-3 gap-y-1">{f.workItems.map((k) => <li key={k}><WorkLink k={k} /></li>)}</ul></Panel>}
        </div>
      </article>
    </div>
  );
}

/** On a work item: the modules that list it. */
export function WorkArchitecture({ workKey }: { workKey: string }) {
  const hub = useHub();
  const arch = archOf(hub);
  const mods = (arch?.modules || []).filter((m) => (m.workItems || []).includes(workKey));
  const flows = (arch?.flows || []).filter((f) => (f.workItems || []).includes(workKey));
  if (!mods.length && !flows.length) return null;
  return (
    <Panel title="Architecture" action={<Link to={archRoute('modules')} className="text-xs underline">All modules</Link>}>
      <ul className="space-y-1.5">
        {mods.map((m) => (
          <li key={m.id} className="text-sm">
            <Link to={archRoute('modules', m.id)} className="font-medium hover:underline">{m.name || m.id}</Link>
            {m.container && <span className="text-ink-3"> in {(arch!.containers || []).find((c) => c.id === m.container)?.name || m.container}</span>}
          </li>
        ))}
        {flows.map((f) => (
          <li key={f.id} className="text-sm"><Link to={archRoute('flows', f.id)} className="hover:underline">Flow: {f.title || f.id}</Link></li>
        ))}
      </ul>
    </Panel>
  );
}

