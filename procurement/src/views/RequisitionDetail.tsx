import { useState } from 'react';
import { go } from '../App';
import { Button, Card, Field, FlagList, Modal, Pill, StageBadge } from '../components/ui';
import { date, dateTime, naira } from '../format';
import {
  advanceDue,
  approvalChain,
  canAct,
  complianceFlags,
  controllingValue,
  estimateTotal,
  lastPurchasePrice,
  lowestCompliantQuote,
  nextApprover,
  quoteTotal,
  requiredQuotes,
  STAGE_OWNER,
  sum,
  threeWayMatch,
  tierFor,
  vendorCanTrade,
} from '../policy';
import { useStore } from '../store';
import { PIPELINE, ROLE_LABEL, type Requisition } from '../types';
import {
  addQuote,
  awardDecision,
  cancelRequisition,
  lineDecision,
  payAdvance,
  rateVendor,
  recommendAward,
  recordInvoice,
  recordPayment,
  recordReceipt,
  removeQuote,
} from '../workflow';
import PurchaseOrderDoc from './PurchaseOrderDoc';

export default function RequisitionDetail({ id }: { id: string }) {
  const { db, user } = useStore();
  const [showPo, setShowPo] = useState(false);
  const r = db.requisitions.find((x) => x.id === id);
  if (!r) return <Card>Requisition not found.</Card>;

  const flags = complianceFlags(db, r);
  const tier = tierFor(db.policy, controllingValue(r));
  const userName = (uid?: string) => db.users.find((u) => u.id === uid)?.name ?? '—';
  const vendor = r.po ? db.vendors.find((v) => v.id === r.po!.vendorId) : undefined;
  const actionable = canAct(r, user);
  const pipeIdx = PIPELINE.indexOf(r.stage === 'match_exception' ? 'received' : r.stage);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <a href="#/requisitions" className="text-xs text-brand-600 hover:underline">
            ← Requisitions
          </a>
          <h1 className="mt-1 text-2xl font-bold text-navy-800">{r.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-500">
            <span className="font-mono">{r.number}</span>·<span>{r.department}</span>·<span>{userName(r.requesterId)}</span>·
            <StageBadge stage={r.stage} />
            {r.route !== 'standard' && <Pill tone="red">{r.route.replace('_', ' ').toUpperCase()}</Pill>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {r.po && (
            <Button variant="secondary" onClick={() => setShowPo(true)}>
              View PO {r.po.number}
            </Button>
          )}
          {r.stage === 'draft' && r.requesterId === user.id && <Button onClick={() => go('new', r.id)}>Edit draft</Button>}
          <CancelButton r={r} />
        </div>
      </div>

      {!['rejected', 'cancelled'].includes(r.stage) && (
        <ol className="flex overflow-x-auto rounded-xl border border-slate-200 bg-white text-xs">
          {PIPELINE.map((s, i) => (
            <li
              key={s}
              className={`flex-1 whitespace-nowrap border-r border-slate-100 px-3 py-2 text-center last:border-0 ${
                i < pipeIdx ? 'bg-brand-50 text-brand-700' : i === pipeIdx ? 'bg-navy-800 font-semibold text-white' : 'text-ink-500'
              }`}
            >
              {i + 1}. {s === 'draft' ? 'Requisition' : s.replace('_', ' ')}
            </li>
          ))}
        </ol>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {actionable ? (
            <ActionPanel r={r} />
          ) : (
            !['closed', 'rejected', 'cancelled'].includes(r.stage) && (
              <div className="rounded-xl border border-brand-100 bg-brand-50 px-5 py-3 text-sm text-navy-800">
                Waiting on <strong>{r.stage === 'award_approval' ? ROLE_LABEL[nextApprover(r)!] : STAGE_OWNER[r.stage]}</strong>. Switch user in the sidebar to
                act as that role.
              </div>
            )
          )}

          <Card title="Line items">
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="th">Item</th>
                    <th className="th text-right">Qty</th>
                    <th className="th text-right">Est. unit</th>
                    {r.po && <th className="th text-right">PO unit</th>}
                    {r.po && <th className="th text-right">Last paid</th>}
                    {r.receipt && <th className="th text-right">Accepted</th>}
                  </tr>
                </thead>
                <tbody>
                  {r.items.map((it, i) => {
                    const last = r.po ? lastPurchasePrice(db, r, i) : null;
                    return (
                      <tr key={i} className="border-b border-slate-50">
                        <td className="td">{it.description}</td>
                        <td className="td text-right">
                          {it.qty} {it.unit}
                        </td>
                        <td className="td text-right">{naira(it.estUnitPrice)}</td>
                        {r.po && <td className="td text-right font-medium">{naira(r.po.unitPrices[i])}</td>}
                        {r.po && (
                          <td className={`td text-right ${last && r.po.unitPrices[i] > last * 1.1 ? 'font-semibold text-red-600' : ''}`}>
                            {last ? naira(last) : '—'}
                          </td>
                        )}
                        {r.receipt && <td className="td text-right">{r.receipt.acceptedQty[i]}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-right text-sm">
              Estimate <strong>{naira(estimateTotal(r))}</strong>
              {r.po && (
                <>
                  {' '}
                  · PO <strong>{naira(r.po.total)}</strong> incl. VAT
                </>
              )}
            </div>
          </Card>

          {r.quotes.length > 0 && <QuotesTable r={r} />}

          <Card title="Audit trail">
            <ol className="relative space-y-3 border-l border-slate-200 pl-5">
              {[...r.history].reverse().map((h, i) => (
                <li key={i} className="text-sm">
                  <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-brand-500" />
                  <div className="font-medium">{h.action}</div>
                  {h.note && <div className="text-ink-700">{h.note}</div>}
                  <div className="text-xs text-ink-500">
                    {userName(h.userId)} · {dateTime(h.at)}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Compliance check">
            <FlagList flags={flags} />
          </Card>
          <Card title="Controls">
            <dl className="space-y-2 text-sm">
              <Row k="Value tier" v={tier?.name ?? 'Petty cash'} />
              <Row k="Min. quotes" v={String(requiredQuotes(db.policy, r))} />
              <Row k="Budget line" v={r.budgetLine} />
              <Row k="Needed by" v={date(r.neededBy)} />
              <Row k="Line approval" v={r.lineApproval ? `${userName(r.lineApproval.userId)} (${r.lineApproval.decision})` : 'Pending'} />
              <Row
                k="Award chain"
                v={(r.requiredApprovers.length ? r.requiredApprovers : approvalChain(db.policy, r)).map((x) => ROLE_LABEL[x]).join(' → ')}
              />
              {r.approvals.map((a, i) => (
                <Row key={i} k={`  ${ROLE_LABEL[a.role]}`} v={`${a.decision} · ${date(a.at)}`} />
              ))}
              {r.po && <Row k="Delivery due" v={date(r.po.deliveryDue)} />}
              {r.po && r.po.advancePct > 0 && <Row k="Advance" v={`${r.po.advancePct}% ${advanceDue(r) ? '(unpaid)' : '(paid)'}`} />}
              {r.receipt && <Row k={r.receipt.kind} v={`${r.receipt.number} · ${userName(r.receipt.recordedBy)}`} />}
              {r.invoice && <Row k="Invoice" v={`${r.invoice.number} · ${r.invoice.matched ? 'matched' : 'MISMATCH'} (${r.invoice.matchVariancePct.toFixed(1)}%)`} />}
              {r.paymentDue && <Row k="Payment due" v={date(r.paymentDue)} />}
              {r.payments.map((p, i) => (
                <Row key={i} k={`Paid (${p.kind})`} v={`${naira(p.amount)} · ${p.reference}`} />
              ))}
            </dl>
          </Card>
          {r.route !== 'standard' && (
            <Card title="Exception justification">
              <p className="text-sm">{r.routeJustification}</p>
            </Card>
          )}
          <Card title="Justification">
            <p className="text-sm">{r.justification}</p>
          </Card>
        </div>
      </div>
      {showPo && r.po && vendor && (
        <Modal title={`Purchase Order ${r.po.number}`} onClose={() => setShowPo(false)} wide>
          <PurchaseOrderDoc r={r} vendor={vendor} />
        </Modal>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="whitespace-pre text-ink-500">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}

function CancelButton({ r }: { r: Requisition }) {
  const { user, run } = useStore();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  if (r.po || ['closed', 'rejected', 'cancelled'].includes(r.stage)) return null;
  if (r.requesterId !== user.id && user.role !== 'head_procurement') return null;
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Cancel requisition
      </Button>
      {open && (
        <Modal title="Cancel requisition" onClose={() => setOpen(false)}>
          <Field label="Reason">
            <textarea className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div className="mt-4 flex justify-end">
            <Button variant="danger" onClick={() => run((d, u) => cancelRequisition(d, u, r.id, reason), 'Requisition cancelled') && setOpen(false)}>
              Confirm cancel
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

function QuotesTable({ r }: { r: Requisition }) {
  const { db, user, run } = useStore();
  const low = lowestCompliantQuote(r);
  const vname = (id: string) => db.vendors.find((v) => v.id === id)?.name ?? id;
  return (
    <Card title={`Comparative bid analysis (${r.quotes.length} quote${r.quotes.length > 1 ? 's' : ''})`}>
      <div className="-mx-5 overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="th">Vendor</th>
              {r.items.map((it, i) => (
                <th key={i} className="th text-right" title={it.description}>
                  {it.description.length > 18 ? it.description.slice(0, 18) + '…' : it.description}
                </th>
              ))}
              <th className="th text-right">Total</th>
              <th className="th text-right">vs lowest</th>
              <th className="th">Delivery / terms</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody>
            {r.quotes.map((q) => {
              const t = quoteTotal(r, q);
              const prem = low ? ((t - quoteTotal(r, low)) / quoteTotal(r, low)) * 100 : 0;
              const awarded = q.id === r.awardQuoteId;
              return (
                <tr key={q.id} className={`border-b border-slate-50 ${awarded ? 'bg-emerald-50' : ''}`}>
                  <td className="td">
                    <div className="font-medium">{vname(q.vendorId)}</div>
                    <div className="text-xs text-ink-500">
                      {q.reference}
                      {!q.technicallyCompliant && <span className="ml-1 font-semibold text-red-600">Non-compliant</span>}
                      {awarded && <span className="ml-1 font-semibold text-emerald-700">Awarded</span>}
                    </div>
                  </td>
                  {q.unitPrices.map((p, i) => (
                    <td key={i} className="td text-right">
                      {naira(p)}
                    </td>
                  ))}
                  <td className="td text-right font-semibold">{naira(t)}</td>
                  <td className="td text-right">
                    {q.id === low?.id ? <Pill tone="green">Lowest</Pill> : q.technicallyCompliant ? `+${prem.toFixed(1)}%` : '—'}
                  </td>
                  <td className="td text-xs">
                    {q.deliveryDays}d · {q.paymentTermsDays}d terms
                  </td>
                  <td className="td">
                    {r.stage === 'sourcing' && user.role === 'procurement_officer' && (
                      <button className="text-xs text-red-600 hover:underline" onClick={() => run((d, u) => removeQuote(d, u, r.id, q.id), 'Quote withdrawn')}>
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {r.awardJustification && (
        <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm">
          <strong>Award justification:</strong> {r.awardJustification}
        </p>
      )}
    </Card>
  );
}

function ActionPanel({ r }: { r: Requisition }) {
  const { user } = useStore();
  let body;
  switch (r.stage) {
    case 'draft':
      body = (
        <p className="text-sm">
          This requisition is in draft or was returned to you. Use <strong>Edit draft</strong> to update and resubmit.
          {r.lineApproval?.comment && <span className="mt-2 block rounded bg-amber-50 p-2">Reviewer: {r.lineApproval.comment}</span>}
        </p>
      );
      break;
    case 'line_approval':
      body = <Decision r={r} kind="line" />;
      break;
    case 'sourcing':
      body = <Sourcing r={r} />;
      break;
    case 'award_approval':
      body = <Decision r={r} kind="award" />;
      break;
    case 'po_issued':
      body = (
        <div className="space-y-5">
          {user.role === 'finance' && advanceDue(r) && <AdvancePayment r={r} />}
          {user.role !== 'finance' && <ReceiptForm r={r} />}
        </div>
      );
      break;
    case 'received':
    case 'match_exception':
      body = <InvoiceForm r={r} />;
      break;
    case 'payment_scheduled':
      body = <PaymentForm r={r} />;
      break;
    case 'paid':
      body = <RatingForm r={r} />;
      break;
    default:
      body = null;
  }
  return (
    <section className="rounded-xl border-2 border-brand-500 bg-white shadow-sm">
      <header className="flex items-center justify-between bg-brand-500 px-5 py-2 text-sm font-semibold text-white">
        <span>Your action · {ROLE_LABEL[user.role]}</span>
      </header>
      <div className="p-5">{body}</div>
    </section>
  );
}

function Decision({ r, kind }: { r: Requisition; kind: 'line' | 'award' }) {
  const { db, run } = useStore();
  const [comment, setComment] = useState('');
  const act = (d: 'approved' | 'returned' | 'rejected') =>
    run(
      (draft, u) => (kind === 'line' ? lineDecision(draft, u, r.id, d, comment) : awardDecision(draft, u, r.id, d, comment)),
      d === 'approved' ? 'Approved' : d === 'returned' ? 'Returned' : 'Rejected',
    ) && setComment('');
  const award = r.quotes.find((q) => q.id === r.awardQuoteId);
  const vname = award ? db.vendors.find((v) => v.id === award.vendorId)?.name : '';
  return (
    <div className="space-y-3">
      {kind === 'line' ? (
        <p className="text-sm">
          Confirm the <strong>need</strong>, <strong>specification</strong> and that budget line <strong>{r.budgetLine}</strong> can absorb{' '}
          <strong>{naira(estimateTotal(r))}</strong>. You are approving demand, not a vendor.
        </p>
      ) : (
        <p className="text-sm">
          Recommended award: <strong>{vname}</strong> at <strong>{naira(award ? quoteTotal(r, award) : 0)}</strong> excl. VAT
          {r.advancePct > 0 && <> with <strong>{r.advancePct}% advance</strong></>}. Review the bid analysis and compliance flags before approving.
        </p>
      )}
      <textarea className="input" placeholder="Comment (required to return or reject)" value={comment} onChange={(e) => setComment(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => act('approved')}>Approve</Button>
        <Button variant="secondary" onClick={() => act('returned')}>
          Return
        </Button>
        <Button variant="danger" onClick={() => act('rejected')}>
          Reject
        </Button>
      </div>
    </div>
  );
}

function Sourcing({ r }: { r: Requisition }) {
  const { db, run } = useStore();
  const eligible = db.vendors.filter((v) => !r.quotes.some((q) => q.vendorId === v.id));
  const [vendorId, setVendorId] = useState('');
  const [prices, setPrices] = useState<number[]>(r.items.map(() => 0));
  const [deliveryDays, setDeliveryDays] = useState(7);
  const [terms, setTerms] = useState(30);
  const [reference, setReference] = useState('');
  const [compliant, setCompliant] = useState(true);
  const low = lowestCompliantQuote(r);
  const [award, setAward] = useState('');
  const [just, setJust] = useState('');
  const [adv, setAdv] = useState(0);
  const [coi, setCoi] = useState(false);
  const need = requiredQuotes(db.policy, r);
  const have = r.quotes.filter((q) => q.technicallyCompliant).length;
  const chosen = award || low?.id || '';

  const save = () =>
    run(
      (d, u) =>
        addQuote(d, u, r.id, {
          vendorId,
          unitPrices: prices,
          deliveryDays,
          paymentTermsDays: terms,
          validUntil: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
          technicallyCompliant: compliant,
          reference,
        }),
      'Quote recorded',
    ) && (setVendorId(''), setPrices(r.items.map(() => 0)), setReference(''));

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="font-semibold text-navy-800">Record a quotation</h4>
          <Pill tone={have >= need ? 'green' : 'amber'}>
            {have}/{need} compliant quotes
          </Pill>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Vendor (approved register only)">
            <select className="input" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              <option value="">Select…</option>
              {eligible.map((v) => {
                const t = vendorCanTrade(db.policy, v);
                return (
                  <option key={v.id} value={v.id} disabled={!t.ok}>
                    {v.name}
                    {!t.ok ? ` (blocked: ${t.reason})` : ''}
                    {v.id === r.preferredVendorId ? ' ★ requester suggestion' : ''}
                  </option>
                );
              })}
            </select>
          </Field>
          <Field label="Quote reference">
            <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Vendor quote no." />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Delivery (days)">
              <input type="number" className="input" value={deliveryDays} onChange={(e) => setDeliveryDays(Number(e.target.value))} />
            </Field>
            <Field label="Terms (days)">
              <input type="number" className="input" value={terms} onChange={(e) => setTerms(Number(e.target.value))} />
            </Field>
          </div>
          {r.items.map((it, i) => (
            <Field key={i} label={`Unit price: ${it.description.slice(0, 28)}`}>
              <input
                type="number"
                className="input"
                value={prices[i] || ''}
                onChange={(e) => setPrices(prices.map((p, j) => (j === i ? Number(e.target.value) : p)))}
              />
            </Field>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={compliant} onChange={(e) => setCompliant(e.target.checked)} /> Meets the specification (technically compliant)
        </label>
        <div className="mt-3">
          <Button variant="secondary" onClick={save}>
            Add quote
          </Button>
        </div>
      </div>

      {r.quotes.length > 0 && (
        <div className="border-t border-slate-100 pt-5">
          <h4 className="mb-2 font-semibold text-navy-800">Recommend award</h4>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Award to">
              <select className="input" value={chosen} onChange={(e) => setAward(e.target.value)}>
                {r.quotes
                  .filter((q) => q.technicallyCompliant)
                  .map((q) => (
                    <option key={q.id} value={q.id}>
                      {db.vendors.find((v) => v.id === q.vendorId)?.name} · {naira(quoteTotal(r, q))}
                      {q.id === low?.id ? ' (lowest)' : ''}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label={`Advance payment % (max ${db.policy.maxAdvancePct})`} hint="Only where the vendor genuinely needs mobilisation funds.">
              <input type="number" min={0} max={100} className="input" value={adv} onChange={(e) => setAdv(Number(e.target.value))} />
            </Field>
            <div className="md:col-span-2">
              <Field label={chosen && chosen !== low?.id ? 'Justification (mandatory: not the lowest compliant quote)' : 'Evaluation note (optional)'}>
                <textarea className="input" value={just} onChange={(e) => setJust(e.target.value)} />
              </Field>
            </div>
          </div>
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={coi} onChange={(e) => setCoi(e.target.checked)} />
            <span>I declare that I have no personal, family or financial interest in any bidder, and I received no gift or inducement.</span>
          </label>
          <div className="mt-3">
            <Button
              onClick={() =>
                run((d, u) => recommendAward(d, u, r.id, { quoteId: chosen, justification: just, advancePct: adv, coiDeclared: coi }), 'Sent for award approval')
              }
            >
              Submit award for approval
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReceiptForm({ r }: { r: Requisition }) {
  const { run } = useStore();
  const [recv, setRecv] = useState(r.items.map((i) => i.qty));
  const [acc, setAcc] = useState(r.items.map((i) => i.qty));
  const [witness, setWitness] = useState('');
  const [comments, setComments] = useState('');
  const [ok, setOk] = useState(true);
  const goods = r.category === 'goods';
  return (
    <div className="space-y-3">
      <p className="text-sm">
        {goods
          ? 'Record the Goods Received Note. Count and inspect against the PO, with a member of the requesting unit present.'
          : 'Sign the Job Completion Certificate only if the service was delivered to specification.'}
      </p>
      <table className="w-full">
        <thead>
          <tr>
            <th className="th">Item</th>
            <th className="th w-28">Ordered</th>
            <th className="th w-28">{goods ? 'Received' : 'Delivered'}</th>
            <th className="th w-28">Accepted</th>
          </tr>
        </thead>
        <tbody>
          {r.items.map((it, i) => (
            <tr key={i}>
              <td className="td">{it.description}</td>
              <td className="td">{it.qty}</td>
              <td className="td">
                <input type="number" className="input" value={recv[i]} onChange={(e) => setRecv(recv.map((x, j) => (j === i ? Number(e.target.value) : x)))} />
              </td>
              <td className="td">
                <input type="number" className="input" value={acc[i]} onChange={(e) => setAcc(acc.map((x, j) => (j === i ? Number(e.target.value) : x)))} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="grid gap-3 md:grid-cols-2">
        {goods && (
          <Field label="Witness from requesting unit">
            <input className="input" value={witness} onChange={(e) => setWitness(e.target.value)} />
          </Field>
        )}
        <Field label="Inspection comments">
          <input className="input" value={comments} onChange={(e) => setComments(e.target.value)} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> Quality is satisfactory
      </label>
      <Button
        onClick={() =>
          run((d, u) => recordReceipt(d, u, r.id, { receivedQty: recv, acceptedQty: acc, witness, comments, satisfied: ok }), goods ? 'GRN recorded' : 'JCC signed')
        }
      >
        {goods ? 'Record GRN' : 'Sign JCC'}
      </Button>
    </div>
  );
}

function AdvancePayment({ r }: { r: Requisition }) {
  const { run } = useStore();
  const [ref, setRef] = useState('');
  return (
    <div className="space-y-3">
      <p className="text-sm">
        Approved advance: <strong>{r.po!.advancePct}%</strong> = <strong>{naira(r.po!.total * (r.po!.advancePct / 100))}</strong>. Pay only to the
        bank account on the vendor master.
      </p>
      <input className="input" placeholder="Payment / transfer reference" value={ref} onChange={(e) => setRef(e.target.value)} />
      <Button onClick={() => run((d, u) => payAdvance(d, u, r.id, ref), 'Advance paid')}>Release advance</Button>
    </div>
  );
}

function InvoiceForm({ r }: { r: Requisition }) {
  const { db, run } = useStore();
  const [num, setNum] = useState('');
  const [dt, setDt] = useState(new Date().toISOString().slice(0, 10));
  const [sub, setSub] = useState(0);
  const m = threeWayMatch(r, sub, db.policy.matchTolerancePct);
  return (
    <div className="space-y-3">
      {r.stage === 'match_exception' && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          Invoice {r.invoice?.number} failed the 3-way match. Obtain a credit note or corrected invoice from the vendor and record it here. Do not pay the
          difference.
        </p>
      )}
      <p className="text-sm">
        Received value (PO price × accepted qty): <strong>{naira(m.receivedValue)}</strong>. Tolerance{' '}
        {db.policy.matchTolerancePct}%.
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Invoice number">
          <input className="input" value={num} onChange={(e) => setNum(e.target.value)} />
        </Field>
        <Field label="Invoice date">
          <input type="date" className="input" value={dt} onChange={(e) => setDt(e.target.value)} />
        </Field>
        <Field label="Amount excl. VAT (₦)">
          <input type="number" className="input" value={sub || ''} onChange={(e) => setSub(Number(e.target.value))} />
        </Field>
      </div>
      {sub > 0 && (
        <p className={`text-sm font-medium ${m.matched ? 'text-emerald-700' : 'text-red-600'}`}>
          {m.matched ? '✓ Within tolerance' : '✗ Exceeds received value'}: variance {m.variancePct.toFixed(2)}%
        </p>
      )}
      <Button
        onClick={() =>
          run(
            (d, u) => recordInvoice(d, u, r.id, { number: num, date: dt, subtotal: sub, vat: Math.round(sub * (db.policy.vatRate / 100)) }),
            'Invoice processed',
          )
        }
      >
        Record invoice and run 3-way match
      </Button>
    </div>
  );
}

function PaymentForm({ r }: { r: Requisition }) {
  const { db, run } = useStore();
  const [ref, setRef] = useState('');
  const [wht, setWht] = useState(0);
  const v = db.vendors.find((x) => x.id === r.po!.vendorId)!;
  const gross = (r.invoice?.subtotal ?? 0) + (r.invoice?.vat ?? 0);
  const adv = sum(r.payments.filter((p) => p.kind === 'advance').map((p) => p.amount));
  return (
    <div className="space-y-3">
      <p className="text-sm">
        Due <strong>{date(r.paymentDue)}</strong>. Gross {naira(gross)} − advance {naira(adv)} − WHT = <strong>{naira(gross - adv - wht)}</strong> to{' '}
        <strong>
          {v.bank.bankName} {v.bank.accountNumber}
        </strong>{' '}
        ({v.bank.accountName}), the account on the verified vendor master.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="WHT deducted (₦)" hint="Apply the current FIRS/NRS rate for this transaction type.">
          <input type="number" className="input" value={wht || ''} onChange={(e) => setWht(Number(e.target.value))} />
        </Field>
        <Field label="Payment reference">
          <input className="input" value={ref} onChange={(e) => setRef(e.target.value)} />
        </Field>
      </div>
      <Button onClick={() => run((d, u) => recordPayment(d, u, r.id, { reference: ref, wht }), 'Payment recorded')}>Record payment</Button>
    </div>
  );
}

function RatingForm({ r }: { r: Requisition }) {
  const { run } = useStore();
  const [s, setS] = useState({ quality: 4, delivery: 4, price: 4, service: 4 });
  return (
    <div className="space-y-3">
      <p className="text-sm">Rate the vendor to close this requisition. Scores feed the vendor scorecard used in future awards.</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(Object.keys(s) as (keyof typeof s)[]).map((k) => (
          <Field key={k} label={k}>
            <select className="input" value={s[k]} onChange={(e) => setS({ ...s, [k]: Number(e.target.value) })}>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 5 ? '(excellent)' : n === 1 ? '(poor)' : ''}
                </option>
              ))}
            </select>
          </Field>
        ))}
      </div>
      <Button onClick={() => run((d, u) => rateVendor(d, u, r.id, s), 'Requisition closed')}>Submit rating and close</Button>
    </div>
  );
}
