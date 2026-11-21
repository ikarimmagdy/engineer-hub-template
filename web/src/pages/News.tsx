import { Link, useSearchParams } from 'react-router';
import { NEWS_KIND, useInsights, type NewsItem } from '../lib/insights';
import { NewsRow } from '../components/InsightsPanels';
import { cx, Empty, PageHeader, Panel, Skeleton } from '../components/ui';

/** /news: every update the insights found, by kind and by when. */
export function News() {
  const ins = useInsights();
  const [params, setParams] = useSearchParams();
  const kind = params.get('kind') || 'highlights';
  if (ins.loading) return <Skeleton lines={8} />;
  if (!ins.data) return <Empty>No news yet: run <code>tools/sync_insights.py</code> (part of <code>sync.sh</code>).</Empty>;
  const all = ins.data.events;
  const counts = all.reduce((c, e) => ({ ...c, [e.kind]: (c[e.kind] || 0) + 1 }), {} as Record<string, number>);
  const shown = all.filter((e) => (kind === 'all' ? true : kind === 'highlights' ? !NEWS_KIND[e.kind]?.routine : e.kind === kind));
  const ago = (d: string) => Math.floor((Date.parse(ins.data!.generated) - Date.parse(d)) / 86400000);
  const groups: [string, NewsItem[]][] = [
    ['This week', shown.filter((e) => ago(e.date) < 7)],
    ['Earlier this month', shown.filter((e) => ago(e.date) >= 7 && ago(e.date) < 31)],
    ['Before', shown.filter((e) => ago(e.date) >= 31)],
  ];
  const chip = (k: string, label: string, n: number) => (
    <button key={k} type="button" onClick={() => setParams((p) => { if (k === 'highlights') p.delete('kind'); else p.set('kind', k); return p; }, { replace: true })} aria-pressed={kind === k}
      className={cx('rounded-full border px-2.5 py-0.5 text-xs', kind === k ? 'border-ink bg-ink text-paper' : 'border-line-2 text-ink-2 hover:border-ink')}>{label} {n}</button>
  );
  return (
    <div>
      <PageHeader crumb={<Link to="/" className="hover:underline">Home</Link>} title="News"
        lede="What happened in the workspace: work moving fast through the loop, quality reached, diagrams and code maps, people taking their first steps with AI, and every work item started and approved." />
      <div className="mb-5 flex flex-wrap gap-1.5">
        {chip('highlights', 'Highlights', all.filter((e) => !NEWS_KIND[e.kind]?.routine).length)}
        {Object.entries(NEWS_KIND).filter(([k]) => counts[k]).map(([k, v]) => chip(k, v.label, counts[k]))}
        {chip('all', 'Everything', all.length)}
      </div>
      {!shown.length ? <Empty>No news of this kind.</Empty> : (
        <div className="space-y-6">
          {groups.filter(([, xs]) => xs.length).map(([title, xs]) => (
            <Panel key={title} title={`${title} · ${xs.length}`}>
              <ul className="-my-1 divide-y divide-line">{xs.map((e, i) => <li key={i}><NewsRow e={e} full /></li>)}</ul>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
