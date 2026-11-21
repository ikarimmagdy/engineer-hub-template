import { Link, NavLink } from 'react-router';
import { PHASES, PHASE_TITLE, useHub, type Phase, type Spec } from '../lib/data';
import { taskTotal } from '../lib/attention';
import { howRoute, phaseCommand, type Tab } from '../lib/routes';
import { CopyButton, cx } from './ui';

/** Which work-item tab holds what each phase produces. Overview, Documents and Activity span every phase. */
export const PHASE_TAB: Record<Phase, { tab: Tab; label: string } | null> = {
  intent: { tab: 'findings', label: 'Findings' },
  spec: { tab: 'requirements', label: 'Requirements' },
  design: { tab: 'design', label: 'Design' },
  build: { tab: 'tasks', label: 'Tasks' },
  test: { tab: 'tests', label: 'Tests' },
  deploy: null,
  maintain: null,
};
export const TAB_PHASE = Object.fromEntries(
  Object.entries(PHASE_TAB).filter(([, v]) => v).map(([p, v]) => [v!.tab, p as Phase]),
) as Partial<Record<Tab, Phase>>;

type Approvals = Record<string, { date: string; by: string } | null | undefined>;

export function phaseState(spec: Spec, p: Phase) {
  const at = PHASES.indexOf(spec.phase);
  const i = PHASES.indexOf(p);
  const approval = (spec.approved as Approvals)[p];
  const state: 'done' | 'now' | 'later' = i < at ? 'done' : i === at ? 'now' : 'later';
  let note = '';
  if (approval) note = `approved ${new Date(approval.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  else if (state === 'now') {
    note = p === 'build' ? `${spec.tasks.done}/${taskTotal(spec)} tasks done`
      : p === 'test' ? `${spec.criteria_passing}/${spec.criteria} passing`
      : ['intent', 'spec', 'design'].includes(p) ? 'waiting for approval' : 'current';
  } else if (state === 'done') note = 'done';
  else note = 'not started';
  return { state, note, approval, index: i };
}

function counts(spec: Spec): Partial<Record<Tab, number>> {
  return { findings: spec.findings?.open, requirements: spec.requirements, tasks: taskTotal(spec), tests: spec.criteria };
}

const SIDE: [Tab, string][] = [['overview', 'Overview']];
const AFTER: [Tab, string][] = [['agents', 'Agents'], ['chat', 'Chat'], ['impact', 'Impact'], ['documents', 'Documents'], ['activity', 'Activity']];

export function PhaseNav({ spec }: { spec: Spec }) {
  const c = counts(spec);
  const side = (t: Tab, label: string) => (
    <NavLink key={t} to={`/work/${spec.key}/${t}`}
      className={({ isActive }) => cx(
        'flex items-center rounded-lg border px-3.5 text-[15px]',
        isActive ? 'border-ink bg-ink font-semibold text-paper' : 'border-line bg-paper text-ink-2 hover:border-line-2 hover:text-ink',
      )}>
      {label}
    </NavLink>
  );
  return (
    <nav aria-label="Phases and views" className="relative -mx-4 mt-6 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
      <div className="flex min-w-[1140px] items-stretch gap-2">
        {SIDE.map(([t, l]) => side(t, l))}
        <ol className="grid flex-1 grid-cols-7 overflow-hidden rounded-lg border border-line">
          {PHASES.map((p) => {
            const st = phaseState(spec, p);
            const target = PHASE_TAB[p];
            const head = (
              <>
                <span className={cx('block h-[3px]', st.state === 'done' && 'bg-ink', st.state === 'now' && 'bg-brand', st.state === 'later' && 'bg-line-2')} />
                <span className="block px-3 pb-2.5 pt-2">
                  <span className={cx('flex items-center justify-between gap-2 text-xs', st.state === 'now' ? 'font-semibold text-ink' : 'text-ink-3')}>
                    <span><span className="tabular-nums">{st.index + 1}</span> {PHASE_TITLE[p]}{st.state === 'now' && <span className="sr-only"> (current phase)</span>}</span>
                    {target && c[target.tab] !== undefined && <span className="tab-count shrink-0 rounded-full bg-sunk px-1.5 py-px text-center text-[11px] font-medium tabular-nums text-ink-2">{c[target.tab]}</span>}
                  </span>
                  {target ? (
                    <span className="tab-label mt-0.5 block truncate text-[15px]">{target.label}</span>
                  ) : (
                    <span className="mt-0.5 block text-[15px] text-ink-3">–</span>
                  )}
                  <span className="mt-0.5 block truncate text-[11.5px] text-ink-3">{st.note}</span>
                </span>
              </>
            );
            return (
              <li key={p} className="min-w-0 border-l border-line first:border-l-0">
                {target ? (
                  <NavLink to={`/work/${spec.key}/${target.tab}`} aria-label={`${PHASE_TITLE[p]} phase: ${target.label}`}
                    className={({ isActive }) => cx(
                      'block h-full',
                      isActive ? 'bg-ink text-paper [&_.tab-count]:bg-paper [&_.tab-count]:text-ink [&_.tab-label]:font-semibold [&_*]:text-paper' : 'bg-paper text-ink-2 hover:bg-sunk hover:text-ink',
                    )}>
                    {head}
                  </NavLink>
                ) : <div className="h-full bg-paper">{head}</div>}
              </li>
            );
          })}
        </ol>
        {AFTER.map(([t, l]) => side(t, l))}
      </div>
    </nav>
  );
}

const isCommand = (s?: string): s is string => !!s && s.match(/^\/[\w-]+(?:\s+[^\s,;]+)*/)?.[0] === s.trim();

/** One line at the top of a phase's tab: where the phase stands, its gate, and the command that moves it. */
export function PhaseBanner({ spec, tab }: { spec: Spec; tab: Tab }) {
  const hub = useHub();
  const { manifest } = hub;
  const p = TAB_PHASE[tab];
  if (!p) return null;
  const st = phaseState(spec, p);
  const cfg = manifest.loopConfig.phases?.find((x) => x.key === p);
  const cmd = cfg?.command.split(',')[0]?.trim();
  const how = phaseCommand(hub, p);
  return (
    <div className={cx('mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-4 py-2.5 text-sm',
      st.state === 'now' ? 'border-brand/50 bg-paper' : 'border-line bg-sunk/50')}>
      <span className="font-semibold">Phase {st.index + 1} · {PHASE_TITLE[p]}</span>
      <span className={cx(st.state === 'now' ? 'text-ink' : 'text-ink-2')}>
        {st.state === 'now' ? 'Current phase' : st.state === 'done' ? 'Done' : 'Not started'}
        {st.approval ? `, approved by ${st.approval.by.replace(/\s*\(.*\)$/, '')} on ${st.approval.date}` : st.state === 'now' ? `, ${st.note}` : ''}
      </span>
      {cfg?.gate && <span className="text-ink-3">Gate: <span className="text-ink-2">{cfg.gate}</span></span>}
      {how && <Link to={howRoute(how)} className="text-ink-2 underline decoration-line-2 underline-offset-4 hover:decoration-ink">How this phase works</Link>}
      {st.state === 'now' && cmd && (
        <span className="ml-auto">
          <CopyButton text={isCommand(spec.next) && spec.next.startsWith(cmd) ? spec.next.trim() : `${cmd} ${spec.key}`} />
        </span>
      )}
    </div>
  );
}
