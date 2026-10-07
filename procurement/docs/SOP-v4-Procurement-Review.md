# The Zone: Procurement SOP v4 and Expert Review

**Prepared for:** CEO, Workforce Group
**Reviewed:** Procurement Policy & Procedure TZ/FA/PP/001 v3.0 and the five-step PV workflow infographic
**Status:** Draft for management approval

---

## 1. Executive summary

The team is not failing the process. **The process is set up so that non-compliance is the easy option.** Four design faults drive most of the leakage:

1. **The requisition is raised on the Payment Voucher.** Commitment, approval and payment sit on one email-borne document, so there is no PO, no commitment control and no 3-way match. Under this design, "No PO, no pay" cannot be enforced.
2. **The sequence is wrong, and the policy says it is optional.** The Business Director approves after a vendor is chosen, so they are anchored to a price rather than approving a need. Section 4.2 then says the steps "might not be followed sequentially", which in practice permits people to skip them.
3. **Segregation of duties is broken.** Procurement sources, issues the PO, inspects the goods, raises the GRN and requests payment. When one unit controls the whole chain, collusion and inflated prices go undetected.
4. **The thresholds are out of date.** ₦10,000 and ₦500,000 have not moved since 2023. At 2025-26 exchange rates ₦500k is roughly US$330, so almost every purchase is "high value" and needs three quotes. When the rule is that impractical, people stop following it.

**What v4 does:** a 10-step procure-to-pay process, a value-tiered delegation of authority, receipt moved out of Procurement, a 3-way match, and fraud controls on bank-detail changes. The new web app enforces all of this: a step cannot be skipped, an unapproved vendor cannot be paid, and every deviation goes on the exceptions register automatically.

**Expected impact** (benchmarks to validate locally): mature procure-to-pay controls typically deliver **5-10% savings on addressable spend**, cut maverick spend to **under 5%**, and bring PR-to-PO cycle time **under 7 days**.

---

## 2. Diagnostic: v3 gaps ranked by margin risk

| # | Gap in v3 / current workflow | Risk | v4 fix | Enforced in app |
|---|---|---|---|---|
| 1 | Requisition raised on the PV; no PO in the infographic | **High**: no commitment control; payment without contract | PR → PO → GRN/JCC → Invoice → Payment | Yes |
| 2 | Procurement inspects, raises GRN and requests payment | **High**: collusion and phantom deliveries | Stores receives goods; requester signs JCC | Yes |
| 3 | "Steps might not be followed sequentially" (s.4.2) | **High**: licenses bypass | Delete. The process is sequential | Yes |
| 4 | No bank-detail change control | **High**: change-of-account (BEC) fraud | Finance call-back verification; payments frozen until verified | Yes |
| 5 | No split-purchase rule | **High**: threshold evasion | Department + category look-back over 30 days | Yes (detected) |
| 6 | "Approval Matrix" referenced but not defined | **High**: approvals by habit, not authority | Value-tiered DoA (section 4) | Yes |
| 7 | BD approves after sourcing | Medium: anchoring; wasted sourcing effort | BD approves need and budget first | Yes |
| 8 | Thresholds of ₦10k and ₦500k | Medium: friction drives workarounds | Re-banded tiers, configurable | Yes |
| 9 | Unlimited advance payments (infographic) | Medium: vendor default exposure | Advance capped at 50%, needs approval | Yes |
| 10 | No price history | Medium: three collusive quotes still look competitive | Each PO compared with last price paid | Yes |
| 11 | Maverick buying has no consequence | Medium | COO + CEO ratification; monthly exceptions report | Yes |
| 12 | Vendor evaluation form has no criteria or weights | Medium | Weighted scorecard: quality 35, delivery 25, price 25, service 15 | Yes |
| 13 | No KPIs | Medium | Eight-metric dashboard (section 7) | Yes |
| 14 | Conflict-of-interest policy is stated but not operational | Medium | Declaration required for every award | Yes |
| 15 | No duplicate-invoice check | Medium: double payment | Same vendor + invoice number blocked | Yes |
| 16 | Ownership unclear (prepared by Facility & Admin, owned by Procurement, infographic roles differ) | Low | Single owner: Head of Procurement; annual review | Policy |
| 17 | No contract management or emergency route | Low | Emergency and sole-source routes with ratification | Yes |

---

## 3. The v4 process (procure-to-pay)

**Golden rules:** *No budget, no requisition. No PO, no commitment. No GRN/JCC and match, no payment.*

| Step | Owner | What happens | System control |
|---|---|---|---|
| 1. Requisition | Requester | Spec, quantity, estimate, budget line, need-by date | Blocks missing budget line; routes petty cash out |
| 2. Line approval | Business Director | Approves **need and budget**, not a vendor | Only BD; comment required to return/reject |
| 3. Sourcing | Procurement Officer | RFQ to **approved, KYC-current** vendors only | Blocked vendors cannot quote |
| 4. Award recommendation | Procurement Officer | Lowest compliant quote by default; comparative bid analysis | Minimum quotes by tier; written justification if not lowest; COI declaration |
| 5. Award approval | DoA chain | HoP validates compliance, then Finance/COO/CEO by tier | Sequential; requester cannot approve; same person cannot approve twice |
| 6. Purchase Order | System | PO generated on final approval and sent to vendor | Only valid commitment |
| 7. Receipt | Stores (goods) / Requester (services) | GRN witnessed by the requesting unit; JCC by the service owner | Procurement cannot receive |
| 8. Invoice and 3-way match | Finance | PO price × accepted qty vs invoice | Outside 2% tolerance: blocked; duplicate invoices rejected |
| 9. Payment | Finance | On due date per terms, to the vendor-master account only | Frozen if bank change pending; advance netted off |
| 10. Rate and close | Requester | Quality, delivery, price, service scored | Feeds vendor scorecard |

**Exception routes** (logged, escalated, reported monthly):

- **Emergency:** business continuity at risk. One quote allowed. COO approval. Ratified within 72 hours.
- **Sole source:** only one capable supplier, with a written justification. COO approval.
- **Retrospective (maverick):** the purchase was made before a PO existed. COO **and** CEO ratification. Repeated offences go to HR as a conduct matter.

---

## 4. Delegation of authority (recommended v4)

| Tier | Value (₦) | Min. quotes | Award approvers (after BD line approval) |
|---|---|---|---|
| Petty cash | < 50,000 | n/a | Petty-cash procedure, monthly cap |
| 1 · Low | 50,000 – 500,000 | 2 | Head of Procurement |
| 2 · Medium | 500,000 – 5,000,000 | 3 | HoP → Head of Finance |
| 3 · High | 5,000,000 – 25,000,000 | 3 + evaluation committee | HoP → Finance → COO |
| 4 · Strategic | > 25,000,000 | 4, sealed RFP | HoP → Finance → COO → CEO |

> **Calibration needed:** these bands are a starting point. Set them so that about 80% of transactions (by count) fall in Tiers 1-2 and about 80% of value in Tiers 2-4. Run the app for one quarter, then re-band using the spend export. All bands can be changed in **Policy & settings** without code changes.

---

## 5. Vendor management

- **Onboarding:** Procurement onboards the vendor. A **different** person (HoP or COO) approves it. Mandatory documents: CAC, TIN, tax clearance. Strongly recommended: two references, three years of financials, and a regulatory licence where relevant.
- **Duplicates:** blocked by name, TIN or bank account.
- **Re-validation:** KYC every 12 months. Lapsed vendors cannot quote, receive POs or be paid.
- **Bank changes:** logged by Procurement; Finance verifies by **calling the number already on file**, never a number supplied with the request. Payments stay frozen until then.
- **Performance:** weighted scorecard after every job, reviewed quarterly. Suspension: HoP or COO. Blacklisting: COO only, with a written reason.

---

## 6. RACI

| Activity | Requester | BD | Proc. Officer | HoP | Finance | COO/CEO |
|---|---|---|---|---|---|---|
| Define need & spec | R | A | C | | | |
| Budget confirmation | C | A | | | C | |
| Vendor onboarding & KYC | | | R | A | C | I |
| RFQ & bid analysis | C | | R | A | | |
| Award approval | I | I | R | A | A (T2+) | A (T3+) |
| Receipt (GRN/JCC) | R | | I | | I | |
| 3-way match & payment | I | | C | | R/A | |
| Bank-detail change | | | R | C | A | |
| Blacklisting | | | R | C | I | A |
| Exception ratification | R | C | C | C | C | A |

---

## 7. KPIs and targets

| KPI | Definition | Target |
|---|---|---|
| Savings vs budget | (Estimate − PO value) / estimate | ≥ 5% |
| Process compliance | Requisitions with no high-severity flag | ≥ 95% |
| Exception spend | PO value carrying a high flag / total PO value | < 5% |
| Quote coverage | POs meeting the minimum-quote rule | ≥ 98% |
| PR → PO cycle time | Submission to PO issue | ≤ 7 days |
| On-time delivery | GRN date ≤ PO due date | ≥ 90% |
| First-time invoice match | Invoices passing 3-way match first time | ≥ 95% |
| SLA breaches | Open items over stage SLA | Trending to zero |

---

## 8. 90-day turnaround plan

| Window | Actions | Owner |
|---|---|---|
| **Days 0-14: Stop the bleeding** | CEO memo: "No PO, no pay" effective on a set date. Freeze new vendors pending re-KYC. Finance verifies bank details for the top 20 vendors by spend. Approve v4 tiers. | CEO, Finance |
| **Days 15-45: Switch on the system** | Load real users and vendors. Train every role in a 60-minute session per role. Run v3 and the app in parallel for 2 weeks, then retire the PV-led process. | HoP, IT |
| **Days 46-90: Drive performance** | Monthly exceptions review at ExCo. Publish the KPI dashboard. Re-tender the top 10 spend categories. Set up framework agreements for repeat items. Put procurement KPIs into the team's scorecards. | HoP, COO |

**People:** turnaround depends on consequences. Tie at least 30% of the procurement team's variable pay to compliance and savings KPIs. Treat repeated maverick buying by any requester as a conduct issue, not a process issue.
