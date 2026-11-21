import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { PHASES, PHASE_TITLE, type Spec } from '../lib/data';
import { gateSpeed, isAgentic, lastChange, loopActivity, NEWS_KIND, pct, topPeople, usage, type Insights, type NewsItem, type Person } from '../lib/insights';
import { HBars, Legend, Sparkline, WeeklyStacked } from './Charts';
import { cx, Panel, Pill } from './ui';

const recent = (d: string | null, n: number) => !!d && Date.parse(d) >= Date.now() - n * 86400000;

function Tile({ label, value, sub, spark, sparkLabels, change }: { label: string; value: ReactNode; sub?: ReactNode; spark?: number[]; sparkLabels?: string[]; change?: number | null }) {
  return (
    <div className="flex min-w-0 flex-col justify-between rounded-lg border border-line bg-paper px-4 py-3">
      <div className="text-xs text-ink-3">{label}</div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="text-2xl font-semibold tabular-nums leading-tight">{value}</div>
          {sub && <div className="mt-0.5 text-[11px] text-ink-3">{sub}</div>}
        </div>
        {spark && spark.some((v) => v > 0) && <Sparkline values={spark} labels={sparkLabels} label={label} />}
      </div>
      {change != null && <div className="mt-1 text-[11px] text-ink-3">{change > 0 ? `▲ ${change}` : change < 0 ? `▼ ${-change}` : 'no change'} on the week before</div>}
    </div>
  );
}

/** The headline numbers, each with its trend over the weeks the insights cover. */
export function StatTiles({ ins, specs }: { ins: Insights; specs: Spec[] }) {
  const weeks = ins.weeks;
  const flight = specs.filter((s) => !['intent', 'maintain'].includes(s.phase)).length;
  const activity = loopActivity(specs, weeks);
  const aiWeek = ins.commits.byWeek.map((w) => w.ai);
  const merged = ins.prs.byWeek.map((w) => w.merged);
  const runs = ins.agents.byWeek.map((w) => w.runs);
  const active = weeks.map((_, i) => ins.people.filter((p) => p.weeks[i] > 0).length);
  const crit = specs.reduce((a, s) => [a[0] + s.criteria_passing, a[1] + s.criteria], [0, 0]);
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <Tile label="Work in flight" value={flight} sub={`${specs.length} work items · loop events per week`} spark={activity} sparkLabels={weeks} change={lastChange(activity)} />
      <Tile label="AI-assisted commits" value={`${pct(ins.commits.ai, ins.commits.total)}%`} sub={`${ins.commits.ai} of ${ins.commits.total} in ${ins.commits.repos} repos`} spark={aiWeek} sparkLabels={weeks} change={lastChange(aiWeek)} />
      {ins.prs.available
        ? <Tile label="Pull requests merged" value={ins.prs.merged} sub={`${ins.prs.agentMerged} by agents · ${ins.prs.open} open`} spark={merged} sparkLabels={weeks} change={lastChange(merged)} />
        : <Tile label="Pull requests" value="–" sub="sign in to gh on the machine that syncs" />}
      <Tile label="Agent runs this week" value={ins.agents.thisWeek} sub={`${ins.agents.total} in ${weeks.length - 1} weeks · ${ins.agents.source === 'shared' ? `shared by ${ins.agents.sharedBy.length}` : 'this laptop'}`} spark={runs} sparkLabels={weeks} change={lastChange(runs)} />
      <Tile label="Acceptance criteria passing" value={`${pct(crit[0], crit[1])}%`} sub={`${crit[0]} of ${crit[1]} across all work`} />
      <Tile label="Active contributors" value={active[active.length - 1] || active[active.length - 2] || 0} sub={`${ins.people.filter(isAgentic).length} use AI · ${ins.people.length} in ${weeks.length - 1} weeks`} spark={active} sparkLabels={weeks} change={lastChange(active)} />
    </div>
  );
}

/** The latest news: highlights first (speed, quality, pictures, first steps with AI), then routine loop events. */
export function NewsList({ ins, n = 6 }: { ins: Insights; n?: number }) {
  const high = ins.events.filter((e) => !NEWS_KIND[e.kind]?.routine);
  const items = [...high, ...ins.events.filter((e) => NEWS_KIND[e.kind]?.routine)].slice(0, n);
  return (
    <Panel title="Recent news" action={<Link to="/news" className="text-xs underline">All news · {ins.events.length}</Link>}>
      {items.length ? (
        <ul className="-my-1 divide-y divide-line">
          {items.map((e, i) => <li key={i}><NewsRow e={e} /></li>)}
        </ul>
      ) : <p className="text-sm text-ink-3">Nothing new yet.</p>}
    </Panel>
  );
}

export function NewsRow({ e, full }: { e: NewsItem; full?: boolean }) {
  const k = NEWS_KIND[e.kind] || { label: e.kind, icon: '•' };
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span aria-hidden className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-sunk text-sm text-ink-2">{k.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium leading-snug">{e.key ? <Link to={`/work/${e.key}/overview`} className="hover:underline">{e.text}</Link> : e.text}</div>
        {e.detail && <div className={cx('mt-0.5 text-xs text-ink-2', !full && 'line-clamp-1')}>{e.detail}</div>}
        <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-ink-3">
          <span>{k.label}</span>
          {e.date && <span>{new Date(e.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
          {e.person && <Link to={`/people?q=${encodeURIComponent(e.person)}`} className="underline decoration-line-2 underline-offset-2 hover:decoration-ink">{e.person}</Link>}
        </div>
      </div>
    </div>
  );
}

export function AiChart({ ins }: { ins: Insights }) {
  const [kind, setKind] = useState<'commits' | 'prs'>('commits');
  const rows = kind === 'commits' ? ins.commits.byWeek.map((w) => ({ week: w.week, a: w.ai, b: w.total - w.ai })) : ins.prs.byWeek.map((w) => ({ week: w.week, a: w.agent, b: w.total - w.agent }));
  return (
    <Panel title="AI-assisted work, week by week" action={ins.prs.available && (
      <span className="inline-flex rounded-md border border-line-2 p-0.5 text-xs">
        {(['commits', 'prs'] as const).map((k) => <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k} className={cx('rounded px-2 py-0.5', kind === k ? 'bg-ink text-paper' : 'text-ink-2')}>{k === 'commits' ? 'Commits' : 'Pull requests'}</button>)}
      </span>
    )}>
      <WeeklyStacked rows={rows} a={kind === 'commits' ? 'AI-assisted' : 'By agents'} b={kind === 'commits' ? 'Other commits' : 'Other pull requests'} unit={kind === 'commits' ? 'commits' : 'pull requests'} />
      <p className="mt-2 text-[11px] text-ink-3">AI-assisted: the commit says <code>Co-Authored-By: Claude</code> or "Generated with Claude Code"; an agent pull request says so in its description or comes from an <code>agent/</code> or task branch. A lower bound: work without the line counts as other.</p>
    </Panel>
  );
}

export function AgentsChart({ ins }: { ins: Insights }) {
  const hours = Math.round((ins.agents.total * ins.agents.minutesPerRun) / 60);
  return (
    <Panel title="Agents at work" action={<Link to="/agents" className="text-xs underline">Agents</Link>}>
      {ins.agents.byAgent.length ? (
        <HBars rows={ins.agents.byAgent.slice(0, 8).map((a) => ({ key: a.agent, label: <span className="font-mono">{a.agent}</span>, a: a.runs }))} a="Runs" unit="runs" />
      ) : <p className="text-sm text-ink-3">No agent runs recorded yet.</p>}
      <p className="mt-3 text-[11px] text-ink-3">
        {ins.agents.total} runs in {ins.weeks.length - 1} weeks, about {hours} hours of engineering time (assumption: {ins.agents.minutesPerRun} minutes saved per run).{' '}
        {ins.agents.source === 'shared' ? `Counts shared by ${ins.agents.sharedBy.join(', ')}.` : 'This laptop only: run tools/share_usage.py --push to add yours to the team numbers.'}
      </p>
    </Panel>
  );
}

/** Where the work is and how long each gate takes. */
export function LoopChart({ specs }: { specs: Spec[] }) {
  const speed = gateSpeed(specs);
  return (
    <Panel title="The loop: where work is, how long gates take">
      <HBars rows={PHASES.map((p) => ({ key: PHASE_TITLE[p], label: <Link to={`/work?phase=${p}`} className="hover:underline">{PHASE_TITLE[p]}</Link>, a: specs.filter((s) => s.phase === p).length }))} a="Work items" unit="work items" />
      <p className="mt-4 border-t border-line pt-3 text-[11px] text-ink-3">Median days at each gate, from the work items that went through it live (items recorded after the fact are left out).</p>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
        {speed.map((g) => (
          <div key={g.label}><dt className="text-ink-3">{g.label}</dt><dd className="text-lg font-semibold tabular-nums">{g.median == null ? '–' : `${g.median} d`}</dd><dd className="text-[11px] text-ink-3">median of {g.n}</dd></div>
        ))}
      </dl>
    </Panel>
  );
}

export function ReposChart({ ins }: { ins: Insights }) {
  return (
    <Panel title="Most active repos">
      <HBars rows={ins.commits.byRepo.slice(0, 10).map((r) => ({ key: r.repo, label: <span className="font-mono">{r.repo}</span>, a: r.ai, b: r.total - r.ai }))} a="AI-assisted" b="Other" unit="commits" />
    </Panel>
  );
}

/** Which repo groups the loop has reached: a work item touched at least one of their repos. */
export function AdoptionChart({ ins }: { ins: Insights }) {
  return (
    <Panel title="Adoption by repo group" action={<span className="text-xs text-ink-3">repos a work item touched</span>}>
      <HBars rows={ins.adoption.map((g) => ({ key: g.group, label: g.group, a: g.touched, b: g.repos - g.touched, note: `of ${g.repos}` }))} a="In the loop" b="Not yet" unit="repos" />
    </Panel>
  );
}

export const initials = (n: string) => n.split(/[\s_-]+/).filter(Boolean).slice(0, 2).map((x) => x[0]!.toUpperCase()).join('');
const shortDate = (d: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '–');

/** One person in detail: what they did, how much of it with AI, the work they started, their weekly rhythm. */
export function PersonCard({ p, rank, weeks }: { p: Person; rank?: number; weeks: string[] }) {
  return (
    <div className="flex min-w-0 flex-col rounded-lg border border-line bg-paper p-3">
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sunk text-sm font-semibold text-ink-2">{initials(p.name)}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium" title={p.name}>{rank ? <span className="mr-1 tabular-nums text-ink-3">{rank}.</span> : null}{p.name}</div>
          <div className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-ink-3">active {shortDate(p.last)}{recent(p.firstAi, 30) && <span className="whitespace-nowrap rounded-full border border-ok px-1.5 text-ok">new to AI</span>}</div>
        </div>
      </div>
      <dl className="mt-2.5 grid grid-cols-4 gap-2 text-center text-[11px] text-ink-3">
        <div><dd className="text-base font-semibold tabular-nums text-ink">{p.commits}</dd><dt>commits</dt></div>
        <div><dd className="text-base font-semibold tabular-nums text-ink">{p.ai}</dd><dt>AI-assisted</dt></div>
        <div><dd className="text-base font-semibold tabular-nums text-ink">{p.agentPrs}<span className="text-xs font-normal text-ink-3">/{p.prs}</span></dd><dt>agent PRs</dt></div>
        <div><dd className="text-base font-semibold tabular-nums text-ink">{p.agentRuns || '–'}</dd><dt>agent runs</dt></div>
      </dl>
      {p.weeks.some((w) => w > 0) && (
        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-ink-3"><span>per week</span><Sparkline values={p.weeks} labels={weeks} label={`${p.name}: activity per week`} /></div>
      )}
      {p.commits > 0 && (
        <div className="mt-2 flex items-center gap-2 text-[11px] text-ink-3">
          <span className="h-1.5 flex-1 rounded-full bg-sunk"><span className="block h-full rounded-full" style={{ width: `${pct(p.ai, p.commits)}%`, background: 'var(--series-1)' }} /></span>
          <span className="tabular-nums">{pct(p.ai, p.commits)}% AI-assisted</span>
        </div>
      )}
      {p.firstAi && <div className="mt-1.5 text-[11px] text-ink-3">first AI-assisted commit {shortDate(p.firstAi)}</div>}
      {p.started.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{p.started.map((k) => <Link key={k} to={`/work/${k}/overview`} className="rounded border border-line px-1.5 font-mono text-[10.5px] text-ink-2 hover:border-ink">{k}</Link>)}</div>}
      {p.repos.length > 0 && <div className="mt-1.5 truncate font-mono text-[10.5px] text-ink-3" title={p.repos.join(', ')}>{p.repos.join(', ')}</div>}
      {p.achievements.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{p.achievements.map((a) => <Pill key={a} className="text-[10.5px]">{a}</Pill>)}</div>}
    </div>
  );
}

/** The people who use AI most in their work (AI-assisted commits, agent pull requests, shared agent runs). */
export function TopPeople({ ins, n = 10 }: { ins: Insights; n?: number }) {
  const top = topPeople(ins, n);
  const max = Math.max(1, ...top.map(usage));
  return (
    <Panel title="Top people using AI" action={<Link to="/people" className="text-xs underline">All people · {ins.people.filter(isAgentic).length}</Link>}>
      <div className="mb-2"><Legend items={[['AI-assisted commits', '--series-1'], ['Agent pull requests', '--series-2']]} /></div>
      <ol className="space-y-2">
        {top.map((p, i) => (
          <li key={p.name}>
            <Link to={`/people?q=${encodeURIComponent(p.name)}`} className="grid grid-cols-[18px_28px_minmax(0,8.5rem)_minmax(0,1fr)_auto] items-center gap-2 text-xs hover:underline">
              <span className="text-right tabular-nums text-ink-3">{i + 1}</span>
              <span aria-hidden className="flex size-7 items-center justify-center rounded-full bg-sunk text-[11px] font-semibold text-ink-2">{initials(p.name)}</span>
              <span className="truncate font-medium text-ink" title={p.name}>{p.name}{recent(p.firstAi, 30) && <span className="ml-1 text-ok">★</span>}</span>
              <span className="flex h-2.5 items-center gap-[2px]" style={{ width: `${Math.max(3, (usage(p) / max) * 100)}%` }} title={`${p.ai} AI-assisted commits, ${p.agentPrs} agent pull requests`}>
                {p.ai > 0 && <span className="h-full rounded-l-[4px] last:rounded-r-[4px]" style={{ width: `${(p.ai / usage(p)) * 100}%`, background: 'var(--series-1)' }} />}
                {p.agentPrs > 0 && <span className="h-full rounded-r-[4px] first:rounded-l-[4px]" style={{ width: `${(p.agentPrs / usage(p)) * 100}%`, background: 'var(--series-2)' }} />}
              </span>
              <span className="tabular-nums text-ink-2">{p.ai} · {p.agentPrs}</span>
            </Link>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[11px] text-ink-3">Ranked by AI-assisted commits plus agent pull requests in {ins.weeks.length - 1} weeks. ★ new to AI this month.</p>
    </Panel>
  );
}

/** The digest as plain text, to paste into Slack or an email. */
export function digestText(ins: Insights, specs: Spec[], brand: string) {
  const flight = specs.filter((s) => !['intent', 'maintain'].includes(s.phase));
  const lines = [
    `*${brand} engineering: the week to ${ins.generated}*`,
    `• ${flight.length} work items in flight, ${specs.length} in total`,
    `• ${pct(ins.commits.ai, ins.commits.total)}% of ${ins.commits.total} commits AI-assisted (last ${ins.weeks.length - 1} weeks, ${ins.commits.repos} repos)`,
    ...(ins.prs.available ? [`• ${ins.prs.merged} pull requests merged, ${ins.prs.agentMerged} of them by agents; ${ins.prs.open} open`] : []),
    `• ${ins.agents.thisWeek} agent runs this week, ${ins.agents.total} in ${ins.weeks.length - 1} weeks`,
    `• ${ins.people.filter(isAgentic).length} people using agents`,
    '', '*Highlights*', ...ins.events.filter((e) => !NEWS_KIND[e.kind]?.routine).slice(0, 6).map((e) => `• ${e.text}`),
  ];
  return lines.join('\n');
}
