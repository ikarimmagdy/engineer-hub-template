import type { Hub } from './data';

export const TABS = [
  ['overview', 'Overview'],
  ['requirements', 'Requirements'],
  ['design', 'Design'],
  ['tasks', 'Tasks'],
  ['tests', 'Tests'],
  ['findings', 'Findings'],
  ['documents', 'Documents'],
  ['activity', 'Activity'],
] as const;
export type Tab = (typeof TABS)[number][0];

const PHASE_TAB: Record<string, Tab> = {
  intent: 'overview', spec: 'requirements', design: 'design', build: 'tasks', test: 'tests', deploy: 'activity', maintain: 'activity',
};

export const ENV_PAGES = [
  ['env-links', 'Environment links'],
  ['accounts', 'Environments and test data'],
  ['tools-logins', 'Tools and logins'],
] as const;

/** Maps a v4 hash route (without the leading '#') to its v5 route, or null when it is already v5 or unknown. */
export function legacyRoute(path: string, hub: Hub): string | null {
  const [p, query = ''] = path.split('?');
  const seg = p.replace(/^\/+/, '').split('/').map(decodeURIComponent);
  const specBy = (k: string) => hub.loop.specs.find((s) => s.dir === k || s.folder === k || s.key.toLowerCase() === k.toLowerCase());
  const head = seg[0] || '';

  if (head === 'loop' || head === 'start') return '/knowledge/how-we-work';
  if (head === 'spec' && seg[1]) {
    const s = specBy(seg[1]);
    if (!s) return '/work';
    const sub = seg[2];
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
  if (head === 'doc' || head === '' ) return null;
  if (['work', 'quality', 'environments', 'knowledge', 'section'].includes(head)) return null;
  if (hub.manifest.sections.some((s) => s.id === head)) return `/section/${head}${query ? `?${query}` : ''}`;
  return '/knowledge/archive';
}
