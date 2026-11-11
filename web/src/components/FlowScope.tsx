import { createContext, useContext, useState, type ElementType, type ReactNode } from 'react';
import { cx } from './ui';

/**
 * One flow and the text that explains it share one selected step. A step names the anchors it is about; any element
 * of the text wrapped in <Hl a="..."> lights up while that step is selected, and clicking it selects the step.
 * Give the scope a key per section so a new section starts at step 1.
 */
export interface Anchored { anchors?: string[] }
interface Scope { at: number; setAt: (i: number) => void; steps: Anchored[] }
const Ctx = createContext<Scope | null>(null);

export function FlowScope({ steps, children }: { steps: Anchored[]; children: ReactNode }) {
  const [at, setAt] = useState(0);
  return <Ctx.Provider value={{ at, setAt, steps }}>{children}</Ctx.Provider>;
}

export const useFlowScope = () => useContext(Ctx);

/** Is this anchor part of the selected step, and how to select the first step that names it. */
export function useHl(a: string) {
  const s = useContext(Ctx);
  if (!s) return { on: false, select: undefined as undefined | (() => void) };
  const on = !!s.steps[s.at]?.anchors?.includes(a);
  const first = s.steps.findIndex((x) => x.anchors?.includes(a));
  return { on, select: first >= 0 ? () => s.setAt(first) : undefined };
}

export const HL_ON = 'bg-brand/10 ring-2 ring-brand/50';

/** Wrap any part of the text: it lights up with its step, and a click selects that step. */
export function Hl({ a, as: Tag = 'div', className, children }: { a: string; as?: ElementType; className?: string; children: ReactNode }) {
  const { on, select } = useHl(a);
  return (
    <Tag onClick={select} data-anchor={a}
      className={cx(className, 'transition-colors', select && 'cursor-pointer', on && (Tag === 'tr' ? 'bg-brand/10' : HL_ON), on && 'rounded-md')}>
      {children}
    </Tag>
  );
}
