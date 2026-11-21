import { Link, useSearchParams } from 'react-router';
import { isAgentic, pct, usage, useInsights, type Person } from '../lib/insights';
import { initials, PersonCard } from '../components/InsightsPanels';
import { Empty, PageHeader, Segmented, Select, Skeleton } from '../components/ui';

type Sort = 'usage' | 'ai' | 'commits' | 'prs' | 'name';
const SORTS: [Sort, string][] = [['usage', 'Using AI most'], ['ai', 'AI-assisted commits'], ['commits', 'Commits'], ['prs', 'Agent pull requests'], ['name', 'Name']];
const by: Record<Sort, (a: Person, b: Person) => number> = {
  usage: (a, b) => usage(b) - usage(a), ai: (a, b) => b.ai - a.ai, commits: (a, b) => b.commits - a.commits,
  prs: (a, b) => b.agentPrs - a.agentPrs, name: (a, b) => a.name.localeCompare(b.name),
};

/** /people: everyone who contributed, the top ten as detailed cards and the rest as a table. ?q= picks one person. */
export function People() {
  const ins = useInsights();
  const [params, setParams] = useSearchParams();
  const set = (k: string, v: string) => setParams((p) => { if (v) p.set(k, v); else p.delete(k); return p; }, { replace: true });
  const q = (params.get('q') || '').toLowerCase();
  const sort = (params.get('sort') as Sort) || 'usage';
  const who = params.get('who') === 'all' ? 'all' : 'ai';
  if (ins.loading) return <Skeleton lines={8} />;
  if (!ins.data) return <Empty>No insights yet: run <code>tools/sync_insights.py</code> (part of <code>sync.sh</code>).</Empty>;
  const d = ins.data;
  const list = d.people.filter((p) => (who === 'all' || isAgentic(p)) && (!q || p.name.toLowerCase().includes(q))).sort((a, b) => by[sort](a, b) || a.name.localeCompare(b.name));
  const top = list.slice(0, 10), rest = list.slice(10);
  return (
    <div>
      <PageHeader crumb={<Link to="/" className="hover:underline">Home</Link>} title="People"
        lede={`${d.people.filter(isAgentic).length} of ${d.people.length} contributors use AI in their work (last ${d.weeks.length - 1} weeks, workspace and ${d.commits.repos - 1} repos). AI-assisted: the commit or pull request says Claude helped; a lower bound.`} />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented label="Who" value={who} onChange={(v) => set('who', v === 'ai' ? '' : v)} options={[['ai', 'Using AI'], ['all', 'Everyone']]} />
        <Select label="Sort" value={sort} onChange={(v) => set('sort', v === 'usage' ? '' : v)} options={SORTS} />
        <input type="search" value={params.get('q') || ''} onChange={(e) => set('q', e.target.value)} placeholder="Find a person" aria-label="Find a person"
          className="h-8 w-56 rounded-md border border-line-2 bg-paper px-2.5 text-sm" />
        <span className="text-xs text-ink-3">{list.length} people</span>
      </div>
      {!list.length ? <Empty>No one matches.</Empty> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {top.map((p, i) => <PersonCard key={p.name} p={p} rank={sort === 'name' ? undefined : i + 1} weeks={d.weeks} />)}
          </div>
          {rest.length > 0 && (
            <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-paper">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-sunk text-left text-xs text-ink-2">
                  <tr>{['#', 'Person', 'Commits', 'AI-assisted', 'Share', 'Agent PRs', 'Work started', 'Last active'].map((h, i) => <th key={h} className={`px-3 py-2 font-semibold ${i > 1 ? 'text-right' : ''}`}>{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rest.map((p, i) => (
                    <tr key={p.name} className="hover:bg-sunk">
                      <td className="px-3 py-1.5 tabular-nums text-ink-3">{i + 11}</td>
                      <td className="px-3 py-1.5"><button type="button" onClick={() => set('q', p.name)} className="flex items-center gap-2 hover:underline"><span aria-hidden className="flex size-6 items-center justify-center rounded-full bg-sunk text-[10px] font-semibold text-ink-2">{initials(p.name)}</span>{p.name}</button></td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{p.commits}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{p.ai}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-ink-2">{p.commits ? `${pct(p.ai, p.commits)}%` : '–'}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{p.agentPrs}<span className="text-ink-3">/{p.prs}</span></td>
                      <td className="px-3 py-1.5 text-right font-mono text-[11.5px]">{p.started.join(', ') || '–'}</td>
                      <td className="px-3 py-1.5 text-right text-ink-3">{p.last || '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
