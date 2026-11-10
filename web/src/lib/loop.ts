import { useEffect, useState } from 'react';
import type { Phase, Spec } from './data';
import { PHASES } from './data';

/** The local loop API (web/hub-loop-api.ts): present only on the hub's dev or preview server. */
export interface LoopApi { writable: boolean; approver: string; agents: boolean; claude: string }
export interface AgentRun { id: string; agent: string; description: string; key: string | null; source: string; started: string; ended?: string; state: 'running' | 'done' | 'failed' | 'lost' }
export interface LiveRun {
  id: string; agent: string; module?: string; key: string | null; question: string; state: 'running' | 'done' | 'failed';
  started: string; ended?: string; text: string; steps: { tool: string; target: string; at?: string; path?: string }[]; error?: string; cost?: number;
  mode?: string; repo?: string; worktree?: string; branch?: string; base?: string; diffStat?: string; diff?: string; reach?: Reach;
  launch?: { cwd: string; command: string; instructions: string };
}
export interface Reach { repos: string[]; docs: boolean; edits: string | null; shell: boolean; mcp: string[]; databases: boolean; clusters: boolean; network: boolean }
/** A team agent from the workspace's .claude/agents/ (team: in the front matter), with the scope repos cloned on this laptop. */
export interface TeamAgent { name: string; description: string; team: string; family: string; scope: string[]; modes: string[]; starters: string[]; mcp?: string[]; mcpTools?: string[]; access?: string[]; build?: string; prompt: string; path: string; cloned?: string[] }

async function call<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, body === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `${path}: ${r.status}`);
  return data as T;
}

export function useLoopApi() {
  const [api, setApi] = useState<LoopApi | null | undefined>(undefined);
  useEffect(() => { call<LoopApi>('/api/loop').then(setApi, () => setApi(null)); }, []);
  return api;
}

export function useRuns(enabled: boolean, key?: string, ms = 3000) {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const tick = () => call<{ runs: AgentRun[] }>(`/api/loop/runs${key ? `?key=${encodeURIComponent(key)}` : ''}`).then((d) => alive && setRuns(d.runs), () => {});
    tick();
    const id = setInterval(() => { if (!document.hidden) tick(); }, ms);
    return () => { alive = false; clearInterval(id); };
  }, [enabled, key, ms]);
  return runs;
}

export const approve = (key: string, what: string) => call<{ ok: boolean; output: string; note: string }>('/api/loop/approve', { key, what });
export const movePhase = (key: string, phase: Phase) => call<{ ok: boolean; output: string; note: string }>('/api/loop/phase', { key, phase });
export const checkSpec = (key: string) => call<{ ok: boolean; output: string }>(`/api/loop/check?key=${encodeURIComponent(key)}`);
export const startAgent = (body: { agent: 'oncall' | 'module' | 'team' | 'intent'; module?: string; name?: string; mode?: string; repo?: string; question: string; key?: string }) => call<{ id: string }>('/api/loop/agent', body);
export const startWork = (body: { kind: string; key: string; slug: string; title?: string; ref?: string }) =>
  call<{ ok: boolean; dir: string | null; output: string; shared: boolean }>('/api/loop/start', body);
export const stopAgent = (id: string) => call<{ ok: boolean }>('/api/loop/agent/stop', { id });
export const discardChange = (id: string) => call<{ ok: boolean }>('/api/loop/agent/discard', { id });
export const teamAgents = () => call<{ agents: TeamAgent[] }>('/api/loop/agents').then((d) => d.agents);
export const createAgent = (body: { name: string; description: string; team: string; family: string; scope: string[]; modes: string[]; starters: string[]; instructions: string }) =>
  call<{ path: string; share: string }>('/api/loop/agents', body);
export interface LiveSummary { id: string; agent: string; key: string | null; question: string; state: LiveRun['state']; started: string; ended?: string; mode?: string; repo?: string; steps: LiveRun['steps']; diffStat?: string; error?: string }
export function useLive(enabled: boolean, ms = 2000) {
  const [runs, setRuns] = useState<LiveSummary[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const tick = () => call<{ live: LiveSummary[] }>('/api/loop/runs').then((d) => alive && setRuns([...d.live].sort((a, b) => b.started.localeCompare(a.started))), () => {});
    tick();
    const id = setInterval(() => { if (!document.hidden) tick(); }, ms);
    return () => { alive = false; clearInterval(id); };
  }, [enabled, ms]);
  return runs;
}
export const agentRun = (id: string) => call<LiveRun>(`/api/loop/agent/${encodeURIComponent(id)}`);

const APPROVES: Partial<Record<Phase, 'intent' | 'spec' | 'design'>> = { intent: 'intent', spec: 'spec', design: 'design' };

/** What it takes to leave the current phase: an approval first where the phase has one, then the move. */
export function nextAction(spec: Spec): { kind: 'approve'; what: 'intent' | 'spec' | 'design' } | { kind: 'phase'; to: Phase } | null {
  const what = APPROVES[spec.phase];
  if (what && !spec.approved[what]) return { kind: 'approve', what };
  const i = PHASES.indexOf(spec.phase);
  return i < PHASES.length - 1 ? { kind: 'phase', to: PHASES[i + 1] } : null;
}

export function since(iso: string, end?: string) {
  const s = Math.max(0, Math.round(((end ? Date.parse(end) : Date.now()) - Date.parse(iso)) / 1000));
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : s < 86400 ? `${Math.round(s / 3600)}h` : `${Math.round(s / 86400)}d`;
}
