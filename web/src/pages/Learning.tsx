import { useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { useHub } from '../lib/data';
import {
  courseById, courseRoute, hours, isHtml, learningOf, lessonRoute, nextCourse, pathSteps, useProgress,
  type Course, type Learning as LearningData,
} from '../lib/learning';
import { HtmlPage, MarkdownFile, MarkdownText } from '../components/Markdown';
import { cx, Empty, PageHeader, Panel, Pill, Stat } from '../components/ui';

function Bar({ pct, label }: { pct: number; label: string }) {
  return (
    <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label} className="h-1 w-full overflow-hidden rounded-full bg-sunk">
      <div className="h-full rounded-full bg-ok" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** The page header already shows the lesson title, so a leading `# Title` line is dropped. */
const dropTitle = (src: string) => src.replace(/^(---\n[\s\S]*?\n---\n)?\s*# [^\n]*\n/, '$1');

const Crumb = ({ course }: { course?: Course }) => (
  <>
    <Link to="/learn" className="hover:underline">Learning</Link>
    {course && <> / <Link to={courseRoute(course.id)} className="hover:underline">{course.code || course.id}</Link></>}
  </>
);

function NoLearning() {
  return <Empty>This hub has no learning paths. Add content/learning/paths.json and its courses, then rebuild.</Empty>;
}

export function Learning() {
  const hub = useHub();
  const { course, lesson } = useParams();
  const l = learningOf(hub);
  if (!l) return <NoLearning />;
  if (course && lesson) return <LessonPage l={l} cid={course} lid={lesson} />;
  if (course) return <CoursePage l={l} cid={course} />;
  return <Paths l={l} />;
}

function Paths({ l }: { l: LearningData }) {
  const hub = useHub();
  const { progress, stats, isDone, reset } = useProgress(hub);
  const total = l.courses.reduce((n, c) => n + c.lessons.length, 0);
  const done = Object.keys(progress.done || {}).length;
  const mins = l.courses.reduce((m, c) => m + stats(c).mins, 0);
  const [rc, rl] = (progress.last || '').split('/');
  const rCourse = courseById(l, rc);
  const rLesson = rCourse?.lessons.find((x) => x.id === rl);

  return (
    <div>
      <PageHeader crumb="Learning" title={l.title || 'Learning paths'} lede={l.lede || 'Courses in a deliberate order. Each lesson assumes only the ones before it.'} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat value={l.courses.length} label="Courses" />
        <Stat value={total} label="Lessons" />
        <div className="rounded-lg border border-line bg-paper px-4 py-3">
          <div className="text-2xl font-semibold tabular-nums leading-tight">{done}</div>
          <div className="mb-2 mt-0.5 text-xs text-ink-3">Completed by you</div>
          <Bar pct={total ? Math.round((done / total) * 100) : 0} label="Lessons completed" />
        </div>
        <Stat value={hours(mins)} label="Total study time" />
      </div>

      {rCourse && rLesson && (
        <Link to={lessonRoute(rCourse.id, rLesson.id)} className="mt-4 block rounded-lg border border-line-2 bg-paper px-4 py-3 hover:border-brand">
          <span className="block text-xs text-ink-3">Continue where you left off</span>
          <b className="text-sm">{rCourse.code || rCourse.id} · {rLesson.title}</b>
        </Link>
      )}

      {l.intro && <div className="mt-6"><MarkdownText src={l.intro} path="content/learning/paths.json" /></div>}

      <div className="mt-6 space-y-5">
        {l.paths.map((p) => {
          const steps = pathSteps(l, p);
          const stepDone = (s: (typeof steps)[number]) => (s.lesson ? isDone(s.course.id, s.lesson.id) : stats(s.course).pct === 100);
          const d = steps.filter(stepDone).length;
          return (
            <Panel key={p.id} title={p.title} action={<span className="text-xs tabular-nums text-ink-3">{d}/{steps.length} steps</span>}>
              {p.summary && <p className="mb-3 text-sm text-ink-2">{p.summary}</p>}
              <ol className="space-y-1.5">
                {steps.map((s, i) => {
                  const ok = stepDone(s);
                  const st = s.lesson ? null : stats(s.course);
                  const to = s.lesson ? lessonRoute(s.course.id, s.lesson.id) : courseRoute(s.course.id);
                  return (
                    <li key={`${s.course.id}/${s.lesson?.id || ''}/${i}`}>
                      <Link to={to} className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-sunk">
                        <span aria-hidden className={cx('grid size-6 shrink-0 place-items-center rounded-full border text-xs tabular-nums', ok ? 'border-ok bg-ok text-paper' : 'border-line-2 text-ink-2')}>{ok ? '✓' : i + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-mono text-[11px] text-ink-3">{s.course.code || s.course.id}{s.lesson ? ' · lesson' : ''}</span>
                          <b className="block text-sm">{s.lesson ? s.lesson.title : s.course.title}</b>
                          <span className="block text-xs text-ink-3">
                            {s.lesson ? `${s.lesson.minutes || ''} min` : `${st!.n} lessons · ${hours(st!.mins)}${s.course.level ? ` · ${s.course.level}` : ''}`}
                          </span>
                          {st && <span className="mt-1.5 block max-w-xs"><Bar pct={st.pct} label={`${s.course.title} progress`} /></span>}
                          <span className="sr-only">{ok ? 'Completed' : 'Not completed'}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </Panel>
          );
        })}
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">All courses</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {l.courses.map((c) => {
          const st = stats(c);
          return (
            <Link key={c.id} to={courseRoute(c.id)} className="flex flex-col rounded-lg border border-line bg-paper px-4 py-3 hover:border-brand">
              <span className="flex flex-wrap items-center gap-2"><span className="font-mono text-[11px] text-ink-3">{c.code || c.id}</span>{c.level && <Pill>{c.level}</Pill>}</span>
              <b className="mt-1 text-sm">{c.title}</b>
              {c.goal && <span className="mt-1 line-clamp-3 text-xs text-ink-2">{c.goal}</span>}
              <span className="mb-2 mt-auto pt-2 text-xs text-ink-3">{st.n} lessons · {hours(st.mins)} · {st.pct}% done</span>
              <Bar pct={st.pct} label={`${c.title} progress`} />
            </Link>
          );
        })}
      </div>
      <p className="mt-8 text-xs text-ink-3">
        Progress is saved in this browser only.{' '}
        <button type="button" className="underline" onClick={() => { if (confirm('Clear your learning progress in this browser?')) reset(); }}>Reset my progress</button>
      </p>
    </div>
  );
}

function CoursePage({ l, cid }: { l: LearningData; cid: string }) {
  const hub = useHub();
  const { stats, isDone } = useProgress(hub);
  const c = courseById(l, cid);
  if (!c) return <Empty action={<Link className="underline" to="/learn">Learning paths</Link>}>No course {cid}.</Empty>;
  const st = stats(c);
  const next = c.lessons.find((x) => !isDone(c.id, x.id)) || c.lessons[0];
  const pre = (c.prereqs || []).map((id) => courseById(l, id)).filter((x): x is Course => !!x);
  const preOpen = pre.filter((p) => stats(p).pct < 100);

  return (
    <div>
      <PageHeader
        crumb={<Crumb />}
        title={c.title}
        lede={c.goal}
        actions={<span className="flex flex-wrap gap-2"><Pill>{c.code || c.id}</Pill>{c.level && <Pill>{c.level}</Pill>}<Pill>{st.n} lessons · {hours(st.mins)}</Pill></span>}
      />
      {preOpen.length > 0 && (
        <p className="mb-4 rounded-md border border-line-2 bg-sunk px-3 py-2 text-sm">
          <b>Take these first:</b>{' '}
          {preOpen.map((p, i) => <span key={p.id}>{i > 0 && ', '}<Link className="underline" to={courseRoute(p.id)}>{p.title}</Link></span>)}. The lessons here assume them.
        </p>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-4">
          {(c.outcomes || []).length > 0 && (
            <Panel title="By the end of this course you can">
              <ul className="list-disc space-y-1 ps-5 text-sm text-ink-2">{c.outcomes!.map((o) => <li key={o}>{o}</li>)}</ul>
            </Panel>
          )}
          <Panel title="Lessons">
            <ol className="space-y-0.5">
              {c.lessons.map((x, i) => {
                const ok = isDone(c.id, x.id);
                return (
                  <li key={x.id}>
                    <Link to={lessonRoute(c.id, x.id)} className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-sunk">
                      <span aria-hidden className={cx('grid size-6 shrink-0 place-items-center rounded-full border text-[11px] tabular-nums', ok ? 'border-ok bg-ok text-paper' : 'border-line-2 text-ink-2')}>{ok ? '✓' : String(i + 1).padStart(2, '0')}</span>
                      <span className="min-w-0">
                        <b className="block text-sm">{x.title}</b>
                        <span className="block text-xs text-ink-3">{x.minutes || ''} min{x.objectives?.[0] ? ` · ${x.objectives[0]}` : ''}</span>
                        <span className="sr-only">{ok ? 'Completed' : 'Not completed'}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </Panel>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Panel>
            <div className="text-2xl font-semibold tabular-nums">{st.pct}%</div>
            <div className="mb-2 text-xs text-ink-3">{st.d} of {st.n} lessons done</div>
            <Bar pct={st.pct} label="Course progress" />
            {next && (
              <Link to={lessonRoute(c.id, next.id)} className="mt-3 inline-flex h-9 items-center rounded-md bg-ink px-3 text-sm font-medium text-paper hover:opacity-90">
                {st.d ? 'Continue' : 'Start the course'}
              </Link>
            )}
          </Panel>
          {pre.length > 0 && (
            <Panel title="Prerequisites">
              <ul className="space-y-1 text-sm">
                {pre.map((p) => <li key={p.id}>{stats(p).pct === 100 ? '✓' : '○'} <Link className="underline" to={courseRoute(p.id)}>{p.code || p.id} {p.title}</Link></li>)}
              </ul>
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
}

function LessonPage({ l, cid, lid }: { l: LearningData; cid: string; lid: string }) {
  const hub = useHub();
  const { isDone, setDone, setLast } = useProgress(hub);
  const c = courseById(l, cid);
  const i = c ? c.lessons.findIndex((x) => x.id === lid) : -1;
  useEffect(() => { if (c && i >= 0) setLast(cid, lid); }, [cid, lid, i, c, setLast]);
  if (!c || i < 0) return <Empty action={<Link className="underline" to="/learn">Learning paths</Link>}>No lesson {cid}/{lid}.</Empty>;

  const x = c.lessons[i];
  const prev = c.lessons[i - 1];
  const next = c.lessons[i + 1];
  const nc = next ? undefined : nextCourse(l, cid);
  const done = isDone(cid, lid);
  const html = isHtml(x.src);
  const moveOn = () => setDone(cid, lid, true);

  return (
    <div>
      <PageHeader
        crumb={<><Crumb course={c} /> / Lesson {i + 1} of {c.lessons.length}{x.minutes ? ` · ${x.minutes} min` : ''}</>}
        title={x.title}
      />
      <nav aria-label="Lessons in this course" className="mb-5 flex flex-wrap gap-1.5">
        {c.lessons.map((y, k) => (
          <Link key={y.id} to={lessonRoute(cid, y.id)} title={y.title} aria-label={`Lesson ${k + 1}: ${y.title}${isDone(cid, y.id) ? ', completed' : ''}`}
            aria-current={k === i ? 'page' : undefined}
            className={cx('h-2 w-6 rounded-full', k === i ? 'bg-brand' : isDone(cid, y.id) ? 'bg-ok' : 'bg-line-2 hover:bg-ink-3')} />
        ))}
      </nav>

      {!html && (x.objectives || []).length > 0 && (
        <Panel title="After this lesson you can" className="mb-5">
          <ul className="list-disc space-y-1 ps-5 text-sm text-ink-2">{x.objectives!.map((o) => <li key={o}>{o}</li>)}</ul>
        </Panel>
      )}

      {html ? <HtmlPage path={x.src} title={x.title} /> : <MarkdownFile path={x.src} wide transform={dropTitle} missing={`Lesson not written yet: ${x.src}`} />}

      {(x.checks || []).length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Check your understanding</h2>
          <p className="mb-3 text-sm text-ink-3">Answer in your own words first, then open the answer.</p>
          <ol className="list-decimal space-y-3 ps-5">
            {x.checks!.map((q) => (
              <li key={q.q} className="text-sm">
                <p>{q.q}</p>
                <details className="mt-1 rounded-md border border-line px-3 py-2">
                  <summary className="cursor-pointer text-ink-2">Show the answer</summary>
                  <p className="mt-2 text-ink-2">{q.a}</p>
                </details>
              </li>
            ))}
          </ol>
        </section>
      )}

      {(x.sources || []).length > 0 && (
        <p className="mt-6 break-words text-xs text-ink-3">Sources: {x.sources!.map((s, k) => <span key={s}>{k > 0 && ', '}<code>{s}</code></span>)}</p>
      )}

      <div className="mt-8 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Link to={prev ? lessonRoute(cid, prev.id) : courseRoute(cid)} className="text-sm text-ink-2 hover:text-ink">
          <span className="block text-xs text-ink-3">Previous</span>{prev ? prev.title : 'Course outline'}
        </Link>
        <button type="button" onClick={() => setDone(cid, lid, !done)} aria-pressed={done}
          className={cx('h-9 rounded-md border px-3 text-sm font-medium', done ? 'border-ok text-ok' : 'border-line-2 hover:bg-sunk')}>
          {done ? '✓ Completed' : 'Mark complete'}
        </button>
        {next ? (
          <Link to={lessonRoute(cid, next.id)} onClick={moveOn} className="text-sm text-ink-2 hover:text-ink sm:text-end">
            <span className="block text-xs text-ink-3">Next</span>{next.title}
          </Link>
        ) : nc ? (
          <Link to={courseRoute(nc.id)} onClick={moveOn} className="text-sm text-ink-2 hover:text-ink sm:text-end">
            <span className="block text-xs text-ink-3">Next course</span>{nc.code || ''} {nc.title}
          </Link>
        ) : (
          <Link to="/learn" onClick={moveOn} className="text-sm text-ink-2 hover:text-ink sm:text-end">
            <span className="block text-xs text-ink-3">Done</span>Back to learning paths
          </Link>
        )}
      </div>
    </div>
  );
}
