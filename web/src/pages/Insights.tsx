import { useState } from 'react';
import { Link } from 'react-router';
import { useHub } from '../lib/data';
import { useInsights } from '../lib/insights';
import { AdoptionChart, AgentsChart, AiChart, digestText, InspirationCards, LoopChart, PeopleCards, ReposChart, StatTiles } from '../components/InsightsPanels';
import { Empty, fmtDate, PageHeader, Skeleton } from '../components/ui';

/** /insights: the week in one page, to share at a stand-up or in Slack (Copy) or print. */
export function Insights() {
  const hub = useHub();
  const ins = useInsights();
  const [copied, setCopied] = useState(false);
  if (ins.loading) return <Skeleton lines={8} />;
  if (!ins.data) return <Empty action={<Link to="/" className="underline">Home</Link>}>No insights yet: run <code>tools/sync_insights.py</code> (part of <code>sync.sh</code>) in a hub fed from a workspace.</Empty>;
  const d = ins.data;
  return (
    <div className="space-y-6">
      <PageHeader title="Weekly digest" lede={`${hub.brand.name} engineering, the ${d.weeks.length - 1} weeks to ${fmtDate(d.generated)}: the work, the people and the agents.`}
        actions={<span className="flex items-center gap-2 print:hidden"><button type="button" onClick={() => navigator.clipboard.writeText(digestText(d, hub.loop.specs, hub.brand.name)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })} className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-paper">{copied ? 'Copied' : 'Copy for Slack'}</button><button type="button" onClick={() => window.print()} className="rounded-md border border-line-2 px-3 py-1.5 text-sm">Print</button></span>} />
      <StatTiles ins={d} specs={hub.loop.specs} />
      <InspirationCards ins={d} n={12} />
      <div className="grid gap-6 lg:grid-cols-2">
        <AiChart ins={d} />
        <LoopChart specs={hub.loop.specs} />
        <AgentsChart ins={d} />
        <ReposChart ins={d} />
      </div>
      <PeopleCards ins={d} />
      <AdoptionChart ins={d} />
    </div>
  );
}
