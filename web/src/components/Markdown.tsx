import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { getText, useAsync, useHub } from '../lib/data';
import { renderMarkdown, runMermaid } from '../lib/markdown';
import { matchDiagrams, sectionize, type DocSection } from '../lib/sections';
import { cx, ErrorNote, Skeleton } from './ui';

export function MarkdownText({ src, path, wide, className }: { src: string; path: string; wide?: boolean; className?: string }) {
  const hub = useHub();
  const html = useMemo(() => renderMarkdown(src, path, hub), [src, path, hub]);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) runMermaid(ref.current); }, [html]);
  return <div ref={ref} className={cx('prose-hub', wide && 'wide', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

/**
 * One diagram (a "## title" section of a diagrams file: caption and Mermaid). Mermaid draws at the column's width and
 * records the natural width as max-width; a wide diagram gets that width and scrolls sideways instead of shrinking.
 */
export function Diagram({ d, path, heading = true }: { d: DocSection; path: string; heading?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const widen = () => el.querySelectorAll<SVGSVGElement>('.mermaid svg').forEach((svg) => {
      const natural = parseFloat(svg.style.maxWidth);
      if (natural > el.clientWidth - 40 && svg.style.width !== `${natural}px`) { svg.style.width = `${natural}px`; svg.style.maxWidth = 'none'; }
    });
    const mo = new MutationObserver(widen);
    mo.observe(el, { childList: true, subtree: true });
    widen();
    return () => mo.disconnect();
  }, [d.slug]);
  return (
    <figure className="rounded-lg border border-line bg-paper p-4">
      {heading && <figcaption className="mb-1 text-sm font-semibold">{d.title}</figcaption>}
      <div ref={box} className="[&_.mermaid]:overflow-x-auto [&_.mermaid]:pb-2"><MarkdownText src={d.body} path={path} wide /></div>
    </figure>
  );
}

/** A section's diagrams: one or two shown together, more than two one at a time behind chips, so a section never becomes a long page. */
function SectionDiagrams({ list, path }: { list: DocSection[]; path: string }) {
  const [i, setI] = useState(0);
  if (list.length <= 2) return <div className="mb-6 space-y-4">{list.map((d) => <Diagram key={d.slug} d={d} path={path} />)}</div>;
  return (
    <div className="mb-6">
      <div role="tablist" aria-label="Diagrams of this section" className="mb-3 flex flex-wrap gap-1.5">
        {list.map((d, j) => (
          <button key={d.slug} type="button" role="tab" aria-selected={i === j} onClick={() => setI(j)}
            className={cx('rounded-full border px-2.5 py-0.5 text-xs', i === j ? 'border-ink bg-ink text-paper' : 'border-line-2 text-ink-2 hover:border-ink')}>{d.title.replace(/^[A-Za-z][\w -]{1,24}:\s+/, '')}</button>
        ))}
      </div>
      <Diagram key={list[i].slug} d={list[i]} path={path} />
    </div>
  );
}

/** Markdown that splits into a side menu of sections when it is long; short text renders whole. With visuals, each section shows its diagrams. */
export function SectionedText({ src, path, wide, param = 's', minLines, visuals, visualOnly, label }: { src: string; path: string; wide?: boolean; param?: string; minLines?: number; visuals?: DocSection[]; visualOnly?: boolean; label?: string }) {
  const split = useMemo(() => sectionize(src, minLines), [src, minLines]);
  if (!split && !visuals?.length) return <MarkdownText src={src} path={path} wide={wide} />;
  return <Sectioned intro={split ? split.intro : src} sections={split ? split.sections : []} path={path} wide={wide} param={param} visuals={visuals} visualOnly={visualOnly} label={label} />;
}

const INTRO = 'overview';

export function Sectioned({ intro, sections, path, wide, param, visuals, visualOnly, label, visualPath }: { intro: string; sections: DocSection[]; path: string; wide?: boolean; param: string; visuals?: DocSection[]; visualOnly?: boolean; label?: string; visualPath?: string }) {
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState('');
  // each diagram joins the section it explains; the ones no section fits get a page each under "More diagrams"
  const { items, pics, loose } = useMemo(() => {
    const text: DocSection[] = [...(intro ? [{ title: 'Overview', slug: INTRO, body: intro }] : []), ...sections];
    const { by, rest } = matchDiagrams(text, visuals || []);
    const extra = rest.map((d) => ({ ...d, group: text.length ? 'More diagrams' : undefined }));
    const base = visualOnly ? text.filter((t) => by.has(t.slug)) : text;
    return { items: [...base, ...extra], pics: by, loose: new Set(rest.map((d) => d.slug)) };
  }, [intro, sections, visuals, visualOnly]);
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
              <span className="flex items-start justify-between gap-2"><span className="line-clamp-2 break-words">{grouped && s.group ? s.title.replace(new RegExp(`^/?${s.group.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), '').replace(/^[:\s]+/, '') || s.title : s.title}</span>
                {pics.get(s.slug) && <span className="shrink-0 text-[11px] opacity-70" title={`${pics.get(s.slug)!.length} diagrams`}>◇ {pics.get(s.slug)!.length}</span>}</span>
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
          <div className="mb-2 flex items-baseline justify-between gap-2 px-3 text-xs text-ink-3"><span className="min-w-0 truncate">{label ? <>Sections of <span className="font-medium text-ink-2">{label}</span></> : `${items.length} sections`}</span><span className="tabular-nums">{idx + 1} / {items.length}</span></div>
          {many && (
            <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a section" aria-label="Find a section"
              className="mb-2 h-8 w-full rounded-md border border-line-2 bg-paper px-2.5 text-sm" />
          )}
          <div className="max-h-[calc(100dvh-9rem)] overflow-y-auto pr-1">{list}</div>
        </div>
      </nav>
      <div className="min-w-0">
        <h2 className="mb-3 text-lg font-semibold text-balance">{current.title}</h2>
        {loose.has(current.slug) ? <Diagram d={current} path={visualPath || path} heading={false} /> : <>
          {!!pics.get(current.slug)?.length && <SectionDiagrams key={current.slug} list={pics.get(current.slug)!} path={visualPath || path} />}
          {!visualOnly && <MarkdownText src={current.body} path={path} wide={wide} />}
        </>}
        <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-line pt-4 text-sm">
          {idx > 0 ? <button type="button" onClick={() => go(items[idx - 1].slug)} className="text-left text-ink-2 hover:text-ink"><span className="block text-xs text-ink-3">Previous</span>{items[idx - 1].title}</button> : <span />}
          {idx < items.length - 1 && <button type="button" onClick={() => go(items[idx + 1].slug)} className="text-right text-ink-2 hover:text-ink"><span className="block text-xs text-ink-3">Next</span>{items[idx + 1].title}</button>}
        </div>
      </div>
    </div>
  );
}

export function MarkdownFile({ path, wide, transform, missing, sectioned, visuals, visualOnly, label, visualPath }: { path: string; wide?: boolean; transform?: (s: string) => string; missing?: string; sectioned?: boolean; visuals?: DocSection[]; visualOnly?: boolean; label?: string; visualPath?: string }) {
  const { data, error, loading } = useAsync(() => getText(path), [path]);
  if (loading) return <Skeleton lines={6} />;
  if (error) return missing ? <p className="text-sm text-ink-3">{missing}</p> : <ErrorNote>Could not load {path}.</ErrorNote>;
  const src = transform ? transform(data!) : data!;
  if (sectioned && visuals?.length) {
    const split = sectionize(src);
    return <Sectioned intro={split ? split.intro : src} sections={split ? split.sections : []} path={path} wide={wide} param="s" visuals={visuals} visualOnly={visualOnly} label={label} visualPath={visualPath} />;
  }
  return sectioned ? <SectionedText src={src} path={path} wide={wide} label={label} /> : <MarkdownText src={src} path={path} wide={wide} />;
}

/** The blocks of a self-contained HTML page, one per <h2>: a <section> that holds only that heading, or the heading
 * and the siblings up to the next one. What comes before the first heading (beyond the title) is the intro. */
function htmlBlocks(d: Document) {
  const hs = [...d.querySelectorAll<HTMLElement>('h2')].filter((h) => h.textContent?.trim());
  const blocks = hs.map((h, i) => {
    const sec = h.closest('section');
    if (sec && sec.querySelectorAll('h2').length === 1) return [sec as HTMLElement];
    const nodes: HTMLElement[] = [h];
    for (let n = h.nextElementSibling; n && n !== hs[i + 1] && !n.querySelector('h2'); n = n.nextElementSibling) nodes.push(n as HTMLElement);
    return nodes;
  });
  const first = blocks[0]?.[0];
  const intro: HTMLElement[] = [];
  for (let n = first?.previousElementSibling; n; n = n.previousElementSibling) if (!/^(H1|HEADER|NAV|STYLE|SCRIPT)$/.test(n.tagName)) intro.push(n as HTMLElement);
  return { titles: hs.map((h) => h.textContent!.trim().replace(/\s+/g, ' ')), blocks, intro };
}

/** A full HTML page from the hub (a spec's architecture or matrix page), sized to its content. Sectioned: one <h2> section at a time, with a side menu. */
export function HtmlPage({ path, title, sectioned }: { path: string; title: string; sectioned?: boolean }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [h, setH] = useState(800);
  const [titles, setTitles] = useState<string[]>([]);
  const [params, setParams] = useSearchParams();
  const at = Math.max(0, Number(params.get('hs') || 0));
  const show = (i: number) => {
    try {
      const d = ref.current?.contentDocument;
      if (!d) return;
      const b = htmlBlocks(d);
      if (b.blocks.length < 3) { setTitles([]); return; }
      setTitles(b.titles);
      b.blocks.forEach((nodes, j) => nodes.forEach((n) => { n.style.display = j === i ? '' : 'none'; }));
      b.intro.forEach((n) => { n.style.display = i === 0 ? '' : 'none'; });
      d.defaultView?.scrollTo(0, 0);
      setTimeout(fit, 50);
    } catch { /* cross-origin: show the page whole */ }
  };
  const go = (i: number) => { setParams((p) => { if (i) p.set('hs', String(i)); else p.delete('hs'); return p; }, { replace: true }); show(i); document.getElementById('doc-top')?.scrollIntoView({ block: 'start' }); };
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
  const frame = <iframe ref={ref} src={path} title={title} onLoad={() => { if (sectioned) show(at); fit(); }} style={{ height: h }} className="w-full rounded-lg border border-line bg-white" />;
  if (!sectioned || titles.length < 3) return (
    <div>
      <div className="mb-2 flex justify-end"><a href={path} target="_blank" rel="noopener" className="text-xs text-ink-3 underline">Open in a new tab</a></div>
      {frame}
    </div>
  );
  return (
    <div id="doc-top" className="grid scroll-mt-20 grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
      <nav aria-label="Sections" className="lg:sticky lg:top-20 lg:self-start">
        <select value={at} onChange={(e) => go(Number(e.target.value))} className="h-10 w-full rounded-md border border-line-2 bg-paper px-3 text-sm lg:hidden">
          {titles.map((t, i) => <option key={i} value={i}>{i + 1}. {t}</option>)}
        </select>
        <div className="hidden lg:block">
          <div className="mb-2 flex items-baseline justify-between gap-2 px-3 text-xs text-ink-3"><span className="min-w-0 truncate">Sections of <span className="font-medium text-ink-2">{title}</span></span><span className="tabular-nums">{at + 1} / {titles.length}</span></div>
          <ul className="max-h-[calc(100dvh-9rem)] space-y-0.5 overflow-y-auto pr-1">
            {titles.map((t, i) => (
              <li key={i}><button type="button" onClick={() => go(i)} aria-current={i === at ? 'page' : undefined}
                className={cx('w-full rounded-md px-3 py-1.5 text-left text-sm', i === at ? 'bg-ink font-medium text-paper' : 'text-ink-2 hover:bg-sunk hover:text-ink')}><span className="line-clamp-2 break-words">{t}</span></button></li>
            ))}
          </ul>
          <a href={path} target="_blank" rel="noopener" className="mt-3 block px-3 text-xs text-ink-3 underline">Open the whole page</a>
        </div>
      </nav>
      <div className="min-w-0">
        {frame}
        <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-line pt-4 text-sm">
          {at > 0 ? <button type="button" onClick={() => go(at - 1)} className="text-left text-ink-2 hover:text-ink"><span className="block text-xs text-ink-3">Previous</span>{titles[at - 1]}</button> : <span />}
          {at < titles.length - 1 && <button type="button" onClick={() => go(at + 1)} className="text-right text-ink-2 hover:text-ink"><span className="block text-xs text-ink-3">Next</span>{titles[at + 1]}</button>}
        </div>
      </div>
    </div>
  );
}
