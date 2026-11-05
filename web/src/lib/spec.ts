export interface Requirement {
  id: string;
  short: string;
  text: string;
  story: string;
  priority: string;
  existing: string;
  criteria: { id: string; text: string }[];
}

export interface SpecSection { title: string; slug: string; body: string }

export interface ParsedSpec {
  title: string;
  intro: string;
  requirementsNote: string;
  requirements: Requirement[];
  sections: SpecSection[];
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const splitRow = (line: string) => line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim());

function shortTitle(text: string) {
  const colon = text.indexOf(':');
  if (colon > 0 && colon < 60) return text.slice(0, colon);
  const words = text.replace(/[*`]/g, '').split(/\s+/);
  return words.slice(0, 8).join(' ') + (words.length > 8 ? '…' : '');
}

/** Splits spec.md (the /spec format) into its intro, the requirements joined with their criteria, and the other ## sections. */
export function parseSpec(md: string): ParsedSpec {
  const body = md.replace(/^---\n[\s\S]*?\n---\n/, '');
  const title = body.match(/^#\s+(.+)$/m)?.[1] || '';
  const chunks = body.split(/^## /m);
  const intro = chunks[0].replace(/^#\s+.+\n/, '').trim();
  const sections: SpecSection[] = [];
  let reqChunk = '';
  let acChunk = '';
  for (const c of chunks.slice(1)) {
    const nl = c.indexOf('\n');
    const t = c.slice(0, nl < 0 ? undefined : nl).trim();
    const b = nl < 0 ? '' : c.slice(nl + 1);
    if (/^requirements$/i.test(t)) reqChunk = b;
    else if (/^acceptance criteria$/i.test(t)) acChunk = b;
    else sections.push({ title: t, slug: slugify(t), body: b });
  }

  const lines = reqChunk.split('\n');
  const head = lines.findIndex((l) => /^\|\s*ID\s*\|/i.test(l));
  const requirements: Requirement[] = [];
  let requirementsNote = reqChunk;
  if (head >= 0) {
    const cols = splitRow(lines[head]).map((h) => h.toLowerCase());
    const at = (n: string) => cols.findIndex((h) => h.startsWith(n));
    let end = head + 2;
    for (; end < lines.length && lines[end].trim().startsWith('|'); end++) {
      const c = splitRow(lines[end]);
      const get = (n: string) => (at(n) >= 0 ? c[at(n)] || '' : '');
      const text = get('requirement');
      requirements.push({ id: get('id'), text, short: shortTitle(text), story: get('story'), priority: get('priority'), existing: get('existing'), criteria: [] });
    }
    requirementsNote = [...lines.slice(0, head), ...lines.slice(end)].join('\n').trim();
  }

  const byId = new Map(requirements.map((r) => [r.id, r]));
  for (const block of acChunk.split(/^### /m).slice(1)) {
    const nl = block.indexOf('\n');
    const req = byId.get(block.slice(0, nl).trim());
    if (!req) continue;
    for (const m of block.slice(nl + 1).matchAll(/^\s*[-*]\s+\*\*(AC-[\w.-]+)\*\*\s*(.+)$/gm)) {
      req.criteria.push({ id: m[1], text: m[2].trim() });
    }
  }
  return { title, intro, requirementsNote, requirements, sections };
}

/** Requirement numbers a task's Covers cell names: "R1, R3", "R5-R12", "R16 / AC-R16.1". */
export function coveredNumbers(covers: string): Set<number> {
  const out = new Set<number>();
  const clean = covers.replace(/AC-R[\d.]+/g, '');
  for (const m of clean.matchAll(/R(\d+)\s*[-–]\s*R?(\d+)/g)) {
    for (let n = Number(m[1]); n <= Number(m[2]); n++) out.add(n);
  }
  for (const m of clean.matchAll(/R(\d+)/g)) out.add(Number(m[1]));
  return out;
}

export const reqNumber = (id: string) => Number(id.match(/R(\d+)$/)?.[1] || NaN);
