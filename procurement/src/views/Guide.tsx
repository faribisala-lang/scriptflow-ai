import { Card } from '../components/ui';
import { naira } from '../format';
import { useStore } from '../store';
import { ROLE_LABEL } from '../types';

const STEPS: [string, string, string, string][] = [
  ['1', 'Requisition', 'Requester', 'Raised in-system with spec, quantity, estimate, budget line and need-by date. Below the petty-cash limit: petty cash instead.'],
  ['2', 'Line approval', 'Business Director', 'Approves the NEED and BUDGET before anyone sources. Can return or reject with a reason.'],
  ['3', 'Sourcing', 'Procurement Officer', 'RFQ to approved, KYC-current vendors only. Minimum compliant quotes by tier. Comparative bid analysis is generated automatically.'],
  ['4', 'Award recommendation', 'Procurement Officer', 'Lowest compliant quote by default. Any other choice needs written justification. Conflict-of-interest declaration is mandatory.'],
  ['5', 'Award approval', 'Delegation of authority', 'Head of Procurement validates process compliance, then Finance / COO / CEO by value tier. Exceptions escalate.'],
  ['6', 'Purchase Order', 'System', 'PO generated on final approval. No PO, no commitment. No PO, no payment.'],
  ['7', 'Receipt', 'Stores (goods) / Requester (services)', 'GRN witnessed by the requesting unit, or JCC signed by the service owner. Procurement does NOT receive what it bought.'],
  ['8', 'Invoice & 3-way match', 'Finance', 'Invoice vs PO price vs accepted quantity. Outside tolerance: payment blocked, credit note required. Duplicate invoices rejected.'],
  ['9', 'Payment', 'Finance', 'On due date per terms, to the bank account on the verified vendor master only. Advances only if approved on the PO (capped).'],
  ['10', 'Vendor rating & close', 'Requester', 'Quality, delivery, price, service scored; feeds the vendor scorecard and future awards.'],
];

const RACI: [string, string, string, string, string, string, string][] = [
  // activity, Requester, BD, Proc Officer, HoP, Finance, COO/CEO
  ['Define need & spec', 'R', 'A', 'C', '', '', ''],
  ['Budget confirmation', 'C', 'A', '', '', 'C', ''],
  ['Vendor onboarding & KYC', '', '', 'R', 'A', 'C', 'I'],
  ['RFQ, quotes, bid analysis', 'C', '', 'R', 'A', '', ''],
  ['Award approval (by tier)', 'I', 'I', 'R', 'A', 'A', 'A'],
  ['PO issue', 'I', '', 'R', 'A', 'I', ''],
  ['Receipt (GRN / JCC)', 'R', '', 'I', '', 'I', ''],
  ['3-way match & payment', 'I', '', 'C', '', 'R/A', ''],
  ['Bank-detail change', '', '', 'R', 'C', 'A', ''],
  ['Suspend / blacklist vendor', '', '', 'R', 'A (suspend)', 'I', 'A (blacklist)'],
  ['Exception ratification', 'R', 'C', 'C', 'C', 'C', 'A'],
];

const GAPS: [string, string][] = [
  ['The requisition is raised on the Payment Voucher', 'Payment and commitment are fused, so there is no PO and no commitment control. v4 separates PR → PO → GRN/JCC → Invoice → Payment.'],
  ['"Steps might not be followed sequentially" (s.4.2)', 'This sentence licenses non-compliance. v4 is sequential and enforced in software.'],
  ['Business Director approves after vendor selection', 'BD should approve the need and budget first. Otherwise Procurement wastes effort and the BD gets anchored to a vendor.'],
  ['"Approval Matrix" referenced but never defined', 'v4 defines value tiers with named approvers and automatic escalation for exceptions.'],
  ['₦10k / ₦500k thresholds unchanged since 2023', 'After the naira reset these thresholds are tiny, so almost everything goes through full process and people work around it. Re-band to spend profile.'],
  ['Procurement issues the PO, inspects, raises the GRN and requests payment', 'One unit controls end-to-end: a classic segregation-of-duties failure. v4 moves receipt to Stores and the requester.'],
  ['No split-purchase rule', 'Orders split to stay under thresholds go undetected. v4 detects them automatically.'],
  ['No price history', '"Lowest of 3 quotes" can still be a bad price, especially if quotes are collusive. v4 compares every PO to the last price paid.'],
  ['No bank-detail change control', 'Change-of-account fraud is one of the most common payment frauds in Nigeria. v4 freezes payment until Finance verifies by call-back.'],
  ['No limit on advance payments', 'Infographic allows full prepayment for services. v4 caps advances and requires approval.'],
  ['Maverick buying has no consequence', 'v4: retrospective purchases need COO and CEO ratification, are logged on the exceptions register and reported monthly.'],
  ['No KPIs', 'v4 tracks savings, cycle time, compliance %, exception spend, quote coverage, OTIF and SLA breaches.'],
];

export default function Guide() {
  const { db } = useStore();
  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-navy-800 p-6 text-white">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">Procurement SOP v4 · The Zone</div>
        <h1 className="mt-1 text-2xl font-bold">Ten steps. Three golden rules.</h1>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {['No budget, no requisition', 'No PO, no commitment', 'No GRN/JCC and match, no payment'].map((x) => (
            <div key={x} className="rounded-lg bg-white/10 px-4 py-3 font-semibold">
              <span className="mr-2 text-brand-300">●</span>
              {x}
            </div>
          ))}
        </div>
      </div>

      <Card title="End-to-end process (procure-to-pay)">
        <ol className="grid gap-3 md:grid-cols-2">
          {STEPS.map(([n, t, who, d]) => (
            <li key={n} className="flex gap-3 rounded-lg border border-slate-200 p-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">{n}</span>
              <div>
                <div className="font-semibold text-navy-800">
                  {t} <span className="text-xs font-normal text-ink-500">· {who}</span>
                </div>
                <div className="text-sm text-ink-700">{d}</div>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Card title={`Active delegation of authority: ${db.policy.name}`}>
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="border-b border-slate-100">
              <tr>
                <th className="th">Tier</th>
                <th className="th">Value band</th>
                <th className="th">Min. quotes</th>
                <th className="th">Award approvers</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-50">
                <td className="td">Petty cash</td>
                <td className="td">Below {naira(db.policy.pettyCashLimit)}</td>
                <td className="td">n/a</td>
                <td className="td">Petty-cash procedure</td>
              </tr>
              {db.policy.tiers.map((t) => (
                <tr key={t.id} className="border-b border-slate-50">
                  <td className="td font-medium">{t.name}</td>
                  <td className="td">
                    {naira(t.min)} {t.max === null ? 'and above' : `to ${naira(t.max)}`}
                  </td>
                  <td className="td">
                    {t.minQuotes}
                    {t.committee ? ' + evaluation committee' : ''}
                  </td>
                  <td className="td">{t.approvers.map((a) => ROLE_LABEL[a]).join(' → ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="RACI">
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[720px] text-center">
            <thead className="border-b border-slate-100">
              <tr>
                {['Activity', 'Requester', 'Business Dir.', 'Proc. Officer', 'Head of Proc.', 'Finance', 'COO / CEO'].map((h) => (
                  <th key={h} className="th text-center first:text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RACI.map((row) => (
                <tr key={row[0]} className="border-b border-slate-50">
                  {row.map((c, i) => (
                    <td key={i} className={`td ${i === 0 ? 'text-left font-medium' : c.startsWith('A') ? 'font-bold text-navy-800' : 'text-ink-500'}`}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-ink-500">R = Responsible · A = Accountable · C = Consulted · I = Informed</p>
      </Card>

      <Card title="What changed from v3, and why">
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-slate-100">
              <tr>
                <th className="th w-2/5">Gap in v3 / current workflow</th>
                <th className="th">v4 fix</th>
              </tr>
            </thead>
            <tbody>
              {GAPS.map(([g, f]) => (
                <tr key={g} className="border-b border-slate-50">
                  <td className="td font-medium">{g}</td>
                  <td className="td">{f}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
