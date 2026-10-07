import { useMemo } from 'react';
import { go } from '../App';
import { Bar, Card, Empty, FlagList, StageBadge, Stat } from '../components/ui';
import { naira, nairaShort } from '../format';
import { canAct, controllingValue, daysBetween, slaBreached } from '../policy';
import { computeMetrics } from '../metrics';
import { useStore } from '../store';
import { PIPELINE, ROLE_LABEL, STAGE_LABEL } from '../types';

export default function Dashboard() {
  const { db, user } = useStore();
  const m = useMemo(() => computeMetrics(db), [db]);
  const tasks = db.requisitions.filter((r) => canAct(r, user));
  const exec = ['head_procurement', 'finance', 'coo', 'ceo', 'admin'].includes(user.role);
  const maxVendor = m.spendByVendor[0]?.value ?? 0;
  const maxDept = m.spendByDept[0]?.value ?? 0;
  const stageCounts = PIPELINE.slice(1, -1).map((s) => ({ s, n: db.requisitions.filter((r) => r.stage === s).length }));
  const mine = db.requisitions.filter((r) => r.requesterId === user.id && !['closed', 'cancelled'].includes(r.stage));
  const exceptions = db.requisitions.filter((r) => r.stage === 'match_exception').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">Good day, {user.name.split(' ')[0]}</h1>
          <p className="text-sm text-ink-500">
            {ROLE_LABEL[user.role]} · {tasks.length ? `${tasks.length} item(s) need your action` : 'Nothing waiting on you'}
          </p>
        </div>
        {user.role === 'requester' && (
          <button onClick={() => go('new')} className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
            + New requisition
          </button>
        )}
      </div>

      <Card title={`My action queue (${tasks.length})`}>
        {tasks.length === 0 ? (
          <Empty>You are clear. Switch user in the sidebar to walk the workflow as another role.</Empty>
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="border-b border-slate-100">
                <tr>
                  <th className="th">Ref</th>
                  <th className="th">Title</th>
                  <th className="th">Stage</th>
                  <th className="th text-right">Value</th>
                  <th className="th">Waiting</th>
                  <th className="th">Flags</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((r) => (
                  <tr key={r.id} onClick={() => go('req', r.id)} className="cursor-pointer border-b border-slate-50 hover:bg-brand-50">
                    <td className="td font-mono text-xs">{r.number}</td>
                    <td className="td font-medium">{r.title}</td>
                    <td className="td">
                      <StageBadge stage={r.stage} />
                    </td>
                    <td className="td text-right">{naira(controllingValue(r))}</td>
                    <td className={`td ${slaBreached(db.policy, r) ? 'font-semibold text-red-600' : ''}`}>{daysBetween(r.stageEnteredAt).toFixed(0)}d</td>
                    <td className="td">
                      <FlagList compact flags={m.flagsByReq.get(r.id) ?? []} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {user.role === 'requester' && (
        <Card title="My requisitions">
          {mine.length === 0 ? (
            <Empty>You have not raised any requisitions yet.</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {mine.map((r) => (
                <li key={r.id} onClick={() => go('req', r.id)} className="flex cursor-pointer flex-wrap items-center justify-between gap-2 py-2 hover:bg-brand-50">
                  <span className="text-sm">
                    <span className="font-mono text-xs text-ink-500">{r.number}</span> <span className="font-medium">{r.title}</span>
                  </span>
                  <StageBadge stage={r.stage} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {exec && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Committed (POs)" value={nairaShort(m.committed)} sub={`${nairaShort(m.paid)} paid incl. WHT`} />
            <Stat
              label="Savings vs budget"
              value={nairaShort(m.savingsVsEstimate)}
              sub={`${m.savingsPct.toFixed(1)}% of estimate · ${nairaShort(m.savingsVsAvgQuote)} vs avg quote`}
              tone={m.savingsVsEstimate >= 0 ? 'good' : 'bad'}
            />
            <Stat
              label="Process compliance"
              value={`${m.compliancePct.toFixed(0)}%`}
              sub="Requisitions with no high-severity flag"
              tone={m.compliancePct >= 90 ? 'good' : 'bad'}
            />
            <Stat
              label="Exception spend"
              value={`${m.exceptionSpendPct.toFixed(0)}%`}
              sub="Of PO value carrying a high flag (target under 5%)"
              tone={m.exceptionSpendPct <= 5 ? 'good' : 'bad'}
            />
            <Stat label="Cycle time PR → PO" value={m.avgCycleToPO === null ? '—' : `${m.avgCycleToPO.toFixed(1)}d`} sub="Target: 7 days or less" />
            <Stat label="Cycle time PR → Paid" value={m.avgCycleToPay === null ? '—' : `${m.avgCycleToPay.toFixed(0)}d`} />
            <Stat label="Quote coverage" value={`${m.quoteCoverage.toFixed(0)}%`} sub="POs meeting minimum-quote rule" tone={m.quoteCoverage >= 95 ? 'good' : 'bad'} />
            <Stat
              label="SLA breaches"
              value={m.slaBreaches}
              sub={`${m.openCount} open · ${exceptions} invoice exception(s)`}
              tone={m.slaBreaches ? 'bad' : 'good'}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card title="Pipeline">
              <div className="space-y-2">
                {stageCounts.map(({ s, n }) => (
                  <a key={s} href={`#/requisitions`} className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
                    <span className="text-ink-700">{STAGE_LABEL[s]}</span>
                    <span className="font-semibold text-navy-800">{n}</span>
                  </a>
                ))}
              </div>
            </Card>
            <Card title="Committed spend by vendor">
              <div className="space-y-3">
                {m.spendByVendor.map((v) => (
                  <Bar key={v.name} label={v.name} value={v.value} max={maxVendor} display={nairaShort(v.value)} />
                ))}
              </div>
            </Card>
            <Card title="Committed spend by department">
              <div className="space-y-3">
                {m.spendByDept.map((v) => (
                  <Bar key={v.name} label={v.name} value={v.value} max={maxDept} display={nairaShort(v.value)} />
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
