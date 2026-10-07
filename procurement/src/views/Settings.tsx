import { useRef } from 'react';
import { PolicyError } from '../workflow';
import { Button, Card, Field } from '../components/ui';
import { downloadBlob, naira } from '../format';
import { POLICY_V3, POLICY_V4 } from '../policy';
import { useStore } from '../store';
import { ROLE_LABEL, type DB, type PolicyConfig, type Role } from '../types';

const APPROVER_ROLES: Role[] = ['head_procurement', 'finance', 'coo', 'ceo'];

export default function Settings() {
  const { db, user, run, reset, importDb, notify } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const admin = user.role === 'admin' || user.role === 'ceo';
  const p = db.policy;

  const setPolicy = (patch: Partial<PolicyConfig>) =>
    run((d, u) => {
      if (u.role !== 'admin' && u.role !== 'ceo') throw new PolicyError('Only the CEO or System Admin can change policy');
      d.policy = { ...d.policy, ...patch };
    });

  const setTier = (i: number, patch: Partial<PolicyConfig['tiers'][number]>) => setPolicy({ tiers: p.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-navy-800">Policy & settings</h1>
        <p className="text-sm text-ink-500">
          Active policy: <strong>{p.name}</strong>. {admin ? 'You can edit.' : 'Read-only: switch to CEO or System Admin to change.'}
        </p>
      </div>

      <Card
        title="Delegation of authority (value tiers)"
        actions={
          admin && (
            <>
              <Button variant="secondary" onClick={() => setPolicy(structuredClone(POLICY_V3))}>
                Load v3 (current)
              </Button>
              <Button variant="secondary" onClick={() => setPolicy(structuredClone(POLICY_V4))}>
                Load v4 (recommended)
              </Button>
            </>
          )
        }
      >
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="border-b border-slate-100">
              <tr>
                <th className="th">Tier</th>
                <th className="th">From (₦)</th>
                <th className="th">To (₦)</th>
                <th className="th">Min quotes</th>
                <th className="th">Award approvers (after BD line approval)</th>
                <th className="th">Committee</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-50 text-sm text-ink-500">
                <td className="td">Petty cash</td>
                <td className="td">0</td>
                <td className="td">
                  <input
                    type="number"
                    disabled={!admin}
                    className="input w-32"
                    value={p.pettyCashLimit}
                    onChange={(e) => setPolicy({ pettyCashLimit: Number(e.target.value) })}
                  />
                </td>
                <td className="td" colSpan={3}>
                  Outside this system; governed by the Petty Cash procedure with a monthly cap.
                </td>
              </tr>
              {p.tiers.map((t, i) => (
                <tr key={t.id} className="border-b border-slate-50">
                  <td className="td font-medium">{t.name}</td>
                  <td className="td">{naira(t.min)}</td>
                  <td className="td">
                    {t.max === null ? (
                      'and above'
                    ) : (
                      <input type="number" disabled={!admin} className="input w-32" value={t.max} onChange={(e) => {
                        const max = Number(e.target.value);
                        setPolicy({ tiers: p.tiers.map((x, j) => (j === i ? { ...x, max } : j === i + 1 ? { ...x, min: max } : x)) });
                      }} />
                    )}
                  </td>
                  <td className="td">
                    <input type="number" min={1} disabled={!admin} className="input w-20" value={t.minQuotes} onChange={(e) => setTier(i, { minQuotes: Number(e.target.value) })} />
                  </td>
                  <td className="td">
                    <div className="flex flex-wrap gap-3 text-sm">
                      {APPROVER_ROLES.map((r) => (
                        <label key={r} className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            disabled={!admin || r === 'head_procurement'}
                            checked={t.approvers.includes(r)}
                            onChange={(e) => setTier(i, { approvers: e.target.checked ? [...t.approvers, r] : t.approvers.filter((x) => x !== r) })}
                          />
                          {ROLE_LABEL[r].replace('Chief Operating Officer', 'COO').replace('Chief Executive Officer', 'CEO')}
                        </label>
                      ))}
                    </div>
                  </td>
                  <td className="td">
                    <input type="checkbox" disabled={!admin} checked={t.committee} onChange={(e) => setTier(i, { committee: e.target.checked })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-ink-500">
          Exception routes escalate automatically: emergency and sole-source add the COO; retrospective (maverick) adds COO and CEO; any advance payment adds
          Finance.
        </p>
      </Card>

      <Card title="Control parameters">
        <div className="grid gap-4 md:grid-cols-3">
          {(
            [
              ['matchTolerancePct', '3-way match tolerance (%)'],
              ['maxAdvancePct', 'Maximum advance payment (%)'],
              ['splitWindowDays', 'Split-purchase look-back (days)'],
              ['priceVarianceAlertPct', 'Price vs last-paid alert (%)'],
              ['estimateOverrunAlertPct', 'Award vs estimate alert (%)'],
              ['kycValidityMonths', 'KYC re-validation (months)'],
              ['vatRate', 'VAT rate (%)'],
            ] as [keyof PolicyConfig, string][]
          ).map(([k, label]) => (
            <Field key={k} label={label}>
              <input type="number" disabled={!admin} className="input" value={p[k] as number} onChange={(e) => setPolicy({ [k]: Number(e.target.value) })} />
            </Field>
          ))}
        </div>
      </Card>

      <Card title="Users and roles">
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="border-b border-slate-100">
              <tr>
                <th className="th">Name</th>
                <th className="th">Role</th>
                <th className="th">Department</th>
              </tr>
            </thead>
            <tbody>
              {db.users.map((u, i) => (
                <tr key={u.id} className="border-b border-slate-50">
                  {(['name', 'role', 'department'] as const).map((k) => (
                    <td key={k} className="td">
                      {k === 'role' ? (
                        <select
                          disabled={!admin}
                          className="input"
                          value={u.role}
                          onChange={(e) => run((d) => void (d.users[i].role = e.target.value as Role))}
                        >
                          {Object.entries(ROLE_LABEL).map(([r, l]) => (
                            <option key={r} value={r}>
                              {l}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input disabled={!admin} className="input" value={u[k]} onChange={(e) => run((d) => void (d.users[i][k] = e.target.value))} />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {admin && (
          <Button
            variant="ghost"
            className="mt-3"
            onClick={() => run((d) => void d.users.push({ id: 'u' + Date.now(), name: 'New user', role: 'requester', department: 'Operations' }))}
          >
            + Add user
          </Button>
        )}
      </Card>

      <Card title="Data">
        <p className="mb-3 text-sm text-ink-500">
          This pilot stores data in this browser. Back up regularly. For multi-user production, connect the storage adapter in <code>src/store.tsx</code> to a
          shared database (see README).
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => downloadBlob(`procure-backup-${new Date().toISOString().slice(0, 10)}.json`, new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' }))}>
            Download backup
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            Restore backup
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                importDb(JSON.parse(await f.text()) as DB);
              } catch {
                notify('error', 'Could not read that file');
              }
              e.target.value = '';
            }}
          />
          <Button variant="danger" disabled={!admin} onClick={() => confirm('Replace all data with the demo dataset?') && reset()}>
            Reset to demo data
          </Button>
        </div>
      </Card>
    </div>
  );
}
