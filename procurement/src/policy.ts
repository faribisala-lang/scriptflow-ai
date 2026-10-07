import type { DB, PolicyConfig, Quote, Requisition, Role, Stage, Tier, User, Vendor } from './types';

const DAY = 86_400_000;

/** Policy v3 as written (TZ/FA/PP/001). Kept so leadership can compare like-for-like. */
export const POLICY_V3: PolicyConfig = {
  name: 'Policy v3 (current, as written)',
  pettyCashLimit: 10_000,
  tiers: [
    { id: 'medium', name: 'Medium value', min: 10_000, max: 500_000, minQuotes: 2, approvers: ['head_procurement'], committee: false },
    { id: 'high', name: 'High value', min: 500_000, max: null, minQuotes: 3, approvers: ['head_procurement'], committee: true },
  ],
  vatRate: 7.5,
  matchTolerancePct: 0,
  maxAdvancePct: 100,
  splitWindowDays: 30,
  priceVarianceAlertPct: 10,
  estimateOverrunAlertPct: 10,
  kycValidityMonths: 12,
  slaDays: { line_approval: 2, sourcing: 5, award_approval: 3, po_issued: 14, received: 5, payment_scheduled: 30, paid: 5 },
};

/** Recommended v4: value-tiered delegation of authority. Calibrate the bands to annual spend. */
export const POLICY_V4: PolicyConfig = {
  name: 'Recommended v4',
  pettyCashLimit: 50_000,
  tiers: [
    { id: 't1', name: 'Tier 1 · Low', min: 50_000, max: 500_000, minQuotes: 2, approvers: ['head_procurement'], committee: false },
    { id: 't2', name: 'Tier 2 · Medium', min: 500_000, max: 5_000_000, minQuotes: 3, approvers: ['head_procurement', 'finance'], committee: false },
    { id: 't3', name: 'Tier 3 · High', min: 5_000_000, max: 25_000_000, minQuotes: 3, approvers: ['head_procurement', 'finance', 'coo'], committee: true },
    { id: 't4', name: 'Tier 4 · Strategic', min: 25_000_000, max: null, minQuotes: 4, approvers: ['head_procurement', 'finance', 'coo', 'ceo'], committee: true },
  ],
  vatRate: 7.5,
  matchTolerancePct: 2,
  maxAdvancePct: 50,
  splitWindowDays: 30,
  priceVarianceAlertPct: 10,
  estimateOverrunAlertPct: 10,
  kycValidityMonths: 12,
  slaDays: { line_approval: 1, sourcing: 5, award_approval: 2, po_issued: 14, received: 3, match_exception: 3, payment_scheduled: 30, paid: 5 },
};

const SENIORITY: Role[] = ['business_director', 'head_procurement', 'finance', 'coo', 'ceo'];

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function estimateTotal(r: Pick<Requisition, 'items'>): number {
  return sum(r.items.map((i) => i.qty * i.estUnitPrice));
}

export function quoteTotal(r: Pick<Requisition, 'items'>, q: Pick<Quote, 'unitPrices'>): number {
  return sum(r.items.map((i, idx) => i.qty * (q.unitPrices[idx] ?? 0)));
}

/** Value that drives tiering: awarded value once known, otherwise the estimate. */
export function controllingValue(r: Requisition): number {
  const award = r.quotes.find((q) => q.id === r.awardQuoteId);
  return award ? Math.max(quoteTotal(r, award), estimateTotal(r)) : estimateTotal(r);
}

export function tierFor(policy: PolicyConfig, value: number): Tier | null {
  if (value < policy.pettyCashLimit) return null;
  return policy.tiers.find((t) => value >= t.min && (t.max === null || value < t.max)) ?? policy.tiers[policy.tiers.length - 1];
}

export function requiredQuotes(policy: PolicyConfig, r: Requisition): number {
  if (r.route === 'sole_source' || r.route === 'emergency' || r.route === 'retrospective') return 1;
  return tierFor(policy, controllingValue(r))?.minQuotes ?? 1;
}

/** Approval chain for the award, ordered by seniority. Exception routes escalate. */
export function approvalChain(policy: PolicyConfig, r: Requisition): Role[] {
  const base = tierFor(policy, controllingValue(r))?.approvers ?? ['head_procurement'];
  const set = new Set<Role>(base);
  set.add('head_procurement');
  if (r.route === 'emergency' || r.route === 'sole_source') set.add('coo');
  if (r.route === 'retrospective') {
    set.add('coo');
    set.add('ceo');
  }
  if (r.advancePct > 0) set.add('finance');
  return SENIORITY.filter((role) => set.has(role));
}

export function nextApprover(r: Requisition): Role | null {
  const done = new Set(r.approvals.filter((a) => a.decision === 'approved').map((a) => a.role));
  return r.requiredApprovers.find((role) => !done.has(role)) ?? null;
}

export function lowestCompliantQuote(r: Requisition): Quote | null {
  const compliant = r.quotes.filter((q) => q.technicallyCompliant);
  if (!compliant.length) return null;
  return compliant.reduce((best, q) => (quoteTotal(r, q) < quoteTotal(r, best) ? q : best));
}

export function vendorKycComplete(v: Vendor): boolean {
  return v.kyc.cac && v.kyc.tin && v.kyc.taxClearance;
}

export function vendorKycExpired(policy: PolicyConfig, v: Vendor, now = Date.now()): boolean {
  if (!v.kycReviewedAt) return true;
  return now - new Date(v.kycReviewedAt).getTime() > policy.kycValidityMonths * 30 * DAY;
}

export function vendorCanTrade(policy: PolicyConfig, v: Vendor | undefined): { ok: boolean; reason?: string } {
  if (!v) return { ok: false, reason: 'Unknown vendor' };
  if (v.status !== 'approved') return { ok: false, reason: `Vendor is ${v.status}` };
  if (!vendorKycComplete(v)) return { ok: false, reason: 'Mandatory KYC incomplete (CAC, TIN, tax clearance)' };
  if (vendorKycExpired(policy, v)) return { ok: false, reason: 'KYC review older than policy allows' };
  if (v.pendingBank) return { ok: false, reason: 'Bank-detail change awaiting Finance verification' };
  return { ok: true };
}

export function vendorScore(v: Vendor): { overall: number; count: number; onTimePct: number } {
  if (!v.ratings.length) return { overall: 0, count: 0, onTimePct: 0 };
  const avg = (k: 'quality' | 'delivery' | 'price' | 'service') => sum(v.ratings.map((x) => x[k])) / v.ratings.length;
  const overall = avg('quality') * 0.35 + avg('delivery') * 0.25 + avg('price') * 0.25 + avg('service') * 0.15;
  const onTimePct = (v.ratings.filter((x) => x.onTime).length / v.ratings.length) * 100;
  return { overall, count: v.ratings.length, onTimePct };
}

/** 3-way match: PO price x accepted quantity (GRN/JCC) vs invoice. */
export function threeWayMatch(r: Requisition, invoiceSubtotal: number, tolerancePct: number) {
  if (!r.po || !r.receipt) return { receivedValue: 0, variancePct: 100, matched: false };
  const receivedValue = sum(r.items.map((_, i) => (r.receipt!.acceptedQty[i] ?? 0) * (r.po!.unitPrices[i] ?? 0)));
  const variancePct = receivedValue === 0 ? 100 : ((invoiceSubtotal - receivedValue) / receivedValue) * 100;
  return { receivedValue, variancePct, matched: variancePct <= tolerancePct + 1e-9 };
}

export interface Flag {
  code: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

/** Last price paid for the same item description on an earlier PO. */
export function lastPurchasePrice(db: DB, r: Requisition, itemIdx: number): number | null {
  const key = norm(r.items[itemIdx].description);
  const prior = db.requisitions
    .filter((x) => x.id !== r.id && x.po && x.po.issuedAt < (r.po?.issuedAt ?? '9999'))
    .sort((a, b) => b.po!.issuedAt.localeCompare(a.po!.issuedAt));
  for (const p of prior) {
    const i = p.items.findIndex((it) => norm(it.description) === key);
    if (i >= 0) return p.po!.unitPrices[i];
  }
  return null;
}

const ACTIVE_OR_DONE = (r: Requisition) => !['draft', 'rejected', 'cancelled'].includes(r.stage);

/** Same department + category within the window whose combined value jumps a tier. */
export function splitSuspects(db: DB, r: Requisition): Requisition[] {
  if (!ACTIVE_OR_DONE(r)) return [];
  const t = new Date(r.submittedAt ?? r.createdAt).getTime();
  const win = db.policy.splitWindowDays * DAY;
  const peers = db.requisitions.filter(
    (x) =>
      x.id !== r.id &&
      ACTIVE_OR_DONE(x) &&
      x.department === r.department &&
      x.category === r.category &&
      Math.abs(new Date(x.submittedAt ?? x.createdAt).getTime() - t) <= win,
  );
  if (!peers.length) return [];
  const own = tierFor(db.policy, estimateTotal(r));
  const combined = tierFor(db.policy, estimateTotal(r) + sum(peers.map(estimateTotal)));
  const idx = (tier: Tier | null) => (tier ? db.policy.tiers.indexOf(tier) : -1);
  return idx(combined) > idx(own) ? peers : [];
}

export function daysBetween(a: string, b: string | number = Date.now()): number {
  const end = typeof b === 'number' ? b : new Date(b).getTime();
  return Math.max(0, (end - new Date(a).getTime()) / DAY);
}

export function slaBreached(policy: PolicyConfig, r: Requisition, now = Date.now()): boolean {
  const sla = policy.slaDays[r.stage];
  return sla !== undefined && daysBetween(r.stageEnteredAt, now) > sla;
}

export function complianceFlags(db: DB, r: Requisition): Flag[] {
  const flags: Flag[] = [];
  const p = db.policy;
  if (r.route === 'retrospective')
    flags.push({ code: 'MAVERICK', severity: 'high', message: 'Retrospective (maverick) purchase: commitment made before a PO existed' });
  if (r.route === 'emergency') flags.push({ code: 'EMERGENCY', severity: 'medium', message: 'Emergency route: competition waived, COO ratification required' });
  if (r.route === 'sole_source') flags.push({ code: 'SOLE', severity: 'medium', message: 'Sole/single source: competition waived on justification' });

  const reachedAward = ['award_approval', 'po_issued', 'received', 'match_exception', 'payment_scheduled', 'paid', 'closed'].includes(r.stage);
  if (reachedAward) {
    const valid = r.quotes.filter((q) => q.technicallyCompliant).length;
    const need = requiredQuotes(p, r);
    if (valid < need) flags.push({ code: 'QUOTES', severity: 'high', message: `Only ${valid} compliant quote(s); policy requires ${need}` });
    const low = lowestCompliantQuote(r);
    const award = r.quotes.find((q) => q.id === r.awardQuoteId);
    if (low && award && low.id !== award.id) {
      const prem = ((quoteTotal(r, award) - quoteTotal(r, low)) / quoteTotal(r, low)) * 100;
      flags.push({ code: 'NOT_LOWEST', severity: prem > 5 ? 'high' : 'medium', message: `Award is ${prem.toFixed(1)}% above lowest compliant quote` });
    }
    if (award) {
      const over = ((quoteTotal(r, award) - estimateTotal(r)) / Math.max(1, estimateTotal(r))) * 100;
      if (over > p.estimateOverrunAlertPct)
        flags.push({ code: 'OVER_BUDGET', severity: 'medium', message: `Award exceeds requisition estimate by ${over.toFixed(1)}%` });
    }
  }
  if (r.po) {
    r.items.forEach((it, i) => {
      const last = lastPurchasePrice(db, r, i);
      if (last && last > 0) {
        const v = ((r.po!.unitPrices[i] - last) / last) * 100;
        if (v > p.priceVarianceAlertPct)
          flags.push({ code: 'PRICE_VAR', severity: 'medium', message: `"${it.description}" is ${v.toFixed(0)}% above last price paid` });
      }
    });
  }
  const split = splitSuspects(db, r);
  if (split.length)
    flags.push({ code: 'SPLIT', severity: 'high', message: `Possible split purchase with ${split.map((s) => s.number).join(', ')} (combined value crosses a tier)` });
  if (r.invoice && !r.invoice.matched)
    flags.push({ code: 'MATCH', severity: 'high', message: `Invoice ${r.invoice.matchVariancePct.toFixed(1)}% above received value` });
  if (r.receipt && !r.receipt.satisfied) flags.push({ code: 'QUALITY', severity: 'medium', message: 'Receipt recorded with quality reservations' });
  if (r.po && r.receipt && r.receipt.at.slice(0, 10) > r.po.deliveryDue)
    flags.push({ code: 'LATE', severity: 'low', message: 'Delivered after PO due date' });
  if (slaBreached(p, r)) flags.push({ code: 'SLA', severity: 'low', message: `Stage SLA breached (${daysBetween(r.stageEnteredAt).toFixed(0)} days in stage)` });
  return flags;
}

/** Who can act on a requisition right now. */
export function canAct(r: Requisition, u: User): boolean {
  if (u.role === 'admin') return false;
  switch (r.stage) {
    case 'draft':
      return u.id === r.requesterId;
    case 'line_approval':
      return u.role === 'business_director' && u.id !== r.requesterId;
    case 'sourcing':
      return u.role === 'procurement_officer';
    case 'award_approval':
      return nextApprover(r) === u.role && u.id !== r.requesterId && !r.approvals.some((a) => a.userId === u.id && a.decision === 'approved');
    case 'po_issued':
      if (r.category === 'goods') return u.role === 'stores' || (u.role === 'finance' && advanceDue(r));
      return u.id === r.requesterId || (u.role === 'finance' && advanceDue(r));
    case 'received':
    case 'match_exception':
    case 'payment_scheduled':
      return u.role === 'finance';
    case 'paid':
      return u.id === r.requesterId;
    default:
      return false;
  }
}

export function advanceDue(r: Requisition): boolean {
  return !!r.po && r.po.advancePct > 0 && !r.payments.some((p) => p.kind === 'advance');
}

export const STAGE_OWNER: Partial<Record<Stage, string>> = {
  draft: 'Requester',
  line_approval: 'Business Director',
  sourcing: 'Procurement Officer',
  award_approval: 'Approval chain',
  po_issued: 'Stores (goods) / Requester (services)',
  received: 'Finance',
  match_exception: 'Finance + Procurement',
  payment_scheduled: 'Finance',
  paid: 'Requester',
};
