import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import type { Brand, Severity, TaskState } from '../lib/data';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export type Tone = 'ok' | 'run' | 'wait' | 'block' | 'critical' | 'high' | 'medium' | 'low' | 'none';

const DOT: Record<Tone, string> = {
  ok: 'bg-ok', run: 'bg-run', wait: 'bg-wait', block: 'bg-block',
  critical: 'bg-sev-critical', high: 'bg-sev-high', medium: 'bg-sev-medium', low: 'bg-sev-low', none: 'bg-line-2',
};
const TEXT: Record<Tone, string> = {
  ok: 'text-ok', run: 'text-run', wait: 'text-ink-3', block: 'text-block',
  critical: 'text-sev-critical', high: 'text-sev-high', medium: 'text-sev-medium', low: 'text-sev-low', none: 'text-ink-3',
};

export const TASK_TONE: Record<TaskState, Tone> = { blocked: 'block', doing: 'run', review: 'run', todo: 'wait', done: 'ok' };
export const SEV_TONE: Record<Severity, Tone> = { critical: 'critical', high: 'high', medium: 'medium', low: 'low', none: 'none' };
export const SEV_LABEL: Record<Severity, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', none: 'Not set' };

export function Logo({ brand, className }: { brand: Brand; className?: string }) {
  if (!brand.logo) return <span aria-hidden className="size-6 rounded bg-ink" />;
  return (
    <>
      <img src={brand.logo} alt="" className={cx(className, brand.logoDark && 'logo-light')} />
      {brand.logoDark && <img src={brand.logoDark} alt="" className={cx(className, 'logo-dark')} />}
    </>
  );
}

export function Dot({ tone, className }: { tone: Tone; className?: string }) {
  return <span aria-hidden className={cx('inline-block size-2 shrink-0 rounded-full', DOT[tone], className)} />;
}

export function Pill({ tone, children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line-2 px-2 py-px text-xs tabular-nums text-ink-2', className)}>
      {tone && <Dot tone={tone} />}
      {children}
    </span>
  );
}

export function StatusText({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium', TEXT[tone])}><Dot tone={tone} />{children}</span>;
}

export function Meter({ value, total, label }: { value: number; total: number; label?: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={total} aria-label={label || 'Criteria passing'} className="h-1 w-full overflow-hidden rounded-full bg-sunk">
      <div className="h-full rounded-full bg-ok" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Panel({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('min-w-0 rounded-lg border border-line bg-paper', className)}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </header>
      )}
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

export function Stat({ value, label, tone }: { value: ReactNode; label: ReactNode; tone?: Tone }) {
  return (
    <div className="rounded-lg border border-line bg-paper px-4 py-3">
      <div className={cx('text-2xl font-semibold tabular-nums leading-tight', tone && TEXT[tone])}>{value}</div>
      <div className="mt-0.5 text-xs text-ink-3">{label}</div>
    </div>
  );
}

export function PageHeader({ title, lede, crumb, actions }: { title: ReactNode; lede?: ReactNode; crumb?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6">
      {crumb && <div className="mb-1 text-xs text-ink-3">{crumb}</div>}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold leading-tight text-balance">{title}</h1>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {lede && <p className="mt-2 max-w-3xl text-pretty text-ink-2">{lede}</p>}
    </header>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line-2 px-4 py-6 text-center text-sm text-ink-3">
      <p>{children}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function CopyButton({ text, label, className }: { text: string; label?: ReactNode; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1400); })}
      className={cx('inline-flex max-w-full items-center gap-2 rounded-md border border-line-2 bg-paper px-2.5 py-1 text-xs hover:border-ink-3', className)}
      aria-label={`Copy ${text}`}
      title={text}
    >
      <span className="shrink-0 text-ink-3" aria-live="polite">{done ? 'Copied' : 'Copy'}</span>
      <code className="min-w-0 truncate font-mono text-[11.5px]">{label ?? text}</code>
    </button>
  );
}

export function TabBar({ label, tabs, className }: { label: string; tabs: { to: string; label: ReactNode; count?: number; end?: boolean }[]; className?: string }) {
  return (
    <nav aria-label={label} className={cx('-mx-4 overflow-x-auto border-b-2 border-line px-4 md:mx-0 md:px-0', className)}>
      <div className="flex min-w-max gap-1">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => cx(
              'group relative -mb-[2px] inline-flex items-center gap-2 rounded-t-md border-b-[3px] px-3.5 py-2.5 text-[15px] transition-colors',
              isActive ? 'border-ink font-semibold text-ink' : 'border-transparent text-ink-2 hover:border-line-2 hover:bg-sunk hover:text-ink',
            )}
          >
            {({ isActive }) => (
              <>
                <span>{t.label}</span>
                {t.count !== undefined && (
                  <span className={cx('min-w-6 rounded-full px-1.5 py-px text-center text-xs font-medium tabular-nums', isActive ? 'bg-ink text-paper' : 'bg-sunk text-ink-2 group-hover:bg-paper')}>
                    {t.count}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: [T, ReactNode][]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-md border border-line-2 bg-paper p-0.5">
      {options.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}
          className={cx('rounded px-2.5 py-1 text-xs', value === v ? 'bg-ink text-paper' : 'text-ink-2 hover:text-ink')}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="inline-flex max-w-full items-center gap-1.5 text-xs text-ink-3">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="min-w-0 max-w-[16rem] rounded-md border border-line-2 bg-paper px-2 py-1 text-xs text-ink">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

/** Pages a long list (ADR 0029: a list is paged, not scrolled). page is 0-based. */
export function Pager({ page, pages, total, size, onPage }: { page: number; pages: number; total: number; size: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  const btn = 'rounded-md border border-line-2 px-2.5 py-1 text-xs disabled:opacity-40';
  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
      <button type="button" className={btn} disabled={page === 0} onClick={() => onPage(page - 1)}>Previous</button>
      <span className="tabular-nums">{page * size + 1}-{Math.min(total, (page + 1) * size)} of {total}</span>
      <button type="button" className={btn} disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>Next</button>
    </nav>
  );
}

export function KeyLink({ to, k }: { to: string; k: string }) {
  return <Link to={to} className="font-mono text-[11.5px] text-ink-3 hover:text-ink">{k}</Link>;
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div aria-busy className="space-y-2">
      {Array.from({ length: lines }, (_, i) => <div key={i} className="h-3 rounded bg-sunk" style={{ width: `${90 - i * 12}%` }} />)}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <p role="alert" className="rounded-md border border-line-2 bg-paper px-3 py-2 text-sm text-block">{children}</p>;
}

export function fmtDate(d?: string) {
  if (!d) return '';
  const t = new Date(d.length === 10 ? d + 'T00:00:00' : d);
  if (isNaN(+t)) return d;
  return t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function fmtDateTime(d?: string) {
  if (!d) return '';
  const t = new Date(d);
  if (isNaN(+t)) return d;
  return t.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
