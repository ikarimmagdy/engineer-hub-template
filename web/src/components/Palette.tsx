import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useHub } from '../lib/data';
import { buildIndex, type Hit } from '../lib/search';
import { cx } from './ui';

const GROUPS: Hit['group'][] = ['Work', 'Commands', 'Pages', 'Learning', 'Decisions', 'Library'];

export function Palette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const hub = useHub();
  const nav = useNavigate();
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const index = useMemo(() => buildIndex(hub), [hub]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { d.showModal(); setQ(''); setSel(0); setTimeout(() => input.current?.focus(), 0); }
    if (!open && d.open) d.close();
  }, [open]);

  const hits: Hit[] = useMemo(() => {
    if (!q.trim()) return index.docs.filter((d) => d.group === 'Pages').slice(0, 8)
      .concat(index.docs.filter((d) => d.group === 'Work' && !d.id.slice(2).includes(':')));
    return (index.ms.search(q) as unknown as Hit[]).slice(0, 40);
  }, [q, index]);

  const grouped = GROUPS.map((g) => [g, hits.filter((h) => h.group === g).slice(0, 8)] as const).filter(([, l]) => l.length);
  const flat = grouped.flatMap(([, l]) => l);

  const choose = (h: Hit | undefined) => {
    if (!h) return;
    if (h.copy) {
      navigator.clipboard?.writeText(h.copy).then(() => { setCopied(h.id); setTimeout(() => setCopied(null), 1200); });
      return;
    }
    if (h.to) { onClose(); nav(h.to); }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(flat[sel]); }
  };

  useEffect(() => {
    document.getElementById(`pal-${sel}`)?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  let n = -1;
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      aria-label="Search and commands"
      className="m-auto mt-[12vh] w-[min(620px,calc(100vw-32px))] rounded-xl border border-line-2 bg-paper p-0 text-ink shadow-xl backdrop:bg-black/30"
    >
      <div className="flex items-center gap-2 border-b border-line px-4">
        <svg aria-hidden viewBox="0 0 20 20" className="size-4 text-ink-3"><circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="m14 14 4 4" stroke="currentColor" strokeWidth="1.6" /></svg>
        <input
          ref={input}
          value={q}
          onChange={(e) => { setQ(e.target.value); setSel(0); }}
          onKeyDown={onKey}
          placeholder="Search work, findings, documents, commands"
          aria-label="Search"
          role="combobox"
          aria-expanded
          aria-controls="pal-list"
          aria-activedescendant={flat[sel] ? `pal-${sel}` : undefined}
          className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3 focus-visible:outline-none"
        />
        <kbd className="rounded border border-line-2 px-1.5 font-mono text-[11px] text-ink-3">esc</kbd>
      </div>
      <div id="pal-list" role="listbox" className="max-h-[56vh] overflow-y-auto py-1">
        {!flat.length && <p className="px-4 py-6 text-center text-sm text-ink-3">Nothing matches “{q}”. Try a Jira key or a page name.</p>}
        {grouped.map(([g, list]) => (
          <div key={g} role="group" aria-label={g}>
            <div className="px-4 pb-1 pt-2 text-[11px] font-medium text-ink-3">{g}</div>
            {list.map((h) => {
              n += 1;
              const i = n;
              return (
                <div
                  key={h.id}
                  id={`pal-${i}`}
                  role="option"
                  aria-selected={i === sel}
                  onMouseMove={() => setSel(i)}
                  onClick={() => choose(h)}
                  className={cx('flex cursor-pointer items-center justify-between gap-4 px-4 py-1.5 text-sm', i === sel && 'bg-sunk')}
                >
                  <span className={cx('truncate', h.copy && 'font-mono text-[12.5px]')}>{h.title}</span>
                  <span className="shrink-0 text-xs text-ink-3">{copied === h.id ? 'Copied' : h.copy ? 'Copy' : h.hint}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </dialog>
  );
}
