import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { getText, specDoc, TASK_STATES, trackerUrl, useAsync, useHub, type Spec, type TaskState } from '../lib/data';
import { renderInline } from '../lib/markdown';
import { coveredNumbers, parseSpec, reqNumber, type Requirement } from '../lib/spec';
import { parseTasks, type TaskRow } from '../lib/tasks';
import { MarkdownText, SectionedText } from '../components/Markdown';
import { CopyButton, cx, Empty, ErrorNote, Pill, Select, Skeleton, StatusText, TASK_TONE } from '../components/ui';

const STATE_LABEL: Record<TaskState, string> = { blocked: 'Blocked', doing: 'Doing', review: 'In review', todo: 'To do', done: 'Done' };

export function Requirements({ spec }: { spec: Spec }) {
  const [params, setParams] = useSearchParams();
  const md = useAsync(spec.files.spec ? () => getText(specDoc(spec, 'spec.md')) : null, [spec.dir]);
  const tasksMd = useAsync(spec.files.tasks ? () => getText(specDoc(spec, 'tasks.md')) : null, [spec.dir]);
  const parsed = useMemo(() => (md.data ? parseSpec(md.data) : null), [md.data]);
  const tasks = useMemo(() => {
    if (!tasksMd.data) return [];
    const status = new Map(spec.task_list.map((t) => [t.id, t.status]));
    return parseTasks(tasksMd.data).rows.map((r) => ({ ...r, status: status.get(r.id) || r.status, nums: coveredNumbers(r.covers) }));
  }, [tasksMd.data, spec.task_list]);

  if (!spec.files.spec) return <Empty action={<CopyButton text={`/spec ${spec.key}`} />}>There is no spec yet. It is written in the workspace with:</Empty>;
  if (md.loading) return <Skeleton lines={10} />;
  if (md.error || !parsed) return <ErrorNote>Could not load spec.md.</ErrorNote>;

  const menu: [string, string, number?][] = [
    ['requirements', 'Requirements', parsed.requirements.length],
    ...(parsed.intro ? [['overview', 'About this spec'] as [string, string]] : []),
    ...parsed.sections.map((s) => [s.slug, s.title] as [string, string]),
  ];
  const section = menu.some(([s]) => s === params.get('section')) ? params.get('section')! : 'requirements';
  const go = (s: string) => setParams(s === 'requirements' ? {} : { section: s }, { replace: false });
  const current = parsed.sections.find((s) => s.slug === section);
  const path = specDoc(spec, 'spec.md');

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
      <nav aria-label="Spec sections" className="lg:sticky lg:top-20 lg:self-start">
        <ul className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0">
          {menu.map(([s, label, n]) => (
            <li key={s} className="shrink-0">
              <button type="button" onClick={() => go(s)} aria-current={section === s ? 'page' : undefined}
                className={cx(
                  'flex w-full items-center justify-between gap-3 whitespace-nowrap rounded-md px-3 py-1.5 text-left text-sm lg:whitespace-normal',
                  section === s ? 'bg-ink font-medium text-paper' : 'text-ink-2 hover:bg-sunk hover:text-ink max-lg:border max-lg:border-line-2',
                )}>
                <span>{label}</span>
                {n !== undefined && <span className={cx('text-xs tabular-nums', section === s ? 'text-paper/80' : 'text-ink-3')}>{n}</span>}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-4 hidden text-xs text-ink-3 lg:block">From <Link to={`/doc/${path}`} className="underline">spec.md</Link>. Changes go through /spec and re-approval.</p>
      </nav>

      <div className="min-w-0">
        {section === 'requirements' && <RequirementList spec={spec} reqs={parsed.requirements} note={parsed.requirementsNote} tasks={tasks} path={path} />}
        {section === 'overview' && <><h2 className="mb-3 text-lg font-semibold">About this spec</h2><MarkdownText src={parsed.intro} path={path} /></>}
        {current && <><h2 className="mb-3 text-lg font-semibold">{current.title}</h2><SectionedText src={current.body} path={path} wide minLines={50} /></>}
      </div>
    </div>
  );
}

type TaskWithNums = TaskRow & { nums: Set<number> };

function RequirementList({ spec, reqs, note, tasks, path }: { spec: Spec; reqs: Requirement[]; note: string; tasks: TaskWithNums[]; path: string }) {
  const hub = useHub();
  const [params, setParams] = useSearchParams();
  const prio = params.get('priority') || '';
  const exist = params.get('existing') || '';
  const q = (params.get('q') || '').toLowerCase();
  const open = new Set((params.get('open') || '').split(',').filter(Boolean));
  const set = (k: string, v: string) => setParams((p) => { if (v) p.set(k, v); else p.delete(k); return p; }, { replace: true });
  const toggle = (id: string) => { const n = new Set(open); if (n.has(id)) n.delete(id); else n.add(id); set('open', [...n].join(',')); };

  const existingKind = (e: string) => e.toLowerCase().match(/^(new|partial|exists|existing|done|built)/)?.[1] || (e ? 'other' : '');
  const priorities = [...new Set(reqs.map((r) => r.priority).filter(Boolean))].sort();
  const kinds = [...new Set(reqs.map((r) => existingKind(r.existing)).filter(Boolean))].sort();
  const shown = reqs.filter((r) =>
    (!prio || r.priority === prio) && (!exist || existingKind(r.existing) === exist) &&
    (!q || `${r.id} ${r.text} ${r.story} ${r.criteria.map((c) => c.text).join(' ')}`.toLowerCase().includes(q)));
  const allOpen = shown.length > 0 && shown.every((r) => open.has(r.id));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input type="search" value={params.get('q') || ''} onChange={(e) => set('q', e.target.value)} placeholder="Search requirements and criteria" aria-label="Search requirements and criteria"
          className="h-8 w-64 rounded-md border border-line-2 bg-paper px-2.5 text-sm" />
        {priorities.length > 1 && <Select label="Priority" value={prio} onChange={(v) => set('priority', v)} options={[['', 'Any'], ...priorities.map((p) => [p, p] as [string, string])]} />}
        {kinds.length > 1 && <Select label="In the code" value={exist} onChange={(v) => set('existing', v)} options={[['', 'Any'], ...kinds.map((k) => [k, k] as [string, string])]} />}
        <span className="text-xs text-ink-3">{shown.length} of {reqs.length} · {reqs.reduce((n, r) => n + r.criteria.length, 0)} criteria</span>
        <button type="button" onClick={() => set('open', allOpen ? '' : shown.map((r) => r.id).join(','))} className="ml-auto text-sm text-ink-2 underline decoration-line-2 underline-offset-4 hover:text-ink">
          {allOpen ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-paper">
        {shown.map((r) => {
          const isOpen = open.has(r.id);
          const n = reqNumber(r.id);
          const covering = tasks.filter((t) => t.nums.has(n));
          const story = trackerUrl(hub, r.story);
          return (
            <li key={r.id}>
              <button type="button" onClick={() => toggle(r.id)} aria-expanded={isOpen}
                className="grid w-full grid-cols-[20px_minmax(0,1fr)] items-start gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-sunk md:grid-cols-[20px_120px_minmax(0,1fr)_auto]">
                <svg aria-hidden viewBox="0 0 20 20" className={cx('mt-0.5 size-4 text-ink-3 transition-transform', isOpen && 'rotate-90')}><path d="m7 5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
                <span className="font-mono text-[11.5px] text-ink-3 max-md:col-start-2 md:pt-0.5">{r.id}</span>
                <span className="min-w-0 font-medium max-md:col-start-2" dangerouslySetInnerHTML={{ __html: renderInline(r.short) }} />
                <span className="flex flex-wrap gap-1.5 max-md:col-start-2 md:justify-end">
                  {r.priority && <Pill>{r.priority}</Pill>}
                  <Pill>{r.criteria.length} {r.criteria.length === 1 ? 'criterion' : 'criteria'}</Pill>
                  {covering.length > 0 && <Pill>{covering.length} {covering.length === 1 ? 'task' : 'tasks'}</Pill>}
                </span>
              </button>
              {isOpen && (
                <div className="grid gap-5 border-t border-line bg-sunk/40 px-4 py-4 md:pl-[52px]">
                  <div>
                    <p className="max-w-[80ch] text-pretty" dangerouslySetInnerHTML={{ __html: renderInline(r.text) }} />
                    <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
                      {r.story && <span>Story {story ? <a href={story} target="_blank" rel="noopener" className="font-mono underline">{r.story}</a> : <span className="font-mono">{r.story}</span>}</span>}
                      {r.existing && <span>In the code: <span className="text-ink-2" dangerouslySetInnerHTML={{ __html: renderInline(r.existing) }} /></span>}
                    </p>
                  </div>
                  <div>
                    <h3 className="mb-2 text-xs font-semibold text-ink-2">Acceptance criteria</h3>
                    {r.criteria.length ? (
                      <ul className="space-y-2">
                        {r.criteria.map((c) => (
                          <li key={c.id} className="grid gap-x-3 md:grid-cols-[96px_minmax(0,1fr)]">
                            <span className="font-mono text-[11.5px] text-ink-3 md:pt-0.5">{c.id}</span>
                            <span className="max-w-[80ch] text-sm text-pretty" dangerouslySetInnerHTML={{ __html: renderInline(givenWhenThen(c.text)) }} />
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-sm text-block">No acceptance criterion yet. Every requirement needs at least one.</p>}
                  </div>
                  {covering.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-xs font-semibold text-ink-2">Tasks that cover it</h3>
                      <ul className="space-y-1.5">
                        {covering.map((t) => (
                          <li key={t.id} className="grid items-start gap-x-3 text-sm md:grid-cols-[48px_minmax(0,1fr)_100px]">
                            <span className="font-mono text-[11.5px] text-ink-3 md:pt-0.5">{t.id}</span>
                            <span className="min-w-0" dangerouslySetInnerHTML={{ __html: renderInline(t.task) }} />
                            {(TASK_STATES as readonly string[]).includes(t.status) && <StatusText tone={TASK_TONE[t.status as TaskState]}>{STATE_LABEL[t.status as TaskState]}</StatusText>}
                          </li>
                        ))}
                      </ul>
                      <Link to={`/work/${spec.key}/tasks`} className="mt-2 inline-block text-xs text-ink-3 underline">All tasks</Link>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
        {!shown.length && <li className="px-4 py-8 text-center text-sm text-ink-3">No requirement matches these filters.</li>}
      </ul>
      {note && <div className="mt-6 text-sm text-ink-2"><MarkdownText src={note} path={path} /></div>}
    </div>
  );
}

function givenWhenThen(text: string) {
  return text.replace(/\b(Given|when|then|and then)\b/g, (w) => `**${w}**`);
}
