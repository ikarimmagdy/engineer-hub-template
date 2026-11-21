import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { chatThread, chatThreads, sendChat, since, useLoopApi, type ChatSummary, type ChatThread } from '../lib/loop';
import { useRun } from './RunView';
import { MarkdownText } from './Markdown';
import { cx, Dot, Empty, ErrorNote } from './ui';

/**
 * Talk to Claude from the hub: conversations kept on this laptop, each message resuming the same Claude Code session.
 * Claude reads only here (code, documents, work items); approvals, phase moves and reruns are the work item's buttons,
 * code changes a propose run or the terminal.
 */
export function ChatPanel({ workKey, threadId, onThread }: { workKey?: string; threadId?: string; onThread?: (id: string | null) => void }) {
  const api = useLoopApi();
  const [list, setList] = useState<ChatSummary[]>([]);
  const [own, setOwn] = useState<string | null>(null);
  const open = threadId !== undefined ? threadId || null : own;
  const pick = (id: string | null) => (onThread ? onThread(id) : setOwn(id));
  const refresh = () => chatThreads(workKey).then(setList, () => {});
  useEffect(() => { if (api) refresh(); }, [api, workKey]);

  if (api === undefined) return null;
  if (api === null) return <Empty>Chat runs on the hub on your laptop (<code>cd web && npm run dev</code>, or the preview server), with your Claude Code login. The shared hub is read-only.</Empty>;
  if (!api.agents) return <Empty>The <code>claude</code> command was not found on this laptop: install Claude Code and sign in, then reload.</Empty>;

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="min-w-0">
        <button type="button" onClick={() => pick(null)} className="mb-2 w-full rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-paper">New conversation</button>
        <ul className="space-y-1">
          {list.map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => pick(t.id)} aria-current={open === t.id ? 'true' : undefined}
                className={cx('w-full rounded-md px-2.5 py-1.5 text-left text-sm', open === t.id ? 'bg-sunk font-medium' : 'hover:bg-sunk/60')}>
                <span className="line-clamp-2 break-words">{t.title}</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-3">
                  {t.running && <Dot tone="run" className="animate-pulse" />}
                  {!workKey && t.key && <span className="font-mono">{t.key}</span>}
                  {t.turns} messages · {since(t.updated)} ago
                </span>
              </button>
            </li>
          ))}
          {!list.length && <li className="px-2.5 text-xs text-ink-3">No conversations yet.</li>}
        </ul>
      </aside>
      <Conversation key={open || 'new'} id={open} workKey={workKey} onCreated={(id) => { pick(id); refresh(); }} onAnswered={refresh} />
    </div>
  );
}

function Conversation({ id, workKey, onCreated, onAnswered }: { id: string | null; workKey?: string; onCreated: (id: string) => void; onAnswered: () => void }) {
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const load = () => id ? chatThread(id).then((t) => {
    setThread(t);
    const last = t.turns[t.turns.length - 1];
    setRunId(last?.role === 'you' && last.run ? last.run : null);
  }, (e) => setErr((e as Error).message)) : Promise.resolve();
  useEffect(() => { load(); }, [id]);
  const { run } = useRun(runId);
  // the answer is written to the conversation when the run ends: reload it then
  useEffect(() => { if (run && run.state !== 'running') { load().then(onAnswered); } }, [run?.state]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [thread?.turns.length, run?.steps.length]);

  const send = async () => {
    const message = text.trim();
    if (!message) return;
    setSending(true); setErr(null);
    try {
      const r = await sendChat({ thread: id || undefined, key: workKey, message });
      setText('');
      if (!id) onCreated(r.thread);
      else { await load(); setRunId(r.run); }
    } catch (e) { setErr((e as Error).message); }
    setSending(false);
  };
  const waiting = !!runId && (!run || run.state === 'running');
  const turns = thread?.turns || [];

  return (
    <section className="flex min-h-[420px] min-w-0 flex-col rounded-lg border border-line bg-paper">
      <div className="flex-1 space-y-4 overflow-y-auto p-4" style={{ maxHeight: '62vh' }}>
        {!turns.length && (
          <div className="text-sm text-ink-3">
            <p>Ask Claude anything about {workKey ? <>work item <span className="font-mono">{workKey}</span>: where it stands, what a document says, what to do next</> : 'the code, the documents and the work items'}. Each message continues the same conversation.</p>
            <p className="mt-2">Claude reads here; it does not write. Approve, move a phase or rerun a command with the buttons on {workKey ? <Link className="underline" to={`/work/${workKey}/overview`}>the work item</Link> : 'a work item'}, and change code from a propose run or the terminal.</p>
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={cx('max-w-[92%]', t.role === 'you' ? 'ml-auto' : '')}>
            <div className={cx('mb-1 text-[11px] text-ink-3', t.role === 'you' && 'text-right')}>{t.role === 'you' ? 'You' : 'Claude'} · {since(t.at)} ago</div>
            {t.role === 'you'
              ? <div className="whitespace-pre-wrap rounded-lg bg-ink px-3 py-2 text-sm text-paper">{t.text}</div>
              : <div className={cx('rounded-lg border px-3 py-2', t.failed ? 'border-block/40 bg-block/5' : 'border-line bg-sunk/40')}><MarkdownText src={t.text} path="content/chat.md" className="text-sm" /></div>}
          </div>
        ))}
        {waiting && (
          <div className="max-w-[92%] rounded-lg border border-run/40 bg-run/5 px-3 py-2 text-sm">
            <div className="flex items-center gap-2 text-run"><Dot tone="run" className="animate-pulse" />Claude is working{run ? ` · ${since(run.started)}` : ''}</div>
            {run && run.steps.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 text-[11.5px] text-ink-3">
                {run.steps.slice(-5).map((s, i) => <li key={i} className="truncate"><span className="font-mono">{s.tool}</span> {s.target}</li>)}
              </ul>
            )}
          </div>
        )}
        <div ref={end} />
      </div>
      {err && <div className="px-4"><ErrorNote>{err}</ErrorNote></div>}
      <div className="border-t border-line p-3">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={4000} disabled={waiting}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }}
          placeholder={waiting ? 'Claude is answering…' : 'Message Claude (⌘ Enter to send)'} aria-label="Message"
          className="w-full resize-y rounded-md border border-line-2 bg-paper px-2.5 py-2 text-sm disabled:opacity-60" />
        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-ink-3">
          <span>Read-only: code, docs and work items on this laptop{workKey ? `, focused on ${workKey}` : ''}. Kept in .claude/state/hub-chats/.</span>
          <button type="button" onClick={send} disabled={sending || waiting || !text.trim()} className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-paper disabled:opacity-50">{sending ? 'Sending' : 'Send'}</button>
        </div>
      </div>
    </section>
  );
}

/** /chat and /chat/<id>: every conversation on this laptop, whichever work item it is about. */
export function ChatPage() {
  const { id } = useParams();
  const nav = useNavigate();
  return (
    <div>
      <h1 className="text-2xl font-semibold">Chat</h1>
      <p className="mb-5 mt-1 max-w-3xl text-sm text-ink-2">Talk to Claude from the hub instead of the terminal or the editor. It reads the workspace (code, documents, work items) and keeps each conversation, so a follow-up continues where you left off. Conversations about one work item are also on its Chat tab.</p>
      <ChatPanel threadId={id || ''} onThread={(t) => nav(t ? `/chat/${t}` : '/chat')} />
    </div>
  );
}
