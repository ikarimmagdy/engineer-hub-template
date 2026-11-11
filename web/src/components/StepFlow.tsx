import { useEffect, useState, type ReactNode } from 'react';
import { cx } from './ui';
import { useFlowScope } from './FlowScope';

/**
 * An interactive flow: numbered circles joined by a line, one short title under each. Click a step (or use the
 * arrows, or Play) and its detail opens below. The kind colours the circle: who acts at that step.
 */
export type StepKind = 'you' | 'model' | 'hook' | 'tool' | 'file' | 'gate' | 'system';
export interface FlowStep { title: string; detail: ReactNode; kind?: StepKind; where?: string; anchors?: string[] }

export const KIND: Record<StepKind, { ring: string; fill: string; label: string }> = {
  you: { ring: 'border-ink', fill: 'bg-ink text-paper', label: 'You' },
  model: { ring: 'border-run', fill: 'bg-run text-paper', label: 'The model' },
  hook: { ring: 'border-sev-medium', fill: 'bg-sev-medium text-paper', label: 'Hook (enforced)' },
  gate: { ring: 'border-sev-medium', fill: 'bg-sev-medium text-paper', label: 'Check (enforced)' },
  tool: { ring: 'border-ok', fill: 'bg-ok text-paper', label: 'Tool or server' },
  file: { ring: 'border-ink-3', fill: 'bg-ink-3 text-paper', label: 'A file you write' },
  system: { ring: 'border-brand', fill: 'bg-brand text-paper', label: 'Our system' },
};

/** `visual` replaces the row of circles with a drawing of its own (a diagram) that shows and changes the step. */
export function StepFlow({ steps, title, caption, visual }: {
  steps: FlowStep[]; title?: ReactNode; caption?: ReactNode; visual?: (at: number, go: (i: number) => void) => ReactNode;
}) {
  const scope = useFlowScope();
  const [own, setOwn] = useState(0);
  const at = scope ? scope.at : own;
  const setAt = scope ? scope.setAt : setOwn;
  const [play, setPlay] = useState(false);
  useEffect(() => {
    if (!play) return;
    const t = setTimeout(() => (at < steps.length - 1 ? setAt(at + 1) : setPlay(false)), 2600);
    return () => clearTimeout(t);
  }, [play, at, steps.length]);
  const s = steps[at];
  const k = KIND[s.kind || 'model'];
  const kinds = [...new Set(steps.map((x) => x.kind || 'model'))];
  const go = (i: number) => { setPlay(false); setAt(Math.max(0, Math.min(steps.length - 1, i))); };
  return (
    <section className="mb-6 rounded-xl border border-line bg-paper p-4 sm:p-5" aria-label={typeof title === 'string' ? title : 'Steps'}>
      {(title || caption) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {caption && <p className="mt-0.5 max-w-3xl text-sm text-ink-2">{caption}</p>}
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => go(at - 1)} disabled={at === 0} aria-label="Previous step"
              className="grid size-8 place-items-center rounded-md border border-line-2 text-sm disabled:opacity-40 hover:bg-sunk">&larr;</button>
            <button type="button" onClick={() => (play ? setPlay(false) : (at === steps.length - 1 && setAt(0), setPlay(true)))}
              className="h-8 rounded-md border border-line-2 px-3 text-sm hover:bg-sunk">{play ? 'Pause' : 'Play'}</button>
            <button type="button" onClick={() => go(at + 1)} disabled={at === steps.length - 1} aria-label="Next step"
              className="grid size-8 place-items-center rounded-md border border-line-2 text-sm disabled:opacity-40 hover:bg-sunk">&rarr;</button>
          </div>
        </div>
      )}
      {visual ? visual(at, go) : (
        <ol className="relative grid items-start" role="tablist" aria-label="Steps" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
          onKeyDown={(e) => { if (e.key === 'ArrowRight') go(at + 1); if (e.key === 'ArrowLeft') go(at - 1); }}>
          {steps.map((x, i) => {
            const kk = KIND[x.kind || 'model'];
            const on = i === at, done = i < at;
            return (
              <li key={i} className="relative flex min-w-0 flex-col items-center px-0.5">
                {i < steps.length - 1 && <span aria-hidden className={cx('absolute left-[calc(50%+18px)] right-[calc(-50%+18px)] top-[17px] h-0.5', done ? 'bg-ink-3' : 'bg-line-2')} />}
                <button type="button" role="tab" aria-selected={on} onClick={() => go(i)}
                  className={cx('relative z-10 grid size-9 place-items-center rounded-full border-2 text-sm font-semibold tabular-nums transition',
                    kk.ring, on ? cx(kk.fill, 'scale-110 shadow-md') : done ? 'bg-sunk text-ink' : 'bg-paper text-ink')}>{i + 1}</button>
                <button type="button" onClick={() => go(i)} className={cx('mt-2 break-words text-center text-xs leading-snug', on ? 'font-semibold text-ink' : 'text-ink-2 hover:text-ink')}>{x.title}</button>
              </li>
            );
          })}
        </ol>
      )}
      <div className="mt-4 grid grid-cols-[44px_minmax(0,1fr)] gap-3 rounded-lg bg-sunk p-4" role="tabpanel" aria-live="polite">
        <span className={cx('grid size-11 place-items-center rounded-full text-lg font-semibold tabular-nums', k.fill)}>{at + 1}</span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[15px] font-semibold">{s.title}</span>
            <span className="text-xs text-ink-3">{k.label}</span>
          </div>
          <div className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-2">{s.detail}</div>
          {s.where && <code className="mt-2 inline-block rounded bg-paper px-1.5 py-0.5 text-[11.5px] text-ink-2">{s.where}</code>}
        </div>
      </div>
      {kinds.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-3">
          {kinds.map((kd) => <span key={kd} className="inline-flex items-center gap-1.5"><span className={cx('inline-block size-2.5 rounded-full', KIND[kd].fill.split(' ')[0])} />{KIND[kd].label}</span>)}
        </div>
      )}
    </section>
  );
}
