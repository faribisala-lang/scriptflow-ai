import { useState } from 'react';
import { go } from '../App';
import { Button, Card, Field } from '../components/ui';
import { naira } from '../format';
import { estimateTotal, tierFor } from '../policy';
import { useStore } from '../store';
import type { LineItem, Requisition } from '../types';
import { saveRequisition, type RequisitionInput } from '../workflow';

const blankItem = (): LineItem => ({ description: '', qty: 1, unit: 'pcs', estUnitPrice: 0 });

export default function RequisitionForm({ editId }: { editId?: string }) {
  const { db, user, run } = useStore();
  const existing = editId ? db.requisitions.find((r) => r.id === editId) : undefined;
  const [f, setF] = useState<RequisitionInput>(() =>
    existing
      ? {
          title: existing.title,
          category: existing.category,
          neededBy: existing.neededBy,
          budgetLine: existing.budgetLine,
          justification: existing.justification,
          items: structuredClone(existing.items),
          route: existing.route,
          routeJustification: existing.routeJustification,
          preferredVendorId: existing.preferredVendorId,
        }
      : {
          title: '',
          category: 'goods',
          neededBy: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
          budgetLine: '',
          justification: '',
          items: [blankItem()],
          route: 'standard',
        },
  );

  if (user.role !== 'requester' && !existing) {
    return (
      <Card title="New requisition">
        <p className="text-sm">
          Requisitions are raised by the requesting unit. Switch to a Requester in the sidebar. (Procurement cannot raise its own demand: segregation of
          duties.)
        </p>
      </Card>
    );
  }

  const total = estimateTotal(f);
  const tier = tierFor(db.policy, total);
  const set = <K extends keyof RequisitionInput>(k: K, v: RequisitionInput[K]) => setF((x) => ({ ...x, [k]: v }));
  const setItem = (i: number, patch: Partial<LineItem>) => set('items', f.items.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  const submit = (send: boolean) => {
    let id = '';
    const ok = run((d, u) => {
      id = saveRequisition(d, u, f, send, existing?.id);
    }, send ? 'Submitted to your Business Director for line approval' : 'Draft saved');
    if (ok) go('req', id);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-navy-800">{existing ? `Edit ${existing.number}` : 'New purchase requisition'}</h1>
      <Card title="1. What do you need and why?">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Title">
            <input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Laptops for new analysts" />
          </Field>
          <Field label="Category">
            <select className="input" value={f.category} onChange={(e) => set('category', e.target.value as Requisition['category'])}>
              <option value="goods">Goods (GRN on receipt)</option>
              <option value="services">Services (JCC on completion)</option>
              <option value="works">Works (JCC on completion)</option>
            </select>
          </Field>
          <Field label="Budget line" hint="No budget line, no requisition.">
            <input className="input" value={f.budgetLine} onChange={(e) => set('budgetLine', e.target.value)} placeholder="e.g. OPEX-IT-2026" />
          </Field>
          <Field label="Needed by">
            <input type="date" className="input" value={f.neededBy} onChange={(e) => set('neededBy', e.target.value)} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Business justification">
              <textarea className="input min-h-[70px]" value={f.justification} onChange={(e) => set('justification', e.target.value)} />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="2. Specification and estimate">
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr>
                <th className="th">Description / specification</th>
                <th className="th w-24">Qty</th>
                <th className="th w-24">Unit</th>
                <th className="th w-40">Est. unit price (₦)</th>
                <th className="th w-36 text-right">Line total</th>
                <th className="th w-10" />
              </tr>
            </thead>
            <tbody>
              {f.items.map((it, i) => (
                <tr key={i}>
                  <td className="td">
                    <input className="input" value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} />
                  </td>
                  <td className="td">
                    <input type="number" min={0} className="input" value={it.qty} onChange={(e) => setItem(i, { qty: Number(e.target.value) })} />
                  </td>
                  <td className="td">
                    <input className="input" value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value })} />
                  </td>
                  <td className="td">
                    <input
                      type="number"
                      min={0}
                      className="input"
                      value={it.estUnitPrice || ''}
                      onChange={(e) => setItem(i, { estUnitPrice: Number(e.target.value) })}
                    />
                  </td>
                  <td className="td text-right font-medium">{naira(it.qty * it.estUnitPrice)}</td>
                  <td className="td">
                    {f.items.length > 1 && (
                      <button className="text-red-600" onClick={() => set('items', f.items.filter((_, j) => j !== i))} aria-label="Remove line">
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => set('items', [...f.items, blankItem()])}>
            + Add line
          </Button>
          <div className="text-right">
            <div className="text-lg font-bold text-navy-800">{naira(total)}</div>
            <div className="text-xs text-ink-500">
              {tier
                ? `${tier.name}: minimum ${tier.minQuotes} quotes${tier.committee ? ', evaluation committee' : ''}`
                : `Below ₦${db.policy.pettyCashLimit.toLocaleString()}: petty cash`}
            </div>
          </div>
        </div>
      </Card>

      <Card title="3. Route">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Procurement route" hint="Anything other than Standard is logged as an exception and escalated to the COO.">
            <select className="input" value={f.route} onChange={(e) => set('route', e.target.value as Requisition['route'])}>
              <option value="standard">Standard (competitive quotes)</option>
              <option value="emergency">Emergency (business continuity at risk)</option>
              <option value="sole_source">Sole / single source (only one capable supplier)</option>
              <option value="retrospective">Retrospective: already bought (maverick, COO + CEO ratification)</option>
            </select>
          </Field>
          <Field label="Suggested vendor (optional)" hint="Procurement decides; suggestion is not a commitment.">
            <select className="input" value={f.preferredVendorId ?? ''} onChange={(e) => set('preferredVendorId', e.target.value || undefined)}>
              <option value="">None</option>
              {db.vendors
                .filter((v) => v.status === 'approved')
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
            </select>
          </Field>
          {f.route !== 'standard' && (
            <div className="md:col-span-2">
              <Field label="Exception justification (min. 20 characters)">
                <textarea
                  className="input min-h-[70px] border-red-300"
                  value={f.routeJustification ?? ''}
                  onChange={(e) => set('routeJustification', e.target.value)}
                />
              </Field>
            </div>
          )}
        </div>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={() => (existing ? go('req', existing.id) : go('requisitions'))}>
          Cancel
        </Button>
        <Button variant="secondary" onClick={() => submit(false)}>
          Save draft
        </Button>
        <Button onClick={() => submit(true)}>Submit for approval</Button>
      </div>
    </div>
  );
}
