export interface DocSection { title: string; slug: string; body: string; group?: string }

const slugify = (s: string) => s.toLowerCase().replace(/[`*_]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';

/** Splits markdown on its headings outside code fences. Returns the text before the first heading and the sections. */
function splitAt(md: string, level: number) {
  const lines = md.split('\n');
  const re = new RegExp(`^#{${level}}\\s+(.+?)\\s*#*\\s*$`);
  let fence = false;
  const intro: string[] = [];
  const out: { title: string; lines: string[] }[] = [];
  for (const l of lines) {
    if (/^\s*(```|~~~)/.test(l)) fence = !fence;
    const m = !fence && l.match(re);
    if (m) out.push({ title: m[1], lines: [] });
    else if (out.length) out[out.length - 1].lines.push(l);
    else intro.push(l);
  }
  return { intro: intro.join('\n').trim(), parts: out };
}

const count = (md: string, level: number) => splitAt(md, level).parts.length;

/**
 * Sections for a long document: split on ## when there are at least three, else on ###.
 * Short documents (under ~70 lines or fewer than three sections) come back as null and render whole.
 */
export function sectionize(md: string, minLines = 70): { intro: string; sections: DocSection[] } | null {
  const body = md.replace(/^---\n[\s\S]*?\n---\n/, '');
  if (body.split('\n').length < minLines) return null;
  const level = count(body, 2) >= 3 ? 2 : count(body, 3) >= 3 ? 3 : 0;
  if (!level) return null;
  const { intro, parts } = splitAt(body, level);
  const used = new Map<string, number>();
  const sections: DocSection[] = parts.map((p) => {
    let slug = slugify(p.title);
    const n = used.get(slug) || 0;
    used.set(slug, n + 1);
    if (n) slug = `${slug}-${n + 1}`;
    return { title: p.title.replace(/`/g, ''), slug, body: p.lines.join('\n') };
  });

  // Many path-like titles (/SCAPI.Digital/Family/v1) group by their first segment.
  if (sections.length > 20) {
    const key = (t: string) => t.match(/^\/?([^/\s]+)\//)?.[1];
    const groups = new Set(sections.map((s) => key(s.title)).filter(Boolean));
    if (groups.size >= 2 && groups.size <= 40) sections.forEach((s) => { s.group = key(s.title) || 'Other'; });
  }
  // A lone ## above the ### sections (e.g. "How to reach them") belongs to the intro.
  const cleanIntro = intro.replace(/^#\s+.+\n?/, '').trim();
  return { intro: cleanIntro, sections };
}

/** A diagrams file (outputs/diagrams/<phase>/v<N>-<date>.md) as one section per diagram, the caption kept with it. */
export function diagramSections(md: string): DocSection[] {
  const { parts } = splitAt(md.replace(/^---\n[\s\S]*?\n---\n/, ''), 2);
  const out: DocSection[] = parts.map((p, i) => ({ title: p.title.replace(/`/g, ''), slug: `d-${slugify(p.title)}-${i + 1}`, body: p.lines.join('\n') }));
  // "States: campaign", "States: batch" ... group under their kind when two or more share it
  const kind = (t: string) => t.match(/^([A-Za-z][\w -]{1,24}):\s+\S/)?.[1];
  const n = new Map<string, number>();
  out.forEach((d) => { const k = kind(d.title); if (k) n.set(k, (n.get(k) || 0) + 1); });
  out.forEach((d) => { const k = kind(d.title); if (k && n.get(k)! > 1) d.group = k; });
  return out;
}

// Where each kind of diagram belongs in a document: the first section whose title has one of these words.
const HOME: [RegExp, string[]][] = [
  [/^containers?|^context|^components?|architecture/i, ['components', 'architecture', 'approach', 'how it works', 'overview']],
  [/^sequence/i, ['sequence', 'contracts', 'how it works']],
  [/^data model|^entit|^erd/i, ['data model', 'data']],
  [/^deploy|^promotion|^rollback/i, ['deployment', 'rollout', 'deploy']],
  [/^pattern/i, ['how it works', 'approach', 'architecture', 'design']],
  [/^states?\b|^state:/i, ['states', 'data', 'how it works']],
  [/^journey|flow/i, ['journeys', 'flows', 'user', 'requirements']],
  [/^requirement/i, ['requirements']],
  [/^task|dependenc/i, ['tasks', 'plan', 'milestones']],
  [/^coverage|^test/i, ['test', 'coverage']],
  [/^runbook|^incident/i, ['runbook', 'incidents', 'operations']],
];
const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3));

/**
 * Gives each diagram the section of a document it explains (Sequence diagrams to "Sequence", the data model to
 * "Data", ...): by its kind first, else by the words its title shares with a section title. The rest stay unmatched.
 */
export function matchDiagrams(sections: DocSection[], diagrams: DocSection[]) {
  const by = new Map<string, DocSection[]>();
  const rest: DocSection[] = [];
  const lower = sections.map((s) => s.title.toLowerCase());
  for (const d of diagrams) {
    let home = -1;
    const rule = HOME.find(([re]) => re.test(d.title));
    if (rule) for (const w of rule[1]) { home = lower.findIndex((t) => t.startsWith(w) || t === w); if (home >= 0) break; }
    if (home < 0) {
      const dw = words(d.title);
      let best = 0;
      sections.forEach((s, i) => { const n = [...words(s.title)].filter((w) => dw.has(w)).length; if (n > best) { best = n; home = i; } });
    }
    if (home >= 0) by.set(sections[home].slug, [...(by.get(sections[home].slug) || []), d]);
    else rest.push(d);
  }
  return { by, rest };
}
