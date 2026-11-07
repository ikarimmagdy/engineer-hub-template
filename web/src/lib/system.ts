import type { Tone } from '../components/ui';

/** The system model: every spec's outputs/impact.json merged over the workspace baseline (tools/impact.py json). */
export type Change = 'added' | 'changed' | 'removed' | 'used';
export interface Where { repo?: string; path?: string; ref?: string }
export interface ChangeRec { key: string; change: Change; summary: string; date: string; where?: Where[]; reqs?: string[] }
export interface Layer { id: string; name: string; summary?: string }
export interface Component { id: string; name: string; layer: string; kind: string; repo?: string; stack?: string; summary?: string; baseline: boolean; changes: ChangeRec[] }
export interface Flow { id: string; from: string; to: string; protocol: string; interface: string; baseline?: boolean; changes: ChangeRec[] }
export interface Infra { id: string; kind: string; name: string; component: string; env: string[]; changes: ChangeRec[] }
export interface Screen { id: string; name: string; app: string; platforms: string[]; image: string | null; changes: ChangeRec[] }
export interface UseCase { id: string; key: string; name: string; actor?: string; change: Change; summary?: string; reqs?: string[]; components?: string[]; date: string }
export interface Work { key: string; dir: string; title: string; phase: string; updated: string; summary: string; decisions: string[]; counts: Record<string, number> }
export interface SystemModel {
  generated: string;
  layers: Layer[];
  components: Component[];
  flows: Flow[];
  infra: Infra[];
  screens: Screen[];
  useCases: UseCase[];
  works: Work[];
}

export const CHANGE_TONE: Record<Change, Tone> = { added: 'ok', changed: 'medium', removed: 'block', used: 'none' };
export const CHANGE_LABEL: Record<Change, string> = { added: 'Added', changed: 'Changed', removed: 'Removed', used: 'Used' };
export const CHANGE_COLOR: Record<Change, string> = { added: 'var(--ok)', changed: 'var(--sev-medium)', removed: 'var(--block)', used: 'var(--ink-3)' };

const RANK: Record<Change, number> = { removed: 3, added: 2, changed: 1, used: 0 };

/** The strongest change an element has, from one work item or from all of them. */
export function changeOf(el: { changes: ChangeRec[] }, key?: string): Change | null {
  const cs = key ? el.changes.filter((c) => c.key === key) : el.changes.filter((c) => c.change !== 'used');
  if (!cs.length) return null;
  return cs.reduce((a, c) => (RANK[c.change] > RANK[a] ? c.change : a), cs[0].change);
}

export const touchedBy = (el: { changes: ChangeRec[] }, key: string) => el.changes.some((c) => c.key === key);
export const keysOf = (el: { changes: ChangeRec[] }) => [...new Set(el.changes.map((c) => c.key))];

export function forWork(sys: SystemModel, key: string) {
  return {
    work: sys.works.find((w) => w.key === key),
    components: sys.components.filter((c) => touchedBy(c, key)),
    flows: sys.flows.filter((f) => touchedBy(f, key)),
    infra: sys.infra.filter((x) => touchedBy(x, key)),
    screens: sys.screens.filter((s) => touchedBy(s, key)),
    useCases: sys.useCases.filter((u) => u.key === key),
  };
}

export const INFRA_KIND: Record<string, string> = {
  database: 'Databases', table: 'Tables', column: 'Columns', 'stored-procedure': 'Stored procedures', config: 'Configuration',
  secret: 'Secrets (by name)', queue: 'Queues', topic: 'Topics', cache: 'Caches', job: 'Scheduled jobs', k8s: 'Kubernetes',
  ingress: 'Ingress', certificate: 'Certificates', dns: 'DNS', 'feature-flag': 'Feature flags', other: 'Other',
};

export function whereText(w: Where) {
  return [w.repo, w.path].filter(Boolean).join(' / ') + (w.ref ? ` @ ${w.ref}` : '');
}
