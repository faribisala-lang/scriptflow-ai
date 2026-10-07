import { describe, expect, it } from 'vitest';
import { approvalChain, complianceFlags, requiredQuotes, threeWayMatch, tierFor, POLICY_V4 } from './policy';
import { buildSeed } from './seed';
import type { DB, User } from './types';
import {
  addQuote,
  awardDecision,
  createVendor,
  lineDecision,
  PolicyError,
  recommendAward,
  recordInvoice,
  recordPayment,
  recordReceipt,
  requestBankChange,
  saveRequisition,
  setVendorStatus,
  verifyBankChange,
} from './workflow';

const db0 = () => buildSeed();
const U = (db: DB, role: User['role']) => db.users.find((u) => u.role === role)!;
const approvedVendors = (db: DB) => db.vendors.filter((v) => v.status === 'approved' && v.categories.includes('IT equipment'));

function newReq(db: DB, unitPrice: number, qty = 1) {
  return saveRequisition(
    db,
    U(db, 'requester'),
    { title: 'Test', category: 'goods', neededBy: '2026-12-01', budgetLine: 'OPEX', justification: 'Need', items: [{ description: 'Widget X', qty, unit: 'pcs', estUnitPrice: unitPrice }], route: 'standard' },
    true,
  );
}

function quote(db: DB, id: string, vendorId: string, price: number, ok = true) {
  addQuote(db, U(db, 'procurement_officer'), id, { vendorId, unitPrices: [price], deliveryDays: 5, paymentTermsDays: 30, validUntil: '2026-12-31', technicallyCompliant: ok, reference: 'Q1' });
}

describe('seed', () => {
  it('builds through the real workflow without violating any guard', () => {
    const db = db0();
    expect(db.requisitions.length).toBeGreaterThan(8);
    expect(db.requisitions.some((r) => r.stage === 'closed')).toBe(true);
    expect(db.requisitions.some((r) => r.stage === 'match_exception')).toBe(true);
  });
  it('surfaces the planted exceptions', () => {
    const db = db0();
    const codes = db.requisitions.flatMap((r) => complianceFlags(db, r).map((f) => f.code));
    for (const c of ['SPLIT', 'PRICE_VAR', 'NOT_LOWEST', 'MATCH', 'EMERGENCY']) expect(codes).toContain(c);
  });
});

describe('policy tiers', () => {
  it('classifies value bands and quote minimums', () => {
    expect(tierFor(POLICY_V4, 30_000)).toBeNull();
    expect(tierFor(POLICY_V4, 400_000)?.minQuotes).toBe(2);
    expect(tierFor(POLICY_V4, 2_000_000)?.minQuotes).toBe(3);
    expect(tierFor(POLICY_V4, 50_000_000)?.approvers).toContain('ceo');
  });
});

describe('workflow guards', () => {
  it('blocks petty-cash-sized requisitions', () => {
    const db = db0();
    expect(() => newReq(db, 5_000)).toThrow(PolicyError);
  });

  it('only the Business Director can give line approval', () => {
    const db = db0();
    const id = newReq(db, 300_000);
    expect(() => lineDecision(db, U(db, 'procurement_officer'), id, 'approved', '')).toThrow(/cannot act/);
    lineDecision(db, U(db, 'business_director'), id, 'approved', '');
    expect(db.requisitions.find((r) => r.id === id)!.stage).toBe('sourcing');
  });

  it('enforces minimum quotes, lowest-bid justification and COI', () => {
    const db = db0();
    const id = newReq(db, 1_000_000); // Tier 2: 3 quotes
    lineDecision(db, U(db, 'business_director'), id, 'approved', '');
    const [a, b, c] = approvedVendors(db);
    quote(db, id, a.id, 900_000);
    quote(db, id, b.id, 950_000);
    const po = U(db, 'procurement_officer');
    const r = () => db.requisitions.find((x) => x.id === id)!;
    expect(() => recommendAward(db, po, id, { quoteId: r().quotes[0].id, justification: '', advancePct: 0, coiDeclared: true })).toThrow(/3 compliant/);
    quote(db, id, c.id, 980_000);
    expect(() => recommendAward(db, po, id, { quoteId: r().quotes[1].id, justification: 'short', advancePct: 0, coiDeclared: true })).toThrow(/lowest/);
    expect(() => recommendAward(db, po, id, { quoteId: r().quotes[0].id, justification: '', advancePct: 0, coiDeclared: false })).toThrow(/conflict/);
    expect(() => recommendAward(db, po, id, { quoteId: r().quotes[0].id, justification: '', advancePct: 80, coiDeclared: true })).toThrow(/Advance/);
    recommendAward(db, po, id, { quoteId: r().quotes[0].id, justification: '', advancePct: 0, coiDeclared: true });
    expect(r().requiredApprovers).toEqual(['head_procurement', 'finance']);
  });

  it('runs full procure-to-pay with SoD on receipt and 3-way match', () => {
    const db = db0();
    const id = newReq(db, 200_000, 2); // 400k, Tier 1: 2 quotes
    lineDecision(db, U(db, 'business_director'), id, 'approved', '');
    const [a, b] = approvedVendors(db);
    quote(db, id, a.id, 190_000);
    quote(db, id, b.id, 195_000);
    const r = () => db.requisitions.find((x) => x.id === id)!;
    recommendAward(db, U(db, 'procurement_officer'), id, { quoteId: r().quotes[0].id, justification: '', advancePct: 0, coiDeclared: true });
    expect(() => awardDecision(db, U(db, 'finance'), id, 'approved', '')).toThrow();
    awardDecision(db, U(db, 'head_procurement'), id, 'approved', '');
    expect(r().po?.subtotal).toBe(380_000);
    const rec = { receivedQty: [2], acceptedQty: [1], witness: 'Adaeze', comments: '', satisfied: true };
    expect(() => recordReceipt(db, U(db, 'procurement_officer'), id, rec)).toThrow(/Stores/);
    recordReceipt(db, U(db, 'stores'), id, rec);
    // Invoice for 2 units but only 1 accepted: blocked.
    recordInvoice(db, U(db, 'finance'), id, { number: 'X1', date: '2026-10-01', subtotal: 380_000, vat: 28_500 });
    expect(r().stage).toBe('match_exception');
    expect(() => recordPayment(db, U(db, 'finance'), id, { reference: 'T', wht: 0 })).toThrow();
    recordInvoice(db, U(db, 'finance'), id, { number: 'X1-CN', date: '2026-10-01', subtotal: 190_000, vat: 14_250 });
    expect(r().stage).toBe('payment_scheduled');
    recordPayment(db, U(db, 'finance'), id, { reference: 'T1', wht: 9_500 });
    expect(r().stage).toBe('paid');
  });

  it('escalates exception routes', () => {
    const db = db0();
    const id = saveRequisition(
      db,
      U(db, 'requester'),
      { title: 'Late', category: 'goods', neededBy: '2026-12-01', budgetLine: 'OPEX', justification: 'x', items: [{ description: 'Chairs', qty: 1, unit: 'lot', estUnitPrice: 300_000 }], route: 'retrospective', routeJustification: 'Bought during the event weekend without a PO.' },
      true,
    );
    const r = db.requisitions.find((x) => x.id === id)!;
    expect(requiredQuotes(db.policy, r)).toBe(1);
    expect(approvalChain(db.policy, r)).toEqual(['head_procurement', 'coo', 'ceo']);
  });
});

describe('vendor controls', () => {
  it('requires a different approver and blocks duplicates', () => {
    const db = db0();
    const input = {
      name: 'New Co', rcNumber: 'RC1', tin: 'T-NEW', vatNo: '', businessType: 'company' as const, categories: [], contactName: '', email: '', phone: '', address: '',
      bank: { bankName: 'GTBank', accountName: 'New Co', accountNumber: '9999999999' },
      kyc: { cac: true, tin: true, taxClearance: true, references: false, financials: false, license: false },
    };
    const id = createVendor(db, U(db, 'head_procurement'), input);
    expect(() => setVendorStatus(db, U(db, 'head_procurement'), id, 'approved', '')).toThrow(/Segregation/);
    setVendorStatus(db, U(db, 'coo'), id, 'approved', '');
    expect(() => createVendor(db, U(db, 'procurement_officer'), { ...input, name: 'Other', tin: 'T-2' })).toThrow(/duplicate/);
    expect(() => setVendorStatus(db, U(db, 'head_procurement'), id, 'blacklisted', 'fraud')).toThrow(/COO/);
  });

  it('freezes payments while a bank change is unverified', () => {
    const db = db0();
    const v = approvedVendors(db)[0];
    requestBankChange(db, U(db, 'procurement_officer'), v.id, { bankName: 'UBA', accountName: v.name, accountNumber: '1111111111' });
    const id = newReq(db, 200_000);
    lineDecision(db, U(db, 'business_director'), id, 'approved', '');
    expect(() => quote(db, id, v.id, 190_000)).toThrow(/Bank-detail/);
    expect(() => verifyBankChange(db, U(db, 'finance'), v.id, true, 'ok')).toThrow(/call-back/);
    verifyBankChange(db, U(db, 'finance'), v.id, true, 'Called MD on 0803 number on file, confirmed.');
    expect(db.vendors.find((x) => x.id === v.id)!.bank.accountNumber).toBe('1111111111');
  });
});

describe('threeWayMatch', () => {
  it('passes within tolerance and fails above it', () => {
    const db = db0();
    const r = db.requisitions.find((x) => x.receipt && x.po)!;
    const base = threeWayMatch(r, 0, 2).receivedValue;
    expect(threeWayMatch(r, base * 1.019, 2).matched).toBe(true);
    expect(threeWayMatch(r, base * 1.03, 2).matched).toBe(false);
  });
});
