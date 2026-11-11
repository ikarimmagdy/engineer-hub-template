import { useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';
import { useHub } from '../lib/data';
import { renderInline } from '../lib/markdown';
import { MarkdownText } from '../components/Markdown';
import { cx, Empty, PageHeader, Pager, Panel, Pill, TabBar } from '../components/ui';
import { SideNav, WithSideNav } from '../components/SideNav';

/** content/data/operations.json (tools/sync_operations.py), read from the workspace's operations-center/. */
export interface OpsStep { actor: string; action: string }
export interface OpsProcess {
  id: string; title: string; category: string; desk: string; requestType: string; approvals: { role: string; checks: string }[];
  executedBy: string; leadTime: string; confidence: string; evidence: string[]; depends: string[]; leadsTo: string[];
  when: string; provide: string[]; steps: OpsStep[]; wrong: string[]; agent: string; notes: string; path: string;
}
export interface OpsJourney { id: string; title: string; who: string; overview: string; steps: { text: string; process: string | null }[]; path: string }
export interface OpsDesk { key: string; name: string; covers: string; overview: string; flow: string; requestTypes: string[]; processes: string[]; path: string }
export interface OpsRole { key: string; label: string; kind: 'fixed' | 'relative'; desks: string[]; matches: string[]; holders: { name: string; title: string | null; tickets: number | null }[]; evidence: string[]; note: string }
export interface Operations { generated: string; workspace: string; lede: string; processes: OpsProcess[]; journeys: OpsJourney[]; desks: OpsDesk[]; people?: { asOf: string; window: string; roles: OpsRole[] } }

/** The role a process names (a lane or an approval), from operations-center/roles.md: who holds it now. */
const roleOf = (ops: Operations, text: string) => {
  const t = text.trim().toLowerCase();
  return ops.people?.roles.find((r) => r.matches.some((m) => m.trim().toLowerCase() === t));
};

function Who({ role, compact }: { role?: OpsRole; compact?: boolean }) {
  if (!role) return null;
  if (role.kind === 'relative' || !role.holders.length) return <div className="mt-0.5 text-[11px] font-normal italic text-ink-3">{role.kind === 'relative' ? 'depends on who asks' : 'no one seen recently'}</div>;
  const hs = compact ? role.holders.slice(0, 2) : role.holders;
  return (
    <div className="mt-1 space-y-0.5 font-normal">
      {hs.map((h) => (
        <div key={h.name} className="text-[11.5px] leading-tight text-ink-2" title={`${h.name}${h.title ? `, ${h.title}` : ''}${h.tickets ? ` · ${h.tickets} tickets in this role` : ''}`}>
          <span className="font-medium text-ink">{h.name}</span>{h.title && <span className="block text-[10.5px] text-ink-3">{h.title}</span>}
        </div>
      ))}
      {compact && role.holders.length > 2 && <div className="text-[10.5px] text-ink-3">+{role.holders.length - 2} more</div>}
    </div>
  );
}

const CATEGORY: Record<string, string> = {
  onboarding: 'Onboarding and access', access: 'Access', 'domains-dns': 'Domains and DNS', certificates: 'Certificates',
  aws: 'AWS resources', kubernetes: 'Kubernetes and Rancher', database: 'Databases', storage: 'Storage', network: 'Network',
  cicd: 'CI/CD and GitHub', monitoring: 'Monitoring', security: 'Security reviews', other: 'Other',
};
const catLabel = (c: string) => CATEGORY[c] || c;
// an approval is the approvers' step, or a step whose verb approves; "names approvers" is not one
const isApproval = (s: OpsStep) => s.actor === 'Approvers' || /\b(approves?|approved|signs? off|authori[sz]es|grants? approval|gives? an? (?:\*\*)?(?:conditional )?approval|accepts the risk)\b/i.test(s.action);

export function OperationsPage() {
  const { operations: ops } = useHub();
  const { view = 'processes', id, tab } = useParams();
  if (!ops) return <div><PageHeader title="Operation Center" /><Empty>No operations-center/ in the workspace yet.</Empty></div>;
  if (view === 'process' && id) return <ProcessPage ops={ops} id={id} tab={tab || 'workflow'} />;
  if (!['processes', 'journeys', 'desks'].includes(view)) return <Navigate to="/operations" replace />;
  if (view === 'journeys' && !id && ops.journeys[0]) return <Navigate to={`/operations/journeys/${ops.journeys[0].id}`} replace />;
  const cats = [...new Set(ops.processes.map((p) => p.category))].sort((a, b) => order(a) - order(b));
  const groups = view === 'processes'
    ? [{ title: 'Areas', items: [{ to: '/operations/processes', label: 'All processes', count: ops.processes.length, end: true },
        ...cats.map((c) => ({ to: `/operations/processes/${c}`, label: catLabel(c), count: ops.processes.filter((p) => p.category === c).length }))] }]
    : view === 'journeys'
      ? [{ title: 'Journeys', items: ops.journeys.map((j) => ({ to: `/operations/journeys/${j.id}`, label: j.title, count: j.steps.length })) }]
      : [{ title: 'Service desks', items: [{ to: '/operations/desks', label: 'All desks', count: ops.desks.length, end: true },
          ...ops.desks.map((d) => ({ to: `/operations/desks/${d.key}`, label: d.name, count: d.processes.length }))] }];
  const section = { processes: 'Processes', journeys: 'Journeys', desks: 'Service desks' }[view as 'processes' | 'journeys' | 'desks'];
  const leaf = view === 'processes' ? (id ? catLabel(id) : '') : view === 'journeys' ? ops.journeys.find((j) => j.id === id)?.title : ops.desks.find((d) => d.key === id)?.name;
  return (
    <div>
      <PageHeader title="Operation Center" lede={<Lede text={ops.lede || 'How engineering gets infrastructure, security and IT work done: what to request, where, what to provide, who approves and who does it.'} />} />
      <TabBar label="Operation Center" className="mb-4" tabs={[
        { to: '/operations/processes', label: 'Processes', count: ops.processes.length },
        { to: '/operations/journeys', label: 'Journeys', count: ops.journeys.length },
        { to: '/operations/desks', label: 'Service desks', count: ops.desks.length },
      ]} />
      <Crumbs items={[['Operation Center', '/operations/processes'], [section, leaf ? `/operations/${view}` : undefined], ...(leaf ? [[leaf, undefined] as [string, undefined]] : [])]} />
      <WithSideNav nav={<SideNav label={section} groups={groups} />}>
        {view === 'processes' && <Catalog ops={ops} cat={id || ''} />}
        {view === 'journeys' && <Journey ops={ops} id={id!} />}
        {view === 'desks' && (id ? <Desk ops={ops} id={id} /> : <DeskList ops={ops} />)}
      </WithSideNav>
    </div>
  );
}

/** Where you are: each level a link back, the last one plain. */
function Crumbs({ items }: { items: [string, string | undefined][] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-5 text-sm text-ink-3">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map(([l, to], i) => (
          <li key={i} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden>&rsaquo;</span>}
            {to ? <Link to={to} className="hover:text-ink hover:underline">{l}</Link> : <span className={i === items.length - 1 ? 'font-medium text-ink' : ''} aria-current={i === items.length - 1 ? 'page' : undefined}>{l}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** The first sentence always; the rest (where the content comes from) on demand. */
function Lede({ text }: { text: string }) {
  const i = text.indexOf('. ');
  if (i < 0 || i > 260) return <>{text}</>;
  return <>{text.slice(0, i + 1)} <details className="inline"><summary className="inline cursor-pointer text-sm text-ink-3 underline decoration-line-2 underline-offset-4">Where this comes from</summary><span className="mt-1 block text-sm text-ink-3">{text.slice(i + 2)}</span></details></>;
}

const order = (c: string) => { const i = Object.keys(CATEGORY).indexOf(c); return i < 0 ? 99 : i; };

function Catalog({ ops, cat }: { ops: Operations; cat: string }) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const shown = ops.processes.filter((p) => (!cat || p.category === cat) && (!q || `${p.title} ${p.when} ${p.requestType} ${p.desk}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => order(a.category) - order(b.category) || a.title.localeCompare(b.title));
  // ADR 0029: the catalog is paged, not scrolled
  const SIZE = 12, pages = Math.ceil(shown.length / SIZE), pg = Math.min(page, Math.max(0, pages - 1));
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{cat ? catLabel(cat) : 'All processes'} <span className="text-base font-normal text-ink-3">{shown.length}</span></h2>
        <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="What do you need?" aria-label="Search processes" className="h-9 w-full max-w-xs rounded-md border border-line-2 bg-paper px-2.5 text-sm" />
      </div>
      <div className="grid content-start gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {shown.slice(pg * SIZE, (pg + 1) * SIZE).map((p) => (
          <Link key={p.id} to={`/operations/process/${p.id}`} className="rounded-lg border border-line bg-paper px-4 py-3 hover:border-ink">
            <div className="flex items-start justify-between gap-2"><span className="font-medium">{p.title}</span><Pill>{p.desk}</Pill></div>
            {p.when && <p className="mt-1 line-clamp-2 text-xs text-ink-3">{p.when}</p>}
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-3">
              <span>{p.steps.length} steps</span>
              {p.approvals.length > 0 && <span>{p.approvals.length} approval{p.approvals.length > 1 ? 's' : ''}</span>}
              {p.leadTime && <span>{p.leadTime}</span>}
            </div>
          </Link>
        ))}
        {!shown.length && <Empty>No process matches.</Empty>}
      </div>
      <Pager page={pg} pages={pages} total={shown.length} size={SIZE} onPage={setPage} />
    </div>
  );
}

function ProcessPage({ ops, id, tab }: { ops: Operations; id: string; tab: string }) {
  const p = ops.processes.find((x) => x.id === id);
  const [qs] = useSearchParams();
  if (!p) return <Navigate to="/operations" replace />;
  // the breadcrumb follows where you came from: a journey, a desk, or the catalog by area
  const from = qs.get('from') || '';
  const j = from.startsWith('journey:') ? ops.journeys.find((x) => x.id === from.slice(8)) : undefined;
  const d = from.startsWith('desk:') ? ops.desks.find((x) => x.key === from.slice(5)) : undefined;
  const trail: [string, string | undefined][] = j ? [['Journeys', '/operations/journeys'], [j.title, `/operations/journeys/${j.id}`]]
    : d ? [['Service desks', '/operations/desks'], [d.name, `/operations/desks/${d.key}`]]
    : [['Processes', '/operations/processes'], [catLabel(p.category), `/operations/processes/${p.category}`]];
  const keep = from ? `?from=${encodeURIComponent(from)}` : '';
  const byId = (x: string) => ops.processes.find((y) => y.id === x);
  return (
    <div>
      <Crumbs items={[['Operation Center', '/operations/processes'], ...trail, [p.title, undefined]]} />
      <PageHeader title={p.title}
        lede={p.when} actions={<div className="flex flex-wrap gap-1.5"><Pill>{catLabel(p.category)}</Pill><Pill>{p.desk}</Pill>{p.confidence && <Pill tone={p.confidence === 'high' ? 'ok' : p.confidence === 'medium' ? 'wait' : 'block'}>{p.confidence} confidence</Pill>}</div>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Fact k="Ask through" v={`${p.desk}${p.requestType ? ` · ${p.requestType}` : ''}`} />
        <Fact k="Done by" v={p.executedBy || 'not recorded'} />
        <Fact k="Usually takes" v={p.leadTime || 'not recorded'} />
      </div>
      <TabBar label="Process views" className="mb-5" tabs={[
        { to: `/operations/process/${p.id}/workflow${keep}`, label: 'Workflow' },
        { to: `/operations/process/${p.id}/prepare${keep}`, label: 'Before you ask' },
        { to: `/operations/process/${p.id}/related${keep}`, label: 'Related' },
      ]} />
      {tab === 'workflow' && (
        <div className="space-y-5">
          <Swimlane steps={p.steps} ops={ops} />
          {ops.people?.roles.length ? <p className="-mt-3 text-xs text-ink-3">Names under each role: who acted in that role on {p.desk} tickets in the {ops.people.window || 'recent past'}, as of {ops.people.asOf}. Hover a name for the ticket count. From <code>operations-center/roles.md</code>; correct it there.</p> : null}
          {p.approvals.length > 0 && (
            <Panel title="Who approves what">
              <ul className="divide-y divide-line">{p.approvals.map((a, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-x-3 py-1.5 text-sm"><span className="inline-block size-2.5 rotate-45 border border-sev-medium bg-sev-medium/20" aria-hidden /><span className="font-medium">{a.role}</span>{a.checks && <span className="text-ink-2">checks {a.checks}</span>}{(() => { const r = roleOf(ops, a.role); return r?.kind === 'fixed' && r.holders.length ? <span className="text-ink-3">now: {r.holders.map((h) => h.title ? `${h.name} (${h.title})` : h.name).join(', ')}</span> : r?.kind === 'relative' ? <span className="text-ink-3 italic">depends on who asks</span> : null; })()}</li>
              ))}</ul>
            </Panel>
          )}
        </div>
      )}
      {tab === 'prepare' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="You provide">{p.provide.length ? <List items={p.provide} /> : <p className="text-sm text-ink-3">Not recorded.</p>}</Panel>
          <Panel title="Goes wrong when">{p.wrong.length ? <List items={p.wrong} /> : <p className="text-sm text-ink-3">Nothing recorded.</p>}</Panel>
          {p.agent && <Panel title="An agent can help" className="lg:col-span-2"><p className="whitespace-pre-line text-sm text-ink-2">{p.agent.replace(/^[-*]\s+/gm, '• ')}</p></Panel>}
        </div>
      )}
      {tab === 'related' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Before this">{p.depends.length ? <ProcLinks ids={p.depends} byId={byId} /> : <p className="text-sm text-ink-3">Nothing first.</p>}</Panel>
          <Panel title="Usually followed by">{p.leadsTo.length ? <ProcLinks ids={p.leadsTo} byId={byId} /> : <p className="text-sm text-ink-3">Nothing recorded.</p>}</Panel>
          <Panel title="Where this comes from" className="lg:col-span-2">
            <p className="text-sm text-ink-2">Reverse-engineered from the content and comments of {p.evidence.length ? <>tickets such as {p.evidence.map((e) => <code key={e} className="mr-1.5">{e}</code>)}</> : 'the desk'}. Edit <code>{p.path}</code> in the workspace to correct it.</p>
            {p.notes && <p className="mt-2 whitespace-pre-line text-sm text-ink-2">{p.notes}</p>}
          </Panel>
        </div>
      )}
    </div>
  );
}

const Fact = ({ k, v }: { k: string; v: string }) => <div className="rounded-lg border border-line bg-paper px-3 py-2" title={v}><div className="text-[11px] uppercase tracking-wide text-ink-3">{k}</div><div className="line-clamp-2 text-sm font-medium">{v}</div></div>;
const List = ({ items }: { items: string[] }) => <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>;

function ProcLinks({ ids, byId }: { ids: string[]; byId: (id: string) => OpsProcess | undefined }) {
  return <ul className="space-y-1 text-sm">{ids.map((x) => { const q = byId(x); return <li key={x}>{q ? <Link to={`/operations/process/${q.id}`} className="underline">{q.title}</Link> : <code className="text-ink-3">{x}</code>}</li>; })}</ul>;
}

/** One lane per actor, in the order they first act; each step sits in its actor's lane, numbered left to right. Approvals are diamonds. */
function Swimlane({ steps, ops }: { steps: OpsStep[]; ops: Operations }) {
  if (!steps.length) return <Empty>No steps recorded.</Empty>;
  const lanes = [...new Set(steps.map((s) => s.actor || 'Someone'))];
  const cols = `150px repeat(${steps.length}, 200px)`;
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-paper" data-scroll>
      <div className="min-w-max p-3">
        <div className="grid items-center gap-x-2" style={{ gridTemplateColumns: cols }}>
          <div />
          {steps.map((_, i) => (
            <div key={i} className="flex items-center gap-1 pb-1 text-[11px] text-ink-3"><span className="tabular-nums">{i + 1}</span>{i < steps.length - 1 && <span aria-hidden className="h-px flex-1 bg-line-2" />}</div>
          ))}
        </div>
        {lanes.map((lane) => (
          <div key={lane} className="grid items-stretch gap-x-2 border-t border-line py-2" style={{ gridTemplateColumns: cols }}>
            <div className="pr-2 text-xs font-semibold text-ink-2">{lane}<Who role={roleOf(ops, lane)} compact /></div>
            {steps.map((s, i) => (s.actor || 'Someone') === lane ? (
              <div key={i} title={s.action} className={cx('line-clamp-6 rounded-md border px-2.5 py-1.5 text-xs leading-snug', isApproval(s) ? 'border-sev-medium bg-sev-medium/10' : 'border-line-2 bg-sunk')}>
                <div className="mb-0.5 flex items-center gap-1.5 text-[10px] text-ink-3"><span className="tabular-nums">{i + 1}</span>{isApproval(s) && <><span className="inline-block size-2 rotate-45 border border-sev-medium" aria-hidden />approval</>}</div>
                <span dangerouslySetInnerHTML={{ __html: renderInline(s.action) }} />
              </div>
            ) : <div key={i} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

function Journey({ ops, id }: { ops: Operations; id: string }) {
  const j = ops.journeys.find((x) => x.id === id);
  if (!j) return <Empty>No journeys yet. A journey is an ordered path through processes, such as an engineer's first week.</Empty>;
  const byId = (x: string | null) => (x ? ops.processes.find((p) => p.id === x) : undefined);
  const tickets = j.steps.filter((s) => byId(s.process));
  const approvals = tickets.reduce((n, s) => n + (byId(s.process)?.approvals.length || 0), 0);
  const desks = [...new Set(tickets.map((s) => byId(s.process)!.desk))];
  const jump = (i: number) => document.getElementById(`step-${i + 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return (
    <div className="min-w-0">
      <h2 className="text-xl font-semibold leading-snug">{j.title}</h2>
      {j.who && <p className="mt-0.5 text-sm text-ink-3">For {j.who}</p>}
      {j.overview && <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-ink-2">{j.overview}</p>}
      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <Fact k="Steps" v={String(j.steps.length)} />
        <Fact k="Tickets to raise" v={String(tickets.length)} />
        <Fact k="Approvals in total" v={String(approvals)} />
        <Fact k="Desks" v={desks.join(', ') || 'none'} />
      </div>
      <div className="mt-5 overflow-x-auto pb-1" data-scroll>
        <ol className="flex min-w-max items-center" aria-label="Jump to a step">
          {j.steps.map((s, i) => (
            <li key={i} className="flex items-center">
              <button type="button" onClick={() => jump(i)} title={s.text.replace(/[*`]/g, '')}
                className={cx('grid size-8 place-items-center rounded-full border-2 text-xs font-semibold tabular-nums hover:scale-110',
                  byId(s.process) ? 'border-ink bg-paper' : 'border-ok bg-ok/10 text-ok')}>{i + 1}</button>
              {i < j.steps.length - 1 && <span aria-hidden className="h-0.5 w-5 bg-line-2" />}
            </li>
          ))}
        </ol>
        <div className="mt-2 flex gap-4 text-[11px] text-ink-3">
          <span className="inline-flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full border-2 border-ink" />raise a ticket</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full border-2 border-ok bg-ok/10" />self-service</span>
        </div>
      </div>
      <ol className="mt-6 space-y-3">
        {j.steps.map((s, i) => {
          const p = byId(s.process);
          return (
            <li key={i} id={`step-${i + 1}`} className="grid scroll-mt-24 grid-cols-[40px_minmax(0,1fr)] gap-4 rounded-xl border border-line bg-paper p-4 sm:p-5">
              <span className={cx('grid size-10 place-items-center rounded-full text-base font-semibold tabular-nums', p ? 'bg-ink text-paper' : 'bg-ok/15 text-ok')}>{i + 1}</span>
              <div className="min-w-0">
                <p className="max-w-3xl text-[15px] leading-relaxed" dangerouslySetInnerHTML={{ __html: renderInline(s.text) }} />
                {p ? (
                  <Link to={`/operations/process/${p.id}?from=journey:${j.id}`} className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-line-2 bg-sunk px-3 py-2 text-sm hover:border-ink">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-3">Raise</span>
                    <Pill>{p.desk}</Pill>
                    <span className="font-medium">{p.title}</span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-ink-2"><span className="inline-block size-2 rotate-45 border border-sev-medium bg-sev-medium/20" aria-hidden />{p.approvals.length} approval{p.approvals.length === 1 ? '' : 's'}</span>
                    {p.leadTime && <span className="text-xs text-ink-3">{p.leadTime}</span>}
                    <span className="ml-auto text-xs text-ink-3">Open the process &rarr;</span>
                  </Link>
                ) : (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-ok/10 px-3 py-1.5 text-xs font-medium text-ok">Self-service: no ticket</div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** The desk notes are long (request types with counts, statuses, approvals, handoffs): the opening always shows,
 * the rest opens in full on demand, never in a scrolling box. */
function DeskNotes({ src }: { src: string }) {
  const parts = src.split(/\n\n+/);
  let n = 0, cut = parts.length;
  for (let i = 0; i < parts.length; i++) { n += parts[i].length; if (n > 700) { cut = i + 1; break; } }
  const head = parts.slice(0, cut).join('\n\n'), rest = parts.slice(cut).join('\n\n');
  return (
    <section className="rounded-xl border border-line bg-paper p-5">
      <h3 className="mb-2 text-base font-semibold">How the desk works</h3>
      <div className="max-w-3xl text-[15px] leading-relaxed"><MarkdownText src={head} path="" /></div>
      {rest && (
        <details className="mt-3 group">
          <summary className="cursor-pointer text-sm font-medium text-ink-2 underline decoration-line-2 underline-offset-4 hover:text-ink">Read the full desk notes: request types with ticket counts, statuses, approvals, handoffs</summary>
          <div className="mt-3 max-w-4xl text-[15px] leading-relaxed"><MarkdownText src={rest} path="" /></div>
        </details>
      )}
    </section>
  );
}

function DeskList({ ops }: { ops: Operations }) {
  if (!ops.desks.length) return <Empty>No service desks described yet.</Empty>;
  return (
    <div className="min-w-0">
      <h2 className="mb-4 text-xl font-semibold">Service desks</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {ops.desks.map((d) => (
          <Link key={d.key} to={`/operations/desks/${d.key}`} className="rounded-xl border border-line bg-paper p-5 hover:border-ink">
            <div className="flex items-center gap-2"><span className="text-base font-semibold">{d.name}</span><Pill>{d.key}</Pill></div>
            {d.covers && <p className="mt-2 text-sm leading-relaxed text-ink-2">{d.covers}</p>}
            <div className="mt-3 flex gap-4 text-xs text-ink-3"><span>{d.processes.length} processes</span><span>{d.requestTypes.length} request types</span></div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Desk({ ops, id }: { ops: Operations; id: string }) {
  const d = ops.desks.find((x) => x.key === id);
  if (!d) return <Navigate to="/operations/desks" replace />;
  const procs = d.processes.map((x) => ops.processes.find((p) => p.id === x)).filter((p): p is OpsProcess => !!p);
  const groups = [...new Set(procs.map((p) => p.category))].sort((a, b) => order(a) - order(b));
  return (
    <div className="min-w-0 space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">{d.name}</h2><Pill>{d.key}</Pill></div>
        {d.covers && <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink-2">{d.covers}</p>}
      </div>
      <div className={cx('grid gap-3', d.requestTypes.length ? 'sm:grid-cols-3' : 'sm:grid-cols-[1fr_2fr]')}>
        <Fact k="Processes" v={String(procs.length)} />
        {d.requestTypes.length > 0 && <Fact k="Request types" v={String(d.requestTypes.length)} />}
        <Fact k="Areas" v={groups.map(catLabel).join(', ') || 'none'} />
      </div>
      {groups.length > 0 && (
        <section>
          <h3 className="mb-3 text-base font-semibold">Processes on this desk</h3>
          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g}>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{catLabel(g)}</div>
                <ul className="grid gap-2 md:grid-cols-2">
                  {procs.filter((p) => p.category === g).map((p) => (
                    <li key={p.id}>
                      <Link to={`/operations/process/${p.id}?from=desk:${d.key}`} className="flex h-full items-start justify-between gap-3 rounded-lg border border-line bg-paper px-3.5 py-2.5 hover:border-ink">
                        <span className="text-sm font-medium leading-snug">{p.title}</span>
                        <span className="shrink-0 text-xs text-ink-3">{p.approvals.length} approval{p.approvals.length === 1 ? '' : 's'}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
      {d.flow && (
        <section className="rounded-xl border border-line bg-paper p-5">
          <h3 className="mb-2 text-base font-semibold">How tickets flow</h3>
          <div className="max-w-3xl text-[15px] leading-relaxed"><MarkdownText src={d.flow} path="" /></div>
        </section>
      )}
      {d.requestTypes.length > 0 && (
        <section>
          <h3 className="mb-2 text-base font-semibold">Request types</h3>
          <div className="flex flex-wrap gap-2">{d.requestTypes.map((r) => <span key={r} className="rounded-md border border-line-2 bg-paper px-2.5 py-1 text-sm text-ink-2">{r}</span>)}</div>
        </section>
      )}
      {d.overview && <DeskNotes src={d.overview} />}
    </div>
  );
}
