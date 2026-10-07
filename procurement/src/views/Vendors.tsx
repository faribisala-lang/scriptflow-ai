import { useState } from 'react';
import { Button, Card, Empty, Field, Modal, Pill } from '../components/ui';
import { date, dateTime, downloadCsv, nairaShort } from '../format';
import { sum, vendorCanTrade, vendorKycExpired, vendorScore } from '../policy';
import { useStore } from '../store';
import type { Vendor, VendorStatus } from '../types';
import { createVendor, requestBankChange, setVendorStatus, updateKyc, verifyBankChange, type VendorInput } from '../workflow';

const STATUS_TONE: Record<VendorStatus, 'green' | 'amber' | 'red' | 'slate'> = { approved: 'green', pending: 'amber', suspended: 'red', blacklisted: 'red' };
const KYC_LABEL: Record<keyof Vendor['kyc'], string> = {
  cac: 'CAC certificate *',
  tin: 'TIN evidence *',
  taxClearance: 'Tax clearance certificate *',
  references: 'Two client references',
  financials: 'Audited financials (3 yrs)',
  license: 'Regulatory licence (if required)',
};

export default function Vendors() {
  const { db, user } = useStore();
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const spend = (id: string) => sum(db.requisitions.filter((r) => r.po?.vendorId === id).map((r) => r.po!.total));
  const list = db.vendors.filter((v) => !q || `${v.name} ${v.categories.join(' ')}`.toLowerCase().includes(q.toLowerCase()));
  const open = db.vendors.find((v) => v.id === openId);
  const pendingBank = db.vendors.filter((v) => v.pendingBank).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">Vendor register</h1>
          <p className="text-sm text-ink-500">Only approved vendors with current KYC can quote, receive POs or be paid.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() =>
              downloadCsv('vendors.csv', [
                ['Name', 'Status', 'Categories', 'RC', 'TIN', 'Score', 'Ratings', 'Spend'],
                ...db.vendors.map((v) => [v.name, v.status, v.categories.join('; '), v.rcNumber, v.tin, vendorScore(v).overall.toFixed(2), vendorScore(v).count, spend(v.id)]),
              ])
            }
          >
            Export CSV
          </Button>
          {['procurement_officer', 'head_procurement'].includes(user.role) && <Button onClick={() => setAdding(true)}>+ Onboard vendor</Button>}
        </div>
      </div>
      {pendingBank > 0 && (
        <div className="rounded-lg border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-700">
          {pendingBank} bank-detail change(s) awaiting Finance call-back verification. Payments to these vendors are frozen.
        </div>
      )}
      <Card>
        <input className="input mb-4 max-w-xs" placeholder="Search vendor or category…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead className="border-b border-slate-100">
              <tr>
                <th className="th">Vendor</th>
                <th className="th">Categories</th>
                <th className="th">Status</th>
                <th className="th">Can trade?</th>
                <th className="th text-right">Score /5</th>
                <th className="th text-right">On-time</th>
                <th className="th text-right">Spend</th>
              </tr>
            </thead>
            <tbody>
              {list.map((v) => {
                const s = vendorScore(v);
                const t = vendorCanTrade(db.policy, v);
                return (
                  <tr key={v.id} className="cursor-pointer border-b border-slate-50 hover:bg-brand-50" onClick={() => setOpenId(v.id)}>
                    <td className="td font-medium">{v.name}</td>
                    <td className="td text-xs">{v.categories.join(', ')}</td>
                    <td className="td">
                      <Pill tone={STATUS_TONE[v.status]}>{v.status}</Pill>
                    </td>
                    <td className="td text-xs">{t.ok ? <span className="text-emerald-700">Yes</span> : <span className="text-red-600">{t.reason}</span>}</td>
                    <td className="td text-right">{s.count ? s.overall.toFixed(2) : '—'}</td>
                    <td className="td text-right">{s.count ? `${s.onTimePct.toFixed(0)}%` : '—'}</td>
                    <td className="td text-right">{nairaShort(spend(v.id))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!list.length && <Empty>No vendors match.</Empty>}
      </Card>
      {open && <VendorModal v={open} onClose={() => setOpenId(null)} />}
      {adding && <VendorForm onClose={() => setAdding(false)} />}
    </div>
  );
}

function VendorModal({ v, onClose }: { v: Vendor; onClose: () => void }) {
  const { db, user, run } = useStore();
  const [kyc, setKyc] = useState(v.kyc);
  const [reason, setReason] = useState('');
  const [bank, setBank] = useState({ bankName: '', accountName: v.name, accountNumber: '' });
  const [callback, setCallback] = useState('');
  const s = vendorScore(v);
  const name = (id?: string) => db.users.find((u) => u.id === id)?.name ?? '—';
  const proc = ['procurement_officer', 'head_procurement'].includes(user.role);
  const status = (st: VendorStatus) => run((d, u) => setVendorStatus(d, u, v.id, st, reason), `Vendor ${st}`);

  return (
    <Modal title={v.name} onClose={onClose} wide>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-1 text-sm">
          <div>
            <Pill tone={STATUS_TONE[v.status]}>{v.status}</Pill> {v.statusReason && <span className="text-ink-500">· {v.statusReason}</span>}
          </div>
          <div>
            RC {v.rcNumber || '—'} · TIN {v.tin} · VAT {v.vatNo || '—'}
          </div>
          <div>
            {v.contactName} · {v.email} · {v.phone}
          </div>
          <div>{v.address}</div>
          <div>
            Bank: {v.bank.bankName} {v.bank.accountNumber} ({v.bank.accountName})
          </div>
          <div className="text-ink-500">
            Onboarded by {name(v.recommendedBy)} · approved by {name(v.approvedBy)} · KYC reviewed {date(v.kycReviewedAt)}
            {vendorKycExpired(db.policy, v) && <span className="font-semibold text-red-600"> (expired)</span>}
          </div>
          <div className="pt-2">
            Scorecard: <strong>{s.count ? s.overall.toFixed(2) : '—'}</strong>/5 from {s.count} job(s), {s.count ? s.onTimePct.toFixed(0) : '—'}% on time
          </div>
        </div>
        <div>
          <div className="label">KYC documents</div>
          <div className="space-y-1">
            {(Object.keys(KYC_LABEL) as (keyof Vendor['kyc'])[]).map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input type="checkbox" disabled={!proc} checked={kyc[k]} onChange={(e) => setKyc({ ...kyc, [k]: e.target.checked })} />
                {KYC_LABEL[k]}
              </label>
            ))}
          </div>
          {proc && (
            <Button variant="secondary" className="mt-2" onClick={() => run((d, u) => updateKyc(d, u, v.id, kyc), 'KYC review recorded')}>
              Record KYC review
            </Button>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-5 border-t border-slate-100 pt-5 md:grid-cols-2">
        <div>
          <div className="label">Status decision</div>
          <textarea className="input" placeholder="Reason (required for suspend / blacklist)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button onClick={() => status('approved')}>Approve</Button>
            <Button variant="secondary" onClick={() => status('suspended')}>
              Suspend
            </Button>
            <Button variant="danger" onClick={() => status('blacklisted')}>
              Blacklist (COO)
            </Button>
          </div>
        </div>
        <div>
          <div className="label">Bank-detail change (fraud control)</div>
          {v.pendingBank ? (
            <div className="space-y-2 text-sm">
              <p className="rounded bg-red-50 p-2 text-red-700">
                Pending: {v.pendingBank.bankName} {v.pendingBank.accountNumber}, requested by {name(v.pendingBank.requestedBy)}. Verify by calling the vendor on
                the number already on file, never one supplied with the request.
              </p>
              <input className="input" placeholder="Call-back note: who, which number, when" value={callback} onChange={(e) => setCallback(e.target.value)} />
              <div className="flex gap-2">
                <Button onClick={() => run((d, u) => verifyBankChange(d, u, v.id, true, callback), 'Bank change applied')}>Verify and apply</Button>
                <Button variant="danger" onClick={() => run((d, u) => verifyBankChange(d, u, v.id, false, callback || 'Rejected'), 'Bank change rejected')}>
                  Reject
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <input className="input" placeholder="Bank" value={bank.bankName} onChange={(e) => setBank({ ...bank, bankName: e.target.value })} />
              <input className="input" placeholder="NUBAN (10 digits)" value={bank.accountNumber} onChange={(e) => setBank({ ...bank, accountNumber: e.target.value })} />
              <input className="input col-span-2" placeholder="Account name" value={bank.accountName} onChange={(e) => setBank({ ...bank, accountName: e.target.value })} />
              <Button variant="secondary" className="col-span-2" onClick={() => run((d, u) => requestBankChange(d, u, v.id, bank), 'Change logged; payments frozen')}>
                Log change request
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <div className="label">History</div>
        <ul className="space-y-1 text-sm">
          {[...v.history].reverse().map((h, i) => (
            <li key={i}>
              <span className="text-ink-500">{dateTime(h.at)}</span> · {h.action} {h.note && <span className="text-ink-500">· {h.note}</span>} ·{' '}
              <span className="text-ink-500">{name(h.userId)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}

function VendorForm({ onClose }: { onClose: () => void }) {
  const { run } = useStore();
  const [f, setF] = useState<VendorInput>({
    name: '',
    rcNumber: '',
    tin: '',
    vatNo: '',
    businessType: 'company',
    categories: [],
    contactName: '',
    email: '',
    phone: '',
    address: '',
    bank: { bankName: '', accountName: '', accountNumber: '' },
    kyc: { cac: false, tin: false, taxClearance: false, references: false, financials: false, license: false },
  });
  const [cats, setCats] = useState('');
  const text = (k: 'name' | 'rcNumber' | 'tin' | 'vatNo' | 'contactName' | 'email' | 'phone' | 'address', label: string) => (
    <Field label={label}>
      <input className="input" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </Field>
  );
  return (
    <Modal title="Onboard vendor (prequalification)" onClose={onClose} wide>
      <div className="grid gap-3 md:grid-cols-3">
        {text('name', 'Business name')}
        <Field label="Business type">
          <select className="input" value={f.businessType} onChange={(e) => setF({ ...f, businessType: e.target.value as VendorInput['businessType'] })}>
            <option value="company">Company (RC)</option>
            <option value="enterprise">Enterprise (BN)</option>
            <option value="individual">Individual</option>
          </select>
        </Field>
        {text('rcNumber', 'RC / BN number')}
        {text('tin', 'TIN')}
        {text('vatNo', 'VAT number')}
        <Field label="Categories (comma separated)">
          <input className="input" value={cats} onChange={(e) => setCats(e.target.value)} />
        </Field>
        {text('contactName', 'Contact name & title')}
        {text('email', 'Email')}
        {text('phone', 'Phone')}
        <div className="md:col-span-3">{text('address', 'Business address')}</div>
        <Field label="Bank">
          <input className="input" value={f.bank.bankName} onChange={(e) => setF({ ...f, bank: { ...f.bank, bankName: e.target.value } })} />
        </Field>
        <Field label="Account name">
          <input className="input" value={f.bank.accountName} onChange={(e) => setF({ ...f, bank: { ...f.bank, accountName: e.target.value } })} />
        </Field>
        <Field label="NUBAN">
          <input className="input" value={f.bank.accountNumber} onChange={(e) => setF({ ...f, bank: { ...f.bank, accountNumber: e.target.value } })} />
        </Field>
      </div>
      <div className="mt-4">
        <div className="label">KYC documents received</div>
        <div className="grid gap-1 md:grid-cols-3">
          {(Object.keys(KYC_LABEL) as (keyof Vendor['kyc'])[]).map((k) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.kyc[k]} onChange={(e) => setF({ ...f, kyc: { ...f.kyc, [k]: e.target.checked } })} />
              {KYC_LABEL[k]}
            </label>
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs text-ink-500">
        The vendor is created as <strong>pending</strong>. A different person (Head of Procurement or COO) must approve it before it can quote.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() =>
            run(
              (d, u) => createVendor(d, u, { ...f, categories: cats.split(',').map((c) => c.trim()).filter(Boolean) }),
              'Vendor onboarded, pending approval',
            ) && onClose()
          }
        >
          Submit for approval
        </Button>
      </div>
    </Modal>
  );
}
