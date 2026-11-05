import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { getText, trackerUrl, useAsync, useHub, usePoll, type Spec, type TestLatest } from '../lib/data';
import { renderInline } from '../lib/markdown';
import { parseScreens, type ColKey, type Lang, type Screen, type Shot } from '../lib/screens';
import { cx, ErrorNote, Select, Skeleton, StatusText } from '../components/ui';

export const screensDoc = (spec: Spec) => `content/specs/${spec.dir}/review/ui-ux.md`;

/** Figma next to each phone, per screen, with the latest phone result for that screen. */
export function Screens({ spec }: { spec: Spec }) {
  const hub = useHub();
  const [params, setParams] = useSearchParams();
  const md = useAsync(() => getText(screensDoc(spec)), [spec.dir]);
  const latest = usePoll<TestLatest>(`content/test-executions/latest-${spec.key.toLowerCase()}.json`, 60000);
  const parsed = useMemo(() => (md.data ? parseScreens(md.data, `content/specs/${spec.dir}/review/`) : null), [md.data, spec.dir]);
  const lang = (params.get('lang') as Lang) || 'en';
  const story = params.get('story') || '';
  const verdict = params.get('verdict') || '';
  const set = (k: string, v: string) => setParams((p) => { if (v) p.set(k, v); else p.delete(k); return p; }, { replace: true });
  const [zoom, setZoom] = useState<Shot | null>(null);

  // iOS cases are named <suite>/<screen> (arabic/landing); journey-level runs (Android) carry no screen name.
  const results = useMemo(() => {
    const out = new Map<string, { status: string; run?: string }>();
    for (const s of latest?.sessions || []) {
      for (const r of s.results || []) {
        const m = r.name.match(/^[a-z-]+\/([a-z0-9-]+)$/i);
        if (!m) continue;
        const k = `${s.platform}|${m[1].replace(/-ar$/, '')}`;
        if (out.get(k)?.status !== 'FAIL') out.set(k, { status: r.status === 'PASS' ? 'PASS' : 'FAIL', run: s.records?.[s.records.length - 1] });
      }
    }
    return out;
  }, [latest]);

  if (md.loading) return <Skeleton lines={8} />;
  if (md.error || !parsed) return <ErrorNote>Could not load the UI / UX review.</ErrorNote>;
  const stories = [...new Set(parsed.screens.map((s) => s.story))];
  const shown = parsed.screens.filter((s) => (!story || s.story === story) && (!verdict || s.verdict === verdict));
  const count = (v: string) => parsed.screens.filter((s) => s.verdict === v).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Language" className="inline-flex rounded-md border border-line-2 bg-paper p-0.5">
          {(['en', 'ar'] as Lang[]).map((l) => (
            <button key={l} type="button" aria-pressed={lang === l} onClick={() => set('lang', l === 'en' ? '' : l)}
              className={cx('rounded px-3 py-1 text-xs', lang === l ? 'bg-ink text-paper' : 'text-ink-2 hover:text-ink')}>{l === 'en' ? 'English' : 'العربية'}</button>
          ))}
        </div>
        <Select label="Story" value={story} onChange={(v) => set('story', v)} options={[['', `All ${stories.length}`], ...stories.map((s) => [s, s] as [string, string])]} />
        <div className="flex flex-wrap gap-1.5">
          {([['', `All ${parsed.screens.length}`], ['match', `Matches Figma ${count('match')}`], ['differs', `Differs ${count('differs')}`]] as [string, string][]).map(([v, l]) => (
            <button key={v} type="button" aria-pressed={verdict === v} onClick={() => set('verdict', v)}
              className={cx('rounded-full border px-3 py-1 text-xs', verdict === v ? 'border-ink bg-ink text-paper' : 'border-line-2 bg-paper')}>{l}</button>
          ))}
        </div>
      </div>

      <div className="space-y-8">
        {stories.filter((st) => shown.some((s) => s.story === st)).map((st) => {
          const key = st.match(/^([A-Z]+-\d+)/)?.[1];
          const url = key ? trackerUrl(hub, key) : undefined;
          return (
            <section key={st} aria-label={st}>
              <h3 className="mb-3 flex flex-wrap items-baseline gap-2 text-base font-semibold">
                {url ? <a href={url} target="_blank" rel="noopener" className="font-mono text-xs font-normal text-ink-3 underline">{key}</a> : null}
                <span>{st.replace(/^[A-Z]+-\d+\s*/, '')}</span>
              </h3>
              <div className="grid gap-4 xl:grid-cols-2">
                {shown.filter((s) => s.story === st).map((s) => (
                  <ScreenCard key={s.story + s.name} s={s} lang={lang} columns={parsed.columns} results={results} onZoom={setZoom} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <Zoom shot={zoom} onClose={() => setZoom(null)} />
    </div>
  );
}

function ScreenCard({ s, lang, columns, results, onZoom }: { s: Screen; lang: Lang; columns: { key: ColKey; label: string }[]; results: Map<string, { status: string; run?: string }>; onZoom: (x: Shot) => void }) {
  const row = s.shots[lang];
  const note = s.notes[lang] || s.notes.en || '';
  return (
    <article className="rounded-lg border border-line bg-paper">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <h4 className="text-sm font-semibold">{s.name}</h4>
        {s.verdict !== 'none' && <StatusText tone={s.verdict === 'match' ? 'ok' : 'high'}>{s.verdict === 'match' ? 'Matches Figma' : 'Differs from Figma'}</StatusText>}
      </header>
      <div className="grid grid-cols-3 gap-3 px-4 py-3">
        {columns.map(({ key, label }) => {
          const figma = key === 'figma';
          const shot = row[key] ?? (figma ? s.shots.en[key] : null);
          const res = figma ? undefined : results.get(`${key}|${s.slug}`);
          return (
            <figure key={key} className="min-w-0">
              <figcaption className="mb-1.5 flex items-center justify-between gap-1 text-[11px] text-ink-3">
                <span className="truncate">{label}{figma && lang === 'ar' && !row[key] && shot ? ' (en)' : ''}</span>
                {!figma && (res ? <StatusText tone={res.status === 'PASS' ? 'ok' : 'block'}>{res.status === 'PASS' ? 'passed' : 'failed'}</StatusText> : <span title="The latest run on this phone has no case for this screen">no case</span>)}
              </figcaption>
              {shot ? (
                <button type="button" onClick={() => onZoom(shot)} className="block w-full overflow-hidden rounded-md border border-line bg-sunk" aria-label={`Enlarge ${label}: ${s.name}`}>
                  <img src={shot.src} alt={`${s.name}, ${label}`} loading="lazy" className="aspect-[9/19] w-full object-cover object-top" />
                </button>
              ) : (
                <div className="grid aspect-[9/19] place-items-center rounded-md border border-dashed border-line-2 text-center text-[11px] text-ink-3">
                  {figma ? 'No Figma frame' : 'Not captured'}
                </div>
              )}
            </figure>
          );
        })}
      </div>
      {note && <p className="border-t border-line px-4 py-2.5 text-xs text-ink-2 text-pretty" dir="auto" dangerouslySetInnerHTML={{ __html: renderInline(note) }} />}
    </article>
  );
}

function Zoom({ shot, onClose }: { shot: Shot | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (shot && d && !d.open) d.showModal();
    if (!shot && d?.open) d.close();
  }, [shot]);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }} aria-label={shot?.alt || 'Screenshot'}
      className="m-auto max-h-[94dvh] max-w-[94vw] rounded-lg bg-paper p-2 backdrop:bg-black/60">
      {shot && <img src={shot.src} alt={shot.alt} className="max-h-[88dvh] w-auto rounded" />}
      <button type="button" onClick={onClose} className="mt-2 w-full rounded-md border border-line-2 py-1 text-sm">Close</button>
    </dialog>
  );
}
