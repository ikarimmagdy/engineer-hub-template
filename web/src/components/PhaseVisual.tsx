import { useState } from 'react';
import { getText, PHASE_TITLE, useAsync, useHub, type Phase, type Spec } from '../lib/data';
import { HtmlPage, Sectioned } from './Markdown';
import { diagramSections } from '../lib/sections';
import { CopyButton, cx, Empty } from './ui';

/** What a phase's diagrams are: the phase commands write them (specs/README.md, "Diagrams"). */
const WHAT: Record<Phase, string> = {
  intent: 'the idea on one page and its context',
  spec: 'the requirement map, a flow per user journey and the states of each entity',
  design: 'containers, a sequence per contract, the data model, deployment and the chosen patterns',
  build: 'task dependencies and what changes where, with the code map of the repos',
  test: 'coverage by layer and the test path of the main journey',
  deploy: 'deploy order, promotion DEV → UAT → PROD and rollback',
  maintain: 'the runbook flow and the incident timeline',
};

/** A phase as pictures: its newest diagrams file (any version can be opened), and for Build the Floorplan code map. */
export function PhaseVisual({ spec, phase }: { spec: Spec; phase: Phase }) {
  const hub = useHub();
  const d = spec.diagrams?.[phase];
  const [version, setVersion] = useState<string | null>(null);
  const map = phase === 'build' ? (spec.pages || []).find((p) => p.kind === 'code-map') : undefined;
  const cmd = hub.manifest.loopConfig.phases?.find((p) => p.key === phase)?.command.split(/[,\s]+/).find((c) => c.startsWith('/'));
  const v = version || d?.version;
  const file = d && v ? `content/specs/${spec.dir}/diagrams/${phase}/${v}` : null;
  const pics = useAsync(file ? () => getText(file).then(diagramSections) : null, [file]);

  return (
    <div className="space-y-6">
      {d ? (
        <section>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-ink-3">
            <span>{PHASE_TITLE[phase]} diagrams</span>
            {d.versions.length > 1 ? d.versions.map((x) => (
              <button key={x} type="button" onClick={() => setVersion(x)} aria-pressed={x === v}
                className={cx('rounded-md border px-2 py-0.5 font-mono', x === v ? 'border-ink text-ink' : 'border-line-2 hover:border-ink')}>{x.replace(/\.md$/, '')}</button>
            )) : <span className="font-mono">{d.version.replace(/\.md$/, '')}</span>}
          </div>
                    {pics.data?.length ? <Sectioned key={v} intro="" sections={[]} path={file!} param="d" visuals={pics.data} label={`${PHASE_TITLE[phase]} diagrams`} /> : null}
        </section>
      ) : (
        <Empty action={cmd ? <span className="inline-flex items-center gap-2">Run it again from the loop on Overview, or in the terminal: <CopyButton text={`${cmd} ${spec.key}`} /></span> : undefined}>
          No {PHASE_TITLE[phase].toLowerCase()} diagrams yet. {cmd ? <code>{cmd}</code> : 'The phase command'} writes them to <code>outputs/diagrams/{phase}/</code>: {WHAT[phase]}.
        </Empty>
      )}
      {map && (
        <section>
          <div className="mb-2 flex flex-wrap items-baseline gap-2">
            <h3 className="text-sm font-semibold">Code map</h3>
            <span className="text-xs text-ink-3">how the repos talk to each other (Floorplan, {map.version.replace(/\.html$/, '')}); double-click a part to zoom in</span>
          </div>
          <HtmlPage path={map.file} title={`${spec.key} code map`} />
        </section>
      )}
      {phase === 'build' && !map && <p className="text-xs text-ink-3">No code map yet: <code>/build</code> saves a Floorplan of the work item's repos to <code>outputs/floorplan/</code> when a task changes how they talk to each other.</p>}
    </div>
  );
}
