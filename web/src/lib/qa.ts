import { useCallback, useEffect, useState } from 'react';
import { getJson, type Hub } from './data';

export interface Question {
  id: string;
  question: string;
  askWho: string;
  category?: string;
  priority?: string;
  status: string;
  why?: string;
  ifYes?: string;
  ifNo?: string;
  blocks?: string[];
  source?: string;
  raised?: string;
  answer?: string;
  answeredOn?: string;
  vendor?: string;
}
export interface Feature { id: string; fid?: string; title: string; status?: string; lifecycle?: string; milestone?: string; summary?: string; version?: string }
export interface Gap { id: string; title: string; status: string; severity?: string; area?: string; summary?: string; ref?: string }
export interface Stage { key: string; title: string }

export interface QaData {
  questions: Question[];
  features: Feature[];
  gaps: Gap[];
  stages: Stage[];
  writable: boolean;
}

const QID = /\b[A-Z]{1,3}-\d{2,4}\b/g;
export const isOpen = (q: Question) => q.status !== 'answered';

async function optional<T>(path: string, fallback: T): Promise<T> {
  try { return await getJson<T>(path, true); } catch { return fallback; }
}

async function apiWritable(): Promise<boolean> {
  try {
    const r = await fetch('api/data', { cache: 'no-store' });
    return r.ok && (await r.json()).writable === true;
  } catch { return false; }
}

export async function loadQa(): Promise<QaData> {
  const [questions, features, gaps, lifecycle, writable] = await Promise.all([
    getJson<Question[]>('content/data/questions.json', true),
    optional<Feature[]>('content/data/features.json', []),
    optional<Gap[]>('content/data/gaps.json', []),
    optional<{ stages?: Stage[] }>('content/data/lifecycle.json', {}),
    apiWritable(),
  ]);
  return { questions, features, gaps, stages: lifecycle.stages || [], writable };
}

export function useQa() {
  const [data, setData] = useState<QaData>();
  const [error, setError] = useState('');
  const reload = useCallback(() => loadQa().then(setData, (e) => setError(String(e.message || e))), []);
  useEffect(() => { reload(); }, [reload]);
  return { data, error, reload };
}

export type DataOp =
  | { op: 'update'; id: string; set: Record<string, unknown> }
  | { op: 'append'; id: string; field: string; text: string }
  | { op: 'add'; item: Record<string, unknown> };

/** Sends one change to the local data API; throws with the server's reason when it is refused. */
export async function writeData(file: 'questions.json' | 'gaps.json' | 'features.json', body: DataOp): Promise<Record<string, unknown>> {
  const r = await fetch(`api/data/${file}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `${r.status}`);
  return j.item;
}

/** What a linked id points at: a feature (by fid or id), a work item (spec key), a gap, or something the hub only names. */
export type Target =
  | { kind: 'feature'; id: string; feature: Feature; spec?: string }
  | { kind: 'work'; id: string; spec: string }
  | { kind: 'gap'; id: string; gap: Gap }
  | { kind: 'other'; id: string };

export function resolveTarget(id: string, d: QaData, hub: Hub): Target {
  const spec = hub.loop.specs.find((s) => s.key.toLowerCase() === id.toLowerCase())?.key;
  const feature = d.features.find((f) => f.fid === id || f.id === id);
  if (feature) return { kind: 'feature', id, feature, spec };
  if (spec) return { kind: 'work', id, spec };
  const gap = d.gaps.find((g) => g.id === id);
  if (gap) return { kind: 'gap', id, gap };
  return { kind: 'other', id };
}

/** Gaps whose text names the question id. */
export function gapsMentioning(qid: string, gaps: Gap[]): Gap[] {
  return gaps.filter((g) => `${g.title} ${g.summary || ''} ${g.ref || ''}`.match(QID)?.includes(qid));
}

/** Questions whose blocks list the work id (a feature's fid or id, or a work item key). */
export function questionsFor(workId: string, d: QaData): Question[] {
  const id = workId.toLowerCase();
  const f = d.features.find((x) => x.fid?.toLowerCase() === id || x.id.toLowerCase() === id);
  const keys = new Set([id, f?.fid?.toLowerCase(), f?.id.toLowerCase()].filter(Boolean) as string[]);
  return d.questions.filter((q) => (q.blocks || []).some((b) => keys.has(b.toLowerCase())));
}

export interface WorkLink { id: string; target: Target; open: Question[]; resolved: Question[] }

/** Every linked work id with its open and answered questions, for the linkage view. */
export function linkage(d: QaData, hub: Hub): WorkLink[] {
  const by = new Map<string, WorkLink>();
  for (const q of d.questions) {
    for (const b of q.blocks || []) {
      const target = resolveTarget(b, d, hub);
      const key = target.kind === 'feature' ? target.feature.fid || target.feature.id : b;
      const row = by.get(key) || { id: key, target, open: [], resolved: [] };
      (isOpen(q) ? row.open : row.resolved).push(q);
      by.set(key, row);
    }
  }
  return [...by.values()].sort((a, b) => b.open.length - a.open.length || a.id.localeCompare(b.id, undefined, { numeric: true }));
}

export const PRIORITIES = ['P0', 'P1', 'P2'];
export const uniq = (xs: (string | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort();
