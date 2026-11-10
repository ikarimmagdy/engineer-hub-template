import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { useHub } from '../lib/data';
import { renderInline } from '../lib/markdown';
import { MarkdownText } from '../components/Markdown';
import { cx, Empty, PageHeader, Pager, Panel, Pill, TabBar } from '../components/ui';

/** content/data/operations.json (tools/sync_operations.py), read from the workspace's operations-center/. */
export interface OpsStep { actor: string; action: string }
export interface OpsProcess {
  id: string; title: string; category: string; desk: string; requestType: string; approvals: { role: string; checks: string }[];
  executedBy: string; leadTime: string; confidence: string; evidence: string[]; depends: string[]; leadsTo: string[];
  when: string; provide: string[]; steps: OpsStep[]; wrong: string[]; agent: string; notes: string; path: string;
}
export interface OpsJourney { id: string; title: string; who: string; overview: string; steps: { text: string; process: string | null }[]; path: string }
export interface OpsDesk { key: string; name: string; covers: string; overview: string; flow: string; requestTypes: string[]; processes: string[]; path: string }
export interface Operations { generated: string; workspace: string; lede: string; processes: OpsProcess[]; journeys: OpsJourney[]; desks: OpsDesk[] }

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
  const tabs = [{ to: '/operations/processes', label: 'Processes', count: ops.processes.length }, { to: '/operations/journeys', label: 'Journeys', count: ops.journeys.length }, { to: '/operations/desks', label: 'Service desks', count: ops.desks.length }];
  return (
    <div>
      <PageHeader title="Operation Center" lede={ops.lede || 'How engineering gets infrastructure, security and IT work done: what to request, where, what to provide, who approves and who does it.'} />
      <TabBar label="Operation Center" className="mb-6" tabs={tabs} />
      {view === 'journeys' ? <Journeys ops={ops} /> : view === 'desks' ? <Desks ops={ops} /> : view === 'processes' ? <Catalog ops={ops} /> : <Navigate to="/operations" replace />}
    </div>
  );
}

function Catalog({ ops }: { ops: Operations }) {
  const [q, setQ] = useState('');
  const [cat, setCatRaw] = useState('');
  const [page, setPage] = useState(0);
  const setCat = (c: string) => { setCatRaw(c); setPage(0); };
  const cats = useMemo(() => [...new Set(ops.processes.map((p) => p.category))].sort((a, b) => Object.keys(CATEGORY).indexOf(a) - Object.keys(CATEGORY).indexOf(b)), [ops]);
  const order = (c: string) => { const i = Object.keys(CATEGORY).indexOf(c); return i < 0 ? 99 : i; };
  const shown = ops.processes.filter((p) => (!cat || p.category === cat) && (!q || `${p.title} ${p.when} ${p.requestType} ${p.desk}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => order(a.category) - order(b.category) || a.title.localeCompare(b.title));
  // ADR 0029: the catalog is paged, not scrolled
  const SIZE = 12, pages = Math.ceil(shown.length / SIZE), pg = Math.min(page, Math.max(0, pages - 1));
  return (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <div className="space-y-1">
        <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="What do you need?" aria-label="Search processes" className="mb-2 h-9 w-full rounded-md border border-line-2 bg-paper px-2.5 text-sm" />
        {[['', 'All'] as [string, string], ...cats.map((c) => [c, catLabel(c)] as [string, string])].map(([c, l]) => (
          <button key={c} type="button" onClick={() => setCat(c)} className={cx('flex w-full justify-between rounded-md px-2.5 py-1.5 text-left text-sm', cat === c ? 'bg-ink text-paper' : 'hover:bg-sunk')}>
            <span>{l}</span><span className="tabular-nums opacity-60">{c ? ops.processes.filter((p) => p.category === c).length : ops.processes.length}</span>
          </button>
        ))}
      </div>
      <div className="min-w-0 space-y-3">
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
    </div>
  );
}

function ProcessPage({ ops, id, tab }: { ops: Operations; id: string; tab: string }) {
  const p = ops.processes.find((x) => x.id === id);
  if (!p) return <Navigate to="/operations" replace />;
  const byId = (x: string) => ops.processes.find((y) => y.id === x);
  return (
    <div>
      <PageHeader crumb={<Link to="/operations" className="hover:underline">Operation Center</Link>} title={p.title}
        lede={p.when} actions={<div className="flex flex-wrap gap-1.5"><Pill>{catLabel(p.category)}</Pill><Pill>{p.desk}</Pill>{p.confidence && <Pill tone={p.confidence === 'high' ? 'ok' : p.confidence === 'medium' ? 'wait' : 'block'}>{p.confidence} confidence</Pill>}</div>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Fact k="Ask through" v={`${p.desk}${p.requestType ? ` · ${p.requestType}` : ''}`} />
        <Fact k="Done by" v={p.executedBy || 'not recorded'} />
        <Fact k="Usually takes" v={p.leadTime || 'not recorded'} />
      </div>
      <TabBar label="Process views" className="mb-5" tabs={[
        { to: `/operations/process/${p.id}/workflow`, label: 'Workflow' },
        { to: `/operations/process/${p.id}/prepare`, label: 'Before you ask' },
        { to: `/operations/process/${p.id}/related`, label: 'Related' },
      ]} />
      {tab === 'workflow' && (
        <div className="space-y-5">
          <Swimlane steps={p.steps} />
          {p.approvals.length > 0 && (
            <Panel title="Who approves what">
              <ul className="divide-y divide-line">{p.approvals.map((a, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-x-3 py-1.5 text-sm"><span className="inline-block size-2.5 rotate-45 border border-sev-medium bg-sev-medium/20" aria-hidden /><span className="font-medium">{a.role}</span>{a.checks && <span className="text-ink-2">checks {a.checks}</span>}</li>
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
function Swimlane({ steps }: { steps: OpsStep[] }) {
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
            <div className="pr-2 text-xs font-semibold text-ink-2">{lane}</div>
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

function Journeys({ ops }: { ops: Operations }) {
  const [sel, setSel] = useState(ops.journeys[0]?.id);
  const j = ops.journeys.find((x) => x.id === sel);
  if (!j) return <Empty>No journeys yet. A journey is an ordered path through processes, such as an engineer's first week.</Empty>;
  const byId = (x: string | null) => (x ? ops.processes.find((p) => p.id === x) : undefined);
  return (
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <ul className="space-y-1">{ops.journeys.map((x) => (
        <li key={x.id}><button type="button" onClick={() => setSel(x.id)} className={cx('w-full rounded-md px-3 py-2 text-left text-sm', x.id === sel ? 'bg-ink text-paper' : 'hover:bg-sunk')}>{x.title}</button></li>
      ))}</ul>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold">{j.title}</h2>
        {j.who && <p className="text-xs text-ink-3">For {j.who}</p>}
        {j.overview && <p className="mt-1 max-w-3xl text-sm text-ink-2">{j.overview}</p>}
        <ol className="mt-4">
          {j.steps.map((s, i) => {
            const p = byId(s.process);
            return (
              <li key={i} className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-3 pb-4 last:pb-0">
                {i < j.steps.length - 1 && <span aria-hidden className="absolute bottom-0 left-[13px] top-7 w-0.5 bg-line" />}
                <span className="grid size-7 place-items-center rounded-full border-2 border-ink text-xs font-semibold">{i + 1}</span>
                <div className="min-w-0 pt-1 text-sm">
                  <span dangerouslySetInnerHTML={{ __html: renderInline(s.text) }} />
                  {p && <Link to={`/operations/process/${p.id}`} className="ml-2 inline-flex items-center gap-1 rounded-md border border-line-2 px-2 py-0.5 text-xs hover:border-ink">{p.desk} · {p.title} · {p.approvals.length} approval{p.approvals.length === 1 ? '' : 's'}</Link>}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function Desks({ ops }: { ops: Operations }) {
  const byId = (x: string) => ops.processes.find((p) => p.id === x);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {ops.desks.map((d) => (
        <Panel key={d.key} title={<span className="flex items-center gap-2">{d.name}<Pill>{d.key}</Pill></span>}>
          {d.covers && <p className="text-sm font-medium text-ink-2">{d.covers}</p>}
          {(d.overview || d.flow) && (
            <details className="mt-2"><summary className="cursor-pointer text-xs text-ink-2">How the desk works</summary>
              <div className="mt-2 max-h-[50dvh] overflow-auto text-sm"><MarkdownText src={`${d.overview}\n\n${d.flow ? `**How tickets flow**\n\n${d.flow}` : ''}`} path="" /></div>
            </details>
          )}
          {d.requestTypes.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{d.requestTypes.slice(0, 12).map((r) => <Pill key={r}>{r}</Pill>)}</div>}
          {d.processes.length > 0 && <div className="mt-3 text-xs text-ink-3">Processes: <ProcInline ids={d.processes} byId={byId} /></div>}
        </Panel>
      ))}
      {!ops.desks.length && <Empty>No service desks described yet.</Empty>}
    </div>
  );
}

const ProcInline = ({ ids, byId }: { ids: string[]; byId: (id: string) => OpsProcess | undefined }) => (
  <>{ids.map((x, i) => { const p = byId(x); return <span key={x}>{i > 0 && ', '}{p ? <Link to={`/operations/process/${x}`} className="underline">{p.title}</Link> : x}</span>; })}</>
);
