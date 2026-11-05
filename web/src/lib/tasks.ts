import type { TaskState } from './data';

export interface TaskRow {
  id: string;
  task: string;
  repo: string;
  covers: string;
  story: string;
  depends: string;
  status: TaskState | string;
}

const splitRow = (line: string) => line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim());

/** Splits tasks.md into the text around the task table and the table's rows (`| ID | Task | … | Status |`). */
export function parseTasks(md: string): { before: string; after: string; rows: TaskRow[] } {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => /^\|\s*ID\s*\|\s*Task\s*\|/i.test(l));
  if (start < 0) return { before: md, after: '', rows: [] };
  const head = splitRow(lines[start]).map((h) => h.toLowerCase());
  const col = (name: string) => head.findIndex((h) => h.startsWith(name));
  let end = start + 2;
  const rows: TaskRow[] = [];
  for (; end < lines.length && lines[end].trim().startsWith('|'); end++) {
    const c = splitRow(lines[end]);
    const get = (n: string) => (col(n) >= 0 ? c[col(n)] || '' : '');
    rows.push({ id: get('id'), task: get('task'), repo: get('repo'), covers: get('covers'), story: get('story'), depends: get('depends'), status: get('status').toLowerCase() });
  }
  return { before: lines.slice(0, start).join('\n'), after: lines.slice(end).join('\n'), rows };
}
