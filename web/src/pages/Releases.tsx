import { Fragment, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useHub, type Hub } from '../lib/data';
import { renderInline } from '../lib/markdown';
import { buildEntries, featureByTicket, liveNow, releaseRoute, releasesFor, releasesOf, ticketRoute, type Release } from '../lib/releases';
import { Empty, fmtDate, PageHeader, Panel, Pill, Select, TabBar, type Tone } from '../components/ui';

export const statusTone = (s?: string): Tone =>
  /^(live|deployed|done|released|ok)/i.test(s || '') ? 'ok' : /(fail|blocked|rolled)/i.test(s || '') ? 'block' : 'wait';

const text = (r: Release) => [r.id, r.title, r.date, r.env, ...(r.tickets || []), ...(r.notes || []), JSON.stringify(r.build || ''), JSON.stringify(r.platforms || [])].join(' ').toLowerCase();

export function Releases() {
  const hub = useHub();
  const { id } = useParams();
  const all = releasesOf(hub);
  if (!all.length) return <Empty>This hub has no releases yet (content/data/releases.json).</Empty>;
  const tabs = [{ to: '/releases', label: 'All releases', count: all.length, end: true }, { to: '/releases/live', label: 'Live now' }];
  if (id && id !== 'live') {
    const r = all.find((x) => x.id === id);
    return (
      <div>
        <PageHeader crumb={<Link to="/releases" className="underline">Releases</Link>} title={r ? r.title || r.id : id} lede={r ? `${r.id} · ${r.env || ''} · ${fmtDate(r.date)}` : undefined} />
        {r ? <ReleaseCard r={r} open /> : <Empty>No release {id}.</Empty>}
      </div>
    );
  }
  return (
    <div>
      <PageHeader title="Releases" lede="What has been deployed, newest first, with the work each release shipped and where each platform runs." />
      <TabBar label="Releases" className="mb-6" tabs={tabs} />
      {id === 'live' ? <LiveNow /> : <ReleaseList all={all} />}
    </div>
  );
}

function ReleaseList({ all }: { all: Release[] }) {
  const [params, setParams] = useSearchParams();
  const env = params.get('env') || '';
  const platform = params.get('platform') || '';
  const ticket = params.get('ticket') || '';
  const q = params.get('q') || '';
  const set = (k: string, v: string) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); setParams(p, { replace: true }); };
  const envs = [...new Set(all.map((r) => r.env).filter(Boolean) as string[])];
  const platforms = [...new Set(all.flatMap((r) => (r.platforms || []).map((p) => p.platform)))].sort();
  const tickets = [...new Set(all.flatMap((r) => r.tickets || []))].sort();
  const list = useMemo(() => all.filter((r) =>
    (!env || r.env === env) &&
    (!platform || (r.platforms || []).some((p) => p.platform === platform)) &&
    (!ticket || (r.tickets || []).includes(ticket)) &&
    (!q.trim() || text(r).includes(q.trim().toLowerCase())),
  ), [all, env, platform, ticket, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select label="Environment" value={env} onChange={(v) => set('env', v)} options={[['', 'All'], ...envs.map((e) => [e, e] as [string, string])]} />
        <Select label="Platform" value={platform} onChange={(v) => set('platform', v)} options={[['', 'All'], ...platforms.map((p) => [p, p] as [string, string])]} />
        <Select label="Ticket" value={ticket} onChange={(v) => set('ticket', v)} options={[['', 'All'], ...tickets.map((t) => [t, t] as [string, string])]} />
        <label className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-xs text-ink-3 sm:max-w-xs">
          <span className="sr-only">Search releases</span>
          <input type="search" value={q} onChange={(e) => set('q', e.target.value)} placeholder="Search release, ticket, text"
            className="w-full min-w-0 rounded-md border border-line-2 bg-paper px-2 py-1 text-xs text-ink" />
        </label>
        <span className="text-xs text-ink-3">{list.length} of {all.length}</span>
      </div>
      {list.length ? list.map((r, i) => <ReleaseCard key={r.id} r={r} open={i === 0} />) : <Empty>No releases match.</Empty>}
    </div>
  );
}

export function ReleaseCard({ r, open }: { r: Release; open?: boolean }) {
  const hub = useHub();
  const build = buildEntries(r.build);
  return (
    <details open={open} className="group rounded-lg border border-line bg-paper">
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
        <Link to={releaseRoute(r.id)} className="font-mono text-[12px] font-semibold hover:underline" onClick={(e) => e.stopPropagation()}>{r.id}</Link>
        <span className="min-w-0 flex-1 font-medium">{r.title}</span>
        {r.env && <Pill tone="ok">{r.env}</Pill>}
        <span className="text-xs tabular-nums text-ink-3">{fmtDate(r.date)}</span>
      </summary>
      <div className="space-y-4 border-t border-line px-4 py-3 text-sm">
        {!!r.tickets?.length && <Tickets hub={hub} tickets={r.tickets} />}
        {!!r.notes?.length && (
          <ul className="list-disc space-y-1 ps-5 text-ink-2">
            {r.notes.map((n, i) => <li key={i} dangerouslySetInnerHTML={{ __html: renderInline(n) }} />)}
          </ul>
        )}
        {!!r.platforms?.length && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-xs text-ink-3"><tr><th className="py-1 pe-3 font-normal">Platform</th><th className="py-1 pe-3 font-normal">Component</th><th className="py-1 pe-3 font-normal">Version / build</th><th className="py-1 pe-3 font-normal">Where</th><th className="py-1 font-normal">Status</th></tr></thead>
              <tbody className="divide-y divide-line">
                {r.platforms.map((p, i) => (
                  <tr key={i}>
                    <td className="py-1.5 pe-3">{p.platform}</td>
                    <td className="py-1.5 pe-3">{p.component}</td>
                    <td className="py-1.5 pe-3 font-mono text-[12px]">{p.version}</td>
                    <td className="py-1.5 pe-3 break-all text-ink-2">{p.where}</td>
                    <td className="py-1.5"><Pill tone={statusTone(p.status)}>{p.status || 'unknown'}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {build.length > 0 && (
          <dl className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
            {build.map(([k, v], i) => <Fragment key={i}><dt className="font-mono text-ink-3">{k || 'build'}</dt><dd className="break-words text-ink-2">{v}</dd></Fragment>)}
          </dl>
        )}
      </div>
    </details>
  );
}

function Tickets({ hub, tickets }: { hub: Hub; tickets: string[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {tickets.map((t) => {
        const f = featureByTicket(hub, t);
        return (
          <li key={t}>
            <Link to={ticketRoute(hub, t)} className="inline-flex items-center gap-1.5 rounded-md border border-line-2 px-2 py-0.5 text-xs hover:border-ink-3" title={f?.title}>
              <span className="font-mono">{t}</span>{f?.title && <span className="max-w-[16rem] truncate text-ink-3">{f.title}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function LiveNow() {
  const hub = useHub();
  const envs = liveNow(hub);
  return (
    <div className="space-y-6">
      {envs.map(({ env, rows }) => (
        <Panel key={env} title={`${env}: what runs now`} action={<span className="text-xs text-ink-3">latest release per platform</span>}>
          {rows.length === 0 ? <p className="text-sm text-ink-3">No platforms recorded.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-xs text-ink-3"><tr><th className="py-1 pe-3 font-normal">Platform</th><th className="py-1 pe-3 font-normal">Component</th><th className="py-1 pe-3 font-normal">Version</th><th className="py-1 pe-3 font-normal">Status</th><th className="py-1 font-normal">Release</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {rows.map((p, i) => (
                    <tr key={i}>
                      <td className="py-1.5 pe-3">{p.platform}</td>
                      <td className="py-1.5 pe-3">{p.component}</td>
                      <td className="py-1.5 pe-3 font-mono text-[12px]">{p.version}</td>
                      <td className="py-1.5 pe-3"><Pill tone={statusTone(p.status)}>{p.status || 'unknown'}</Pill></td>
                      <td className="py-1.5"><Link to={releaseRoute(p.release.id)} className="font-mono text-[12px] underline">{p.release.id}</Link> <span className="text-xs text-ink-3">{fmtDate(p.release.date)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      ))}
    </div>
  );
}

/** Releases that shipped a work item or feature: by ticket, or named in the title or notes. */
export function WorkReleases({ ids, title = 'Releases' }: { ids: (string | undefined)[]; title?: string }) {
  const hub = useHub();
  if (!releasesOf(hub).length) return null;
  const list = releasesFor(hub, ...ids);
  return (
    <Panel title={title} action={<span className="text-xs text-ink-3">{list.length}</span>}>
      {list.length === 0 ? <p className="text-sm text-ink-3">Not in any release yet.</p> : (
        <ul className="-my-1 divide-y divide-line">
          {list.slice(0, 8).map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
              <Link to={releaseRoute(r.id)} className="font-mono text-[12px] underline">{r.id}</Link>
              <span className="min-w-0 flex-1 truncate text-ink-2">{r.title}</span>
              <span className="text-xs tabular-nums text-ink-3">{fmtDate(r.date)}</span>
            </li>
          ))}
          {list.length > 8 && <li className="py-2 text-xs"><Link to={`/releases?q=${encodeURIComponent(ids.find(Boolean) || '')}`} className="underline">All {list.length}</Link></li>}
        </ul>
      )}
    </Panel>
  );
}

/** A one-line link to the newest release, for Home and Environments. */
export function LatestRelease() {
  const hub = useHub();
  const r = releasesOf(hub)[0];
  if (!r) return null;
  return (
    <Link to={releaseRoute(r.id)} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-paper px-4 py-3 text-sm hover:border-line-2">
      <Pill tone="ok">latest release</Pill>
      <span className="font-mono text-[12px]">{r.id}</span>
      <span className="min-w-0 flex-1 truncate">{r.title}</span>
      <span className="text-xs text-ink-3">{r.env} · {fmtDate(r.date)}</span>
    </Link>
  );
}
