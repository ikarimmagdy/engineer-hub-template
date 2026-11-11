import type { FlowStep } from '../components/StepFlow';

/**
 * Building blocks as a map: where each block sits (you, Claude Code, MCP servers, our systems) and the numbered
 * hand-offs of one request between them. A selected step draws its arrows and its blocks; the rest fades.
 */
type Node = { id: string; x: number; y: number; w: number; h: number; t: string; d: string; kind: 'context' | 'enforced' | 'model' | 'you' | 'system' };
const N: Node[] = [
  { id: 'you', x: 20, y: 205, w: 130, h: 70, t: 'You', d: 'type /notification', kind: 'you' },
  { id: 'command', x: 215, y: 70, w: 175, h: 62, t: 'Command', d: '.claude/commands/', kind: 'context' },
  { id: 'context', x: 215, y: 350, w: 175, h: 62, t: 'CLAUDE.md, rules, memory', d: 'always in context', kind: 'context' },
  { id: 'model', x: 450, y: 200, w: 170, h: 80, t: 'The model', d: 'plans each next step', kind: 'model' },
  { id: 'skill', x: 450, y: 55, w: 170, h: 62, t: 'Skill', d: '.claude/skills/', kind: 'context' },
  { id: 'agent', x: 450, y: 365, w: 170, h: 62, t: 'Subagent', d: '.claude/agents/ + its tools', kind: 'enforced' },
  { id: 'settings', x: 680, y: 70, w: 160, h: 62, t: 'Settings', d: 'allow / deny', kind: 'enforced' },
  { id: 'pre', x: 680, y: 210, w: 160, h: 62, t: 'PreToolUse hook', d: 'can block the call', kind: 'enforced' },
  { id: 'post', x: 680, y: 350, w: 160, h: 62, t: 'PostToolUse hook', d: 'records the result', kind: 'enforced' },
  { id: 'mcp', x: 905, y: 206, w: 135, h: 70, t: 'MCP server', d: 'tools/mcp/*.py', kind: 'enforced' },
  { id: 'env', x: 905, y: 355, w: 135, h: 58, t: 'Environment', d: '.env, by name', kind: 'enforced' },
  { id: 'system', x: 1085, y: 206, w: 125, h: 70, t: 'Our system', d: 'API or database', kind: 'system' },
];
const at = (id: string) => N.find((n) => n.id === id)!;
type Side = 'l' | 'r' | 't' | 'b';
const pt = (id: string, s: Side): [number, number] => {
  const n = at(id);
  return s === 'l' ? [n.x, n.y + n.h / 2] : s === 'r' ? [n.x + n.w, n.y + n.h / 2] : s === 't' ? [n.x + n.w / 2, n.y] : [n.x + n.w / 2, n.y + n.h];
};
/** One hand-off: from a block side to a block side, as a straight or elbow path. */
type Edge = [string, Side, string, Side];
const path = ([a, sa, b, sb]: Edge): { d: string; mid: [number, number] } => {
  const [x1, y1] = pt(a, sa), [x2, y2] = pt(b, sb);
  const side = (x: Side) => x === 'l' || x === 'r';
  if (x1 === x2 || y1 === y2) return { d: `M${x1},${y1} L${x2},${y2}`, mid: [(x1 + x2) / 2, (y1 + y2) / 2] };
  if (side(sa) && side(sb)) { const mx = (x1 + x2) / 2; return { d: `M${x1},${y1} L${mx},${y1} L${mx},${y2} L${x2},${y2}`, mid: [mx, (y1 + y2) / 2] }; }
  if (!side(sa) && !side(sb)) { const my = (y1 + y2) / 2; return { d: `M${x1},${y1} L${x1},${my} L${x2},${my} L${x2},${y2}`, mid: [(x1 + x2) / 2, my] }; }
  if (side(sa)) return { d: `M${x1},${y1} L${x2},${y1} L${x2},${y2}`, mid: [(x1 + x2) / 2, y1] };
  return { d: `M${x1},${y1} L${x1},${y2} L${x2},${y2}`, mid: [x1, (y1 + y2) / 2] };
};

export interface MapStep extends FlowStep { edges: Edge[]; nodes: string[] }

export const BLOCK_STEPS: MapStep[] = [
  { title: 'You start a command', kind: 'you', where: '.claude/commands/notification.md', anchors: ['blk:Commands'], nodes: ['you', 'command'], edges: [['you', 'r', 'command', 'l']],
    detail: <>You type <code>/notification new ...</code>. Claude Code finds the command file. <strong>Relation:</strong> the command is the recipe; nothing has run yet.</> },
  { title: 'It becomes the prompt', kind: 'file', anchors: ['blk:Commands'], nodes: ['command', 'model'], edges: [['command', 'r', 'model', 'l']],
    detail: <>The file's steps, with your arguments filled in, are handed to the model as its instructions. <strong>Relation:</strong> command → model.</> },
  { title: 'Context joins', kind: 'file', where: 'CLAUDE.md, .claude/rules/, memory', anchors: ['blk:CLAUDE.md', 'blk:Rules and constitution', 'blk:Memory'], nodes: ['context', 'model'], edges: [['context', 'r', 'model', 'l']],
    detail: <>CLAUDE.md, the rules for the paths involved and your memory are already loaded. <strong>Relation:</strong> they shape every decision, but enforce nothing.</> },
  { title: 'A skill loads', kind: 'file', where: '.claude/skills/notification-engine/', anchors: ['blk:Skills'], nodes: ['skill', 'model'], edges: [['skill', 'b', 'model', 't']],
    detail: <>The task matches the notification-engine description, so its know-how is loaded now, not before. <strong>Relation:</strong> skill → model, on demand.</> },
  { title: 'Hand off to a specialist', kind: 'model', where: '.claude/agents/notification-messages.md', anchors: ['blk:Agents (subagents)'], nodes: ['model', 'agent'], edges: [['model', 'b', 'agent', 't']],
    detail: <>For a specialist job the model starts a subagent: a fresh context and its own tool list. <strong>Relation:</strong> the subagent runs the same loop, limited to its tools (enforced).</> },
  { title: 'Ask for a tool', kind: 'model', where: 'mcp__notifications__create_notification', anchors: ['blk:Settings and permissions'], nodes: ['model', 'settings'], edges: [['model', 'r', 'settings', 'l']],
    detail: <>The model (or subagent) asks for a tool call. It cannot act itself. <strong>Relation:</strong> every request first meets the settings: allowed, denied, or ask you.</> },
  { title: 'Hook checks', kind: 'hook', where: '.claude/hooks/notification-guard.py', anchors: ['blk:Hooks'], nodes: ['settings', 'pre'], edges: [['settings', 'b', 'pre', 't']],
    detail: <>The PreToolUse hook runs whatever the model decided, and can refuse with a reason the model reads ("simulate it first"). <strong>Relation:</strong> hooks sit between the model and every system.</> },
  { title: 'MCP server runs', kind: 'tool', where: 'tools/mcp/notifications_mcp.py, .mcp.json', anchors: ['blk:MCP servers', 'blk:Environment'], nodes: ['pre', 'mcp', 'env'], edges: [['pre', 'r', 'mcp', 'l'], ['env', 't', 'mcp', 'b']],
    detail: <>The harness calls the server registered in .mcp.json. It reads the URL and credentials by name from the environment. <strong>Relation:</strong> the model never sees a token.</> },
  { title: 'Our system answers', kind: 'system', where: 'notification-service API', anchors: [], nodes: ['mcp', 'system'], edges: [['mcp', 'r', 'system', 'l']],
    detail: <>The real API (or the database, read-only) applies its own rules and answers. The server trims and masks the answer.</> },
  { title: 'Hook records', kind: 'hook', where: '.claude/state/notification-changes.jsonl', anchors: ['blk:Hooks'], nodes: ['mcp', 'post', 'model'], edges: [['mcp', 'l', 'post', 'r'], ['post', 'l', 'model', 'r']],
    detail: <>The PostToolUse hook records the write; the result goes back to the model, which decides the next step (back to step 6) or answers.</> },
  { title: 'You get the answer', kind: 'you', anchors: [], nodes: ['model', 'you'], edges: [['model', 'l', 'you', 'r']],
    detail: <>The model reports what changed and what was only read. On the hub, the run shows every step and every blocked call.</> },
];

const FILL: Record<Node['kind'], string> = {
  you: 'fill-paper stroke-ink', context: 'fill-sunk stroke-line-2', model: 'fill-run/10 stroke-run', enforced: 'fill-ok/10 stroke-ok', system: 'fill-brand/10 stroke-brand',
};

export function BlocksMap({ step, go }: { step: number; go: (i: number) => void }) {
  const cur = BLOCK_STEPS[step];
  const lit = new Set(cur.nodes);
  const firstFor = (id: string) => BLOCK_STEPS.findIndex((s) => s.nodes.includes(id));
  return (
    <div className="w-full">
      <svg viewBox="0 0 1230 470" className="block w-full" role="img" aria-label="How the blocks relate: one request from you through Claude Code to our system and back">
        <defs>
          <marker id="bm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" className="fill-ink" /></marker>
          <marker id="bm-arrow-dim" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" className="fill-line-2" /></marker>
        </defs>
        <rect x="190" y="18" width="680" height="440" rx="16" className="fill-none stroke-ink-3" strokeDasharray="6 5" />
        <text x="205" y="40" className="fill-ink-3 text-[13px] font-semibold uppercase tracking-wide">Claude Code: the harness</text>
        <text x="20" y="190" className="fill-ink-3 text-[13px] font-semibold uppercase tracking-wide">You</text>
        <text x="905" y="190" className="fill-ink-3 text-[13px] font-semibold uppercase tracking-wide">Reach</text>
        <text x="1085" y="190" className="fill-ink-3 text-[13px] font-semibold uppercase tracking-wide">Our systems</text>
        {BLOCK_STEPS.flatMap((s, i) => s.edges.map((e, j) => ({ e, i, j }))).sort((a, b) => Number(a.i === step) - Number(b.i === step)).map(({ e, i, j }) => {
          const on = i === step, p = path(e);
          return <path key={`${i}-${j}`} d={p.d} fill="none" strokeWidth={on ? 3 : 1.5} className={on ? 'stroke-ink' : 'stroke-line-2'} markerEnd={`url(#${on ? 'bm-arrow' : 'bm-arrow-dim'})`} />;
        })}
        {N.map((n) => {
          const on = lit.has(n.id), k = firstFor(n.id);
          return (
            <g key={n.id} onClick={() => k >= 0 && go(k)} className={k >= 0 ? 'cursor-pointer' : ''} opacity={on ? 1 : 0.45}>
              <rect x={n.x} y={n.y} width={n.w} height={n.h} rx="10" strokeWidth={on ? 2.5 : 1.25} className={FILL[n.kind]} />
              <text x={n.x + n.w / 2} y={n.y + n.h / 2 - 4} textAnchor="middle" className="fill-ink text-[14px] font-semibold">{n.t}</text>
              <text x={n.x + n.w / 2} y={n.y + n.h / 2 + 15} textAnchor="middle" className="fill-ink-3 text-[11.5px]">{n.d}</text>
            </g>
          );
        })}
        {BLOCK_STEPS.map((s, i) => {
          const [mx, my] = path(s.edges[0]).mid, on = i === step;
          return (
            <g key={i} onClick={() => go(i)} className="cursor-pointer">
              <circle cx={mx} cy={my} r={on ? 15 : 12} className={on ? 'fill-ink' : 'fill-paper stroke-ink-3'} strokeWidth={1.5} />
              <text x={mx} y={my + 4.5} textAnchor="middle" className={on ? 'fill-paper text-[13px] font-bold' : 'fill-ink text-[12px] font-semibold'}>{i + 1}</text>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-3">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-sm border border-line-2 bg-sunk" />context: steers the model</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-sm border border-ok bg-ok/10" />enforced: holds whatever the model decides</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-sm border border-run bg-run/10" />the model</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-sm border border-brand bg-brand/10" />our system</span>
      </div>
    </div>
  );
}
