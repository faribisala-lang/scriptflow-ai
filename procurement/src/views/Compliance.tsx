import { useMemo, useState } from 'react';
import { go } from '../App';
import { Card, Empty, Pill, StageBadge, Stat } from '../components/ui';
import { downloadCsv, naira, nairaShort } from '../format';
import { computeMetrics } from '../metrics';
import { controllingValue } from '../policy';
import { useStore } from '../store';

const CODE_LABEL: Record<string, string> = {
  MAVERICK: 'Maverick / retrospective',
  SPLIT: 'Possible split purchase',
  QUOTES: 'Insufficient quotes',
  NOT_LOWEST: 'Not lowest compliant bid',
  MATCH: '3-way match failure',
  PRICE_VAR: 'Price above last paid',
  OVER_BUDGET: 'Award above estimate',
  EMERGENCY: 'Emergency route',
  SOLE: 'Sole source',
  QUALITY: 'Quality reservation',
  LATE: 'Late delivery',
  SLA: 'SLA breach',
};

export default function Compliance() {
  const { db } = useStore();
  const m = useMemo(() => computeMetrics(db), [db]);
  const [code, setCode] = useState<string>('all');
  const rows = db.requisitions.flatMap((r) => (m.flagsByReq.get(r.id) ?? []).map((f) => ({ r, f })));
  const byCode = Object.entries(
    rows.reduce<Record<string, { n: number; value: number }>>((acc, { r, f }) => {
      acc[f.code] ??= { n: 0, value: 0 };
      acc[f.code].n++;
      acc[f.code].value += controllingValue(r);
      return acc;
    }, {}),
  ).sort((a, b) => b[1].value - a[1].value);
  const shown = rows.filter((x) => code === 'all' || x.f.code === code);
  const high = rows.filter((x) => x.f.severity === 'high');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">Compliance & exceptions register</h1>
          <p className="text-sm text-ink-500">Every deviation is detected automatically and logged. Review monthly at management meeting.</p>
        </div>
        <button
          className="rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm"
          onClick={() => downloadCsv('exceptions.csv', [['PR', 'Title', 'Department', 'Severity', 'Code', 'Detail', 'Value'], ...rows.map(({ r, f }) => [r.number, r.title, r.department, f.severity, f.code, f.message, controllingValue(r)])])}
        >
          Export CSV
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Compliance rate" value={`${m.compliancePct.toFixed(0)}%`} tone={m.compliancePct >= 90 ? 'good' : 'bad'} sub="Target 95%+" />
        <Stat label="High-severity flags" value={high.length} tone={high.length ? 'bad' : 'good'} />
        <Stat label="Exception spend" value={`${m.exceptionSpendPct.toFixed(0)}%`} tone={m.exceptionSpendPct <= 5 ? 'good' : 'bad'} sub="Target under 5%" />
        <Stat label="Quote coverage" value={`${m.quoteCoverage.toFixed(0)}%`} tone={m.quoteCoverage >= 95 ? 'good' : 'bad'} />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="By exception type">
          <div className="space-y-1">
            <button onClick={() => setCode('all')} className={`flex w-full justify-between rounded px-2 py-1.5 text-sm ${code === 'all' ? 'bg-brand-50 font-semibold' : 'hover:bg-slate-50'}`}>
              <span>All</span>
              <span>{rows.length}</span>
            </button>
            {byCode.map(([c, v]) => (
              <button
                key={c}
                onClick={() => setCode(c)}
                className={`flex w-full justify-between rounded px-2 py-1.5 text-left text-sm ${code === c ? 'bg-brand-50 font-semibold' : 'hover:bg-slate-50'}`}
              >
                <span>{CODE_LABEL[c] ?? c}</span>
                <span className="text-ink-500">
                  {v.n} · {nairaShort(v.value)}
                </span>
              </button>
            ))}
          </div>
        </Card>
        <Card title={`Register (${shown.length})`} className="lg:col-span-2">
          {shown.length === 0 ? (
            <Empty>No exceptions. That is the goal.</Empty>
          ) : (
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="border-b border-slate-100">
                  <tr>
                    <th className="th">Sev.</th>
                    <th className="th">PR</th>
                    <th className="th">Finding</th>
                    <th className="th text-right">Value</th>
                    <th className="th">Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map(({ r, f }, i) => (
                    <tr key={i} className="cursor-pointer border-b border-slate-50 hover:bg-brand-50" onClick={() => go('req', r.id)}>
                      <td className="td">
                        <Pill tone={f.severity === 'high' ? 'red' : f.severity === 'medium' ? 'amber' : 'slate'}>{f.severity}</Pill>
                      </td>
                      <td className="td">
                        <div className="font-mono text-xs">{r.number}</div>
                        <div className="text-xs text-ink-500">{r.department}</div>
                      </td>
                      <td className="td">{f.message}</td>
                      <td className="td text-right">{naira(controllingValue(r))}</td>
                      <td className="td">
                        <StageBadge stage={r.stage} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
