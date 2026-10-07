# Workforce Procure (The Zone)

A procure-to-pay web app that enforces Procurement SOP v4. Every step, approval and payment control from the SOP is checked in code before an action is accepted.

- **Workflow:** Requisition → BD line approval → Sourcing (RFQ, comparative bid analysis) → Tiered award approval → PO → GRN/JCC → Invoice 3-way match → Payment → Vendor rating
- **Controls:** value-tiered delegation of authority, minimum quotes, lowest-bid justification, conflict-of-interest declaration, segregation of duties on receipt, 3-way match with tolerance, duplicate-invoice block, advance-payment cap, vendor KYC expiry, bank-change call-back verification
- **Detection:** split purchases, maverick/retrospective buys, price above last paid, award above estimate, SLA breaches
- **Dashboards:** savings, compliance %, exception spend, cycle time, quote coverage, spend by vendor and department, vendor scorecards
- **Documents:** printable branded PO, CSV exports, JSON backup/restore

The policy review and SOP v4 are in [`docs/SOP-v4-Procurement-Review.md`](docs/SOP-v4-Procurement-Review.md).

## Run

```bash
cd procurement
npm install
npm run dev      # http://localhost:3100
npm test         # workflow and policy unit tests
npm run build    # static build in dist/, deployable to any static host
```

Use **Acting as** at the bottom of the sidebar to switch roles and walk a requisition end to end. The demo data is fictitious. Rename users in **Policy & settings**.

## Architecture

| File | Purpose |
|---|---|
| `src/policy.ts` | Pure rules: tiers, approval chains, 3-way match, compliance flags, split detection |
| `src/workflow.ts` | Commands (submit, approve, quote, award, receive, invoice, pay); each one throws `PolicyError` when a guard fails |
| `src/store.tsx` | State + persistence adapter (browser storage for the pilot) |
| `src/seed.ts` | Demo data generated through the real workflow, so the seed is itself an integration test |
| `src/views/*` | Screens |

## Going to production

The pilot keeps data in the browser, so each user sees only their own copy. For a real multi-user rollout:

1. Replace `load`/`save` in `src/store.tsx` with API calls to a shared database (Supabase/Postgres, Zoho Creator or a small Node service).
2. Run the same `workflow.ts` guards **on the server**, so no one can bypass them from the browser.
3. Add SSO (Microsoft 365/Google) and map users to roles.
4. Add email or Teams notifications when an item lands in someone's queue.
5. Add document attachments (quotes, invoices, KYC files) in object storage.
