import type { Hub } from './data';

export interface ReleasePlatform { platform: string; component?: string; version?: string; where?: string; status?: string }
export interface Release {
  id: string;
  date?: string;
  env?: string;
  title?: string;
  tickets?: string[];
  notes?: string[];
  build?: string | Record<string, unknown>;
  platforms?: ReleasePlatform[];
}
interface FeatureRef { id: string; fid?: string; title?: string }

/** Releases from content/data/releases.json (via the manifest), newest first. */
export function releasesOf(hub: Hub): Release[] {
  const r = (hub.manifest as unknown as { releases?: { releases?: Release[] } }).releases?.releases || [];
  return r.slice().reverse();
}

export const releaseRoute = (id: string) => `/releases/${encodeURIComponent(id)}`;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Releases that name an id in their tickets, title or notes, newest first. */
export function releasesFor(hub: Hub, ...ids: (string | undefined)[]): Release[] {
  const keys = ids.filter(Boolean) as string[];
  if (!keys.length) return [];
  const res = keys.map((k) => new RegExp(`(^|[^A-Za-z0-9-])${escapeRe(k)}(?![0-9A-Za-z])`));
  return releasesOf(hub).filter((r) =>
    (r.tickets || []).some((t) => keys.includes(t)) || res.some((re) => re.test([r.title || '', ...(r.notes || [])].join('\n'))),
  );
}

export function featureByTicket(hub: Hub, t: string): FeatureRef | undefined {
  const fs = (hub.manifest as unknown as { features?: FeatureRef[] }).features || [];
  return fs.find((f) => f.fid === t || f.id === t);
}

/** Where a ticket on a release opens: its work item when one exists, otherwise its question linkage. */
export function ticketRoute(hub: Hub, t: string): string {
  const s = hub.loop.specs.find((x) => x.key === t);
  if (s) return `/work/${s.key}/overview`;
  return `/questions?work=${encodeURIComponent(t)}`;
}

export const buildEntries = (b: Release['build']): [string, string][] =>
  !b ? [] : typeof b === 'string' ? [['', b]] : Object.entries(b).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]);

/** The latest release per environment, platform and component: what each environment runs now. */
export function liveNow(hub: Hub): { env: string; rows: (ReleasePlatform & { release: Release })[] }[] {
  const out = new Map<string, Map<string, ReleasePlatform & { release: Release }>>();
  for (const r of releasesOf(hub)) {
    const env = r.env || 'unspecified';
    const m = out.get(env) || new Map();
    for (const p of r.platforms || []) {
      const k = `${p.platform}\u0000${p.component || ''}`;
      if (!m.has(k)) m.set(k, { ...p, release: r });
    }
    out.set(env, m);
  }
  return [...out.entries()].map(([env, m]) => ({ env, rows: [...m.values()].sort((a, b) => a.platform.localeCompare(b.platform)) }));
}
