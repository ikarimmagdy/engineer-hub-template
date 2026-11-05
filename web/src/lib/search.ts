import MiniSearch from 'minisearch';
import type { Hub } from './data';
import { TABS, ENV_PAGES } from './routes';

export interface Hit {
  id: string;
  group: 'Work' | 'Commands' | 'Pages' | 'Decisions' | 'Library';
  title: string;
  hint?: string;
  to?: string;
  copy?: string;
}

export function buildIndex(hub: Hub) {
  const docs: Hit[] = [];
  for (const s of hub.loop.specs) {
    docs.push({ id: `w:${s.key}`, group: 'Work', title: `${s.key} ${s.title}`, hint: s.phase, to: `/work/${s.key}/overview` });
    for (const [tab, label] of TABS.slice(1)) {
      docs.push({ id: `w:${s.key}:${tab}`, group: 'Work', title: `${s.key} · ${label}`, hint: s.title, to: `/work/${s.key}/${tab}` });
    }
    if (s.tasks?.blocked) docs.push({ id: `w:${s.key}:blocked`, group: 'Work', title: `${s.key} · Tasks · blocked`, hint: String(s.tasks.blocked), to: `/work/${s.key}/tasks?status=blocked` });
    if (s.next?.startsWith('/')) docs.push({ id: `c:${s.key}:next`, group: 'Commands', title: s.next, hint: `next step for ${s.key}`, copy: s.next });
    docs.push({ id: `c:${s.key}:feature`, group: 'Commands', title: `/feature ${s.key}`, hint: 'where everything is', copy: `/feature ${s.key}` });
  }
  const pages: [string, string][] = [
    ['/', 'Home'], ['/work', 'Work board'], ['/work?view=table', 'Work table'], ['/quality/findings', 'Findings, all work'],
    ['/quality/tests', 'Test health'], ['/knowledge/how-we-work', 'How we work'], ['/knowledge/decisions', 'Decision log'],
    ['/knowledge/library', 'Library'], ['/knowledge/archive', 'Archive (before v5)'],
    ...ENV_PAGES.map(([id, t]) => [`/environments/${id}`, t] as [string, string]),
  ];
  pages.forEach(([to, title]) => docs.push({ id: `p:${to}`, group: 'Pages', title, to }));
  for (const s of hub.loop.specs) {
    for (const p of s.pages || []) {
      docs.push({ id: `sp:${s.key}:${p.id}`, group: 'Pages', title: `${p.title}`, hint: s.key, to: `/work/${s.key}/design?doc=page:${p.id}` });
    }
  }
  for (const sec of hub.manifest.sections) {
    if (/^(spec-|te-|test-executions-|delivery-loop)/.test(sec.id)) continue;
    docs.push({ id: `s:${sec.id}`, group: 'Pages', title: sec.title, hint: sec.eyebrow, to: `/section/${sec.id}` });
  }
  for (const a of hub.manifest.adrs) {
    docs.push({ id: `a:${a.id}`, group: 'Decisions', title: `${a.id} ${a.title}`, hint: a.status, to: `/knowledge/decisions/${a.id}` });
  }
  for (const k of hub.manifest.kb) {
    docs.push({ id: `k:${k.path}`, group: 'Library', title: k.title, hint: k.group, to: `/doc/${k.path}` });
  }
  const ms = new MiniSearch<Hit>({
    fields: ['title', 'hint'],
    storeFields: ['group', 'title', 'hint', 'to', 'copy'],
    searchOptions: { prefix: true, fuzzy: 0.15, boost: { title: 3 }, combineWith: 'AND' },
  });
  ms.addAll(docs);
  return { ms, docs };
}
