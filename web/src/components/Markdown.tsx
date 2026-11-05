import { useEffect, useMemo, useRef } from 'react';
import { getText, useAsync, useHub } from '../lib/data';
import { renderMarkdown, runMermaid } from '../lib/markdown';
import { cx, ErrorNote, Skeleton } from './ui';

export function MarkdownText({ src, path, wide, className }: { src: string; path: string; wide?: boolean; className?: string }) {
  const hub = useHub();
  const html = useMemo(() => renderMarkdown(src, path, hub), [src, path, hub]);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) runMermaid(ref.current); }, [html]);
  return <div ref={ref} className={cx('prose-hub', wide && 'wide', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function MarkdownFile({ path, wide, transform, missing }: { path: string; wide?: boolean; transform?: (s: string) => string; missing?: string }) {
  const { data, error, loading } = useAsync(() => getText(path), [path]);
  if (loading) return <Skeleton lines={6} />;
  if (error) return missing ? <p className="text-sm text-ink-3">{missing}</p> : <ErrorNote>Could not load {path}.</ErrorNote>;
  return <MarkdownText src={transform ? transform(data!) : data!} path={path} wide={wide} />;
}
