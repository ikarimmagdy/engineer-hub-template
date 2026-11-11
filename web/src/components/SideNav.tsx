import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { cx } from './ui';

/** A page's own menu, on the left: groups of links, so sub-pages never stack as a second row of tabs under the page tabs. */
export interface SideGroup { title?: string; items: { to: string; label: ReactNode; count?: number; end?: boolean }[] }

export function SideNav({ label, groups }: { label: string; groups: SideGroup[] }) {
  return (
    <nav aria-label={label} className="lg:sticky lg:top-4 lg:self-start">
      {groups.map((g, i) => (
        <div key={g.title || i} className={cx(i > 0 && 'mt-4')}>
          {g.title && <div className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{g.title}</div>}
          <ul className="space-y-0.5">
            {g.items.map((it) => (
              <li key={it.to}>
                <NavLink to={it.to} end={it.end}
                  className={({ isActive }) => cx('flex items-start justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm leading-snug',
                    isActive ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-sunk hover:text-ink')}>
                  <span>{it.label}</span>
                  {it.count !== undefined && <span className="tabular-nums opacity-60">{it.count}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Side menu and content, side by side from lg up; stacked on a phone. */
export function WithSideNav({ nav, children }: { nav: ReactNode; children: ReactNode }) {
  return <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-8">{nav}<div className="min-w-0">{children}</div></div>;
}
