import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router';
import { useHub } from '../lib/data';
import { releasesOf } from '../lib/releases';
import { archOf } from '../lib/architecture';
import { Palette } from './Palette';
import { cx, Logo } from './ui';

const NAV: [string, string][] = [
  ['/', 'Home'],
  ['/work', 'Work'],
  ['/architecture', 'Architecture'],
  ['/questions', 'Questions'],
  ['/quality', 'Quality'],
  ['/system', 'System'],
  ['/environments', 'Environments'],
  ['/knowledge', 'Knowledge'],
  ['/learn', 'Learning'],
  ['/releases', 'Releases'],
];

function useTheme() {
  const [theme, setTheme] = useState<string | undefined>(() => document.documentElement.dataset.theme);
  const toggle = () => {
    const dark = theme === 'dark' || (!theme && matchMedia('(prefers-color-scheme: dark)').matches);
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('hub5-theme', next); } catch { /* storage may be blocked */ }
    setTheme(next);
  };
  return toggle;
}

export function Shell({ children, onSignOut }: { children: ReactNode; onSignOut: () => void }) {
  const hub = useHub();
  const { brand, manifest } = hub;
  const hasLearning = !!manifest.learning?.courses?.length;
  const hasReleases = releasesOf(hub).length > 0;
  const hasArch = !!archOf(hub);
  const shown = NAV.filter(([to]) => (to !== '/learn' || hasLearning) && (to !== '/releases' || hasReleases) && (to !== '/system' || !!hub.system) && (to !== '/architecture' || hasArch));
  const [palette, setPalette] = useState(false);
  const [menu, setMenu] = useState(false);
  const toggleTheme = useTheme();
  const loc = useLocation();

  useEffect(() => { setMenu(false); if (!(loc.state as { keepScroll?: boolean } | null)?.keepScroll) window.scrollTo(0, 0); }, [loc.pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(true); }
      else if (e.key === '/' && !(e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) { e.preventDefault(); setPalette(true); }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  const link = (to: string, label: string) => (
    <NavLink
      key={to}
      to={to}
      end={to === '/'}
      className={({ isActive }) => cx(
        'relative rounded-md px-2.5 py-1.5 text-sm',
        isActive ? 'font-semibold text-ink after:absolute after:inset-x-2.5 after:-bottom-[13px] after:h-0.5 after:bg-brand' : 'text-ink-2 hover:text-ink',
      )}
    >
      {label}
    </NavLink>
  );

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded focus:bg-paper focus:px-3 focus:py-1">Skip to content</a>
      <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[1320px] items-center gap-4 px-4 md:px-6">
          <NavLink to="/" className="flex shrink-0 items-center gap-2.5" aria-label={`${brand.name} Engineering Hub, home`}>
            <Logo brand={brand} className="h-6 w-auto" />
            <span className="hidden text-sm font-semibold sm:inline">Engineering Hub</span>
          </NavLink>
          <nav aria-label="Main" className="hidden items-center gap-0.5 md:flex">{shown.map(([to, l]) => link(to, l))}</nav>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => setPalette(true)}
              className="flex h-8 items-center gap-2 whitespace-nowrap rounded-md border border-line bg-sunk px-2.5 text-sm text-ink-3 hover:border-line-2 md:w-auto 2xl:w-72">
              <svg aria-hidden viewBox="0 0 20 20" className="size-4 shrink-0"><circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="m14 14 4 4" stroke="currentColor" strokeWidth="1.6" /></svg>
              <span className="hidden 2xl:inline">Search work and commands</span><span className="hidden md:inline 2xl:hidden">Search</span>
              <kbd className="ml-auto hidden rounded border border-line-2 px-1 font-mono text-[11px] md:inline">⌘K</kbd>
              <span className="sr-only md:hidden">Search</span>
            </button>
            <button type="button" onClick={toggleTheme} aria-label="Switch light or dark theme" className="grid size-8 place-items-center rounded-md text-ink-2 hover:bg-sunk">
              <svg aria-hidden viewBox="0 0 20 20" className="size-4"><path d="M10 3a7 7 0 1 0 7 7 5.5 5.5 0 0 1-7-7Z" fill="currentColor" /></svg>
            </button>
            <button type="button" onClick={onSignOut} className="hidden whitespace-nowrap rounded-md px-2 py-1 text-sm text-ink-2 hover:bg-sunk md:block">Sign out</button>
            <button type="button" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-controls="mobile-nav" aria-label="Menu" className="grid size-8 place-items-center rounded-md hover:bg-sunk md:hidden">
              <svg aria-hidden viewBox="0 0 20 20" className="size-4"><path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.6" /></svg>
            </button>
          </div>
        </div>
        {menu && (
          <nav id="mobile-nav" aria-label="Main" className="flex flex-col gap-1 border-t border-line px-4 py-2 md:hidden">
            {shown.map(([to, l]) => link(to, l))}
            <button type="button" onClick={onSignOut} className="rounded-md px-2.5 py-1.5 text-left text-sm text-ink-2">Sign out</button>
          </nav>
        )}
      </header>
      <main id="main" className="mx-auto max-w-[1320px] px-4 pb-24 pt-6 md:px-6 md:pt-8">{children}</main>
      <footer className="mx-auto max-w-[1320px] px-4 pb-8 text-xs text-ink-3 md:px-6">
        {brand.name} · content generated {manifest.meta.generated} · template {manifest.meta.template}
      </footer>
      <Palette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}
