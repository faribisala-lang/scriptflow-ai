import { POLICY_V4 } from './policy';
import type { DB, User, Vendor } from './types';
import {
  addQuote,
  awardDecision,
  clock,
  createVendor,
  lineDecision,
  rateVendor,
  recommendAward,
  recordInvoice,
  recordPayment,
  recordReceipt,
  saveRequisition,
  setVendorStatus,
  updateKyc,
  type RequisitionInput,
} from './workflow';

export const DB_VERSION = 1;

/** Fictitious demo users. Rename them in Settings to your real team. */
export const SEED_USERS: User[] = [
  { id: 'u1', name: 'Adaeze Okafor', role: 'requester', department: 'Operations' },
  { id: 'u2', name: 'Tunde Bakare', role: 'requester', department: 'Facilities' },
  { id: 'u3', name: 'Ifeoma Nwosu', role: 'business_director', department: 'Business' },
  { id: 'u4', name: 'Kunle Adebayo', role: 'procurement_officer', department: 'Procurement' },
  { id: 'u5', name: 'Emeka Obi', role: 'head_procurement', department: 'Procurement' },
  { id: 'u6', name: 'Folake Adeyemi', role: 'finance', department: 'Finance' },
  { id: 'u7', name: 'Musa Ibrahim', role: 'stores', department: 'Stores' },
  { id: 'u8', name: 'Chidi Eze', role: 'coo', department: 'Executive' },
  { id: 'u9', name: 'Bola Martins', role: 'ceo', department: 'Executive' },
  { id: 'u10', name: 'System Admin', role: 'admin', department: 'IT' },
];

const DAY = 86_400_000;

export function buildSeed(): DB {
  const db: DB = {
    version: DB_VERSION,
    users: SEED_USERS,
    vendors: [],
    requisitions: [],
    policy: structuredClone(POLICY_V4),
    counters: {},
  };
  const U = Object.fromEntries(SEED_USERS.map((u) => [u.id, u])) as Record<string, User>;
  const realNow = Date.now();
  const at = (daysAgo: number) => (clock.now = () => realNow - daysAgo * DAY);

  // ---------- Vendors ----------
  at(120);
  const fullKyc = { cac: true, tin: true, taxClearance: true, references: true, financials: true, license: false };
  const mk = (name: string, cats: string[], acct: string, extra: Partial<Vendor> = {}) =>
    createVendor(db, U.u4, {
      name,
      rcNumber: 'RC' + acct.slice(4),
      tin: 'TIN-' + acct,
      vatNo: 'VAT-' + acct.slice(3),
      businessType: 'company',
      categories: cats,
      contactName: 'Sales Desk',
      email: name.toLowerCase().replace(/[^a-z]/g, '') + '@example.ng',
      phone: '+234 80' + acct.slice(2),
      address: 'Lagos, Nigeria',
      bank: { bankName: ['GTBank', 'Access Bank', 'Zenith Bank', 'UBA'][Number(acct[9]) % 4], accountName: name, accountNumber: acct },
      kyc: fullKyc,
      ...extra,
    });
  const vTech = mk('Lekki Tech Supplies Ltd', ['IT equipment'], '0123456781');
  const vByte = mk('ByteHub Nigeria Ltd', ['IT equipment'], '0223456782');
  const vCompu = mk('CompuMart West Africa', ['IT equipment'], '0323456783');
  const vClean = mk('SparkleClean Services', ['Facility services'], '0423456780');
  const vFresh = mk('Mainland Facility Care', ['Facility services'], '0523456781');
  const vPower = mk('Volta Power Systems', ['Power & energy', 'Facility services'], '0623456782');
  const vGen = mk('GenServe Engineering', ['Power & energy'], '0723456783');
  const vOffice = mk('Ikeja Office Mart', ['Stationery & consumables'], '0823456780');
  const vPrint = mk('Sharp Print Hub', ['Stationery & consumables'], '0923456781');
  mk('QuickFix Contractors', ['Works & construction'], '1023456782', {
    kyc: { cac: true, tin: false, taxClearance: false, references: false, financials: false, license: false },
  });
  at(115);
  for (const id of [vTech, vByte, vCompu, vClean, vFresh, vPower, vGen, vOffice, vPrint]) {
    updateKyc(db, U.u4, id, fullKyc);
    setVendorStatus(db, U.u5, id, 'approved', '');
  }

  // ---------- Requisitions through the real workflow ----------
  type Plan = {
    who: User;
    input: RequisitionInput;
    start: number; // days ago
    quotes?: { v: string; prices: number[]; days?: number; terms?: number; ok?: boolean }[];
    award?: { idx: number; just?: string; adv?: number };
    stopAt: 'line' | 'sourcing' | 'award' | 'po' | 'received' | 'scheduled' | 'paid' | 'closed';
    invoiceUplift?: number;
  };
  const items = (...xs: [string, number, string, number][]) => xs.map(([description, qty, unit, estUnitPrice]) => ({ description, qty, unit, estUnitPrice }));
  const base = (title: string, category: RequisitionInput['category'], its: RequisitionInput['items'], extra: Partial<RequisitionInput> = {}): RequisitionInput => ({
    title,
    category,
    neededBy: new Date(realNow + 14 * DAY).toISOString().slice(0, 10),
    budgetLine: category === 'goods' ? 'OPEX-IT-2026' : 'OPEX-FAC-2026',
    justification: 'Operational requirement approved in the 2026 budget.',
    items: its,
    route: 'standard',
    ...extra,
  });

  const plans: Plan[] = [
    {
      who: U.u1, start: 95, stopAt: 'closed',
      input: base('Laptops for new analysts', 'goods', items(['Laptop 14" i7 16GB 512GB SSD', 6, 'pcs', 1_150_000])),
      quotes: [{ v: vTech, prices: [1_090_000] }, { v: vByte, prices: [1_120_000] }, { v: vCompu, prices: [1_185_000] }],
      award: { idx: 0 },
    },
    {
      who: U.u2, start: 80, stopAt: 'closed',
      input: base('Quarterly office cleaning', 'services', items(['Office cleaning, 3 floors (quarter)', 1, 'lot', 2_400_000])),
      quotes: [{ v: vClean, prices: [2_250_000], terms: 30 }, { v: vFresh, prices: [2_180_000], terms: 30 }, { v: vPower, prices: [2_600_000] }],
      award: { idx: 0, just: 'SparkleClean scored higher on supervision and incumbent knowledge; 3.2% premium accepted by evaluation team.' },
    },
    {
      who: U.u2, start: 60, stopAt: 'paid',
      input: base('Generator servicing (500kVA)', 'services', items(['500kVA generator full service', 1, 'job', 850_000], ['Filters and lubricants', 1, 'set', 300_000])),
      quotes: [{ v: vGen, prices: [780_000, 290_000] }, { v: vPower, prices: [820_000, 310_000] }, { v: vFresh, prices: [760_000, 280_000], ok: false }, { v: vTech, prices: [900_000, 330_000] }],
      award: { idx: 0 },
    },
    {
      who: U.u1, start: 40, stopAt: 'scheduled',
      input: base('Laptops for audit team', 'goods', items(['Laptop 14" i7 16GB 512GB SSD', 3, 'pcs', 1_150_000])),
      quotes: [{ v: vByte, prices: [1_260_000] }, { v: vTech, prices: [1_240_000] }, { v: vCompu, prices: [1_300_000] }],
      award: { idx: 1 },
    },
    {
      who: U.u2, start: 30, stopAt: 'received', invoiceUplift: 0.06,
      input: base('Printer toner and paper', 'goods', items(['A4 paper 80gsm (box of 5 reams)', 40, 'box', 21_000], ['HP 59A toner', 10, 'pcs', 95_000])),
      quotes: [{ v: vOffice, prices: [19_500, 92_000] }, { v: vPrint, prices: [20_500, 89_000] }, { v: vByte, prices: [22_000, 99_000] }],
      award: { idx: 0 },
    },
    {
      who: U.u2, start: 24, stopAt: 'po',
      input: base('Inverter and battery bank for server room', 'goods', items(['10kVA inverter', 1, 'unit', 3_800_000], ['Lithium battery 5kWh', 4, 'unit', 1_900_000]), { budgetLine: 'CAPEX-PWR-2026' }),
      quotes: [{ v: vPower, prices: [3_650_000, 1_850_000], days: 10 }, { v: vGen, prices: [3_900_000, 1_820_000], days: 14 }, { v: vTech, prices: [4_100_000, 2_000_000] }],
      award: { idx: 0, adv: 40 },
    },
    {
      who: U.u1, start: 14, stopAt: 'award',
      input: base('Network switches upgrade', 'goods', items(['48-port managed switch', 4, 'pcs', 1_600_000])),
      quotes: [{ v: vByte, prices: [1_520_000] }, { v: vCompu, prices: [1_480_000] }, { v: vTech, prices: [1_610_000] }],
      award: { idx: 2, just: 'Lekki Tech offers 3-year onsite warranty and 48h replacement SLA; others offer 12-month return-to-base only.' },
    },
    {
      who: U.u1, start: 9, stopAt: 'sourcing',
      input: base('Staff ID card printer', 'goods', items(['ID card printer, dual-sided', 1, 'unit', 1_350_000], ['Blank PVC cards', 500, 'pcs', 450])),
      quotes: [{ v: vPrint, prices: [1_290_000, 420] }],
    },
    {
      who: U.u2, start: 8, stopAt: 'line',
      input: base('Fumigation of office complex', 'services', items(['Fumigation, full complex', 1, 'job', 420_000])),
    },
    {
      who: U.u2, start: 7, stopAt: 'line',
      input: base('Fumigation of annex building', 'services', items(['Fumigation, annex', 1, 'job', 380_000])),
    },
    {
      who: U.u2, start: 5, stopAt: 'award',
      input: base('Emergency generator alternator repair', 'services', items(['Alternator rewind and repair', 1, 'job', 1_200_000]), {
        route: 'emergency',
        routeJustification: 'Main generator failed during grid outage; server room on UPS with under 4 hours autonomy.',
      }),
      quotes: [{ v: vGen, prices: [1_150_000], days: 2 }],
      award: { idx: 0 },
    },
  ];

  for (const p of plans) {
    let d = p.start;
    at(d);
    const id = saveRequisition(db, p.who, p.input, true);
    if (p.stopAt === 'line') continue;
    at((d -= 1));
    lineDecision(db, U.u3, id, 'approved', 'Need and budget confirmed.');
    at((d -= 1));
    for (const q of p.quotes ?? [])
      addQuote(db, U.u4, id, {
        vendorId: q.v,
        unitPrices: q.prices,
        deliveryDays: q.days ?? 7,
        paymentTermsDays: q.terms ?? 30,
        validUntil: new Date(realNow + 30 * DAY).toISOString().slice(0, 10),
        technicallyCompliant: q.ok ?? true,
        reference: 'Q-' + Math.floor(1000 + Math.random() * 9000),
      });
    if (p.stopAt === 'sourcing' || !p.award) continue;
    const r = db.requisitions.find((x) => x.id === id)!;
    at((d -= 1));
    recommendAward(db, U.u4, id, {
      quoteId: r.quotes[p.award.idx].id,
      justification: p.award.just ?? '',
      advancePct: p.award.adv ?? 0,
      coiDeclared: true,
    });
    if (p.stopAt === 'award') {
      awardDecision(db, U.u5, id, 'approved', 'Process compliant.');
      continue;
    }
    for (const role of [...r.requiredApprovers]) {
      at((d -= 0.5));
      awardDecision(db, SEED_USERS.find((u) => u.role === role)!, id, 'approved', '');
    }
    if (p.stopAt === 'po') continue;
    at((d -= 7));
    const recv = r.items.map((i) => i.qty);
    recordReceipt(db, r.category === 'goods' ? U.u7 : p.who, id, {
      receivedQty: recv,
      acceptedQty: recv,
      witness: r.category === 'goods' ? p.who.name : '',
      comments: 'Delivered complete and in good condition.',
      satisfied: true,
    });
    if (p.stopAt === 'received' && !p.invoiceUplift) continue;
    at((d -= 2));
    const sub = Math.round(r.po!.subtotal * (1 + (p.invoiceUplift ?? 0)));
    recordInvoice(db, U.u6, id, { number: 'INV-' + r.number.slice(-4), date: new Date(clock.now()).toISOString().slice(0, 10), subtotal: sub, vat: Math.round(sub * 0.075) });
    if (p.stopAt === 'received' || p.stopAt === 'scheduled') continue;
    at((d -= 10));
    recordPayment(db, U.u6, id, { reference: 'TRF-' + r.number.slice(-4), wht: Math.round(sub * 0.05) });
    if (p.stopAt === 'paid') continue;
    at((d -= 1));
    rateVendor(db, p.who, id, { quality: 4, delivery: 4, price: 5, service: 4 });
  }

  // A blacklisted vendor for the register.
  at(3);
  const bad = mk('Shadow Logistics Ventures', ['Logistics'], '1123456783');
  setVendorStatus(db, U.u8, bad, 'blacklisted', 'Submitted forged tax clearance certificate (verified with FIRS/NRS portal).');

  clock.now = () => Date.now();
  return db;
}
