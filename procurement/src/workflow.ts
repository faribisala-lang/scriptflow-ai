import {
  advanceDue,
  approvalChain,
  canAct,
  lowestCompliantQuote,
  nextApprover,
  quoteTotal,
  requiredQuotes,
  sum,
  threeWayMatch,
  vendorCanTrade,
} from './policy';
import { ROLE_LABEL, type DB, type LineItem, type Quote, type Requisition, type Stage, type User, type Vendor } from './types';

export class PolicyError extends Error {}

const fail = (msg: string): never => {
  throw new PolicyError(msg);
};

/** Overridable clock so demo data can be generated through the real workflow with back-dated timestamps. */
export const clock = { now: () => Date.now() };
export const nowIso = () => new Date(clock.now()).toISOString();
const uid = () => Math.random().toString(36).slice(2, 10);

export function nextNumber(db: DB, prefix: string): string {
  const year = new Date().getFullYear();
  const key = `${prefix}-${year}`;
  db.counters[key] = (db.counters[key] ?? 0) + 1;
  return `${prefix}-${year}-${String(db.counters[key]).padStart(4, '0')}`;
}

function getReq(db: DB, id: string): Requisition {
  return db.requisitions.find((r) => r.id === id) ?? fail('Requisition not found');
}

function getVendor(db: DB, id: string): Vendor {
  return db.vendors.find((v) => v.id === id) ?? fail('Vendor not found');
}

function log(r: { history: Requisition['history'] }, user: User, action: string, note?: string) {
  r.history.push({ at: nowIso(), userId: user.id, action, note });
}

function moveTo(r: Requisition, stage: Stage) {
  r.stage = stage;
  r.stageEnteredAt = nowIso();
}

function guard(r: Requisition, user: User) {
  if (!canAct(r, user)) fail(`${user.name} cannot act on ${r.number} at this stage`);
}

export interface RequisitionInput {
  title: string;
  category: Requisition['category'];
  neededBy: string;
  budgetLine: string;
  justification: string;
  items: LineItem[];
  route: Requisition['route'];
  routeJustification?: string;
  preferredVendorId?: string;
}

function validateInput(db: DB, input: RequisitionInput) {
  if (!input.title.trim()) fail('Title is required');
  if (!input.budgetLine.trim()) fail('Budget line is required: no budget, no requisition');
  if (!input.justification.trim()) fail('Business justification is required');
  if (!input.items.length) fail('Add at least one line item');
  for (const it of input.items) {
    if (!it.description.trim()) fail('Every line item needs a description');
    if (!(it.qty > 0)) fail(`Quantity must be positive for "${it.description}"`);
    if (!(it.estUnitPrice > 0)) fail(`Estimated unit price is required for "${it.description}"`);
  }
  if (input.route !== 'standard' && (input.routeJustification ?? '').trim().length < 20)
    fail('Exception routes need a written justification of at least 20 characters');
  const total = sum(input.items.map((i) => i.qty * i.estUnitPrice));
  if (total < db.policy.pettyCashLimit && input.route === 'standard')
    fail(`Below the ₦${db.policy.pettyCashLimit.toLocaleString()} petty-cash limit: use the petty-cash process instead`);
}

export function saveRequisition(db: DB, user: User, input: RequisitionInput, submit: boolean, existingId?: string): string {
  validateInput(db, input);
  let r: Requisition;
  if (existingId) {
    r = getReq(db, existingId);
    if (r.stage !== 'draft' || r.requesterId !== user.id) fail('Only the requester can edit a draft');
    Object.assign(r, input);
    log(r, user, 'Draft updated');
  } else {
    r = {
      id: uid(),
      number: nextNumber(db, 'PR'),
      ...input,
      department: user.department,
      requesterId: user.id,
      createdAt: nowIso(),
      stage: 'draft',
      quotes: [],
      requiredApprovers: [],
      approvals: [],
      advancePct: 0,
      coiDeclared: false,
      payments: [],
      history: [],
      stageEnteredAt: nowIso(),
    };
    db.requisitions.unshift(r);
    log(r, user, 'Requisition created');
  }
  if (submit) {
    r.submittedAt = nowIso();
    r.lineApproval = undefined;
    moveTo(r, 'line_approval');
    log(r, user, 'Submitted for line approval');
  }
  return r.id;
}

export function cancelRequisition(db: DB, user: User, id: string, reason: string) {
  const r = getReq(db, id);
  if (r.requesterId !== user.id && user.role !== 'head_procurement') fail('Only the requester or Head of Procurement can cancel');
  if (r.po) fail('A PO has been issued: cancel the PO with the vendor through Procurement');
  if (['closed', 'rejected', 'cancelled'].includes(r.stage)) fail('Requisition is already finalised');
  if (!reason.trim()) fail('Give a reason for cancelling');
  moveTo(r, 'cancelled');
  log(r, user, 'Cancelled', reason);
}

export function lineDecision(db: DB, user: User, id: string, decision: 'approved' | 'returned' | 'rejected', comment: string) {
  const r = getReq(db, id);
  guard(r, user);
  if (decision !== 'approved' && !comment.trim()) fail('A comment is required when returning or rejecting');
  r.lineApproval = { role: user.role, userId: user.id, decision, at: nowIso(), comment };
  if (decision === 'approved') {
    moveTo(r, 'sourcing');
    log(r, user, 'Line approval: need and budget confirmed', comment);
  } else if (decision === 'returned') {
    moveTo(r, 'draft');
    log(r, user, 'Returned to requester', comment);
  } else {
    moveTo(r, 'rejected');
    log(r, user, 'Rejected at line approval', comment);
  }
}

export function addQuote(db: DB, user: User, id: string, q: Omit<Quote, 'id' | 'receivedAt'>) {
  const r = getReq(db, id);
  guard(r, user);
  const v = getVendor(db, q.vendorId);
  const trade = vendorCanTrade(db.policy, v);
  if (!trade.ok) fail(`${v.name} cannot be invited: ${trade.reason}. Onboard/verify the vendor first.`);
  if (r.quotes.some((x) => x.vendorId === q.vendorId)) fail(`${v.name} has already quoted on this requisition`);
  if (q.unitPrices.length !== r.items.length || q.unitPrices.some((p) => !(p > 0))) fail('Enter a unit price for every line item');
  if (!q.reference.trim()) fail('Quote reference (vendor document number) is required for the audit trail');
  r.quotes.push({ ...q, id: uid(), receivedAt: nowIso() });
  log(r, user, `Quote recorded from ${v.name}`, `₦${quoteTotal(r, q).toLocaleString()}`);
}

export function removeQuote(db: DB, user: User, id: string, quoteId: string) {
  const r = getReq(db, id);
  guard(r, user);
  const q = r.quotes.find((x) => x.id === quoteId) ?? fail('Quote not found');
  r.quotes = r.quotes.filter((x) => x.id !== quoteId);
  log(r, user, 'Quote withdrawn', getVendor(db, q.vendorId).name);
}

export function recommendAward(
  db: DB,
  user: User,
  id: string,
  args: { quoteId: string; justification: string; advancePct: number; coiDeclared: boolean },
) {
  const r = getReq(db, id);
  guard(r, user);
  const q = r.quotes.find((x) => x.id === args.quoteId) ?? fail('Select a quote to award');
  if (!q.technicallyCompliant) fail('Cannot award to a technically non-compliant quote');
  const need = requiredQuotes(db.policy, { ...r, awardQuoteId: q.id });
  const have = r.quotes.filter((x) => x.technicallyCompliant).length;
  if (have < need) fail(`Policy requires ${need} compliant quotes at this value; you have ${have}. Issue more RFQs.`);
  const low = lowestCompliantQuote(r);
  if (low && low.id !== q.id && args.justification.trim().length < 30)
    fail('You are not awarding to the lowest compliant quote: a justification of at least 30 characters is mandatory');
  if (args.advancePct < 0 || args.advancePct > db.policy.maxAdvancePct)
    fail(`Advance payment cannot exceed ${db.policy.maxAdvancePct}% under policy`);
  if (!args.coiDeclared) fail('Confirm the conflict-of-interest declaration before recommending an award');
  r.awardQuoteId = q.id;
  r.awardJustification = args.justification;
  r.advancePct = args.advancePct;
  r.coiDeclared = true;
  r.approvals = [];
  r.requiredApprovers = approvalChain(db.policy, r);
  moveTo(r, 'award_approval');
  log(r, user, `Award recommended to ${getVendor(db, q.vendorId).name}`, `Approval chain: ${r.requiredApprovers.map((x) => ROLE_LABEL[x]).join(' → ')}`);
}

export function awardDecision(db: DB, user: User, id: string, decision: 'approved' | 'returned' | 'rejected', comment: string) {
  const r = getReq(db, id);
  guard(r, user);
  if (decision !== 'approved' && !comment.trim()) fail('A comment is required when returning or rejecting');
  r.approvals.push({ role: user.role, userId: user.id, decision, at: nowIso(), comment });
  if (decision === 'returned') {
    moveTo(r, 'sourcing');
    log(r, user, 'Award returned to Procurement', comment);
    return;
  }
  if (decision === 'rejected') {
    moveTo(r, 'rejected');
    log(r, user, 'Award rejected', comment);
    return;
  }
  log(r, user, 'Award approved', comment);
  if (nextApprover(r) === null) issuePO(db, user, r);
}

function issuePO(db: DB, user: User, r: Requisition) {
  const q = r.quotes.find((x) => x.id === r.awardQuoteId)!;
  const v = getVendor(db, q.vendorId);
  const trade = vendorCanTrade(db.policy, v);
  if (!trade.ok) fail(`PO blocked: ${trade.reason}`);
  const subtotal = quoteTotal(r, q);
  const vat = Math.round(subtotal * (db.policy.vatRate / 100));
  const due = new Date(clock.now() + q.deliveryDays * 86_400_000).toISOString().slice(0, 10);
  r.po = {
    number: nextNumber(db, 'PO'),
    issuedAt: nowIso(),
    issuedBy: user.id,
    vendorId: v.id,
    unitPrices: [...q.unitPrices],
    subtotal,
    vat,
    total: subtotal + vat,
    deliveryDue: due,
    paymentTermsDays: q.paymentTermsDays,
    advancePct: r.advancePct,
  };
  moveTo(r, 'po_issued');
  log(r, user, `PO ${r.po.number} issued to ${v.name}`, 'Final approval reached; PO is the only valid commitment');
}

export function recordReceipt(
  db: DB,
  user: User,
  id: string,
  args: { receivedQty: number[]; acceptedQty: number[]; witness: string; comments: string; satisfied: boolean },
) {
  const r = getReq(db, id);
  if (!(r.category === 'goods' ? user.role === 'stores' : user.id === r.requesterId))
    fail(r.category === 'goods' ? 'Goods must be received by Stores, not Procurement' : 'Only the service owner (requester) can sign the JCC');
  if (r.stage !== 'po_issued') fail('Nothing to receive at this stage');
  if (r.category === 'goods' && !args.witness.trim()) fail('A member of the requesting unit must witness the GRN');
  args.acceptedQty.forEach((a, i) => {
    if (a > args.receivedQty[i]) fail('Accepted quantity cannot exceed received quantity');
    if (args.receivedQty[i] > r.items[i].qty) fail(`Received quantity exceeds PO quantity for "${r.items[i].description}"`);
  });
  if (sum(args.acceptedQty) === 0) fail('Nothing accepted: reject the delivery with Procurement instead');
  const kind = r.category === 'goods' ? 'GRN' : 'JCC';
  r.receipt = { kind, number: nextNumber(db, kind), at: nowIso(), recordedBy: user.id, ...args };
  moveTo(r, 'received');
  log(r, user, `${kind} ${r.receipt.number} recorded`, args.comments);
}

export function payAdvance(db: DB, user: User, id: string, reference: string) {
  const r = getReq(db, id);
  if (user.role !== 'finance') fail('Only Finance can release payments');
  if (!advanceDue(r)) fail('No advance is due on this PO');
  if (!reference.trim()) fail('Payment reference is required');
  const v = getVendor(db, r.po!.vendorId);
  const trade = vendorCanTrade(db.policy, v);
  if (!trade.ok) fail(`Payment blocked: ${trade.reason}`);
  const amount = Math.round(r.po!.total * (r.po!.advancePct / 100));
  r.payments.push({ kind: 'advance', amount, wht: 0, reference, at: nowIso(), by: user.id });
  log(r, user, `Advance of ₦${amount.toLocaleString()} paid (${r.po!.advancePct}%)`, reference);
}

export function recordInvoice(db: DB, user: User, id: string, args: { number: string; date: string; subtotal: number; vat: number }) {
  const r = getReq(db, id);
  guard(r, user);
  if (!['received', 'match_exception'].includes(r.stage)) fail('Invoice can only be recorded after GRN/JCC');
  if (!args.number.trim()) fail('Invoice number required');
  const dup = db.requisitions.some((x) => x.id !== r.id && x.invoice?.number === args.number && x.po?.vendorId === r.po?.vendorId);
  if (dup) fail('Duplicate invoice number for this vendor: possible double payment');
  const m = threeWayMatch(r, args.subtotal, db.policy.matchTolerancePct);
  r.invoice = { ...args, recordedBy: user.id, recordedAt: nowIso(), matchVariancePct: m.variancePct, matched: m.matched };
  if (m.matched) {
    const due = new Date(new Date(args.date).getTime() + r.po!.paymentTermsDays * 86_400_000).toISOString().slice(0, 10);
    r.paymentDue = due;
    moveTo(r, 'payment_scheduled');
    log(r, user, `Invoice ${args.number} matched (variance ${m.variancePct.toFixed(1)}%)`, `Payment due ${due}`);
  } else {
    moveTo(r, 'match_exception');
    log(r, user, `Invoice ${args.number} FAILED 3-way match`, `Invoice exceeds received value by ${m.variancePct.toFixed(1)}%; payment blocked`);
  }
}

export function recordPayment(db: DB, user: User, id: string, args: { reference: string; wht: number }) {
  const r = getReq(db, id);
  guard(r, user);
  const inv = r.invoice;
  if (r.stage !== 'payment_scheduled' || !inv?.matched) return fail('No matched invoice awaiting payment');
  if (!args.reference.trim()) fail('Payment reference is required');
  const v = getVendor(db, r.po!.vendorId);
  const trade = vendorCanTrade(db.policy, v);
  if (!trade.ok) fail(`Payment blocked: ${trade.reason}`);
  const gross = inv.subtotal + inv.vat;
  const advance = sum(r.payments.filter((p) => p.kind === 'advance').map((p) => p.amount));
  const amount = gross - advance - args.wht;
  r.payments.push({ kind: 'final', amount, wht: args.wht, reference: args.reference, at: nowIso(), by: user.id });
  moveTo(r, 'paid');
  log(r, user, `Paid ₦${amount.toLocaleString()} to ${v.bank.bankName} ${v.bank.accountNumber}`, `WHT ₦${args.wht.toLocaleString()}; ref ${args.reference}`);
}

export function rateVendor(db: DB, user: User, id: string, scores: { quality: number; delivery: number; price: number; service: number }) {
  const r = getReq(db, id);
  guard(r, user);
  const v = getVendor(db, r.po!.vendorId);
  const onTime = !!r.receipt && r.receipt.at.slice(0, 10) <= r.po!.deliveryDue;
  v.ratings.push({ reqId: r.id, ...scores, onTime, at: nowIso(), by: user.id });
  r.rated = true;
  moveTo(r, 'closed');
  log(r, user, 'Vendor rated; requisition closed', `Q${scores.quality} D${scores.delivery} P${scores.price} S${scores.service}`);
}

// ---------- Vendor master ----------

export type VendorInput = Omit<Vendor, 'id' | 'status' | 'createdAt' | 'ratings' | 'history' | 'recommendedBy' | 'approvedBy' | 'pendingBank'>;

export function createVendor(db: DB, user: User, input: VendorInput): string {
  if (!['procurement_officer', 'head_procurement'].includes(user.role)) fail('Only Procurement can onboard vendors');
  if (!input.name.trim()) fail('Business name required');
  if (!input.tin.trim()) fail('TIN is mandatory');
  if (input.businessType !== 'individual' && !input.rcNumber.trim()) fail('RC/BN number is mandatory for registered businesses');
  if (!/^\d{10}$/.test(input.bank.accountNumber)) fail('NUBAN account number must be 10 digits');
  const dupe = db.vendors.find(
    (v) => v.tin.trim() === input.tin.trim() || v.bank.accountNumber === input.bank.accountNumber || v.name.toLowerCase() === input.name.toLowerCase(),
  );
  if (dupe) fail(`Possible duplicate of existing vendor "${dupe.name}" (same name, TIN or bank account)`);
  const v: Vendor = {
    ...input,
    id: uid(),
    status: 'pending',
    createdAt: nowIso(),
    recommendedBy: user.id,
    ratings: [],
    history: [],
  };
  log(v, user, 'Vendor onboarded and recommended for approval');
  db.vendors.push(v);
  return v.id;
}

export function updateKyc(db: DB, user: User, id: string, kyc: Vendor['kyc']) {
  if (!['procurement_officer', 'head_procurement'].includes(user.role)) fail('Only Procurement maintains KYC');
  const v = getVendor(db, id);
  v.kyc = kyc;
  v.kycReviewedAt = nowIso();
  log(v, user, 'KYC reviewed');
}

export function setVendorStatus(db: DB, user: User, id: string, status: Vendor['status'], reason: string) {
  const v = getVendor(db, id);
  if (status === 'approved') {
    if (v.status === 'blacklisted' && user.role !== 'coo') fail('Only the COO can reinstate a blacklisted vendor');
    if (!['head_procurement', 'coo'].includes(user.role)) fail('Vendor approval sits with Head of Procurement or COO');
    if (v.recommendedBy === user.id) fail('Segregation of duties: the person who onboarded the vendor cannot approve it');
    if (!v.kyc.cac || !v.kyc.tin || !v.kyc.taxClearance) fail('Mandatory KYC (CAC, TIN, tax clearance) incomplete');
    v.approvedBy = user.id;
    if (!v.kycReviewedAt) v.kycReviewedAt = nowIso();
  }
  if (status === 'suspended' && !['head_procurement', 'coo'].includes(user.role)) fail('Suspension requires Head of Procurement or COO');
  if (status === 'blacklisted' && user.role !== 'coo') fail('Blacklisting requires COO approval');
  if (status !== 'approved' && !reason.trim()) fail('A reason is required');
  v.status = status;
  v.statusReason = reason;
  log(v, user, `Status set to ${status}`, reason);
}

export function requestBankChange(db: DB, user: User, id: string, bank: Vendor['bank']) {
  if (!['procurement_officer', 'head_procurement'].includes(user.role)) fail('Only Procurement can log a bank change request');
  if (!/^\d{10}$/.test(bank.accountNumber)) fail('NUBAN account number must be 10 digits');
  const v = getVendor(db, id);
  v.pendingBank = { ...bank, requestedBy: user.id, requestedAt: nowIso() };
  log(v, user, 'Bank-detail change requested: payments frozen until Finance verifies');
}

export function verifyBankChange(db: DB, user: User, id: string, approve: boolean, callbackNote: string) {
  if (user.role !== 'finance') fail('Only Finance can verify bank changes');
  const v = getVendor(db, id);
  const pending = v.pendingBank;
  if (!pending) return fail('No pending change');
  if (pending.requestedBy === user.id) fail('Segregation of duties: requester cannot verify');
  if (approve && callbackNote.trim().length < 15)
    fail('Record the call-back verification (who you called, on which number already on file)');
  if (approve) {
    const { bankName, accountName, accountNumber } = pending;
    v.bank = { bankName, accountName, accountNumber };
  }
  v.pendingBank = undefined;
  log(v, user, approve ? 'Bank change verified and applied' : 'Bank change rejected', callbackNote);
}
