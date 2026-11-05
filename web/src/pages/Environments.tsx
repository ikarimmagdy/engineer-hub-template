import { NavLink, Navigate, useParams } from 'react-router';
import { isLocal, useHub } from '../lib/data';
import { ENV_PAGES } from '../lib/routes';
import { MarkdownFile } from '../components/Markdown';
import { cx, Empty, PageHeader } from '../components/ui';

export function Environments() {
  const { page } = useParams();
  const { manifest } = useHub();
  const local = manifest.nav.find((g) => /local tools/i.test(g.label))?.items || [];
  const pages = ENV_PAGES.filter(([id]) => manifest.sections.some((s) => s.id === id));
  const tabs: [string, string][] = [...pages.map(([id, t]) => [id, t] as [string, string]), ...(local.length && isLocal() ? [['local', 'On this laptop'] as [string, string]] : [])];
  if (!page) return tabs.length ? <Navigate to={`/environments/${tabs[0][0]}`} replace /> : <Empty>No environment pages in this hub yet.</Empty>;
  const section = manifest.sections.find((s) => s.id === page);

  return (
    <div>
      <PageHeader title="Environments" lede="Where the stack runs, the accounts and test data for each environment, and the tools the team signs in to." />
      <nav aria-label="Environments" className="-mx-4 mb-6 overflow-x-auto border-b border-line px-4 md:mx-0 md:px-0">
        <div className="flex min-w-max gap-5">
          {tabs.map(([id, t]) => (
            <NavLink key={id} to={`/environments/${id}`} className={({ isActive }) => cx('-mb-px border-b-2 py-2.5 text-sm', isActive ? 'border-ink font-semibold' : 'border-transparent text-ink-3 hover:text-ink')}>{t}</NavLink>
          ))}
        </div>
      </nav>
      {page === 'local' ? (
        <div>
          <p className="mb-4 max-w-3xl text-sm text-ink-2">Consoles running on this machine. They are listed only when the hub itself runs locally, because on the shared hub these addresses point at the visitor's own laptop.</p>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {local.map((i) => (
              <li key={i.route}>
                <a href={i.route} target="_blank" rel="noopener" className="block rounded-lg border border-line bg-paper px-4 py-3 hover:border-line-2">
                  <div className="text-sm font-medium">{i.title}</div>
                  <div className="mt-0.5 truncate font-mono text-[11.5px] text-ink-3">{i.route}</div>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : section ? <MarkdownFile path={section.doc} wide /> : <Navigate to="/environments" replace />}
    </div>
  );
}
