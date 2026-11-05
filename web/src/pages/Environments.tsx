import { Navigate, useParams } from 'react-router';
import { isLocal, useHub } from '../lib/data';
import { ENV_PAGES } from '../lib/routes';
import { MarkdownFile } from '../components/Markdown';
import { Empty, PageHeader, TabBar } from '../components/ui';

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
      <TabBar label="Environments" className="mb-6" tabs={tabs.map(([id, t]) => ({ to: `/environments/${id}`, label: t }))} />
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
