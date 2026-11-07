import { useCallback, useEffect, useState } from 'react';
import type { Hub } from './data';

/** manifest.learning, as build.mjs writes it from content/learning (the v4 Learning paths contract). */
export interface Lesson {
  id: string;
  title: string;
  minutes?: number | string;
  src: string;
  objectives?: string[];
  checks?: { q: string; a: string }[];
  sources?: string[];
}
export interface Course {
  id: string;
  code?: string;
  track?: string;
  title: string;
  level?: string;
  goal?: string;
  outcomes?: string[];
  prereqs?: string[];
  lessons: Lesson[];
}
export interface LearnPath { id: string; title: string; summary?: string; steps?: string[]; courses?: string[] }
export interface Learning {
  title?: string;
  lede?: string;
  intro?: string;
  courseOrder?: string[];
  paths: LearnPath[];
  courses: Course[];
}

export const learningOf = (hub: Hub): Learning | null => {
  const l = hub.manifest.learning;
  return l && (l.courses || []).length ? { ...l, paths: l.paths || [], courses: l.courses || [] } : null;
};

export const courseById = (l: Learning, id?: string) => l.courses.find((c) => c.id === id);

export interface Step { course: Course; lesson: Lesson | null }

/** A path's steps, each a course id or "course/lesson", resolved; unknown ids are skipped. */
export function pathSteps(l: Learning, p: LearnPath): Step[] {
  return (p.steps || p.courses || []).flatMap((s) => {
    const [cid, lid] = String(s).split('/');
    const course = courseById(l, cid);
    if (!course) return [];
    const lesson = lid ? course.lessons.find((x) => x.id === lid) || null : null;
    return lid && !lesson ? [] : [{ course, lesson }];
  });
}

export const minutesOf = (c: Course) => c.lessons.reduce((m, x) => m + (Number(x.minutes) || 0), 0);
export const hours = (m: number) => (m >= 60 ? `${Math.round(m / 6) / 10} h` : `${m} min`);
export const isHtml = (src: string) => /\.html?$/i.test(src);

/** The next course after [cid] in the first path that lists it, for the end of a course. */
export function nextCourse(l: Learning, cid: string): Course | undefined {
  for (const p of l.paths) {
    const ids = (p.steps || p.courses || []).map((s) => String(s).split('/')[0]);
    const k = ids.indexOf(cid);
    if (k >= 0) {
      const nid = ids.slice(k + 1).find((x) => x !== cid);
      if (nid) return courseById(l, nid);
    }
  }
  return undefined;
}

/* Progress lives in this browser only, under the v4 hub's key, so progress made there carries over. */
interface Progress { done?: Record<string, string>; last?: string }
const KEY = (hub: Hub) => `hub-learn:${hub.brand.name || 'hub'}`;
const EVENT = 'hub-learn-change';

function read(hub: Hub): Progress {
  try { return JSON.parse(localStorage.getItem(KEY(hub)) || '{}') as Progress; } catch { return {}; }
}
function write(hub: Hub, p: Progress) {
  try { localStorage.setItem(KEY(hub), JSON.stringify(p)); } catch { /* storage may be blocked */ }
  dispatchEvent(new Event(EVENT));
}

export function useProgress(hub: Hub) {
  const [p, setP] = useState<Progress>(() => read(hub));
  useEffect(() => {
    const on = () => setP(read(hub));
    addEventListener(EVENT, on);
    addEventListener('storage', on);
    return () => { removeEventListener(EVENT, on); removeEventListener('storage', on); };
  }, [hub]);
  const isDone = useCallback((c: string, l: string) => !!p.done?.[`${c}/${l}`], [p]);
  const setDone = useCallback((c: string, l: string, v: boolean) => {
    const cur = read(hub);
    const done = { ...(cur.done || {}) };
    if (v) done[`${c}/${l}`] = new Date().toISOString().slice(0, 10); else delete done[`${c}/${l}`];
    write(hub, { ...cur, done });
  }, [hub]);
  const setLast = useCallback((c: string, l: string) => {
    const cur = read(hub);
    if (cur.last !== `${c}/${l}`) write(hub, { ...cur, last: `${c}/${l}` });
  }, [hub]);
  const reset = useCallback(() => write(hub, {}), [hub]);
  const stats = useCallback((c: Course) => {
    const n = c.lessons.length;
    const d = c.lessons.filter((x) => p.done?.[`${c.id}/${x.id}`]).length;
    return { n, d, pct: n ? Math.round((d / n) * 100) : 0, mins: minutesOf(c) };
  }, [p]);
  return { progress: p, isDone, setDone, setLast, reset, stats };
}

export const courseRoute = (cid: string) => `/learn/${encodeURIComponent(cid)}`;
export const lessonRoute = (cid: string, lid: string) => `/learn/${encodeURIComponent(cid)}/${encodeURIComponent(lid)}`;
