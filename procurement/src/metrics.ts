import { complianceFlags, daysBetween, estimateTotal, quoteTotal, slaBreached, sum, type Flag } from './policy';
import type { DB, Requisition } from './types';

export interface Metrics {
  committed: number;
  paid: number;
  savingsVsEstimate: number;
  savingsVsAvgQuote: number;
  savingsPct: number;
  compliancePct: number;
  exceptionSpendPct: number;
  avgCycleToPO: number | null;
  avgCycleToPay: number | null;
  slaBreaches: number;
  openCount: number;
  flagsByReq: Map<string, Flag[]>;
  spendByVendor: { name: string; value: number }[];
  spendByDept: { name: string; value: number }[];
  quoteCoverage: number;
}

const OPEN = (r: Requisition) => !['closed', 'rejected', 'cancelled', 'draft'].includes(r.stage);

export function computeMetrics(db: DB): Metrics {
  const flagsByReq = new Map(db.requisitions.map((r) => [r.id, complianceFlags(db, r)]));
  const withPo = db.requisitions.filter((r) => r.po);
  const committed = sum(withPo.map((r) => r.po!.total));
  const paid = sum(db.requisitions.flatMap((r) => r.payments.map((p) => p.amount + p.wht)));

  let savingsVsEstimate = 0;
  let savingsVsAvgQuote = 0;
  let estBase = 0;
  let compliantQuoted = 0;
  for (const r of withPo) {
    const est = estimateTotal(r);
    estBase += est;
    savingsVsEstimate += est - r.po!.subtotal;
    const valid = r.quotes.filter((q) => q.technicallyCompliant);
    if (valid.length) savingsVsAvgQuote += sum(valid.map((q) => quoteTotal(r, q))) / valid.length - r.po!.subtotal;
    if (!flagsByReq.get(r.id)!.some((f) => f.code === 'QUOTES')) compliantQuoted++;
  }

  const assessed = db.requisitions.filter((r) => r.submittedAt && !['draft', 'cancelled'].includes(r.stage));
  const clean = assessed.filter((r) => !flagsByReq.get(r.id)!.some((f) => f.severity === 'high'));
  const exceptionSpend = sum(withPo.filter((r) => flagsByReq.get(r.id)!.some((f) => f.severity === 'high')).map((r) => r.po!.total));

  const cyclePO = withPo.filter((r) => r.submittedAt).map((r) => daysBetween(r.submittedAt!, r.po!.issuedAt));
  const cyclePay = db.requisitions
    .filter((r) => r.submittedAt && r.payments.some((p) => p.kind === 'final'))
    .map((r) => daysBetween(r.submittedAt!, r.payments.find((p) => p.kind === 'final')!.at));

  const group = (key: (r: Requisition) => string) => {
    const m = new Map<string, number>();
    for (const r of withPo) m.set(key(r), (m.get(key(r)) ?? 0) + r.po!.total);
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  };
  const vendorName = (id: string) => db.vendors.find((v) => v.id === id)?.name ?? id;

  return {
    committed,
    paid,
    savingsVsEstimate,
    savingsVsAvgQuote,
    savingsPct: estBase ? (savingsVsEstimate / estBase) * 100 : 0,
    compliancePct: assessed.length ? (clean.length / assessed.length) * 100 : 100,
    exceptionSpendPct: committed ? (exceptionSpend / committed) * 100 : 0,
    avgCycleToPO: cyclePO.length ? sum(cyclePO) / cyclePO.length : null,
    avgCycleToPay: cyclePay.length ? sum(cyclePay) / cyclePay.length : null,
    slaBreaches: db.requisitions.filter((r) => OPEN(r) && slaBreached(db.policy, r)).length,
    openCount: db.requisitions.filter(OPEN).length,
    flagsByReq,
    spendByVendor: group((r) => vendorName(r.po!.vendorId)).slice(0, 6),
    spendByDept: group((r) => r.department),
    quoteCoverage: withPo.length ? (compliantQuoted / withPo.length) * 100 : 100,
  };
}
