import { Marked } from 'marked';
import type { Hub } from './data';
import { legacyRoute } from './routes';

const marked = new Marked({ gfm: true, breaks: false });

const STATUS: [RegExp, string, string][] = [
  [/✅\s*(PASS(?:ED)?|passed|passing)?/g, 'st-ok', 'passed'],
  [/❌\s*(FAIL(?:ED)?|failed|failing)?/g, 'st-fail', 'failed'],
  [/⏳\s*(running)?/g, 'st-run', 'running'],
];

function dirOf(path: string) {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i + 1);
}

function joinPath(base: string, rel: string) {
  const out: string[] = [];
  for (const part of (base + rel).split('/')) {
    if (part === '..') out.pop();
    else if (part !== '.' && part !== '') out.push(part);
  }
  return out.join('/');
}

/** Where a link inside a rendered doc should point. `docPath` is the doc's served path, e.g. content/kb-src/x/y.md. */
export function resolveLink(href: string, docPath: string, hub: Hub): { href: string; external?: boolean } {
  if (/^(https?:|mailto:|tel:)/i.test(href)) return { href, external: true };
  if (href.startsWith('#/')) {
    const mapped = legacyRoute(href.slice(1), hub);
    return { href: '#' + (mapped || href.slice(1)) };
  }
  if (href.startsWith('#')) return { href };
  const [path, anchor] = href.split('#');
  const abs = joinPath(dirOf(docPath), path);
  if (/\.(md|markdown)$/i.test(abs)) return { href: '#/doc/' + abs + (anchor ? `#${anchor}` : '') };
  return { href: abs + (anchor ? `#${anchor}` : ''), external: /\.(html?|pdf)$/i.test(abs) };
}

export function renderMarkdown(src: string, docPath: string, hub: Hub): string {
  const html = marked.parse(src.replace(/^---\n[\s\S]*?\n---\n/, ''), { async: false }) as string;
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLElement;

  root.querySelectorAll('script, iframe, object, embed').forEach((n) => n.remove());
  root.querySelectorAll('*').forEach((n) => {
    for (const a of Array.from(n.attributes)) {
      if (a.name.startsWith('on') || /^\s*javascript:/i.test(a.value)) n.removeAttribute(a.name);
    }
  });

  root.querySelectorAll('a[href]').forEach((a) => {
    const r = resolveLink(a.getAttribute('href')!, docPath, hub);
    a.setAttribute('href', r.href);
    if (r.external) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); }
  });
  root.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src')!;
    if (!/^(https?:|data:)/.test(src)) img.setAttribute('src', joinPath(dirOf(docPath), src));
    img.setAttribute('loading', 'lazy');
  });
  root.querySelectorAll('table').forEach((t) => {
    const wrap = doc.createElement('div');
    wrap.className = 'table-wrap';
    t.replaceWith(wrap);
    wrap.appendChild(t);
  });
  root.querySelectorAll('td').forEach((td) => {
    const t = (td.textContent || '').trim();
    if (t.length < 26 && /^[A-Z][A-Z0-9]*-[A-Za-z0-9.-]+$/.test(t) && td.children.length === 0) td.innerHTML = `<span class="nw">${td.innerHTML}</span>`;
  });
  root.querySelectorAll('pre > code.language-mermaid').forEach((c) => {
    const div = doc.createElement('div');
    div.className = 'mermaid';
    div.textContent = c.textContent;
    c.parentElement!.replaceWith(div);
  });
  root.querySelectorAll('h1, h2, h3').forEach((h) => {
    if (!h.id) h.id = (h.textContent || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  });

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const hits: Text[] = [];
  while (walker.nextNode()) if (/[✅❌⏳]/.test(walker.currentNode.nodeValue || '')) hits.push(walker.currentNode as Text);
  for (const node of hits) {
    let text = node.nodeValue || '';
    const span = doc.createElement('span');
    for (const [re, cls, word] of STATUS) {
      text = text.replace(re, (_m, w) => `\u0000${cls}|${w || word}\u0001`);
    }
    for (const part of text.split(/(\u0000[^\u0001]*\u0001)/)) {
      const m = part.match(/^\u0000([^|]*)\|([^\u0001]*)\u0001$/);
      if (m) {
        const s = doc.createElement('span');
        s.className = `st ${m[1]}`;
        s.textContent = m[2];
        span.appendChild(s);
      } else if (part) span.appendChild(doc.createTextNode(part));
    }
    node.replaceWith(...Array.from(span.childNodes));
  }
  return root.innerHTML;
}

/** One line of markdown (a table cell, a title) as safe inline HTML. */
export function renderInline(src: string): string {
  const html = marked.parseInline(src || '', { async: false }) as string;
  return html.replace(/<(script|iframe|object|embed)[\s\S]*?>/gi, '').replace(/\son\w+="[^"]*"/gi, '');
}

let mermaidReady: Promise<typeof import('mermaid').default> | null = null;
export async function runMermaid(el: HTMLElement) {
  const nodes = el.querySelectorAll<HTMLElement>('.mermaid:not([data-processed])');
  if (!nodes.length) return;
  mermaidReady ||= import('mermaid').then((m) => {
    const dark = document.documentElement.dataset.theme === 'dark' ||
      (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
    m.default.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'neutral', securityLevel: 'strict' });
    return m.default;
  });
  const mermaid = await mermaidReady;
  await mermaid.run({ nodes: Array.from(nodes) }).catch(() => {});
}
