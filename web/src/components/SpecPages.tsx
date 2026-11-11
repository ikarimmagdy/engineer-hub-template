import { Link, useSearchParams } from 'react-router';
import { useHub, type Spec } from '../lib/data';
import { cx, Pill } from './ui';

/**
 * A work item's whole-page documents (architecture, communication matrix, environment), shown inside the page that
 * needs them: pick one from the list, read it full width with every diagram, open it full page or in its work item.
 */
export type PageKind = 'architecture' | 'matrix' | 'infra' | 'other';
export type SpecPage = NonNullable<Spec['pages']>[number] & { spec: Spec };
export const KIND_LABEL: Record<PageKind, string> = { architecture: 'Architecture', matrix: 'Communication matrix', infra: 'Infrastructure and environments', other: 'Document' };

export function useSpecPages(kinds?: PageKind[], key?: string): SpecPage[] {
  const { loop } = useHub();
  return loop.specs.filter((s) => !key || s.key === key)
    .flatMap((s) => (s.pages || []).map((p) => ({ ...p, spec: s })))
    .filter((p) => !kinds || kinds.includes(((p as { kind?: PageKind }).kind || 'other') as PageKind));
}

export function DocViewer({ docs, title, empty }: { docs: SpecPage[]; title: string; empty?: string }) {
  const [params, setParams] = useSearchParams();
  if (!docs.length) return empty ? <p className="text-sm text-ink-3">{empty}</p> : null;
  const id = (d: SpecPage) => `${d.spec.key}:${d.id}`;
  const cur = docs.find((d) => id(d) === params.get('doc')) || docs[0];
  const pick = (d: SpecPage) => setParams((p) => { p.set('doc', id(d)); return p; }, { replace: true });
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">{title} <span className="text-sm font-normal text-ink-3">{docs.length}</span></h2>
        <div className="flex gap-3 text-xs">
          <a href={cur.file} target="_blank" rel="noopener" className="underline decoration-line-2 underline-offset-4 hover:decoration-ink">Open full page</a>
          <Link to={`/work/${cur.spec.key}/design?doc=page:${cur.id}`} className="underline decoration-line-2 underline-offset-4 hover:decoration-ink">In {cur.spec.key}</Link>
        </div>
      </div>
      {docs.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={title}>
          {docs.map((d) => (
            <button key={id(d)} type="button" role="tab" aria-selected={d === cur} onClick={() => pick(d)}
              className={cx('rounded-lg border px-3 py-2 text-left text-sm', d === cur ? 'border-ink bg-ink text-paper' : 'border-line bg-paper hover:border-ink')}>
              <span className="block font-medium leading-snug">{d.title.replace(/\s+—.*$/, '')}</span>
              <span className={cx('block font-mono text-[11px]', d === cur ? 'text-paper/70' : 'text-ink-3')}>{d.spec.key} · {d.version.replace(/\.html?$/, '')}</span>
            </button>
          ))}
        </div>
      )}
      <div className="overflow-hidden rounded-lg border border-line bg-paper">
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-sunk px-3 py-2 text-xs text-ink-2">
          <span className="font-medium text-ink">{cur.title}</span><Pill>{cur.spec.key}</Pill><span className="text-ink-3">{cur.spec.title}</span>
          <span className="ml-auto font-mono text-ink-3">{cur.source}</span>
        </div>
        <iframe key={cur.file} src={cur.file} title={cur.title} className="block h-[82vh] w-full bg-white" />
      </div>
    </section>
  );
}
