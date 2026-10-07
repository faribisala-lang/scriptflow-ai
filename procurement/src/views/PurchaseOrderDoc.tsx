import { Button } from '../components/ui';
import { date, naira } from '../format';
import { useStore } from '../store';
import { ROLE_LABEL, type Requisition, type Vendor } from '../types';

export default function PurchaseOrderDoc({ r, vendor }: { r: Requisition; vendor: Vendor }) {
  const { db } = useStore();
  const po = r.po!;
  const name = (id: string) => db.users.find((u) => u.id === id)?.name ?? id;
  const approvers = r.approvals.filter((a) => a.decision === 'approved');
  return (
    <div>
      <div className="print-area space-y-5 text-sm" id="po-doc">
        <div className="flex items-start justify-between border-b-4 border-navy-800 pb-4">
          <div>
            <img src="./workforce-logo-dark.webp" alt="Workforce" className="h-7" />
            <div className="mt-2 text-xs text-ink-500">
              The Zone · Zone Tech Park, Plot 9, Gbagada Industrial Scheme, Gbagada–Oworonshoki Expressway, Lagos
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold text-navy-800">PURCHASE ORDER</div>
            <div className="font-mono">{po.number}</div>
            <div>Date: {date(po.issuedAt)}</div>
            <div>Ref: {r.number}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="label">Supplier</div>
            <div className="font-semibold">{vendor.name}</div>
            <div>{vendor.address}</div>
            <div>
              RC {vendor.rcNumber} · TIN {vendor.tin}
            </div>
            <div>
              {vendor.contactName} · {vendor.phone}
            </div>
          </div>
          <div>
            <div className="label">Deliver to / terms</div>
            <div>
              {r.department}, attn. {name(r.requesterId)}
            </div>
            <div>Delivery due: {date(po.deliveryDue)}</div>
            <div>Payment: {po.paymentTermsDays} days after matched invoice</div>
            {po.advancePct > 0 && <div>Advance: {po.advancePct}% on PO acceptance</div>}
          </div>
        </div>
        <table className="w-full border border-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">#</th>
              <th className="th">Description</th>
              <th className="th text-right">Qty</th>
              <th className="th text-right">Unit price</th>
              <th className="th text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {r.items.map((it, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="td">{i + 1}</td>
                <td className="td">{it.description}</td>
                <td className="td text-right">
                  {it.qty} {it.unit}
                </td>
                <td className="td text-right">{naira(po.unitPrices[i])}</td>
                <td className="td text-right">{naira(po.unitPrices[i] * it.qty)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-200">
            <tr>
              <td colSpan={4} className="td text-right">
                Subtotal
              </td>
              <td className="td text-right">{naira(po.subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="td text-right">
                VAT ({db.policy.vatRate}%)
              </td>
              <td className="td text-right">{naira(po.vat)}</td>
            </tr>
            <tr>
              <td colSpan={4} className="td text-right font-bold">
                Total
              </td>
              <td className="td text-right font-bold">{naira(po.total)}</td>
            </tr>
          </tfoot>
        </table>
        <div className="grid grid-cols-2 gap-6 text-xs">
          <div>
            <div className="label">Approved by</div>
            {approvers.map((a, i) => (
              <div key={i}>
                {name(a.userId)} ({ROLE_LABEL[a.role]}) · {date(a.at)}
              </div>
            ))}
          </div>
          <div className="text-ink-500">
            Conditions: quote this PO number on every delivery note and invoice. Invoices without a valid PO, or exceeding the quantity received, will
            not be paid. Payment is made only to the bank account registered on our vendor master. Report any request to change bank details to
            procurement@thezone.ng.
          </div>
        </div>
      </div>
      <div className="no-print mt-5 flex justify-end">
        <Button onClick={() => window.print()}>Print / save as PDF</Button>
      </div>
    </div>
  );
}
