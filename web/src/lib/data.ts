import { createContext, useContext, useEffect, useState } from 'react';
import type { SystemModel } from './system';
import type { Operations } from '../pages/Operations';

export const PHASES = ['intent', 'spec', 'design', 'build', 'test', 'deploy', 'maintain'] as const;
export type Phase = (typeof PHASES)[number];
export const PHASE_TITLE: Record<Phase, string> = {
  intent: 'Intent', spec: 'Spec', design: 'Design', build: 'Build', test: 'Test', deploy: 'Deploy', maintain: 'Maintain',
};
export const TASK_STATES = ['blocked', 'doing', 'review', 'todo', 'done'] as const;
export type TaskState = (typeof TASK_STATES)[number];
export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'none'] as const;
export type Severity = (typeof SEVERITIES)[number];

export interface Brand {
  name: string;
  logo?: string;
  logoDark?: string;
  passcode?: string;
  repoBase?: string;
}

export interface Approval { date: string; by: string }

export interface FindingSummary {
  total: number;
  open: number;
  bySeverity: Partial<Record<Severity, number>>;
  byArea?: Record<string, number>;
  byType?: Record<string, number>;
  byComponent?: Record<string, number>;
  byTeam?: Record<string, number>;
}

export interface Spec {
  key: string;
  title: string;
  folder: string;
  dir: string;
  phase: Phase;
  approved: Partial<Record<'intent' | 'spec' | 'design', Approval | null>>;
  tracker?: { initiative?: string; epics?: string[]; stories?: string[] };
  repos: string[];
  updated: string;
  next: string;
  requirements: number;
  criteria: number;
  criteria_tested: number;
  criteria_passing: number;
  tasks: Record<TaskState, number>;
  task_list: { id: string; status: TaskState }[];
  history: { date: string; event: string; by?: string; note?: string; forced?: string[] }[];
  intake?: { kind: string; ref: string; summary: string };
  started_by?: { name: string; date: string } | null;
  findings: FindingSummary | null;
  review: string[];
  files: Record<string, boolean>;
  outputs: string[];
  inputs: string[];
  sources: string[];
  findingsFile: string | null;
  pages?: { id: string; title: string; file: string; version: string; source: string; phase?: string | null }[];
  docs?: SpecDoc[];
  /** Only on an open pull request to the workspace, not merged yet (laid in by the shared hub's workspace sync). */
  proposed?: { pr: number; url: string; author: string; title: string; branch: string };
}

export interface DocFile { name: string; file: string }
/** A loop-config "docs" entry: a document of the hub's own repo shown on a phase of a spec (tools/sync_loop.py). */
export interface SpecDoc {
  id: string;
  title: string;
  phase: Phase;
  kind: 'md' | 'html' | 'images';
  source: string;
  file: string | null;
  version: string;
  versions: DocFile[];
  images: DocFile[];
}

export interface Loop { generated: string; workspace: string; specs: Spec[] }

export interface NavItem { title: string; icon?: string; route: string }
export interface NavGroup { label: string; items: NavItem[] }
export interface Section { id: string; title: string; eyebrow?: string; lede?: string; doc: string }
export interface Adr { id: string; title: string; status: string; date: string; summary: string; file?: string; doc?: string }
export interface KbEntry { title: string; path: string; group: string; summary?: string; version?: string }

export interface SdlcBox { t: string; d?: string; go?: string }

export interface LoopConfig {
  title: string;
  lede: string;
  trackerBase?: string;
  intake?: { key: string; title: string; what: string; command: string; via: string }[];
  phases?: { key: string; title: string; command: string; does: string; gate?: string; tools?: string; outputs?: string; files?: string[] }[];
  entries?: { key: string; title: string; what?: string; command?: string; example?: string; via?: string }[];
  flows?: { key: string; title: string; steps: { nodes: string[]; text: string }[] }[];
  sdlc?: { title?: string; workspace?: string; sources?: SdlcBox[]; delivers?: SdlcBox[] };
  [k: string]: unknown;
}

export interface AgCommand { id: string; name: string; description: string; args?: string; phase: number | null; agents: string[]; tools: string[]; files: string[]; path: string }
export interface AgNode { id: string; name: string; description?: string; path?: string; tools?: string; kind?: string; configured?: boolean; used?: boolean; source?: string; event?: string; matcher?: string
  team?: string; family?: string; scope?: string[]; modes?: string[]; starters?: string[]; mcp?: string[]; mcpTools?: string[]; access?: string[]; build?: string; prompt?: string }
/** An MCP server the workspace configures (.mcp.json or an enabled plugin); header and env values are never carried, only names. */
export interface McpServer { name: string; transport: 'http' | 'stdio' | 'plugin'; endpoint: string; headers: string[]; env: string[]; for: string; signIn: string; source: string; usedBy: string[] }
/** The workspace's .claude wiring, read from the command, agent, hook and skill files (manifest "agentic"). */
export interface Agentic {
  generated: string;
  workspace: string;
  commands: AgCommand[];
  agents: AgNode[];
  tools: AgNode[];
  mcpServers?: McpServer[];
  files: AgNode[];
  hooks: AgNode[];
  rules: AgNode[];
  skills: AgNode[];
  constitution?: string[];
  edges: [string, string][];
}

export interface Manifest {
  meta: { generated: string; version: string; template: string; brand: string };
  nav: NavGroup[];
  sections: Section[];
  adrs: Adr[];
  kb: KbEntry[];
  loopConfig: LoopConfig;
  agentic?: Agentic;
  learning?: import('./learning').Learning;
}

export interface Finding {
  id: string;
  title: string;
  severity: Severity | null;
  area: string | null;
  dimension: string | null;
  kind?: string;
  location?: string;
  detail?: string;
  impact?: string;
  fix?: string;
  status: string;
  source?: string;
  component?: string;
  type?: string;
  team?: string;
}

export interface TestResult { status: string; name: string; screen?: string | null; story?: string | null; seconds?: number; failure?: unknown }
export interface TestSession {
  key: string;
  session?: string;
  platform: string;
  device: { model: string; os: string; id: string };
  suite: string;
  suite_detail?: string;
  short_suite?: string;
  data_mode?: string;
  state: string;
  updated: string;
  started?: string;
  total: number;
  passed: number;
  failed: number;
  current?: string | null;
  records?: string[];
  results?: TestResult[];
  last_line?: string;
  notice?: string;
}
export interface TestLatest {
  key: string;
  last?: { run_id: string; passed: number; failed: number; cases: number; when: string; model: string; suite: string };
  sessions: TestSession[];
}

export interface Hub { brand: Brand; manifest: Manifest; loop: Loop; system: SystemModel | null; operations: Operations | null }

export const url = (path: string) => path.split('/').map(encodeURIComponent).join('/');

export async function getJson<T>(path: string, fresh = false): Promise<T> {
  const r = await fetch(url(path) + (fresh ? `?t=${Date.now()}` : ''), { cache: fresh ? 'no-store' : 'default' });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json() as Promise<T>;
}

export async function getText(path: string): Promise<string> {
  const r = await fetch(url(path));
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.text();
}

export async function loadHub(): Promise<Hub> {
  // loop.json and system.json exist only in hubs fed from a workspace
  const [brand, manifest, loop, system, operations] = await Promise.all([
    getJson<Brand>('content/brand.json'),
    getJson<Manifest>('content/manifest.json'),
    getJson<Loop>('content/data/loop.json').catch((): Loop => ({ generated: '', workspace: '', specs: [] })),
    getJson<SystemModel>('content/data/system.json').catch(() => null),
    // operations.json exists only when the workspace has an operations-center/ (tools/sync_operations.py)
    getJson<Operations>('content/data/operations.json').then((o) => (Array.isArray(o?.processes) ? o : null), () => null),
  ]);
  return { brand, manifest, loop, system, operations };
}

export const HubContext = createContext<Hub | null>(null);
export function useHub(): Hub {
  const h = useContext(HubContext);
  if (!h) throw new Error('useHub outside HubContext');
  return h;
}

export function useSpec(key: string | undefined): Spec | undefined {
  const { loop } = useHub();
  return loop.specs.find((s) => s.key === key || s.folder === key || s.dir === key);
}

type Async<T> = { data?: T; error?: string; loading: boolean };

export function useAsync<T>(fn: (() => Promise<T>) | null, deps: unknown[]): Async<T> {
  const [state, set] = useState<Async<T>>({ loading: !!fn });
  useEffect(() => {
    if (!fn) { set({ loading: false }); return; }
    let live = true;
    set((s) => ({ ...s, loading: true }));
    fn().then((data) => live && set({ data, loading: false }), (e) => live && set({ error: String(e.message || e), loading: false }));
    return () => { live = false; };
  }, deps);
  return state;
}

export function useFindings(spec: Spec | undefined) {
  return useAsync(
    spec?.findingsFile ? () => getJson<{ findings: Finding[] }>(spec.findingsFile!).then((f) => f.findings || []) : null,
    [spec?.findingsFile],
  );
}

export function useAllFindings() {
  const { loop } = useHub();
  return useAsync(
    () => Promise.all(
      loop.specs.filter((s) => s.findingsFile).map((s) =>
        getJson<{ findings: Finding[] }>(s.findingsFile!).then((f) => (f.findings || []).map((x) => ({ ...x, spec: s.key }))).catch(() => []),
      ),
    ).then((a) => a.flat()),
    [loop.generated],
  );
}

export function usePoll<T>(path: string, ms: number) {
  const [data, setData] = useState<T | undefined>();
  useEffect(() => {
    let live = true;
    let id: ReturnType<typeof setInterval> | undefined;
    // A file the hub does not publish (live runs exist only on the laptop) answers 404: stop asking.
    const tick = () => getJson<T>(path, true).then((d) => live && setData(d)).catch((e) => { if (/: 404$/.test(String(e.message))) clearInterval(id); });
    tick();
    id = setInterval(() => { if (!document.hidden) tick(); }, ms);
    return () => { live = false; clearInterval(id); };
  }, [path, ms]);
  return data;
}

export const severityOf = (f: Finding): Severity => (f.severity && (SEVERITIES as readonly string[]).includes(f.severity) ? f.severity : 'none');

export function specDoc(spec: Spec, name: string) {
  return `content/specs/${spec.dir}/${name}`;
}

export const trackerUrl = (hub: Hub, key: string) =>
  hub.manifest.loopConfig.trackerBase && /^[A-Z]+-\d+$/.test(key) ? `${hub.manifest.loopConfig.trackerBase}/${key}` : undefined;

export const isLocal = () => ['127.0.0.1', 'localhost', '::1'].includes(location.hostname);
