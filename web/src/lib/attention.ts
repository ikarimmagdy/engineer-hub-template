import type { Spec } from './data';

export type AttentionKind = 'gate' | 'blocked' | 'critical' | 'ready' | 'failing';

export interface Attention {
  kind: AttentionKind;
  spec: Spec;
  label: string;
  text: string;
  to: string;
  since?: string;
}

const GATE_FOR: Partial<Record<Spec['phase'], 'intent' | 'spec' | 'design'>> = { intent: 'intent', spec: 'spec', design: 'design' };

/** What a team should act on first, most urgent first. Rules are listed in docs/hub-redesign v1 §9 (decision 3). */
export function attention(specs: Spec[]): Attention[] {
  const out: Attention[] = [];
  for (const s of specs) {
    const gate = GATE_FOR[s.phase];
    if (gate && !s.approved?.[gate]) {
      const since = s.history.find((h) => h.event.startsWith('created'))?.date;
      out.push({ kind: 'gate', spec: s, label: 'Gate', text: `${cap(gate)} waiting for approval`, to: `/work/${s.key}/overview`, since });
    }
    if (s.tasks?.blocked) {
      out.push({ kind: 'blocked', spec: s, label: `${s.tasks.blocked} blocked`, text: `${plural(s.tasks.blocked, 'task')} waiting on someone outside the team`, to: `/work/${s.key}/tasks?status=blocked` });
    }
    const crit = s.findings?.bySeverity?.critical || 0;
    if (crit) {
      out.push({ kind: 'critical', spec: s, label: `${crit} critical`, text: `${crit} critical of ${s.findings!.open} open findings`, to: `/work/${s.key}/findings?severity=critical` });
    }
    if (s.phase === 'deploy' && s.criteria > 0 && s.criteria_passing === s.criteria) {
      out.push({ kind: 'ready', spec: s, label: 'Ready', text: `All ${s.criteria} criteria passing, ready to deploy`, to: `/work/${s.key}/overview` });
    }
  }
  const order: AttentionKind[] = ['gate', 'blocked', 'failing', 'critical', 'ready'];
  return out.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function taskTotal(s: Spec) {
  return Object.values(s.tasks || {}).reduce((a, b) => a + b, 0);
}
