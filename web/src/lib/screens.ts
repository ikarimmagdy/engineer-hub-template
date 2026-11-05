export type Lang = 'en' | 'ar';
export interface Shot { alt: string; src: string }
export interface Screen {
  name: string;
  story: string;
  slug: string;
  verdict: 'match' | 'differs' | 'none';
  /** Image cells by language and column kind (figma, ios, android), whatever each table titles them. */
  shots: Record<Lang, Record<string, Shot | null>>;
  notes: Partial<Record<Lang, string>>;
}

export type ColKey = 'figma' | 'ios' | 'android';
const colKey = (col: string): ColKey => (/figma|design/i.test(col) ? 'figma' : /iphone|ios/i.test(col) ? 'ios' : 'android');

const splitRow = (line: string) => line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim());
const IMG = /!\[([^\]]*)\]\(([^)\s]+)\)/;

/**
 * Reads a UI / UX review (review/ui-ux.md): ### <story> headings, each with a table
 * | Screen | Figma | <phone> | <phone> | Verdict | whose rows are "<screen> (en)" and "<screen> (ar)".
 */
export function parseScreens(md: string, base: string): { columns: { key: ColKey; label: string }[]; screens: Screen[] } {
  const screens: Screen[] = [];
  let story = '';
  let cols: string[] = [];
  const byKey = new Map<string, Screen>();
  const labels: Partial<Record<ColKey, string>> = {};
  for (const line of md.split('\n')) {
    const h = line.match(/^(#{2,3})\s+(.+)/);
    if (h) { story = h[1].length === 3 ? h[2].trim() : ''; cols = []; continue; }
    if (!story || !line.trim().startsWith('|')) continue;
    const cells = splitRow(line);
    if (/^screen$/i.test(cells[0])) { cols = cells; continue; }
    if (!cols.length || /^-+$/.test(cells[0].replace(/:/g, ''))) continue;
    const m = cells[0].match(/^(.*?)\s*\((en|ar)\)\s*$/);
    const name = (m ? m[1] : cells[0]).trim();
    const lang = (m?.[2] || 'en') as Lang;
    const key = `${story}|${name}`;
    let s = byKey.get(key);
    if (!s) {
      s = { name, story, slug: '', verdict: 'none', shots: { en: {}, ar: {} }, notes: {} };
      byKey.set(key, s);
      screens.push(s);
    }
    cols.slice(1, -1).forEach((col, i) => {
      const img = cells[i + 1]?.match(IMG);
      const k = colKey(col);
      labels[k] ||= col;
      s!.shots[lang][k] = img ? { alt: img[1], src: base + img[2] } : null;
      if (img && !s!.slug) s!.slug = img[2].split('/').pop()!.replace(/^[A-Z]+-\d+_/, '').replace(/_(figma|ios|android).*$/, '');
    });
    const note = cells[cols.length - 1] || '';
    s.notes[lang] = note;
    if (lang === 'en' || s.verdict === 'none') {
      s.verdict = /^matches/i.test(note) ? 'match' : /^differs/i.test(note) ? 'differs' : s.verdict;
    }
  }
  const columns = (['figma', 'ios', 'android'] as const).filter((k) => labels[k]).map((k) => ({ key: k, label: labels[k]! }));
  return { columns: columns.length ? columns : [{ key: 'figma', label: 'Figma' }, { key: 'ios', label: 'iPhone' }, { key: 'android', label: 'Android' }], screens };
}
