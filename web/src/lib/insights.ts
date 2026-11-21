import { getJson, useAsync, type Spec } from './data';

/** content/data/insights.json, written by tools/sync_insights.py. Absent in hubs without a workspace. */
export interface Person {
  name: string; commits: number; ai: number; prs: number; agentPrs: number; repos: string[]; last: string | null; firstAi: string | null;
  started: string[]; weeks: number[]; achievements: string[]; agentRuns: number;
}
export interface Insights {
  generated: string; weeks: string[]; since: string;
  commits: { total: number; ai: number; repos: number; byWeek: { week: string; total: number; ai: number }[]; byRepo: { repo: string; total: number; ai: number }[] };
  prs: { available: boolean; total: number; merged: number; open: number; agent: number; agentMerged: number;
    byWeek: { week: string; total: number; agent: number; merged: number }[]; byRepo: { repo: string; total: number; agent: number; merged: number }[] };
  agents: { source: 'local' | 'shared'; sharedBy: string[]; total: number; thisWeek: number; byWeek: { week: string; runs: number }[]; byAgent: { agent: string; runs: number }[]; minutesPerRun: number };
  people: Person[];
  adoption: { group: string; repos: number; touched: number; names: string[] }[];
  events: NewsItem[];
}

export interface NewsItem { date: string; kind: string; text: string; detail?: string; key?: string; person?: string | null; value?: number }

/** Kinds of news: highlights (speed, quality, pictures, maps, first steps with AI) and routine loop events. */
export const NEWS_KIND: Record<string, { label: string; icon: string; routine?: boolean }> = {
  speed: { label: 'Speed', icon: '⏱' }, quality: { label: 'Quality', icon: '✓' }, diagrams: { label: 'Diagrams', icon: '◇' },
  map: { label: 'Code maps', icon: '⌘' }, new: { label: 'New to AI', icon: '★' }, pr: { label: 'Agent pull requests', icon: '⇡' },
  agent: { label: 'Agents', icon: '⚙' }, started: { label: 'Work started', icon: '＋', routine: true }, approved: { label: 'Approvals', icon: '◆', routine: true },
};

/** How much someone uses AI in their work: AI-assisted commits, agent pull requests and shared agent runs. */
export const usage = (p: Person) => p.ai + p.agentPrs + p.agentRuns;
export const topPeople = (ins: Insights, n: number) => [...ins.people].filter(isAgentic).sort((a, b) => usage(b) - usage(a) || a.name.localeCompare(b.name)).slice(0, n);

export function useInsights() {
  return useAsync(() => getJson<Insights>('content/data/insights.json').catch(() => null), []);
}

export const isAgentic = (p: Person) => p.ai > 0 || p.agentPrs > 0 || p.agentRuns > 0;
export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

/** The change from the week before the last full week to the last full week. */
export function lastChange(values: number[]) {
  const n = values.length;
  if (n < 3) return null;
  return values[n - 2] - values[n - 3];
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/** How long each gate takes, from status.json history: created → intent approved → spec approved → design approved → build. */
export function gateSpeed(specs: Spec[]) {
  const legs: [string, (h: Spec['history']) => [string?, string?]][] = [
    ['Intent approved', (h) => [h.find((x) => x.event.startsWith('created'))?.date, h.find((x) => x.event === 'approved intent')?.date]],
    ['Spec approved', (h) => [h.find((x) => x.event === 'approved intent')?.date, h.find((x) => x.event === 'approved spec')?.date]],
    ['Design approved', (h) => [h.find((x) => x.event === 'approved spec')?.date, h.find((x) => x.event === 'approved design')?.date]],
    ['Build started', (h) => [h.find((x) => x.event === 'approved design')?.date, h.find((x) => /-> build$/.test(x.event))?.date]],
  ];
  // a work item recorded after the fact (a forced phase move, or created and approved on the same day) took no real
  // time at its gates: leave it out rather than report a median of zero days
  const honest = specs.filter((s) => {
    const h = s.history || [];
    const created = h.find((x) => x.event.startsWith('created'))?.date;
    return !h.some((x) => x.forced?.length) && !h.some((x) => x.event === 'approved intent' && x.date === created);
  });
  return legs.map(([label, f]) => {
    const xs = honest.map((s) => f(s.history || [])).filter((p): p is [string, string] => !!p[0] && !!p[1]).map(([a, b]) => days(a, b)).filter((d) => d >= 0);
    return { label, median: median(xs), n: xs.length };
  });
}

/** Loop events (approvals, phase moves, tasks) per week, for the work-in-flight trend. */
export function loopActivity(specs: Spec[], weeks: string[]) {
  // local date parts, not toISOString: east of UTC, local midnight is the day before in UTC
  const iso = (t: Date) => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  const wk = (d: string) => { const t = new Date(d + 'T00:00:00'); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return iso(t); };
  const c = new Map<string, number>();
  for (const s of specs) for (const h of s.history || []) c.set(wk(h.date), (c.get(wk(h.date)) || 0) + 1);
  return weeks.map((w) => c.get(w) || 0);
}
