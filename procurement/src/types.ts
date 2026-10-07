export type Role =
  | 'requester'
  | 'business_director'
  | 'procurement_officer'
  | 'head_procurement'
  | 'finance'
  | 'stores'
  | 'coo'
  | 'ceo'
  | 'admin';

export const ROLE_LABEL: Record<Role, string> = {
  requester: 'Requester',
  business_director: 'Business Director',
  procurement_officer: 'Procurement Officer',
  head_procurement: 'Head of Procurement',
  finance: 'Head of Finance',
  stores: 'Stores / Receiving',
  coo: 'Chief Operating Officer',
  ceo: 'Chief Executive Officer',
  admin: 'System Admin',
};

export interface User {
  id: string;
  name: string;
  role: Role;
  department: string;
}

export type Category = 'goods' | 'services' | 'works';

export type Stage =
  | 'draft'
  | 'line_approval'
  | 'sourcing'
  | 'award_approval'
  | 'po_issued'
  | 'received'
  | 'match_exception'
  | 'payment_scheduled'
  | 'paid'
  | 'closed'
  | 'rejected'
  | 'cancelled';

export const STAGE_LABEL: Record<Stage, string> = {
  draft: 'Draft / Returned',
  line_approval: 'Line approval (BD)',
  sourcing: 'Sourcing & quotes',
  award_approval: 'Award approval',
  po_issued: 'PO issued, awaiting delivery',
  received: 'Received, awaiting invoice',
  match_exception: '3-way match exception',
  payment_scheduled: 'Payment scheduled',
  paid: 'Paid, awaiting vendor rating',
  closed: 'Closed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export const PIPELINE: Stage[] = [
  'draft',
  'line_approval',
  'sourcing',
  'award_approval',
  'po_issued',
  'received',
  'payment_scheduled',
  'paid',
  'closed',
];

export interface LineItem {
  description: string;
  qty: number;
  unit: string;
  estUnitPrice: number;
}

export interface Quote {
  id: string;
  vendorId: string;
  unitPrices: number[]; // aligned to requisition.items
  deliveryDays: number;
  paymentTermsDays: number;
  validUntil: string;
  technicallyCompliant: boolean;
  reference: string;
  receivedAt: string;
  notes?: string;
}

export interface Approval {
  role: Role;
  userId: string;
  decision: 'approved' | 'returned' | 'rejected';
  at: string;
  comment?: string;
}

export interface PurchaseOrder {
  number: string;
  issuedAt: string;
  issuedBy: string;
  vendorId: string;
  unitPrices: number[];
  subtotal: number;
  vat: number;
  total: number;
  deliveryDue: string;
  paymentTermsDays: number;
  advancePct: number;
}

export interface Receipt {
  kind: 'GRN' | 'JCC';
  number: string;
  at: string;
  recordedBy: string;
  witness: string;
  receivedQty: number[];
  acceptedQty: number[];
  comments: string;
  satisfied: boolean;
}

export interface Invoice {
  number: string;
  date: string;
  subtotal: number;
  vat: number;
  recordedBy: string;
  recordedAt: string;
  matchVariancePct: number;
  matched: boolean;
}

export interface Payment {
  kind: 'advance' | 'final';
  amount: number;
  wht: number;
  reference: string;
  at: string;
  by: string;
}

export interface HistoryEntry {
  at: string;
  userId: string;
  action: string;
  note?: string;
}

export interface VendorRating {
  reqId: string;
  quality: number;
  delivery: number;
  price: number;
  service: number;
  onTime: boolean;
  at: string;
  by: string;
}

export interface Requisition {
  id: string;
  number: string;
  title: string;
  category: Category;
  department: string;
  requesterId: string;
  createdAt: string;
  submittedAt?: string;
  neededBy: string;
  budgetLine: string;
  justification: string;
  items: LineItem[];
  route: 'standard' | 'emergency' | 'sole_source' | 'retrospective';
  routeJustification?: string;
  preferredVendorId?: string;
  stage: Stage;
  quotes: Quote[];
  awardQuoteId?: string;
  awardJustification?: string;
  requiredApprovers: Role[];
  approvals: Approval[];
  lineApproval?: Approval;
  advancePct: number;
  coiDeclared: boolean;
  po?: PurchaseOrder;
  receipt?: Receipt;
  invoice?: Invoice;
  payments: Payment[];
  paymentDue?: string;
  rated?: boolean;
  history: HistoryEntry[];
  stageEnteredAt: string;
}

export type VendorStatus = 'pending' | 'approved' | 'suspended' | 'blacklisted';

export interface Vendor {
  id: string;
  name: string;
  rcNumber: string;
  tin: string;
  vatNo: string;
  businessType: 'company' | 'enterprise' | 'individual';
  categories: string[];
  contactName: string;
  email: string;
  phone: string;
  address: string;
  bank: { bankName: string; accountName: string; accountNumber: string };
  pendingBank?: { bankName: string; accountName: string; accountNumber: string; requestedBy: string; requestedAt: string };
  kyc: { cac: boolean; tin: boolean; taxClearance: boolean; references: boolean; financials: boolean; license: boolean };
  kycReviewedAt?: string;
  status: VendorStatus;
  statusReason?: string;
  recommendedBy?: string;
  approvedBy?: string;
  createdAt: string;
  ratings: VendorRating[];
  history: HistoryEntry[];
}

export interface Tier {
  id: string;
  name: string;
  min: number;
  max: number | null;
  minQuotes: number;
  approvers: Role[];
  committee: boolean;
}

export interface PolicyConfig {
  name: string;
  pettyCashLimit: number;
  tiers: Tier[];
  vatRate: number;
  matchTolerancePct: number;
  maxAdvancePct: number;
  splitWindowDays: number;
  priceVarianceAlertPct: number;
  estimateOverrunAlertPct: number;
  kycValidityMonths: number;
  slaDays: Partial<Record<Stage, number>>;
}

export interface DB {
  version: number;
  users: User[];
  vendors: Vendor[];
  requisitions: Requisition[];
  policy: PolicyConfig;
  counters: Record<string, number>;
}
