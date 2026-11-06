import { useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { PHASES, PHASE_TITLE, type Agentic, type AgNode, type Hub, type LoopConfig } from '../lib/data';
import { CopyButton, cx } from './ui';

type Kind = 'entry' | 'command' | 'agent' | 'tool' | 'file' | 'hook' | 'skill' | 'rule';
type Entry = NonNullable<LoopConfig['entries']>[number];
export interface GNode extends AgNode { kind: Kind; label?: string; args?: string; e?: Entry }
export interface Model { ag: Agentic; cols: [string, GNode[]][]; guard: GNode[]; edges: [string, string][]; all: Record<string, GNode> }
export interface GraphState { sel: string | null; flow: string | null; step: number }

const COLOR: Record<Kind, string> = {
  entry: 'var(--sev-medium)', command: 'var(--run)', agent: 'var(--ok)', tool: 'var(--sev-high)', file: 'var(--sev-low)',
  hook: 'var(--block)', skill: 'var(--block)', rule: 'var(--block)',
};
const KIND: Record<Kind, string> = {
  entry: 'Entry point', command: 'Slash command', agent: 'Subagent', tool: 'MCP server or tool', file: 'Spec file', hook: 'Hook', skill: 'Skill', rule: 'Path rule',
};
const LEGEND: [Kind, string][] = [['entry', 'Entry point'], ['command', 'Slash command'], ['agent', 'Subagent'], ['tool', 'MCP server or CLI'], ['file', 'File in specs/<KEY>/'], ['hook', 'Hook, skill or rule']];
const kc = (k: Kind) => ({ '--k': COLOR[k] }) as CSSProperties;

export function phaseList(cfg: LoopConfig) {
  return cfg.phases?.length ? cfg.phases : PHASES.map((k) => ({ key: k, title: PHASE_TITLE[k], command: '', does: '' }));
}
const firstCmd = (c: string) => c.split(/[,\s]+/).find((x) => x.startsWith('/')) || '';

/** Agents and tools each phase uses, from the command files: never a hand-written list. */
export function phaseWiring(ag: Agentic | undefined, command: string, index: number) {
  if (!ag) return { agents: [] as string[], tools: [] as string[] };
  const names = command.split(/[,\s]+/);
  const cmds = ag.commands.filter((c) => c.phase === index + 1 || names.includes(c.name));
  const tools = [...new Set(cmds.flatMap((c) => c.tools))].filter((t) => t !== 'spec-py');
  return { agents: [...new Set(cmds.flatMap((c) => c.agents))], tools: tools.map((t) => ag.tools.find((x) => x.id === `tool:${t}`)?.name || t) };
}

export function useModel(hub: Hub): Model | null {
  return useMemo(() => {
    const ag = hub.manifest.agentic;
    if (!ag) return null;
    const cfg = hub.manifest.loopConfig;
    const entries: GNode[] = (cfg.entries || []).map((e) => ({ id: `entry:${e.key}`, name: e.title, kind: 'entry', e }));
    const seq = phaseList(cfg).flatMap((p) => p.command.split(/[,\s]+/).filter((x) => x.startsWith('/')));
    const order = (c: Agentic['commands'][number]) => { const i = seq.indexOf(c.name); return i >= 0 ? i : (c.phase || 50) * 100 + ag.commands.indexOf(c); };
    const cols: [string, GNode[]][] = [
      ['Entry points', entries],
      ['Commands', [...ag.commands].sort((a, b) => order(a) - order(b)).map((c) => ({ ...c, tools: undefined, kind: 'command' as const, label: c.name }))],
      ['Agents', ag.agents.map((x) => ({ ...x, kind: 'agent' as const }))],
      ['MCP and tools', ag.tools.map((x) => ({ ...x, kind: 'tool' as const }))],
      ['Spec files', ag.files.map((x) => ({ ...x, kind: 'file' as const }))],
    ];
    const guard: GNode[] = [
      ...ag.hooks.map((x) => ({ ...x, kind: 'hook' as const })),
      ...ag.skills.map((x) => ({ ...x, kind: 'skill' as const })),
      ...ag.rules.map((x) => ({ ...x, kind: 'rule' as const })),
    ];
    const edges: [string, string][] = [...ag.edges, ...entries.filter((e) => e.e?.command).map((e) => [e.id, e.e!.command!] as [string, string])];
    if (ag.hooks.some((h) => h.id === 'hook:spec-gate')) edges.push(['cmd:build', 'hook:spec-gate']);
    const all = Object.fromEntries([...cols.flatMap(([, l]) => l), ...guard].map((x) => [x.id, x]));
    return { ag, cols, guard, edges, all };
  }, [hub]);
}

/* ---------- the SDLC at a glance ---------- */

function Box({ go, onGo, className, style, children }: { go?: string; onGo: (id: string) => void; className?: string; style?: CSSProperties; children: ReactNode }) {
  const cls = cx('flex min-w-0 flex-col gap-0.5 rounded-md border border-line bg-paper px-2.5 py-1.5 text-left text-[13px]', className);
  return go
    ? <button type="button" onClick={() => onGo(go)} className={cx(cls, 'hover:border-ink-3')} style={style}>{children}</button>
    : <div className={cls} style={style}>{children}</div>;
}

const Label = ({ children }: { children: ReactNode }) => <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-3">{children}</div>;
const Arrow = () => (
  <div aria-hidden className="grid place-items-center text-xl font-bold text-brand">
    <span className="xl:hidden">↓</span><span className="hidden xl:inline">→</span>
  </div>
);

export function SdlcOverview({ hub, model, onGo }: { hub: Hub; model: Model; onGo: (id: string) => void }) {
  const cfg = hub.manifest.loopConfig;
  const s = cfg.sdlc || {};
  const { ag } = model;
  const sources = s.sources || (cfg.entries || []).map((e) => ({ t: e.title, d: e.via, go: `entry:${e.key}` }));
  const usedBy = (id: string) => ag.commands.filter((c) => c.tools.includes(id.slice(5))).map((c) => c.name);
  const ph = phaseList(cfg);
  const side = (title: string, list: typeof sources) => (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label>{title}</Label>
      {list.map((x) => (
        <Box key={x.t} go={x.go} onGo={onGo}><b className="font-semibold">{x.t}</b>{x.d && <span className="text-xs text-ink-3">{x.d}</span>}</Box>
      ))}
    </div>
  );
  return (
    <div className="grid gap-3 rounded-lg border border-line bg-paper p-3 sm:p-4 xl:grid-cols-[minmax(150px,1fr)_24px_minmax(0,3.2fr)_24px_minmax(150px,1fr)]">
      {side('Work comes from', sources)}
      <Arrow />
      <div className="flex min-w-0 flex-col gap-3 rounded-lg border-2 border-ink bg-sunk p-3">
        <Label>Claude Code in {s.workspace || ag.workspace}</Label>
        <div>
          <Label>Guardrails, every session</Label>
          <div className="flex flex-wrap gap-1.5">
            {!!ag.constitution?.length && <Box onGo={onGo} className="flex-row items-baseline gap-1 border-l-[3px]" style={{ borderLeftColor: COLOR.rule }}>constitution <small className="text-[11px] text-ink-3">{ag.constitution.length} files</small></Box>}
            {!!ag.rules.length && <Box go={ag.rules[0].id} onGo={onGo} className="flex-row items-baseline gap-1 border-l-[3px]" style={{ borderLeftColor: COLOR.rule }}>path rules <small className="text-[11px] text-ink-3">{ag.rules.length}</small></Box>}
            {ag.hooks.map((h) => <Box key={h.id} go={h.id} onGo={onGo} className="flex-row items-baseline gap-1 border-l-[3px]" style={{ borderLeftColor: COLOR.hook }}>{h.name.replace(/\.py$/, '')} <small className="text-[11px] text-ink-3">{h.event}</small></Box>)}
            {ag.skills.map((k) => <Box key={k.id} go={k.id} onGo={onGo} className="flex-row items-baseline gap-1 border-l-[3px]" style={{ borderLeftColor: COLOR.skill }}>{k.name} <small className="text-[11px] text-ink-3">skill</small></Box>)}
          </div>
        </div>
        <div>
          <ol className="flex flex-wrap items-center gap-1 rounded-md border border-line bg-paper p-2">
            {ph.map((p, i) => {
              const c = firstCmd(p.command);
              return (
                <li key={p.key} className="flex min-w-[88px] flex-1 items-center gap-1">
                  {i > 0 && <span aria-hidden className="font-bold text-ink-3">→</span>}
                  <Box go={c ? `cmd:${c.slice(1)}` : undefined} onGo={onGo} className="flex-1 border-t-[3px] border-t-brand">
                    <b className="whitespace-nowrap text-[12.5px] font-semibold">{i + 1}. {p.title}</b>
                    <code className="font-mono text-[11px] text-ink-3">{p.command.split(',')[0]}</code>
                  </Box>
                </li>
              );
            })}
          </ol>
          <p className="mt-1.5 text-xs text-ink-3">↺ {ph[ph.length - 1]?.title || 'Maintain'} loops back: findings and feedback start a new intent</p>
        </div>
        <div>
          <Label>Subagents</Label>
          <div className="flex flex-wrap gap-1.5">
            {ag.agents.map((a) => <Box key={a.id} go={a.id} onGo={onGo} className="border-l-[3px]" style={{ borderLeftColor: COLOR.agent }}>{a.name}</Box>)}
          </div>
        </div>
      </div>
      <Arrow />
      {side('It delivers', s.delivers || [])}
      <div className="border-t border-dashed border-line-2 pt-3 xl:col-span-5">
        <Label>MCP servers and tools Claude calls</Label>
        <div className="flex flex-wrap gap-1.5">
          {ag.tools.filter((t) => t.id !== 'tool:spec-py').map((t) => {
            const u = usedBy(t.id);
            return (
              <Box key={t.id} go={t.id} onGo={onGo} className={cx('min-w-[170px] flex-1 border-l-[3px]', !u.length && 'border-dashed opacity-75')} style={{ borderLeftColor: COLOR.tool }}>
                <b className="font-semibold">{t.name}</b>
                <span className="text-xs text-ink-3">{u.length ? `used by ${u.join(', ')}` : 'installed, no command uses it yet'}</span>
              </Box>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- how it works, in detail ---------- */

function hotSet(m: Model, st: GraphState, flows: NonNullable<LoopConfig['flows']>) {
  const hot = new Set<string>(), lit = new Set<string>();
  const flow = st.flow ? flows.find((f) => f.key === st.flow) : undefined;
  if (flow) {
    const ns = flow.steps[st.step]?.nodes || [];
    ns.forEach((id) => lit.add(id));
    for (let i = 1; i < ns.length; i++) { hot.add(`${ns[0]}>${ns[i]}`); hot.add(`${ns[i]}>${ns[0]}`); }
  } else if (st.sel) {
    lit.add(st.sel);
    m.edges.forEach(([a, b]) => { if (a === st.sel || b === st.sel) { hot.add(`${a}>${b}`); lit.add(a); lit.add(b); } });
  }
  return { hot, lit, flow, focus: flow ? flow.steps[st.step]?.nodes?.[0] : st.sel };
}

function drawLines(box: HTMLElement, svg: SVGSVGElement, m: Model, hot: Set<string>) {
  const r0 = box.getBoundingClientRect();
  svg.setAttribute('width', String(r0.width));
  svg.setAttribute('height', String(r0.height));
  const pos = (id: string) => {
    const el = box.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { l: r.left - r0.left, r: r.right - r0.left, y: r.top - r0.top + r.height / 2, t: r.top - r0.top, b: r.bottom - r0.top, cx: r.left - r0.left + r.width / 2 };
  };
  // a walkthrough step may pair boxes no command file links directly: those draw dashed
  const known = new Set(m.edges.map(([a, b]) => `${a}>${b}`));
  const rev = (k: string) => k.split('>').reverse().join('>');
  const list = [...hot];
  const extra = list.filter((k) => !known.has(k) && !known.has(rev(k)) && (!list.includes(rev(k)) || list.indexOf(k) < list.indexOf(rev(k))))
    .map((k) => [...k.split('>'), 'x'] as [string, string, string]);
  const paths = [...m.edges.map(([a, b]) => [a, b, ''] as [string, string, string]), ...extra].map(([a, b, x]) => {
    const p = pos(a), q = pos(b);
    if (!p || !q) return '';
    const on = hot.has(`${a}>${b}`) || hot.has(`${b}>${a}`);
    const sameCol = Math.abs(p.cx - q.cx) < 40;
    const below = q.t > p.b + 40 && !sameCol && Math.abs(p.cx - q.cx) < 260;
    const d = sameCol ? `M${p.r},${p.y} C${p.r + 70},${p.y} ${q.r + 70},${q.y} ${q.r},${q.y}`
      : below ? `M${p.cx},${p.b} C${p.cx},${p.b + 60} ${q.cx},${q.t - 60} ${q.cx},${q.t}`
      : q.l >= p.r ? `M${p.r},${p.y} C${p.r + 50},${p.y} ${q.l - 50},${q.y} ${q.l},${q.y}` : `M${p.l},${p.y} C${p.l - 50},${p.y} ${q.r + 50},${q.y} ${q.r},${q.y}`;
    return `<path d="${d}" class="${on ? 'on' : ''}${x ? ' x' : ''}"/>`;
  });
  svg.innerHTML = paths.filter(Boolean).sort((a, b) => Number(a.includes('class="on')) - Number(b.includes('class="on'))).join('');
}

function Node({ x, lit, dim, focus, onClick }: { x: GNode; lit: boolean; dim: boolean; focus: boolean; onClick: () => void }) {
  return (
    <button type="button" data-id={x.id} onClick={onClick} title={x.description || x.name} aria-pressed={focus} style={kc(x.kind)}
      className={cx(
        'relative block w-full truncate rounded-md border border-l-4 border-line border-l-[var(--k)] bg-paper px-2 py-1 text-left text-[12.5px] transition-opacity hover:border-[var(--k)]',
        x.kind === 'command' && 'font-mono',
        x.kind === 'tool' && !x.used && 'border-dashed text-ink-3',
        dim && !lit && 'opacity-30',
        lit && 'ring-1 ring-[var(--k)]',
        focus && 'bg-[color-mix(in_oklab,var(--k)_14%,var(--paper))] font-semibold',
      )}>
      {x.label || x.name}
    </button>
  );
}

export function AgenticGraph({ hub, model, state, setState }: { hub: Hub; model: Model; state: GraphState; setState: (s: GraphState) => void }) {
  const flows = hub.manifest.loopConfig.flows || [];
  const box = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const panel = useRef<HTMLElement>(null);
  const { hot, lit, flow, focus } = hotSet(model, state, flows);
  const dim = lit.size > 0;

  useLayoutEffect(() => {
    const b = box.current, s = svg.current;
    if (!b || !s) return;
    const draw = () => drawLines(b, s, model, hot);
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(b);
    document.fonts?.ready.then(draw);
    return () => ro.disconnect();
  });

  const pick = (sel: string | null) => {
    setState({ sel, flow: null, step: 0 });
    // below xl the panel sits under the graph: bring it into view
    if (sel && !matchMedia('(min-width: 1280px)').matches) requestAnimationFrame(() => panel.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  };
  const node = (x: GNode) => <Node key={x.id} x={x} lit={lit.has(x.id)} dim={dim} focus={x.id === focus} onClick={() => pick(state.sel === x.id ? null : x.id)} />;
  const ag = model.ag;

  return (
    <div>
      {!!flows.length && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3">Walk through</span>
          {flows.map((f) => (
            <button key={f.key} type="button" aria-pressed={state.flow === f.key}
              onClick={() => setState({ sel: null, flow: state.flow === f.key ? null : f.key, step: 0 })}
              className={cx('rounded-full border px-3 py-1 text-xs font-medium', state.flow === f.key ? 'border-ink bg-ink text-paper' : 'border-line-2 bg-paper text-ink-2 hover:border-ink-3 hover:text-ink')}>
              {f.title}
            </button>
          ))}
        </div>
      )}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div data-scroll className="min-w-0 overflow-x-auto rounded-lg border border-line bg-paper">
          <div ref={box} className={cx('ax relative min-w-[880px] p-3.5', dim && 'dim')}>
            <svg ref={svg} aria-hidden className="ax-svg pointer-events-none absolute inset-0 overflow-visible" />
            <div className="relative grid grid-cols-5 gap-8">
              {model.cols.map(([t, l]) => (
                <div key={t} className="flex min-w-0 flex-col gap-1.5">
                  <div className="mb-1 flex justify-between text-[11px] font-semibold uppercase tracking-wider text-ink-3"><span>{t}</span><span className="tabular-nums">{l.length}</span></div>
                  {l.map(node)}
                </div>
              ))}
            </div>
            <div className="relative mt-6 border-t border-dashed border-line-2 pt-3">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-3">Guardrails on every session: hooks, skills, path rules{ag.constitution?.length ? ', constitution' : ''}</div>
              <div className="flex flex-wrap gap-1.5 [&>button]:w-auto">
                {model.guard.map(node)}
                {!!ag.constitution?.length && <span style={kc('rule')} className="rounded-md border border-l-4 border-line border-l-[var(--k)] bg-paper px-2 py-1 text-[12.5px]">constitution/ ({ag.constitution.length} files)</span>}
              </div>
            </div>
          </div>
        </div>
        <aside ref={panel} aria-live="polite" className="scroll-mt-20 rounded-lg border border-line border-t-4 border-t-brand bg-paper px-4 py-3.5 text-sm xl:sticky xl:top-20 xl:max-h-[calc(100dvh-6rem)] xl:overflow-y-auto">
          {flow ? <FlowPanel flow={flow} step={state.step} onStep={(step) => setState({ ...state, step })} />
            : state.sel && model.all[state.sel] ? <NodePanel x={model.all[state.sel]} model={model} onGo={(id) => setState({ sel: id, flow: null, step: 0 })} />
            : (
              <>
                <h3 className="mb-1.5 font-semibold">Select something</h3>
                <p className="text-ink-2">Click a box to see what it does, which file defines it and what it connects to. Or pick a walkthrough above.</p>
                <ul className="mt-3 space-y-1.5">
                  {LEGEND.map(([k, l]) => <li key={k} className="flex items-center gap-2"><i aria-hidden style={kc(k)} className="size-3.5 border-l-4 border-l-[var(--k)] bg-[color-mix(in_oklab,var(--k)_18%,transparent)]" />{l}</li>)}
                </ul>
              </>
            )}
        </aside>
      </div>
    </div>
  );
}

function FlowPanel({ flow, step, onStep }: { flow: NonNullable<LoopConfig['flows']>[number]; step: number; onStep: (n: number) => void }) {
  return (
    <>
      <h3 className="mb-2 font-semibold">{flow.title}</h3>
      <ol className="mb-3 list-decimal space-y-0.5 pl-5">
        {flow.steps.map((s, i) => (
          <li key={i}>
            <button type="button" onClick={() => onStep(i)} className={cx('py-0.5 text-left', i === step ? 'font-semibold text-ink' : i < step ? 'text-ink-2' : 'text-ink-3 hover:text-ink-2')}>{s.text}</button>
          </li>
        ))}
      </ol>
      <div className="flex items-center justify-between gap-2">
        <button type="button" disabled={!step} onClick={() => onStep(step - 1)} className="rounded-md border border-line-2 px-3.5 py-1 text-sm font-medium disabled:opacity-40">Back</button>
        <span className="text-xs tabular-nums text-ink-3">{step + 1} / {flow.steps.length}</span>
        <button type="button" disabled={step >= flow.steps.length - 1} onClick={() => onStep(step + 1)} className="rounded-md border border-line-2 px-3.5 py-1 text-sm font-medium disabled:opacity-40">Next</button>
      </div>
    </>
  );
}

function NodePanel({ x, model, onGo }: { x: GNode; model: Model; onGo: (id: string) => void }) {
  const links = model.edges.filter(([a, b]) => a === x.id || b === x.id).map(([a, b]) => (a === x.id ? b : a));
  const cmd = x.kind === 'command' ? model.ag.commands.find((c) => c.id === x.id) : undefined;
  return (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">{KIND[x.kind]}</p>
      <h3 className={cx('mb-2 mt-0.5 text-base font-semibold', x.kind === 'command' && 'font-mono')}>{x.label || x.name}</h3>
      <div className="space-y-2 text-ink-2">
        {x.kind === 'entry' && x.e && (
          <>
            {x.e.what && <p>{x.e.what}</p>}
            {x.e.example && <CopyButton text={x.e.example} />}
            {x.e.via && <p className="text-xs text-ink-3">via {x.e.via}</p>}
          </>
        )}
        {x.kind === 'command' && (
          <>
            <p>{x.description}</p>
            {cmd?.args && <CopyButton text={`${cmd.name} ${cmd.args}`} />}
          </>
        )}
        {x.kind === 'agent' && (<><p>{x.description}</p><p><span className="font-medium text-ink">Allowed tools</span> {x.tools || 'all'}</p></>)}
        {x.kind === 'tool' && (
          <>
            <p>{model.ag.tools.find((t) => t.id === x.id)?.kind}{x.source && <> · configured in <code className="font-mono text-[12px]">{x.source}</code></>}</p>
            {!x.used && <p className="rounded-md border border-line-2 bg-sunk px-3 py-2 text-xs">Installed, but no command file uses it yet.</p>}
          </>
        )}
        {x.kind === 'hook' && (<><p><span className="font-medium text-ink">{x.event}</span>{x.matcher && ` on ${x.matcher}`}</p><p>{x.description}</p></>)}
        {(x.kind === 'skill' || x.kind === 'rule') && x.description && x.description !== '---' && <p>{x.description}</p>}
        {x.path && <p className="break-all font-mono text-[11.5px] text-ink-3">{x.path}</p>}
      </div>
      {links.length ? (
        <>
          <p className="mb-1.5 mt-3 font-medium">Connected to</p>
          <div className="flex flex-col gap-1">
            {links.map((id) => {
              const n = model.all[id];
              return (
                <button key={id} type="button" onClick={() => onGo(id)} style={kc(n?.kind || 'file')}
                  className={cx('truncate rounded-md border border-l-4 border-line border-l-[var(--k)] bg-paper px-2 py-1 text-left text-[12.5px] hover:border-[var(--k)]', n?.kind === 'command' && 'font-mono')}>
                  {n?.label || n?.name || id}
                </button>
              );
            })}
          </div>
        </>
      ) : <p className="mt-3 text-xs text-ink-3">Nothing connects to it in the command files.</p>}
    </>
  );
}
