import type { ReactNode } from 'react';
import type { FlowStep, StepKind } from '../components/StepFlow';
import { Hl } from '../components/FlowScope';

/**
 * The drawings behind three How agents work sections: one request with its loop, the three ways to build side by
 * side, and how MCP reaches a system. Each takes the selected step and a way to change it (StepFlow's `visual`).
 */
const STROKE: Record<StepKind, string> = { you: 'stroke-ink', model: 'stroke-run', hook: 'stroke-sev-medium', gate: 'stroke-sev-medium', tool: 'stroke-ok', file: 'stroke-ink-3', system: 'stroke-brand' };
const FILL: Record<StepKind, string> = { you: 'fill-ink', model: 'fill-run', hook: 'fill-sev-medium', gate: 'fill-sev-medium', tool: 'fill-ok', file: 'fill-ink-3', system: 'fill-brand' };

const Arrow = ({ id }: { id: string }) => (
  <marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" className="fill-ink-3" /></marker>
);

/* ---------- One request, with the loop inside it ---------- */

export function CycleMap({ steps, at, go }: { steps: FlowStep[]; at: number; go: (i: number) => void }) {
  // 1-5 enter, 6-12 are the agent loop (a ring), 13 is the answer
  const pos: [number, number][] = [];
  for (let i = 0; i < 5; i++) pos.push([70 + i * 112, 90]);
  const cx = 830, cy = 205, rx = 230, ry = 125;
  for (let i = 0; i < 7; i++) { const t = Math.PI + (i * 2 * Math.PI) / 7; pos.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]); }
  pos.push([470, 300]);
  const inLoop = at >= 5 && at <= 11;
  return (
    <svg viewBox="0 0 1200 380" className="block w-full" role="img" aria-label="One request: five steps in, the agent loop of seven steps that repeats, then the answer">
      <defs><Arrow id="cy-a" /></defs>
      <ellipse cx={cx} cy={cy} rx={rx + 46} ry={ry + 40} className={inLoop ? 'fill-run/5 stroke-run' : 'fill-sunk stroke-line-2'} strokeDasharray="7 6" strokeWidth={1.5} />
      <text x={cx} y={cy - 8} textAnchor="middle" className="fill-run text-[15px] font-semibold">The agent loop</text>
      <text x={cx} y={cy + 12} textAnchor="middle" className="fill-ink-3 text-[12px]">steps 6 to 12 repeat</text>
      <text x={cx} y={cy + 28} textAnchor="middle" className="fill-ink-3 text-[12px]">until the model answers</text>
      <text x="40" y="38" className="fill-ink-3 text-[12px] font-semibold uppercase tracking-wide">Once per request</text>
      {pos.slice(0, 4).map(([x, y], i) => <line key={i} x1={x + 20} y1={y} x2={pos[i + 1][0] - 22} y2={pos[i + 1][1]} className="stroke-ink-3" strokeWidth={1.5} markerEnd="url(#cy-a)" />)}
      <path d={`M${pos[4][0] + 20},${pos[4][1]} L${pos[5][0] - 24},${pos[5][1] - 16}`} className="stroke-ink-3" strokeWidth={1.5} fill="none" markerEnd="url(#cy-a)" />
      {pos.slice(5, 12).map(([x, y], i) => {
        const [nx, ny] = i < 6 ? pos[6 + i] : pos[5];
        const mx = (x + nx) / 2 + (cx - (x + nx) / 2) * -0.12, my = (y + ny) / 2 + (cy - (y + ny) / 2) * -0.12;
        return <path key={i} d={`M${x},${y} Q${mx},${my} ${nx},${ny}`} className={i === 6 ? 'stroke-run' : 'stroke-ink-3'} strokeWidth={i === 6 ? 2 : 1.5} fill="none" strokeDasharray={i === 6 ? '5 4' : undefined} markerEnd="url(#cy-a)" />;
      })}
      <path d={`M${pos[5][0] - 18},${pos[5][1] + 12} L${pos[12][0] + 24},${pos[12][1] - 6}`} className="stroke-ink-3" strokeWidth={1.5} fill="none" markerEnd="url(#cy-a)" />
      {pos.map(([x, y], i) => {
        const s = steps[i], k = s?.kind || 'model', on = i === at;
        const below = i < 5 || i === 12 || y > cy;
        return (
          <g key={i} onClick={() => go(i)} className="cursor-pointer">
            <circle cx={x} cy={y} r={on ? 22 : 18} strokeWidth={2.5} className={on ? `${FILL[k]} ${STROKE[k]}` : `fill-paper ${STROKE[k]}`} />
            <text x={x} y={y + 5} textAnchor="middle" className={on ? 'fill-paper text-[14px] font-bold' : 'fill-ink text-[13px] font-semibold'}>{i + 1}</text>
            <text x={x} y={below ? y + 40 : y - 30} textAnchor="middle" className={on ? 'fill-ink text-[12.5px] font-semibold' : 'fill-ink-2 text-[12px]'}>{s?.title}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- Three ways to build, side by side ---------- */

type WBox = { t: string; k: StepKind };
const WAYS: { title: string; owner: string; boxes: WBox[]; loop?: [number, number]; tools: string }[] = [
  { title: '1. Agent harness', owner: 'The model owns the flow', tools: 'Claude Code, Claude Agent SDK',
    boxes: [{ t: 'Request from a person', k: 'you' }, { t: 'Model decides the next step', k: 'model' }, { t: 'Tool call: Read, Grep, MCP', k: 'tool' }, { t: 'Answer a person reads', k: 'you' }], loop: [1, 2] },
  { title: '2. Framework graph', owner: 'Our graph owns the flow', tools: 'Spring AI, Semantic Kernel, LangGraph',
    boxes: [{ t: 'Request in our service', k: 'you' }, { t: 'Node: our code validates', k: 'file' }, { t: 'Node: model reasons, picks a tool', k: 'model' }, { t: 'Checkpoint: human approval', k: 'gate' }, { t: 'Node: our code acts', k: 'file' }] },
  { title: '3. Deterministic service', owner: 'Code owns every fact', tools: 'Java 21 service + Spring AI (IDEA-4)',
    boxes: [{ t: 'Schedule or request', k: 'you' }, { t: 'Named queries compute the facts', k: 'file' }, { t: 'Model classifies and words', k: 'model' }, { t: 'Guard: words match the facts', k: 'gate' }, { t: 'Report (also with the model off)', k: 'system' }] },
];
const BOXFILL: Record<StepKind, string> = { you: 'fill-paper stroke-ink', model: 'fill-run/10 stroke-run', hook: 'fill-sev-medium/10 stroke-sev-medium', gate: 'fill-sev-medium/10 stroke-sev-medium', tool: 'fill-ok/10 stroke-ok', file: 'fill-sunk stroke-ink-3', system: 'fill-brand/10 stroke-brand' };

export function WaysMap({ at, go }: { at: number; go: (i: number) => void }) {
  const col = at >= 1 && at <= 3 ? at - 1 : -1, all = at === 0 || at === 4;
  const W = 360, X = [20, 420, 820];
  return (
    <svg viewBox="0 0 1200 540" className="block w-full" role="img" aria-label="Three ways to build an agent, side by side: who owns the control flow">
      <defs><Arrow id="wy-a" /></defs>
      {WAYS.map((w, c) => {
        const on = all || col === c, x = X[c];
        return (
          <g key={c} opacity={on ? 1 : 0.4} onClick={() => go(c + 1)} className="cursor-pointer">
            <rect x={x} y={10} width={W} height={440} rx={14} className={col === c ? 'fill-paper stroke-ink' : 'fill-paper stroke-line-2'} strokeWidth={col === c ? 2 : 1} />
            <text x={x + 18} y={40} className="fill-ink text-[17px] font-bold">{w.title}</text>
            <text x={x + 18} y={62} className="fill-run text-[13px] font-semibold">{w.owner}</text>
            {w.boxes.map((b, i) => {
              const y = 84 + i * 70, bx = x + 40, bw = W - 80;
              return (
                <g key={i}>
                  <rect x={bx} y={y} width={bw} height={48} rx={9} strokeWidth={1.5} className={BOXFILL[b.k]} />
                  <text x={bx + bw / 2} y={y + 29} textAnchor="middle" className="fill-ink text-[13px] font-medium">{b.t}</text>
                  {i < w.boxes.length - 1 && <line x1={bx + bw / 2} y1={y + 48} x2={bx + bw / 2} y2={y + 68} className="stroke-ink-3" strokeWidth={1.5} markerEnd="url(#wy-a)" />}
                </g>
              );
            })}
            {w.loop && (() => {
              const y1 = 84 + w.loop[0] * 70 + 24, y2 = 84 + w.loop[1] * 70 + 24, rx2 = x + W - 40;
              return <g><path d={`M${rx2},${y2} C${rx2 + 34},${y2} ${rx2 + 34},${y1} ${rx2},${y1}`} className="stroke-run" strokeWidth={2} fill="none" strokeDasharray="5 4" markerEnd="url(#wy-a)" />
                <text x={rx2 + 28} y={(y1 + y2) / 2 + 4} textAnchor="middle" className="fill-run text-[11px] font-semibold">loop</text></g>;
            })()}
            <text x={x + 18} y={430} className="fill-ink-3 text-[12px]">{w.tools}</text>
          </g>
        );
      })}
      <g opacity={at === 4 || at === 0 ? 1 : 0.5} onClick={() => go(4)} className="cursor-pointer">
        <rect x={20} y={470} width={1160} height={52} rx={12} className={at === 4 ? 'fill-ok/15 stroke-ok' : 'fill-ok/5 stroke-ok'} strokeWidth={at === 4 ? 2 : 1} />
        <text x={600} y={502} textAnchor="middle" className="fill-ink text-[14px] font-semibold">Same reach for all three: MCP servers or typed tools, read-only first, credentials by name, every call logged</text>
      </g>
    </svg>
  );
}

/* ---------- MCP: how an agent reaches a system ---------- */

type MNode = { id: string; x: number; y: number; w: number; t: string; d: string; k: StepKind };
const MN: MNode[] = [
  { id: 'agent', x: 20, y: 165, w: 170, t: 'Agent (the model)', d: 'asks for a tool by name', k: 'model' },
  { id: 'client', x: 250, y: 165, w: 170, t: 'MCP client', d: 'Claude Code, the host', k: 'you' },
  { id: 'reg', x: 250, y: 25, w: 170, t: '.mcp.json', d: 'which servers, how to start', k: 'file' },
  { id: 'hook', x: 250, y: 310, w: 170, t: 'Hook', d: 'PreToolUse: may refuse', k: 'hook' },
  { id: 'server', x: 500, y: 165, w: 190, t: 'MCP server', d: 'tools/mcp/*.py: typed tools', k: 'tool' },
  { id: 'env', x: 500, y: 310, w: 190, t: 'Environment', d: 'URL, credentials, by name', k: 'gate' },
  { id: 'api', x: 780, y: 70, w: 200, t: 'Service API', d: 'notification-service :8110', k: 'system' },
  { id: 'db', x: 780, y: 260, w: 200, t: 'Database, read-only', d: 'MariaDB, user agent_ro', k: 'system' },
  { id: 'result', x: 1020, y: 165, w: 160, t: 'Result', d: 'trimmed, masked, data', k: 'tool' },
];
const mn = (id: string) => MN.find((n) => n.id === id)!;
const H = 58;
type MEdge = [string, string, string?];
const mid = (a: MNode, b: MNode): [number, number, number, number] => {
  const ax = a.x + a.w / 2, ay = a.y + H / 2, bx = b.x + b.w / 2, by = b.y + H / 2;
  const dx = bx - ax, dy = by - ay;
  const sx = Math.abs(dx) * H / 2 > Math.abs(dy) * a.w / 2 ? (a.w / 2) / Math.abs(dx) : (H / 2) / Math.abs(dy);
  const ex = Math.abs(dx) * H / 2 > Math.abs(dy) * b.w / 2 ? (b.w / 2) / Math.abs(dx) : (H / 2) / Math.abs(dy);
  return [ax + dx * sx, ay + dy * sx, bx - dx * ex, by - dy * ex];
};

export interface McpStep extends FlowStep { nodes: string[]; edges: MEdge[]; term: string; means: ReactNode; here: ReactNode }

export const MCP_STEPS: McpStep[] = [
  { title: 'Tool call', kind: 'model', term: 'Tool call', nodes: ['agent', 'client'], edges: [['agent', 'client']], anchors: ['mcp:0'],
    means: 'A request by the model to run one named tool with typed inputs. The model never acts itself.', here: <code>get_notification(id: 6)</code>,
    detail: <>The model picks a tool from the descriptions it was given and asks for it by name, with typed inputs. Nothing has run yet.</> },
  { title: 'MCP client', kind: 'you', term: 'MCP client (host)', nodes: ['client', 'reg'], edges: [['reg', 'client']], anchors: ['mcp:1'],
    means: 'The program that runs the model and talks to MCP servers on its behalf.', here: 'Claude Code: the terminal, VS Code, the hub',
    detail: <>Claude Code is the MCP client. It started the servers listed in <code>.mcp.json</code> when the session began, and now passes the call to the right one.</> },
  { title: 'Hook check', kind: 'hook', term: 'Hook', nodes: ['client', 'hook'], edges: [['client', 'hook']], anchors: ['mcp:2'],
    means: 'A script the client runs before (and after) every matching tool call; it can refuse with a reason.', here: <code>notification-guard.py</code>,
    detail: <>Before the call leaves, the PreToolUse hook checks it: a write outside local or DEV, or a publish before a simulate, is refused here.</> },
  { title: 'Transport', kind: 'tool', term: 'Transport (stdio, http)', nodes: ['client', 'server'], edges: [['client', 'server', 'stdio']], anchors: ['mcp:3'],
    means: 'How client and server talk: stdio is a local program over stdin and stdout; http is a shared service.', here: 'stdio: the server is a Python file on your laptop',
    detail: <>The call travels as a JSON-RPC message over <strong>stdio</strong>: the server is a small program on your laptop, started by Claude Code.</> },
  { title: 'MCP server and tools', kind: 'tool', term: 'MCP server, tool, description', nodes: ['server'], edges: [], anchors: ['mcp:4'],
    means: 'A program that lists tools (name, description, input schema) for one system and runs them. The description is the only documentation the model reads.', here: <><code>notifications_mcp.py</code> (13 tools), <code>localdb_mcp.py</code> (5 tools)</>,
    detail: <>The server validates the inputs and decides how to reach the system. One server per system; narrow tools, read-only first.</> },
  { title: 'Credentials by name', kind: 'gate', term: 'Environment', nodes: ['env', 'server'], edges: [['env', 'server']], anchors: ['mcp:5'],
    means: 'Where URLs and secrets live, referred to by name. The model never sees a value.', here: <code>local-env/.env: NOTIFICATIONS_API_URL ...</code>,
    detail: <>The server reads the URL and the client secret by name from the environment and gets its own token. The model never sees either.</> },
  { title: 'API path', kind: 'system', term: 'API path', nodes: ['server', 'api'], edges: [['server', 'api', 'HTTPS + token']], anchors: ['mcp:6'],
    means: 'For one record now, and for every change: the service applies its own rules, roles and tenant.', here: 'create, change, publish a notification',
    detail: <>For one record or any change, the server calls the service API with a service-account token. The service's own rules apply.</> },
  { title: 'Database path', kind: 'system', term: 'Database path', nodes: ['server', 'db'], edges: [['server', 'db', 'SELECT only']], anchors: ['mcp:7'],
    means: 'For history, counts and joins: a read-only user, personal columns counted only, never a write.', here: 'eSIM status counts in CAS_SERVER',
    detail: <>For history and counts, the server reads the database as a read-only user; personal columns can only be counted.</> },
  { title: 'Result back', kind: 'tool', term: 'Result', nodes: ['api', 'db', 'result', 'agent'], edges: [['api', 'result'], ['db', 'result']], anchors: ['mcp:8'],
    means: 'What the server returns: trimmed, masked, and treated as data, never as instructions.', here: 'masked numbers, 100 rows at most, logged by the hook',
    detail: <>The server trims and masks the answer; it returns to the model as data. The PostToolUse hook logs the call. The model decides the next step.</> },
];

export function McpMap({ at, go }: { at: number; go: (i: number) => void }) {
  const cur = MCP_STEPS[at];
  const lit = new Set(cur.nodes);
  const all: { e: MEdge; i: number }[] = MCP_STEPS.flatMap((s, i) => s.edges.map((e) => ({ e, i })));
  const first = (id: string) => MCP_STEPS.findIndex((s) => s.nodes.includes(id));
  return (
    <svg viewBox="0 0 1200 395" className="block w-full" role="img" aria-label="How an agent reaches a system through MCP: client, hook, transport, server, credentials, API or database, result">
      <defs><Arrow id="mc-a" /><marker id="mc-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" className="fill-ink" /></marker></defs>
      <rect x="230" y="8" width="210" height="380" rx="14" className="fill-none stroke-ink-3" strokeDasharray="6 5" />
      <text x="245" y="384" className="fill-ink-3 text-[11px] font-semibold uppercase tracking-wide">on your laptop: Claude Code</text>
      {all.sort((a, b) => Number(a.i === at) - Number(b.i === at)).map(({ e, i }, j) => {
        const [x1, y1, x2, y2] = mid(mn(e[0]), mn(e[1])), on = i === at;
        return (
          <g key={j}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={on ? 3 : 1.5} className={on ? 'stroke-ink' : 'stroke-line-2'} markerEnd={`url(#${on ? 'mc-on' : 'mc-a'})`} />
            {e[2] && <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 8} textAnchor="middle" className={on ? 'fill-ink text-[12px] font-semibold' : 'fill-ink-3 text-[11px]'}>{e[2]}</text>}
          </g>
        );
      })}
      <path d="M1100,223 C1100,380 105,380 105,223" fill="none" strokeWidth={at === 8 ? 2.5 : 1.25} className={at === 8 ? 'stroke-ink' : 'stroke-line-2'} strokeDasharray="6 5" markerEnd={`url(#${at === 8 ? 'mc-on' : 'mc-a'})`} />
      {MN.map((n) => {
        const on = lit.has(n.id), k = first(n.id);
        return (
          <g key={n.id} opacity={on ? 1 : 0.45} onClick={() => k >= 0 && go(k)} className="cursor-pointer">
            <rect x={n.x} y={n.y} width={n.w} height={H} rx={10} strokeWidth={on ? 2.5 : 1.25} className={BOXFILL[n.k]} />
            <text x={n.x + n.w / 2} y={n.y + 25} textAnchor="middle" className="fill-ink text-[14px] font-semibold">{n.t}</text>
            <text x={n.x + n.w / 2} y={n.y + 43} textAnchor="middle" className="fill-ink-3 text-[11.5px]">{n.d}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** The terms of the MCP map with their meaning and where they are in this workspace; each row lights with its step. */
export function McpGlossary() {
  return (
    <div className="w-full overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="text-left text-xs uppercase tracking-wide text-ink-3"><th className="py-1.5 pr-3">#</th><th className="py-1.5 pr-3">Term</th><th className="py-1.5 pr-3">Means</th><th className="py-1.5">In this workspace</th></tr></thead>
      <tbody className="divide-y divide-line align-top text-ink-2">
        {MCP_STEPS.map((s, i) => (
          <Hl as="tr" a={`mcp:${i}`} key={s.term}>
            <td className="py-2 pr-3 tabular-nums text-ink-3">{i + 1}</td>
            <td className="py-2 pr-3 font-medium text-ink">{s.term}</td>
            <td className="py-2 pr-3">{s.means}</td>
            <td className="py-2 text-xs">{s.here}</td>
          </Hl>
        ))}
      </tbody>
    </table></div>
  );
}
