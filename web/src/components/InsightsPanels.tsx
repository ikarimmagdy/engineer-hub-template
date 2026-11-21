import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { PHASES, PHASE_TITLE, type Spec } from '../lib/data';
import { gateSpeed, isAgentic, lastChange, loopActivity, pct, type Insights, type Person } from '../lib/insights';
import { HBars, Sparkline, WeeklyStacked } from './Charts';
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

const KIND_ICON: Record<string, string> = { speed: '⏱', quality: '✓', diagrams: '◇', map: '⌘', new: '★', agent: '⚙' };

/** Stories from real events: speed through the loop, quality reached, new people using agents. */
export function InspirationCards({ ins, n = 6 }: { ins: Insights; n?: number }) {
  const ev = ins.events.slice(0, n);
  if (!ev.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {ev.map((e, i) => {
        const body = (
          <div className="flex h-full items-start gap-3 rounded-lg border border-line bg-sunk/50 px-4 py-3 hover:border-line-2">
            <span aria-hidden className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-paper text-sm text-ink-2">{KIND_ICON[e.kind] || '•'}</span>
            <span className="min-w-0 text-sm leading-snug"><span className="font-medium">{e.text}</span>{e.date && <span className="mt-0.5 block text-[11px] text-ink-3">{new Date(e.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}</span>
          </div>
        );
        return e.key ? <Link key={i} to={`/work/${e.key}/overview`}>{body}</Link> : <div key={i}>{body}</div>;
      })}
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

const initials = (n: string) => n.split(/[\s_-]+/).filter(Boolean).slice(0, 2).map((x) => x[0]!.toUpperCase()).join('');

function PersonCard({ p }: { p: Person }) {
  return (
    <div className="flex min-w-0 flex-col rounded-lg border border-line bg-paper p-3">
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sunk text-sm font-semibold text-ink-2">{initials(p.name)}</span>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium" title={p.name}>{p.name}</div>
          <div className="text-[11px] text-ink-3">{p.last ? `active ${new Date(p.last + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}{recent(p.firstAi, 30) && <span className="ml-1.5 rounded-full border border-ok px-1.5 text-ok">new to AI</span>}</div>
        </div>
      </div>
      <dl className="mt-2.5 grid grid-cols-3 gap-2 text-center text-[11px] text-ink-3">
        <div><dd className="text-base font-semibold tabular-nums text-ink">{p.commits}</dd><dt>commits</dt></div>
        <div><dd className="text-base font-semibold tabular-nums text-ink">{pct(p.ai, p.commits)}%</dd><dt>AI-assisted</dt></div>
        <div><dd className="text-base font-semibold tabular-nums text-ink">{p.agentPrs}<span className="text-xs font-normal text-ink-3">/{p.prs}</span></dd><dt>agent PRs</dt></div>
      </dl>
      {p.started.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{p.started.slice(0, 4).map((k) => <Link key={k} to={`/work/${k}/overview`} className="rounded border border-line px-1.5 font-mono text-[10.5px] text-ink-2 hover:border-ink">{k}</Link>)}{p.started.length > 4 && <span className="text-[10.5px] text-ink-3">+{p.started.length - 4}</span>}</div>}
      {p.repos.length > 0 && <div className="mt-1.5 truncate font-mono text-[10.5px] text-ink-3" title={p.repos.join(', ')}>{p.repos.join(', ')}</div>}
      {p.achievements.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{p.achievements.map((a) => <Pill key={a} className="text-[10.5px]">{a}</Pill>)}</div>}
    </div>
  );
}

/** Who uses agents, alphabetically (no ranking), then everyone else who contributed. */
export function PeopleCards({ ins }: { ins: Insights }) {
  const [all, setAll] = useState(false);
  const agentic = ins.people.filter(isAgentic);
  const rest = ins.people.filter((p) => !isAgentic(p));
  return (
    <Panel title={`People using agents · ${agentic.length}`} action={<span className="text-xs text-ink-3">alphabetical, last {ins.weeks.length - 1} weeks</span>}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {agentic.map((p) => <PersonCard key={p.name} p={p} />)}
      </div>
      {rest.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <button type="button" onClick={() => setAll(!all)} className="text-xs underline">{all ? 'Hide' : 'Show'} the other {rest.length} contributors</button>
          {all && <p className="mt-2 text-xs leading-relaxed text-ink-2">{rest.map((p) => `${p.name} (${p.commits + p.prs})`).join(' · ')}</p>}
        </div>
      )}
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
    '', '*Highlights*', ...ins.events.slice(0, 6).map((e) => `• ${e.text}`),
  ];
  return lines.join('\n');
}
