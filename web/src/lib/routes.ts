import type { Hub } from './data';

export const TABS = [
  ['overview', 'Overview'],
  ['requirements', 'Requirements'],
  ['design', 'Design'],
  ['tasks', 'Tasks'],
  ['tests', 'Tests'],
  ['findings', 'Findings'],
  ['impact', 'Impact'],
  ['documents', 'Documents'],
  ['activity', 'Activity'],
] as const;
export type Tab = (typeof TABS)[number][0];

export const PHASE_TAB: Record<string, Tab> = {
  intent: 'overview', spec: 'requirements', design: 'design', build: 'tasks', test: 'tests', deploy: 'activity', maintain: 'activity',
};

export const ENV_PAGES = [
  ['env-links', 'Environment links'],
  ['accounts', 'Environments and test data'],
  ['tools-logins', 'Tools and logins'],
] as const;

const HOW = '/knowledge/how-we-work';

/** The command a phase's "How this phase works" link selects: the first one loop-config lists for it (Build: /tasks). */
export function phaseCommand(hub: Hub, phase: string): string | undefined {
  return hub.manifest.loopConfig.phases?.find((p) => p.key === phase)?.command.split(/[,\s]+/).find((c) => c.startsWith('/'))?.slice(1);
}
export const howRoute = (cmd: string) => `${HOW}/cmd/${encodeURIComponent(cmd)}`;

/** The work-item tab showing a spec document (loop-config "docs"), at one of its versions. */
export const docTabRoute = (key: string, phase: string, id: string, version?: string) =>
  `/work/${key}/${PHASE_TAB[phase] || 'overview'}?doc=doc:${encodeURIComponent(id)}${version ? `&v=${encodeURIComponent(version)}` : ''}`;

/** A served file that is a version of a spec document opens on that document's phase tab. */
export function docRoute(hub: Hub, file: string): string | null {
  for (const s of hub.loop.specs) {
    for (const d of s.docs || []) {
      const v = d.versions.find((x) => x.file === file);
      if (v) return docTabRoute(s.key, d.phase, d.id, v.name === d.version ? undefined : v.name);
      if (file === `content/kb-src/${d.source}`) return docTabRoute(s.key, d.phase, d.id);
    }
  }
  return null;
}

/** Maps a v4 hash route (without the leading '#') to its v5 route, or null when it is already v5 or unknown. */
export function legacyRoute(path: string, hub: Hub): string | null {
  const [p, query = ''] = path.split('?');
  const seg = p.replace(/^\/+/, '').split('/').map(decodeURIComponent);
  const specBy = (k: string) => hub.loop.specs.find((s) => s.dir === k || s.folder === k || s.key.toLowerCase() === k.toLowerCase());
  const head = seg[0] || '';

  if (head === 'loop' && ['cmd', 'node', 'flow'].includes(seg[1]) && seg[2]) return `${HOW}/${seg[1]}/${encodeURIComponent(seg.slice(2).join('/'))}`;
  if (head === 'loop') return HOW;
  if (head === 'start') return `${HOW}/start`;
  if (head === 'review') {
    const k = seg[1]?.toLowerCase();
    const s = hub.loop.specs.find((x) => (!k || x.key.toLowerCase() === k) && x.docs?.some((d) => /code-review/.test(d.id)));
    const d = s?.docs?.find((x) => /code-review/.test(x.id));
    if (s && d) return docTabRoute(s.key, d.phase, d.id);
    const t = k && specBy(k);
    return t ? `/work/${t.key}/findings` : '/quality/findings';
  }
  if (head === 'spec' && seg[1]) {
    const s = specBy(seg[1]);
    if (!s) return '/work';
    const sub = seg[2];
    const doc = seg[3]?.startsWith('doc:') && s.docs?.find((d) => `doc:${d.id}` === seg[3]);
    if (doc) return docTabRoute(s.key, doc.phase, doc.id, seg[4]);
    const page = sub === 'page' ? seg[3] : seg[3]?.startsWith('page:') ? seg[3].slice(5) : '';
    if (page && s.pages?.some((x) => x.id === page)) return `/work/${s.key}/design?doc=page:${encodeURIComponent(page)}`;
    if (seg[3] === 'findings' || sub === 'findings') return `/work/${s.key}/findings`;
    if (seg[3] === 'review') return `/work/${s.key}/findings${seg[4] ? `?area=${encodeURIComponent(seg[4])}` : ''}`;
    return `/work/${s.key}/${(sub && PHASE_TAB[sub]) || 'overview'}`;
  }
  const te = head.match(/^test-executions-(.+)$/);
  if (te) {
    const s = specBy(te[1]);
    return s ? `/work/${s.key}/tests` : '/quality/tests';
  }
  if (head === 'findings') return `/quality/findings${seg[1] && seg[1] !== 'all' ? `?area=${encodeURIComponent(seg[1])}` : ''}`;
  if (ENV_PAGES.some(([id]) => id === head)) return `/environments/${head}`;
  if (head === 'adr') return seg[1] ? `/knowledge/decisions/${seg[1]}` : '/knowledge/decisions';
  if (head === 'kb') return '/knowledge/library';
  if (head === 'course' && seg[1]) return `/learn/${encodeURIComponent(seg[1])}`;
  if (head === 'lesson' && seg[1]) return `/learn/${seg.slice(1, 3).map(encodeURIComponent).join('/')}`;
  if (head === 'releases' && !seg[1]) return null;
  if (head === 'release' && seg[1]) return `/releases/${encodeURIComponent(seg[1])}`;
  if (head === 'doc' || head === '' ) return null;
  if (['work', 'quality', 'environments', 'knowledge', 'section', 'learn', 'releases'].includes(head)) return null;
  if (hub.manifest.sections.some((s) => s.id === head)) return `/section/${head}${query ? `?${query}` : ''}`;
  return '/knowledge/archive';
}
