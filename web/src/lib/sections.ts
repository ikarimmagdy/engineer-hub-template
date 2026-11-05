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
