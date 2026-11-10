import type { Hub } from './data';

export interface ArchLink { label?: string; url?: string }
export interface ArchActor { id: string; name?: string; kind?: string; description?: string }
export interface ArchExternal { id: string; name?: string; kind?: string; regions?: string[]; description?: string }
export interface ArchResource { id: string; name?: string; type?: string; stack?: string; description?: string; connects?: string[]; links?: ArchLink[] }
export interface ArchLayer { id?: string; name?: string; resources?: ArchResource[] }
export interface ArchRegion { id: string; name?: string; cloud?: string; location?: string; account?: string; status?: string; description?: string; layers?: ArchLayer[] }
export interface ArchContainer {
  id: string; name?: string; kind?: string; tech?: string; repo?: string; regions?: string[]; description?: string;
  runsOn?: Record<string, string>; talksTo?: string[]; urls?: ArchLink[];
}
export interface ArchEndpoint { method?: string; path?: string; summary?: string }
export interface ArchModule {
  id: string; name?: string; container?: string; package?: string; description?: string; dependsOn?: string[];
  endpoints?: ArchEndpoint[]; tables?: string[]; events?: { publishes?: string[]; consumes?: string[] };
  adapters?: string[]; workItems?: string[]; adrs?: string[]; code?: string[];
}
export interface ArchAdapter { id: string; name?: string; external?: string; regions?: string[]; ports?: string[]; module?: string; code?: string[]; description?: string }
export interface ArchFlow { id: string; title?: string; description?: string; mermaid?: string; workItems?: string[]; modules?: string[] }

export interface Architecture {
  generated?: string;
  sources?: string[];
  summary?: string;
  actors?: ArchActor[];
  externals?: ArchExternal[];
  regions?: ArchRegion[];
  containers?: ArchContainer[];
  modules?: ArchModule[];
  adapters?: ArchAdapter[];
  flows?: ArchFlow[];
}

export const VIEWS = [
  ['overview', 'Overview'],
  ['infrastructure', 'Infrastructure'],
  ['application', 'Application'],
  ['modules', 'Modules'],
  ['flows', 'Flows'],
] as const;
export type View = (typeof VIEWS)[number][0];

/** content/data/architecture.json (via the manifest), or null when the hub has none. */
export function archOf(hub: Hub): Architecture | null {
  const a = (hub.manifest as unknown as { architecture?: Architecture | null }).architecture;
  if (!a || typeof a !== 'object') return null;
  const any = ['actors', 'externals', 'regions', 'containers', 'modules', 'adapters', 'flows'].some((k) => ((a as Record<string, unknown>)[k] as unknown[] | undefined)?.length);
  return any || a.summary ? a : null;
}

export type NodeKind = 'actor' | 'external' | 'region' | 'resource' | 'container' | 'module' | 'adapter' | 'flow';
export const KIND_LABEL: Record<NodeKind, string> = {
  actor: 'Actor', external: 'External system', region: 'Region', resource: 'Resource', container: 'Container',
  module: 'Module', adapter: 'Adapter', flow: 'Flow',
};

export interface ArchNode {
  id: string;
  kind: NodeKind;
  name: string;
  hint?: string;
  region?: string;
  layer?: string;
  data: ArchActor | ArchExternal | ArchRegion | ArchResource | ArchContainer | ArchModule | ArchAdapter | ArchFlow;
}

export interface ArchIndex {
  arch: Architecture;
  nodes: ArchNode[];
  byId: Map<string, ArchNode>;
  get: (id?: string | null) => ArchNode | undefined;
  name: (id: string) => string;
}

const ORDER: NodeKind[] = ['container', 'module', 'resource', 'region', 'external', 'actor', 'adapter', 'flow'];

export function indexArch(arch: Architecture): ArchIndex {
  const nodes: ArchNode[] = [];
  for (const a of arch.actors || []) nodes.push({ id: a.id, kind: 'actor', name: a.name || a.id, hint: a.kind, data: a });
  for (const e of arch.externals || []) nodes.push({ id: e.id, kind: 'external', name: e.name || e.id, hint: e.kind, data: e });
  for (const r of arch.regions || []) {
    nodes.push({ id: r.id, kind: 'region', name: r.name || r.id, hint: [r.cloud, r.location].filter(Boolean).join(' '), data: r });
    for (const l of r.layers || []) {
      for (const x of l.resources || []) nodes.push({ id: x.id, kind: 'resource', name: x.name || x.id, hint: [x.type, r.name || r.id].filter(Boolean).join(' · '), region: r.id, layer: l.name || l.id, data: x });
    }
  }
  for (const c of arch.containers || []) nodes.push({ id: c.id, kind: 'container', name: c.name || c.id, hint: [c.kind, c.tech].filter(Boolean).join(' · '), data: c });
  for (const m of arch.modules || []) nodes.push({ id: m.id, kind: 'module', name: m.name || m.id, hint: m.package || m.container, data: m });
  for (const a of arch.adapters || []) nodes.push({ id: a.id, kind: 'adapter', name: a.name || a.id, hint: a.external, data: a });
  for (const f of arch.flows || []) nodes.push({ id: f.id, kind: 'flow', name: f.title || f.id, data: f });
  const byId = new Map<string, ArchNode>();
  for (const k of ORDER) for (const n of nodes) if (n.kind === k && n.id && !byId.has(n.id)) byId.set(n.id, n);
  const get = (id?: string | null) => (id ? byId.get(id) : undefined);
  return { arch, nodes: nodes.filter((n) => n.id), byId, get, name: (id) => byId.get(id)?.name || id };
}

const enc = encodeURIComponent;
export const archRoute = (view?: View, id?: string) => `/architecture${view ? `/${view}` : ''}${id ? `/${enc(id)}` : ''}`;

/** The view a node opens on. */
export function nodeRoute(n: ArchNode, idx?: ArchIndex): string {
  switch (n.kind) {
    case 'resource': return archRoute('infrastructure', n.id);
    case 'container': return archRoute('application', n.id);
    case 'module': return archRoute('modules', n.id);
    case 'flow': return archRoute('flows', n.id);
    case 'adapter': {
      const m = (n.data as ArchAdapter).module;
      return m && idx?.get(m)?.kind === 'module' ? `${archRoute('modules', m)}#adapter-${enc(n.id)}` : archRoute('overview', n.id);
    }
    default: return archRoute('overview', n.id);
  }
}

/** Modules that list a work item key. */
export function modulesForWork(hub: Hub, key: string): ArchModule[] {
  const a = archOf(hub);
  if (!a) return [];
  return (a.modules || []).filter((m) => (m.workItems || []).includes(key));
}

/** Containers running on a resource (runsOn values). */
export function containersOn(arch: Architecture, resourceId: string): ArchContainer[] {
  return (arch.containers || []).filter((c) => Object.values(c.runsOn || {}).includes(resourceId));
}

/** Resources a resource connects to, in either direction. */
export function resourceNeighbours(arch: Architecture, id: string): Set<string> {
  const out = new Set<string>();
  for (const r of arch.regions || []) for (const l of r.layers || []) for (const x of l.resources || []) {
    if (x.id === id) (x.connects || []).forEach((c) => out.add(c));
    else if ((x.connects || []).includes(id)) out.add(x.id);
  }
  return out;
}

/** Container-level edges for the context map: talksTo, plus each adapter's container to its external system. */
export function contextEdges(arch: Architecture): [string, string][] {
  const out: [string, string][] = [];
  const seen = new Set<string>();
  const add = (a?: string, b?: string) => {
    if (!a || !b || a === b) return;
    const k = `${a}\u0000${b}`;
    if (!seen.has(k)) { seen.add(k); out.push([a, b]); }
  };
  for (const c of arch.containers || []) for (const t of c.talksTo || []) add(c.id, t);
  const modContainer = new Map((arch.modules || []).map((m) => [m.id, m.container]));
  for (const a of arch.adapters || []) add(a.module ? modContainer.get(a.module) || a.module : undefined, a.external);
  return out;
}

export const searchText = (n: ArchNode) => [n.name, n.id, n.hint, n.layer, (n.data as { description?: string }).description].filter(Boolean).join(' ').toLowerCase();
