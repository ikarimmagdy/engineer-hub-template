import { Link, Navigate, useParams } from 'react-router';
import { SEVERITIES, useAllFindings, useHub } from '../lib/data';
import { FindingsTable } from './WorkItem';
import { cx, ErrorNote, Meter, PageHeader, Panel, SEV_LABEL, SEV_TONE, Skeleton, StatusText, TabBar } from '../components/ui';

export function Quality() {
  const { view } = useParams();
  if (!view) return <Navigate to="/quality/findings" replace />;
  return (
    <div>
      <PageHeader title="Quality" lede="Open findings from every code review and test health across all work, in one place." />
      <TabBar label="Quality" className="mb-6" tabs={[{ to: '/quality/findings', label: 'Findings' }, { to: '/quality/tests', label: 'Test health' }]} />
      {view === 'tests' ? <TestHealth /> : <AllFindings />}
    </div>
  );
}

function AllFindings() {
  const { loop } = useHub();
  const { data, loading, error } = useAllFindings();
  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-lg border border-line bg-paper">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-sunk text-xs text-ink-2">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-semibold">Work</th>
              {SEVERITIES.map((s) => <th key={s} scope="col" className="px-3 py-2 text-right font-semibold"><StatusText tone={SEV_TONE[s]}>{SEV_LABEL[s]}</StatusText></th>)}
              <th scope="col" className="px-3 py-2 text-right font-semibold">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loop.specs.filter((s) => s.findings).map((s) => (
              <tr key={s.key}>
                <td className="px-3 py-2"><Link to={`/quality/findings?spec=${s.key}`} className="hover:underline"><span className="mr-2 font-mono text-[11.5px] text-ink-3">{s.key}</span>{s.title}</Link></td>
                {SEVERITIES.map((v) => {
                  const n = s.findings!.bySeverity[v] || 0;
                  return <td key={v} className={cx('px-3 py-2 text-right tabular-nums', !n && 'text-ink-3', v === 'critical' && n > 0 && 'font-semibold text-sev-critical')}>
                    {n ? <Link to={`/quality/findings?spec=${s.key}&severity=${v}`} className="hover:underline">{n}</Link> : 0}
                  </td>;
                })}
                <td className="px-3 py-2 text-right font-medium tabular-nums">{s.findings!.open}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loading ? <Skeleton lines={8} /> : error ? <ErrorNote>Could not load findings.</ErrorNote> : <FindingsTable findings={data!} showSpec />}
    </div>
  );
}

function TestHealth() {
  const { loop } = useHub();
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {loop.specs.map((s) => (
        <Panel key={s.key} title={<Link to={`/work/${s.key}/tests`} className="hover:underline"><span className="mr-2 font-mono text-[11.5px] font-normal text-ink-3">{s.key}</span>{s.title}</Link>}>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-semibold tabular-nums">{s.criteria_passing}<span className="text-sm font-normal text-ink-3"> / {s.criteria} passing</span></span>
            <span className="text-xs text-ink-3">{s.criteria_tested} with a test</span>
          </div>
          <div className="mt-2"><Meter value={s.criteria_passing} total={s.criteria} /></div>
        </Panel>
      ))}
    </div>
  );
}
