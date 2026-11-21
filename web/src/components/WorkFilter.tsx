import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { PHASES, PHASE_TITLE, type Spec } from '../lib/data';
import { Select } from './ui';

/** Where a work item came from: its intake kind, else read from the key (IDEA-7 is an idea, a tracker key is Jira). */
export function workType(s: Spec): string {
  const k = s.intake?.kind;
  if (k === 'idea' || k === 'jira' || k === 'github-issue' || k === 'pr') return k;
  return /(^|-)IDEA-\d+$/.test(s.key) ? 'idea' : 'jira';
}
const TYPE_TITLE: Record<string, string> = { idea: 'Idea', jira: 'Jira ticket', 'github-issue': 'GitHub issue', pr: 'Pull request' };
const NEEDS: [string, string][] = [['', 'Anything'], ['approval', 'Waiting for approval'], ['blocked', 'Has blocked tasks'], ['critical', 'Has critical findings']];
const SEP = ' · ';

const needsApproval = (s: Spec) => (['intent', 'spec', 'design'] as const).some((g) => g === s.phase && !s.approved?.[g]);

/** The work filter, kept in the URL so a filtered view can be shared: item (key or name), phase, who started it, type, what it needs, repo. */
export function useWorkFilter(all: Spec[]) {
  const [params, setParams] = useSearchParams();
  const get = (k: string) => params.get(k) || '';
  const set = (k: string, v: string) => setParams((p) => { if (v) p.set(k, v); else p.delete(k); return p; }, { replace: true });
  const raw = get('q');
  // a suggestion picked from the list is "KEY · title": match its key exactly
  const pickedKey = raw.includes(SEP) ? raw.split(SEP)[0] : '';
  const q = raw.toLowerCase();
  const f = { q: raw, phase: get('phase'), starter: get('by'), type: get('type'), needs: get('needs') || (get('flag') === 'blocked' || get('flag') === 'critical' ? get('flag') : ''), repo: get('repo') };
  const specs = all.filter((s) =>
    (!raw || (pickedKey ? s.key === pickedKey : `${s.key} ${s.title} ${s.intake?.summary || ''}`.toLowerCase().includes(q))) &&
    (!f.phase || s.phase === f.phase) &&
    (!f.starter || s.started_by?.name === f.starter) &&
    (!f.type || workType(s) === f.type) &&
    (!f.repo || s.repos.includes(f.repo)) &&
    (!f.needs || (f.needs === 'approval' ? needsApproval(s) : f.needs === 'blocked' ? s.tasks.blocked > 0 : (s.findings?.bySeverity.critical || 0) > 0)),
  );
  const active = Object.values(f).some(Boolean);
  const clear = () => setParams((p) => { ['q', 'phase', 'by', 'type', 'needs', 'flag', 'repo'].forEach((k) => p.delete(k)); return p; }, { replace: true });
  return { f, set, specs, active, clear };
}

export function WorkFilterBar({ all, filter, phase = true }: { all: Spec[]; filter: ReturnType<typeof useWorkFilter>; phase?: boolean }) {
  const { f, set, specs, active, clear } = filter;
  const repos = useMemo(() => [...new Set(all.flatMap((s) => s.repos))].sort(), [all]);
  const starters = useMemo(() => [...new Set(all.map((s) => s.started_by?.name).filter((x): x is string => !!x))].sort(), [all]);
  const types = useMemo(() => [...new Set(all.map(workType))], [all]);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <label className="inline-flex items-center gap-1.5 text-xs text-ink-3">
        <span>Work item</span>
        <input type="search" list="work-items" value={f.q} onChange={(e) => set('q', e.target.value)} placeholder="Ticket, idea or name" aria-label="Work item: ticket, idea or name"
          className="h-8 w-64 rounded-md border border-line-2 bg-paper px-2.5 text-sm text-ink" />
        <datalist id="work-items">{all.map((s) => <option key={s.key} value={`${s.key}${SEP}${s.title}`} />)}</datalist>
      </label>
      {phase && <Select label="Phase" value={f.phase} onChange={(v) => set('phase', v)} options={[['', 'Any'], ...PHASES.map((p) => [p, PHASE_TITLE[p]] as [string, string])]} />}
      <Select label="Needs" value={f.needs} onChange={(v) => { set('flag', ''); set('needs', v); }} options={NEEDS} />
      {types.length > 1 && <Select label="Type" value={f.type} onChange={(v) => set('type', v)} options={[['', 'Any'], ...types.map((t) => [t, TYPE_TITLE[t] || t] as [string, string])]} />}
      {starters.length > 1 && <Select label="Started by" value={f.starter} onChange={(v) => set('by', v)} options={[['', 'Anyone'], ...starters.map((n) => [n, n] as [string, string])]} />}
      <Select label="Repo" value={f.repo} onChange={(v) => set('repo', v)} options={[['', 'Any'], ...repos.map((r) => [r, r] as [string, string])]} />
      <span className="text-xs text-ink-3">{specs.length} of {all.length}</span>
      {active && <button type="button" onClick={clear} className="text-xs underline">Clear</button>}
    </div>
  );
}
