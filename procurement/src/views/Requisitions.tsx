import { useMemo, useState } from 'react';
import { go } from '../App';
import { Button, Card, Empty, FlagList, StageBadge } from '../components/ui';
import { date, downloadCsv, naira } from '../format';
import { complianceFlags, controllingValue, tierFor } from '../policy';
import { useStore } from '../store';
import { STAGE_LABEL, type Stage } from '../types';

export default function Requisitions() {
  const { db, user } = useStore();
  const [q, setQ] = useState('');
  const [stage, setStage] = useState<'all' | 'open' | Stage>('open');
  const [mine, setMine] = useState(user.role === 'requester');

  const rows = useMemo(
    () =>
      db.requisitions
        .filter((r) => (stage === 'all' ? true : stage === 'open' ? !['closed', 'rejected', 'cancelled'].includes(r.stage) : r.stage === stage))
        .filter((r) => !mine || r.requesterId === user.id)
        .filter((r) => !q || `${r.number} ${r.title} ${r.department}`.toLowerCase().includes(q.toLowerCase()))
        .map((r) => ({ r, flags: complianceFlags(db, r), value: controllingValue(r), tier: tierFor(db.policy, controllingValue(r)) })),
    [db, q, stage, mine, user.id],
  );

  const userName = (id: string) => db.users.find((u) => u.id === id)?.name ?? id;
  const vendorName = (id?: string) => db.vendors.find((v) => v.id === id)?.name ?? '';

  const exportCsv = () =>
    downloadCsv('requisitions.csv', [
      ['PR', 'Title', 'Department', 'Requester', 'Category', 'Route', 'Stage', 'Value', 'Tier', 'PO', 'Vendor', 'Flags'],
      ...rows.map(({ r, flags, value, tier }) => [
        r.number,
        r.title,
        r.department,
        userName(r.requesterId),
        r.category,
        r.route,
        STAGE_LABEL[r.stage],
        value,
        tier?.name ?? 'Petty cash',
        r.po?.number ?? '',
        vendorName(r.po?.vendorId),
        flags.map((f) => f.message).join(' | '),
      ]),
    ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-navy-800">Requisitions</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportCsv}>
            Export CSV
          </Button>
          {user.role === 'requester' && <Button onClick={() => go('new')}>+ New requisition</Button>}
        </div>
      </div>
      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <input className="input max-w-xs" placeholder="Search ref, title, department…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input max-w-[240px]" value={stage} onChange={(e) => setStage(e.target.value as typeof stage)}>
            <option value="open">All open</option>
            <option value="all">Everything</option>
            {Object.entries(STAGE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Raised by me
          </label>
        </div>
        {rows.length === 0 ? (
          <Empty>No requisitions match.</Empty>
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead className="border-b border-slate-100">
                <tr>
                  <th className="th">Ref</th>
                  <th className="th">Title</th>
                  <th className="th">Dept</th>
                  <th className="th">Tier</th>
                  <th className="th text-right">Value</th>
                  <th className="th">Stage</th>
                  <th className="th">Raised</th>
                  <th className="th">Compliance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ r, flags, value, tier }) => (
                  <tr key={r.id} onClick={() => go('req', r.id)} className="cursor-pointer border-b border-slate-50 hover:bg-brand-50">
                    <td className="td font-mono text-xs">{r.number}</td>
                    <td className="td">
                      <div className="font-medium">{r.title}</div>
                      {r.route !== 'standard' && <div className="text-xs font-semibold uppercase text-red-600">{r.route.replace('_', ' ')}</div>}
                    </td>
                    <td className="td">{r.department}</td>
                    <td className="td text-xs">{tier?.name ?? 'Petty cash'}</td>
                    <td className="td text-right">{naira(value)}</td>
                    <td className="td">
                      <StageBadge stage={r.stage} />
                    </td>
                    <td className="td text-xs">{date(r.createdAt)}</td>
                    <td className="td">
                      <FlagList compact flags={flags} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
