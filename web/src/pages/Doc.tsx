import { Link, useLocation, useParams } from 'react-router';
import { useHub } from '../lib/data';
import { MarkdownFile } from '../components/Markdown';
import { Empty, PageHeader } from '../components/ui';

export function Doc() {
  const loc = useLocation();
  const rel = decodeURIComponent(loc.pathname.replace(/^\/doc\//, ''));
  const path = rel.startsWith('content/') ? rel : `content/kb-src/${rel}`;
  const { manifest } = useHub();
  const entry = manifest.kb.find((k) => k.path === rel);
  const parts = rel.replace(/^content\/(kb-src\/)?/, '').split('/');
  if (!/\.(md|markdown)$/i.test(rel)) {
    return <Empty action={<a className="underline" href={path} target="_blank" rel="noopener">Open the file</a>}>This file is not markdown.</Empty>;
  }
  return (
    <div>
      <PageHeader
        crumb={<><Link to="/knowledge/library" className="hover:underline">Library</Link> / <span className="font-mono">{parts.slice(0, -1).join(' / ')}</span></>}
        title={entry?.title || parts[parts.length - 1].replace(/\.md$/, '').replace(/[-_]/g, ' ')}
      />
      <MarkdownFile path={path} />
    </div>
  );
}

export function SectionPage() {
  const { id } = useParams();
  const { manifest } = useHub();
  const s = manifest.sections.find((x) => x.id === id);
  if (!s) return <Empty action={<Link className="underline" to="/knowledge">Knowledge</Link>}>No page {id}.</Empty>;
  return (
    <div>
      <PageHeader crumb={s.eyebrow} title={s.title} />
      <MarkdownFile path={s.doc} wide />
    </div>
  );
}
