import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { useHub, type Hub, type NavItem } from '../lib/data';
import { legacyRoute } from '../lib/routes';
import { renderInline } from '../lib/markdown';
import { MarkdownFile } from '../components/Markdown';
import { CopyButton, cx, Empty, fmtDate, PageHeader, Panel, Pill } from '../components/ui';

const V4 = import.meta.env.VITE_V4_URL as string | undefined;

function target(item: NavItem, hub: Hub): { to?: string; href?: string } {
  if (/^https?:/.test(item.route)) return { href: item.route };
  const mapped = legacyRoute(item.route.replace(/^#/, ''), hub);
  if (mapped && mapped !== '/knowledge/archive') return { to: mapped };
  return V4 ? { href: `${V4}${item.route}` } : {};
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
  return <div className={cx(cls, 'opacity-60')}>{body}<div className="text-xs text-ink-3">Only in the v4 hub</div></div>;
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

function HowWeWork() {
  const { manifest } = useHub();
  const c = manifest.loopConfig;
  const start = c.start as { title: string; lede: string; steps: { title: string; where?: string; text?: string[]; commands?: { cmd: string; note?: string }[] }[] } | undefined;
  return (
    <div>
      <PageHeader crumb={<Link to="/knowledge" className="hover:underline">Knowledge</Link>} title="How we work" lede={c.lede} />
      <h2 className="mb-3 text-lg font-semibold">The loop</h2>
      <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {(c.phases || []).map((p, i) => (
          <li key={p.key} className="rounded-lg border border-line bg-paper px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold"><span className="mr-1.5 tabular-nums text-ink-3">{i + 1}</span>{p.title}</span>
              <code className="font-mono text-[11.5px] text-ink-2">{p.command}</code>
            </div>
            <p className="mt-1.5 text-sm text-ink-2 text-pretty" dangerouslySetInnerHTML={{ __html: renderInline(p.does) }} />
            {p.gate && <p className="mt-2 text-xs"><span className="font-medium">Gate:</span> <span className="text-ink-2">{p.gate}</span></p>}
          </li>
        ))}
      </ol>

      {!!c.intake?.length && (
        <>
          <h2 className="mb-3 mt-10 text-lg font-semibold">Where work comes from</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {c.intake.map((e) => (
              <Panel key={e.key} title={e.title}>
                <p className="text-sm text-ink-2">{e.what}</p>
                <div className="mt-2"><CopyButton text={e.command} /></div>
                <p className="mt-2 text-xs text-ink-3">{e.via}</p>
              </Panel>
            ))}
          </div>
        </>
      )}

      {start && (
        <>
          <h2 id="start" className="mb-1 mt-10 scroll-mt-20 text-lg font-semibold">{start.title}</h2>
          <p className="mb-4 max-w-3xl text-sm text-ink-2">{start.lede}</p>
          <StartForm />
          <ol className="mt-6 space-y-4">
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
        </>
      )}
    </div>
  );
}

const KINDS: [string, string, string][] = [
  ['jira', 'Jira ticket', 'Jira key, e.g. TELCO-2513'],
  ['idea', 'Idea', 'One or two sentences'],
  ['github-issue', 'GitHub issue', 'BeyondOneGroup/<repo>#<n>'],
  ['pr', 'Pull request', 'BeyondOneGroup/<repo>#<n>'],
];

function StartForm() {
  const [kind, setKind] = useState('jira');
  const [key, setKey] = useState('');
  const [slug, setSlug] = useState('');
  const [src, setSrc] = useState('');
  const k = key.trim().toUpperCase() || '<KEY>';
  const s = slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || '<short-name>';
  const source = kind === 'jira' ? (src.trim() || k) : kind === 'idea' ? `"${src.trim() || '<the idea>'}"` : (src.trim() || 'BeyondOneGroup/<repo>#<n>');
  const cmds = kind === 'pr'
    ? [`/pr-review ${source}`]
    : [`/intent ${k} ${s} ${source}`, `/gap ${k} all`, `python3 tools/spec.py approve ${k} intent --by "<your name>"`, `/spec ${k}`];
  const field = 'mt-1 h-9 w-full rounded-md border border-line-2 bg-canvas px-2.5 text-sm';
  return (
    <form className="rounded-lg border border-line bg-paper p-4" onSubmit={(e) => e.preventDefault()}>
      <div className="grid gap-3 md:grid-cols-[180px_160px_minmax(0,1fr)]">
        <label className="text-xs font-medium">Comes from
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={field}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </label>
        {kind !== 'pr' && <label className="text-xs font-medium">Work key<input value={key} onChange={(e) => setKey(e.target.value)} placeholder="PROJ-123" className={field} /></label>}
        {kind !== 'pr' && <label className="text-xs font-medium">Short name<input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="promissory-cap" className={field} /></label>}
        <label className="text-xs font-medium md:col-span-3">Source
          <input value={src} onChange={(e) => setSrc(e.target.value)} placeholder={KINDS.find(([v]) => v === kind)![2]} className={field} />
        </label>
      </div>
      <ol className="mt-4 space-y-1.5">
        {cmds.map((c, i) => <li key={i} className="flex items-center gap-2"><span className="w-4 text-xs tabular-nums text-ink-3">{i + 1}</span><CopyButton text={c} className="max-w-full [&_code]:truncate" /></li>)}
      </ol>
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
            <Link to={`/knowledge/decisions/${a.id}`} className="grid gap-x-4 gap-y-1 px-4 py-3 hover:bg-canvas md:grid-cols-[88px_minmax(0,1fr)_120px]">
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
      {file ? <MarkdownFile path={file.startsWith('content/') ? file : `content/kb-src/${file}`} /> : <p className="max-w-3xl" dangerouslySetInnerHTML={{ __html: renderInline(a.summary) }} />}
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
            <Link to={`/doc/${k.path}`} className="grid gap-x-4 px-4 py-2.5 hover:bg-canvas md:grid-cols-[minmax(0,1fr)_200px]">
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
