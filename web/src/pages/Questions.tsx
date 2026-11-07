import { useMemo, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useHub } from '../lib/data';
import {
  gapsMentioning, isOpen, linkage, PRIORITIES, resolveTarget, uniq, useQa, writeData,
  type QaData, type Question, type Target, type WorkLink,
} from '../lib/qa';
import { cx, Empty, ErrorNote, fmtDate, PageHeader, Panel, Pill, Select, Skeleton, Stat, StatusText, TabBar } from '../components/ui';

const today = () => new Date().toISOString().slice(0, 10);
const input = 'w-full rounded-md border border-line-2 bg-paper px-2.5 py-1.5 text-sm';

export function Questions() {
  const { view = 'list' } = useParams();
  const { data, error, reload } = useQa();
  if (error) return <ErrorNote>The questions did not load ({error}).</ErrorNote>;
  if (!data) return <Skeleton lines={6} />;
  const open = data.questions.filter(isOpen).length;
  return (
    <div>
      <PageHeader
        title="Questions"
        lede="Every question we need answered, who answers it, and the work it holds up. Answering a question here shows which work it releases."
        actions={<WriteMode writable={data.writable} />}
      />
      <TabBar
        label="Questions views"
        className="mb-5"
        tabs={[
          { to: '/questions', label: 'All questions', count: data.questions.length, end: true },
          { to: '/questions/linkage', label: 'Work and questions', count: open },
        ]}
      />
      {view === 'linkage' ? <Linkage data={data} reload={reload} /> : <QuestionList data={data} reload={reload} />}
    </div>
  );
}

function WriteMode({ writable }: { writable: boolean }) {
  return writable
    ? <Pill tone="ok">Editing on: changes save to content/data</Pill>
    : <Pill tone="wait">Read-only: run the hub locally to edit</Pill>;
}

function QuestionList({ data, reload }: { data: QaData; reload: () => void }) {
  const [params, setParams] = useSearchParams();
  const set = (k: string, v: string) => setParams((p) => { if (v) p.set(k, v); else p.delete(k); return p; }, { replace: true });
  const who = params.get('who') || '';
  const status = params.get('status') || 'open';
  const priority = params.get('priority') || '';
  const category = params.get('category') || '';
  const work = params.get('work') || '';
  const text = (params.get('q') || '').toLowerCase();
  const [adding, setAdding] = useState(false);

  const askers = useMemo(() => uniq(data.questions.map((q) => q.askWho)), [data]);
  const perWho = askers.map((w) => ({ w, open: data.questions.filter((q) => q.askWho === w && isOpen(q)).length, all: data.questions.filter((q) => q.askWho === w).length }))
    .sort((a, b) => b.open - a.open);
  const rows = data.questions.filter((q) =>
    (!who || q.askWho === who) &&
    (status === 'all' || (status === 'open' ? isOpen(q) : !isOpen(q))) &&
    (!priority || q.priority === priority) &&
    (!category || q.category === category) &&
    (!work || (q.blocks || []).some((b) => b.toLowerCase() === work.toLowerCase())) &&
    (!text || `${q.id} ${q.question} ${q.why || ''} ${q.answer || ''}`.toLowerCase().includes(text)),
  ).sort((a, b) => (a.priority || 'P9').localeCompare(b.priority || 'P9') || a.id.localeCompare(b.id, undefined, { numeric: true }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {perWho.slice(0, 6).map(({ w, open, all }) => (
          <button key={w} type="button" onClick={() => set('who', who === w ? '' : w)} className={cx('text-start', who === w && 'ring-2 ring-brand rounded-lg')}>
            <Stat value={open} label={<>{w}: open of {all}</>} tone={open ? 'run' : 'ok'} />
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input type="search" value={params.get('q') || ''} onChange={(e) => set('q', e.target.value)} placeholder="Search questions and answers"
          aria-label="Search questions and answers" className="h-8 w-60 rounded-md border border-line-2 bg-paper px-2.5 text-sm" />
        <Select label="Ask who" value={who} onChange={(v) => set('who', v)} options={[['', 'Anyone'], ...askers.map((a) => [a, a] as [string, string])]} />
        <Select label="Status" value={status} onChange={(v) => set('status', v === 'open' ? '' : v)} options={[['open', 'Open'], ['answered', 'Answered'], ['all', 'All']]} />
        <Select label="Priority" value={priority} onChange={(v) => set('priority', v)} options={[['', 'Any'], ...PRIORITIES.map((p) => [p, p] as [string, string])]} />
        <Select label="Category" value={category} onChange={(v) => set('category', v)} options={[['', 'Any'], ...uniq(data.questions.map((q) => q.category)).map((c) => [c, c] as [string, string])]} />
        {work && <button type="button" onClick={() => set('work', '')} className="text-xs underline">Linked to {work} (clear)</button>}
        <span className="text-xs text-ink-3">{rows.length} shown</span>
        {data.writable && <button type="button" onClick={() => setAdding((a) => !a)} className="ml-auto rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-paper">{adding ? 'Close' : 'New question'}</button>}
      </div>
      {adding && <NewQuestion data={data} onDone={() => { setAdding(false); reload(); }} />}
      {rows.length === 0
        ? <Empty action={<button type="button" className="underline" onClick={() => setParams({}, { replace: true })}>Clear filters</button>}>No questions match these filters.</Empty>
        : <ul className="space-y-2">{rows.map((q) => <QuestionRow key={q.id} q={q} data={data} reload={reload} />)}</ul>}
    </div>
  );
}

function QuestionRow({ q, data, reload }: { q: Question; data: QaData; reload: () => void }) {
  const hub = useHub();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const gaps = gapsMentioning(q.id, data.gaps);
  return (
    <li id={q.id} className="rounded-lg border border-line bg-paper">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-start gap-3 px-4 py-3 text-start">
        <span className="w-14 shrink-0 font-mono text-[11.5px] text-ink-3">{q.id}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{q.question}</span>
          <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-3">
            <StatusText tone={isOpen(q) ? 'run' : 'ok'}>{isOpen(q) ? 'Open' : `Answered${q.answeredOn ? ` ${fmtDate(q.answeredOn)}` : ''}`}</StatusText>
            {q.priority && <Pill tone={q.priority === 'P0' ? 'block' : undefined}>{q.priority}</Pill>}
            <span>{q.askWho}</span>
            {q.category && <span>{q.category}</span>}
            {!!q.blocks?.length && <span>blocks {q.blocks.length}</span>}
          </span>
        </span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-line px-4 py-3 text-sm">
          {q.why && <Field label="Why it matters">{q.why}</Field>}
          {(q.ifYes || q.ifNo) && (
            <div className="grid gap-3 md:grid-cols-2">
              {q.ifYes && <Field label="If yes">{q.ifYes}</Field>}
              {q.ifNo && <Field label="If no">{q.ifNo}</Field>}
            </div>
          )}
          {q.answer && <Field label={`Answer${q.answeredOn ? `, ${fmtDate(q.answeredOn)}` : ''}`}>{q.answer}</Field>}
          <Field label="Holds up">
            {q.blocks?.length ? (
              <ul className="space-y-1.5">
                {q.blocks.map((b) => <li key={b}><TargetLine t={resolveTarget(b, data, hub)} data={data} reload={reload} /></li>)}
              </ul>
            ) : <span className="text-ink-3">No linked work.</span>}
          </Field>
          {gaps.length > 0 && (
            <Field label="Gaps that mention it">
              <ul className="space-y-1.5">{gaps.map((g) => <li key={g.id}><TargetLine t={{ kind: 'gap', id: g.id, gap: g }} data={data} reload={reload} /></li>)}</ul>
            </Field>
          )}
          {q.source && <p className="text-xs text-ink-3">Source: {q.source}{q.raised ? `, raised ${fmtDate(q.raised)}` : ''}</p>}
          {data.writable && (editing
            ? <EditQuestion q={q} data={data} onDone={() => { setEditing(false); reload(); }} />
            : <button type="button" onClick={() => setEditing(true)} className="rounded-md border border-line-2 px-3 py-1 text-sm hover:border-ink-3">Edit or answer</button>)}
        </div>
      )}
    </li>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><div className="mb-0.5 text-xs font-medium text-ink-3">{label}</div><div className="text-pretty">{children}</div></div>;
}

function stageTitle(data: QaData, key?: string) {
  return data.stages.find((s) => s.key === key)?.title || key || 'No stage';
}

/** One linked item with its state, and on a writable hub a control to move it on. */
function TargetLine({ t, data, reload }: { t: Target; data: QaData; reload: () => void }) {
  const [err, setErr] = useState('');
  const save = (p: Promise<unknown>) => p.then(() => { setErr(''); reload(); }, (e) => setErr(String(e.message || e)));
  if (t.kind === 'feature') {
    const f = t.feature;
    return (
      <span className="flex flex-wrap items-center gap-2">
        {t.spec ? <Link to={`/work/${t.spec}/overview`} className="font-mono text-[11.5px] underline">{f.fid || f.id}</Link> : <span className="font-mono text-[11.5px]">{f.fid || f.id}</span>}
        <span>{f.title}</span>
        {data.writable && data.stages.length ? (
          <select aria-label={`Stage of ${f.fid || f.id}`} value={f.lifecycle || ''} className="rounded-md border border-line-2 bg-paper px-1.5 py-0.5 text-xs"
            onChange={(e) => save(writeData('features.json', { op: 'update', id: f.id, set: { lifecycle: e.target.value } }))}>
            {!f.lifecycle && <option value="">No stage</option>}
            {data.stages.map((s) => <option key={s.key} value={s.key}>{s.title}</option>)}
          </select>
        ) : <Pill>{stageTitle(data, f.lifecycle)}</Pill>}
        {err && <span role="alert" className="text-xs text-block">{err}</span>}
      </span>
    );
  }
  if (t.kind === 'work') return <span className="flex gap-2"><Link to={`/work/${t.spec}/overview`} className="font-mono text-[11.5px] underline">{t.spec}</Link><span>work item</span></span>;
  if (t.kind === 'gap') return <GapLine t={t} data={data} reload={reload} />;
  return <span className="font-mono text-[11.5px] text-ink-3">{t.id}</span>;
}

function GapLine({ t, data, reload }: { t: Extract<Target, { kind: 'gap' }>; data: QaData; reload: () => void }) {
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const g = t.gap;
  const statuses = uniq([...data.gaps.map((x) => x.status), 'open', 'fixed']);
  const save = (p: Promise<unknown>) => p.then(() => { setErr(''); setNote(''); reload(); }, (e) => setErr(String(e.message || e)));
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-[11.5px]">{g.id}</span>
      <span>{g.title}</span>
      {data.writable ? (
        <>
          <select aria-label={`Status of ${g.id}`} value={g.status} className="rounded-md border border-line-2 bg-paper px-1.5 py-0.5 text-xs"
            onChange={(e) => save(writeData('gaps.json', { op: 'update', id: g.id, set: { status: e.target.value } }))}>
            {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a dated note" aria-label={`Note on ${g.id}`} className="h-7 w-48 rounded-md border border-line-2 bg-paper px-2 text-xs" />
          <button type="button" disabled={!note.trim()} onClick={() => save(writeData('gaps.json', { op: 'append', id: g.id, field: 'summary', text: note }))}
            className="rounded-md border border-line-2 px-2 py-0.5 text-xs disabled:opacity-40">Add note</button>
        </>
      ) : <StatusText tone={g.status === 'open' ? 'run' : 'ok'}>{g.status}</StatusText>}
      {err && <span role="alert" className="text-xs text-block">{err}</span>}
    </span>
  );
}

function EditQuestion({ q, data, onDone }: { q: Question; data: QaData; onDone: () => void }) {
  const [status, setStatus] = useState(q.status);
  const [answer, setAnswer] = useState(q.answer || '');
  const [answeredOn, setAnsweredOn] = useState(q.answeredOn || '');
  const [priority, setPriority] = useState(q.priority || 'P1');
  const [blocks, setBlocks] = useState((q.blocks || []).join(', '));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const answering = status === 'answered';

  const submit = async () => {
    const set: Record<string, unknown> = {
      status, priority, answer,
      answeredOn: answering ? (answeredOn || today()) : answeredOn,
      blocks: blocks.split(/[,\s]+/).map((b) => b.trim()).filter(Boolean),
    };
    if (!answer && !q.answer) delete set.answer;
    setBusy(true);
    try { await writeData('questions.json', { op: 'update', id: q.id, set }); onDone(); } catch (e) { setErr(String((e as Error).message || e)); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3 rounded-md border border-line-2 bg-sunk p-3">
      <div className="flex flex-wrap gap-3">
        <Select label="Status" value={status} onChange={setStatus} options={uniq([...data.questions.map((x) => x.status), 'open', 'answered']).map((s) => [s, s] as [string, string])} />
        <Select label="Priority" value={priority} onChange={setPriority} options={PRIORITIES.map((p) => [p, p] as [string, string])} />
        <label className="inline-flex items-center gap-1.5 text-xs text-ink-3">Answered on
          <input type="date" value={answeredOn} onChange={(e) => setAnsweredOn(e.target.value)} className="rounded-md border border-line-2 bg-paper px-2 py-0.5 text-xs text-ink" />
        </label>
      </div>
      <label className="block text-xs text-ink-3">Answer
        <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={4} className={cx(input, 'mt-1 text-ink')} placeholder="Who answered, when, and what it means for the work" />
      </label>
      <label className="block text-xs text-ink-3">Holds up (ids, comma separated: work items, features, gaps)
        <input value={blocks} onChange={(e) => setBlocks(e.target.value)} className={cx(input, 'mt-1 font-mono text-ink')} />
      </label>
      {err && <ErrorNote>{err}</ErrorNote>}
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={busy || (answering && !answer.trim())} className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-paper disabled:opacity-40">Save</button>
        <button type="button" onClick={onDone} className="rounded-md border border-line-2 px-3 py-1.5 text-sm">Cancel</button>
        {answering && !answer.trim() && <span className="self-center text-xs text-ink-3">An answered question needs its answer.</span>}
      </div>
    </div>
  );
}

function NewQuestion({ data, onDone }: { data: QaData; onDone: () => void }) {
  const askers = uniq(data.questions.map((q) => q.askWho));
  const categories = uniq(data.questions.map((q) => q.category));
  const [f, setF] = useState({ question: '', askWho: askers[0] || '', category: categories[0] || '', priority: 'P1', why: '', blocks: '' });
  const [err, setErr] = useState('');
  const upd = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const submit = async () => {
    try {
      await writeData('questions.json', {
        op: 'add',
        item: { question: f.question, askWho: f.askWho, category: f.category, priority: f.priority, why: f.why, blocks: f.blocks.split(/[,\s]+/).filter(Boolean) },
      });
      onDone();
    } catch (e) { setErr(String((e as Error).message || e)); }
  };
  return (
    <Panel title="New question">
      <div className="space-y-3">
        <label className="block text-xs text-ink-3">Question
          <textarea value={f.question} onChange={(e) => upd('question')(e.target.value)} rows={2} className={cx(input, 'mt-1 text-ink')} />
        </label>
        <div className="flex flex-wrap gap-3">
          <label className="inline-flex items-center gap-1.5 text-xs text-ink-3">Ask who
            <input list="hub-askers" value={f.askWho} onChange={(e) => upd('askWho')(e.target.value)} className="rounded-md border border-line-2 bg-paper px-2 py-1 text-xs text-ink" />
            <datalist id="hub-askers">{askers.map((a) => <option key={a} value={a} />)}</datalist>
          </label>
          <Select label="Category" value={f.category} onChange={upd('category')} options={categories.map((c) => [c, c] as [string, string])} />
          <Select label="Priority" value={f.priority} onChange={upd('priority')} options={PRIORITIES.map((p) => [p, p] as [string, string])} />
        </div>
        <label className="block text-xs text-ink-3">Why it matters
          <textarea value={f.why} onChange={(e) => upd('why')(e.target.value)} rows={2} className={cx(input, 'mt-1 text-ink')} />
        </label>
        <label className="block text-xs text-ink-3">Holds up (ids, comma separated)
          <input value={f.blocks} onChange={(e) => upd('blocks')(e.target.value)} className={cx(input, 'mt-1 font-mono text-ink')} />
        </label>
        {err && <ErrorNote>{err}</ErrorNote>}
        <button type="button" onClick={submit} disabled={!f.question.trim() || !f.askWho.trim()} className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-paper disabled:opacity-40">Add question</button>
      </div>
    </Panel>
  );
}

function Linkage({ data, reload }: { data: QaData; reload: () => void }) {
  const hub = useHub();
  const rows = useMemo(() => linkage(data, hub), [data, hub]);
  const waiting = rows.filter((r) => r.open.length > 0);
  const released = rows.filter((r) => r.open.length === 0 && r.resolved.length > 0);
  const partly = waiting.filter((r) => r.resolved.length > 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat value={waiting.length} label="Work waiting on open questions" tone="run" />
        <Stat value={partly.length} label="Waiting, some questions already answered" />
        <Stat value={released.length} label="All linked questions answered" tone="ok" />
        <Stat value={data.questions.filter((q) => isOpen(q) && !q.blocks?.length).length} label="Open questions with no linked work" />
      </div>
      <Panel title="Waiting on open questions">
        <LinkTable rows={waiting} data={data} reload={reload} />
      </Panel>
      <Panel title="Released: every linked question is answered">
        <LinkTable rows={released} data={data} reload={reload} />
      </Panel>
    </div>
  );
}

function LinkTable({ rows, data, reload }: { rows: WorkLink[]; data: QaData; reload: () => void }) {
  if (!rows.length) return <Empty>Nothing here.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-start text-xs text-ink-3">
          <tr><th className="py-1.5 pr-3 font-medium">Work</th><th className="py-1.5 pr-3 font-medium">Stage</th><th className="py-1.5 pr-3 font-medium">Open questions</th><th className="py-1.5 font-medium">Answered (resolved links)</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-line align-top">
              <td className="py-2 pr-3"><TargetLine t={r.target} data={{ ...data, writable: false }} reload={reload} /></td>
              <td className="py-2 pr-3">{r.target.kind === 'feature' ? <StageControl r={r} data={data} reload={reload} /> : <span className="text-ink-3">{r.target.kind}</span>}</td>
              <td className="py-2 pr-3"><QLinks qs={r.open} /></td>
              <td className="py-2"><QLinks qs={r.resolved} resolved /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StageControl({ r, data, reload }: { r: WorkLink; data: QaData; reload: () => void }) {
  const [err, setErr] = useState('');
  if (r.target.kind !== 'feature') return null;
  const f = r.target.feature;
  if (!data.writable || !data.stages.length) return <Pill>{stageTitle(data, f.lifecycle)}</Pill>;
  return (
    <>
      <select aria-label={`Stage of ${f.fid || f.id}`} value={f.lifecycle || ''} className="rounded-md border border-line-2 bg-paper px-1.5 py-0.5 text-xs"
        onChange={(e) => writeData('features.json', { op: 'update', id: f.id, set: { lifecycle: e.target.value } }).then(reload, (x) => setErr(String(x.message || x)))}>
        {!f.lifecycle && <option value="">No stage</option>}
        {data.stages.map((s) => <option key={s.key} value={s.key}>{s.title}</option>)}
      </select>
      {err && <div role="alert" className="text-xs text-block">{err}</div>}
    </>
  );
}

function QLinks({ qs, resolved }: { qs: Question[]; resolved?: boolean }) {
  if (!qs.length) return <span className="text-ink-3">None</span>;
  return (
    <ul className="space-y-1">
      {qs.map((q) => (
        <li key={q.id} className="flex gap-2">
          <Link to={`/questions?status=all&q=${encodeURIComponent(q.id)}`} className="shrink-0 font-mono text-[11.5px] underline">{q.id}</Link>
          <span className="line-clamp-1" title={q.question}>{resolved && q.answeredOn ? `${fmtDate(q.answeredOn)}: ` : ''}{q.askWho}, {q.question}</span>
        </li>
      ))}
    </ul>
  );
}

/** The questions panel on a work item: what it waits on and what was answered for it. */
export function WorkQuestions({ workId }: { workId: string }) {
  const { data } = useQa();
  if (!data) return null;
  const qs = data.questions.filter((q) => (q.blocks || []).some((b) => b.toLowerCase() === workId.toLowerCase()));
  if (!qs.length) return null;
  const open = qs.filter(isOpen);
  const done = qs.filter((q) => !isOpen(q));
  return (
    <Panel title={`Questions (${open.length} open, ${done.length} answered)`} action={<Link to={`/questions?work=${encodeURIComponent(workId)}&status=all`} className="text-xs underline">Open in Questions</Link>}>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-1.5 text-xs font-medium text-ink-3">Waiting on</h3>
          <QLinks qs={open} />
        </div>
        <div>
          <h3 className="mb-1.5 text-xs font-medium text-ink-3">Answered</h3>
          <ul className="space-y-1.5">
            {done.length ? done.map((q) => (
              <li key={q.id}>
                <Link to={`/questions?status=all&q=${encodeURIComponent(q.id)}`} className="font-mono text-[11.5px] underline">{q.id}</Link>
                <span className="ml-2 text-xs text-ink-3">{q.answeredOn ? fmtDate(q.answeredOn) : 'answered'}</span>
                {q.answer && <p className="line-clamp-2 text-sm text-ink-2" title={q.answer}>{q.answer}</p>}
              </li>
            )) : <span className="text-ink-3">None</span>}
          </ul>
        </div>
      </div>
    </Panel>
  );
}
