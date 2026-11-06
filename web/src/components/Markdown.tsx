import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { getText, useAsync, useHub } from '../lib/data';
import { renderMarkdown, runMermaid } from '../lib/markdown';
import { sectionize, type DocSection } from '../lib/sections';
import { cx, ErrorNote, Skeleton } from './ui';

export function MarkdownText({ src, path, wide, className }: { src: string; path: string; wide?: boolean; className?: string }) {
  const hub = useHub();
  const html = useMemo(() => renderMarkdown(src, path, hub), [src, path, hub]);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) runMermaid(ref.current); }, [html]);
  return <div ref={ref} className={cx('prose-hub', wide && 'wide', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Markdown that splits into a side menu of sections when it is long; short text renders whole. */
export function SectionedText({ src, path, wide, param = 's', minLines }: { src: string; path: string; wide?: boolean; param?: string; minLines?: number }) {
  const split = useMemo(() => sectionize(src, minLines), [src, minLines]);
  if (!split) return <MarkdownText src={src} path={path} wide={wide} />;
  return <Sectioned intro={split.intro} sections={split.sections} path={path} wide={wide} param={param} />;
}

const INTRO = 'overview';

function Sectioned({ intro, sections, path, wide, param }: { intro: string; sections: DocSection[]; path: string; wide?: boolean; param: string }) {
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState('');
  const items: DocSection[] = useMemo(
    () => [...(intro ? [{ title: 'Overview', slug: INTRO, body: intro }] : []), ...sections],
    [intro, sections],
  );
  const wanted = params.get(param);
  const idx = Math.max(0, items.findIndex((s) => s.slug === wanted));
  const current = items[idx];
  const go = (slug: string) => {
    setParams((p) => { if (slug === items[0].slug) p.delete(param); else p.set(param, slug); return p; });
    document.getElementById('doc-top')?.scrollIntoView({ block: 'start' });
  };
  const many = items.length > 12;
  const shown = filter ? items.filter((s) => s.title.toLowerCase().includes(filter.toLowerCase())) : items;
  const grouped = items.some((s) => s.group);

  const list = (
    <ul className="space-y-0.5">
      {shown.map((s, i) => {
        const header = grouped && s.group && (i === 0 || shown[i - 1].group !== s.group);
        return (
          <li key={s.slug}>
            {header && <div className="px-3 pb-1 pt-3 text-[11px] font-semibold text-ink-3">{s.group}</div>}
            <button type="button" onClick={() => go(s.slug)} aria-current={s.slug === current.slug ? 'page' : undefined}
              className={cx('w-full rounded-md px-3 py-1.5 text-left text-sm', s.slug === current.slug ? 'bg-ink font-medium text-paper' : 'text-ink-2 hover:bg-sunk hover:text-ink')}>
              <span className="line-clamp-2 break-words">{grouped && s.group ? s.title.replace(new RegExp(`^/?${s.group.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), '') || s.title : s.title}</span>
            </button>
          </li>
        );
      })}
      {!shown.length && <li className="px-3 py-2 text-sm text-ink-3">No section matches.</li>}
    </ul>
  );

  return (
    <div id="doc-top" className="grid scroll-mt-20 grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
      <nav aria-label="Sections" className="lg:sticky lg:top-20 lg:self-start">
        <label className="block lg:hidden">
          <span className="sr-only">Section</span>
          <select value={current.slug} onChange={(e) => go(e.target.value)} className="h-10 w-full rounded-md border border-line-2 bg-paper px-3 text-sm">
            {items.map((s, i) => <option key={s.slug} value={s.slug}>{i + 1}. {s.title}</option>)}
          </select>
        </label>
        <div className="hidden lg:block">
          <div className="mb-2 flex items-baseline justify-between px-3 text-xs text-ink-3"><span>{items.length} sections</span><span className="tabular-nums">{idx + 1} / {items.length}</span></div>
          {many && (
            <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a section" aria-label="Find a section"
              className="mb-2 h-8 w-full rounded-md border border-line-2 bg-paper px-2.5 text-sm" />
          )}
          <div className="max-h-[calc(100dvh-9rem)] overflow-y-auto pr-1">{list}</div>
        </div>
      </nav>
      <div className="min-w-0">
        <h2 className="mb-3 text-lg font-semibold text-balance">{current.title}</h2>
        <MarkdownText src={current.body} path={path} wide={wide} />
        <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-line pt-4 text-sm">
          {idx > 0 ? <button type="button" onClick={() => go(items[idx - 1].slug)} className="text-left text-ink-2 hover:text-ink"><span className="block text-xs text-ink-3">Previous</span>{items[idx - 1].title}</button> : <span />}
          {idx < items.length - 1 && <button type="button" onClick={() => go(items[idx + 1].slug)} className="text-right text-ink-2 hover:text-ink"><span className="block text-xs text-ink-3">Next</span>{items[idx + 1].title}</button>}
        </div>
      </div>
    </div>
  );
}

export function MarkdownFile({ path, wide, transform, missing, sectioned }: { path: string; wide?: boolean; transform?: (s: string) => string; missing?: string; sectioned?: boolean }) {
  const { data, error, loading } = useAsync(() => getText(path), [path]);
  if (loading) return <Skeleton lines={6} />;
  if (error) return missing ? <p className="text-sm text-ink-3">{missing}</p> : <ErrorNote>Could not load {path}.</ErrorNote>;
  const src = transform ? transform(data!) : data!;
  return sectioned ? <SectionedText src={src} path={path} wide={wide} /> : <MarkdownText src={src} path={path} wide={wide} />;
}

/** A full HTML page from the hub (a spec's architecture or matrix page), sized to its content. */
export function HtmlPage({ path, title }: { path: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [h, setH] = useState(800);
  const fit = () => {
    try {
      const d = ref.current?.contentDocument;
      if (!d?.documentElement) return;
      // the hub's theme toggle carries into the framed page, as in v4
      const t = document.documentElement.dataset.theme;
      if (t !== d.documentElement.dataset.theme) { if (t) d.documentElement.dataset.theme = t; else delete d.documentElement.dataset.theme; }
      setH(Math.max(400, d.documentElement.scrollHeight + 8));
    } catch { /* cross-origin: keep the default height */ }
  };
  useEffect(() => {
    const id = setInterval(fit, 1500);
    return () => clearInterval(id);
  }, []);
  return (
    <div>
      <div className="mb-2 flex justify-end"><a href={path} target="_blank" rel="noopener" className="text-xs text-ink-3 underline">Open in a new tab</a></div>
      <iframe ref={ref} src={path} title={title} onLoad={fit} style={{ height: h }} className="w-full rounded-lg border border-line bg-white" />
    </div>
  );
}
