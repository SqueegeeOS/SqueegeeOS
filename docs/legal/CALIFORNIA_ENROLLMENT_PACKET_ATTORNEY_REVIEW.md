# California HomeAtlas enrollment packet — attorney review brief

> **Status: attorney-review draft. Do not send this document to customers or mark either database version approved until California counsel has approved the exact DocuSign template.** This is a product and operations specification, not legal advice.

HomeAtlas uses one DocuSign envelope containing two visibly separate documents. The customer signs once through DocuSign, then receives a separate Stripe-hosted page to save a payment method. The signed envelope, completion certificate, quote snapshot, provider event history, and final portal link remain connected to one enrollment record.

Complete proposed drafts for counsel are in `docs/legal/drafts/`. They now include the business terms, payment rails, service-concern process, responsibility framework, dispute process, renewal controls, add-on evidence, and a conditional customer-home cancellation insert. They are deliberately blocked from customer use and should be redlined by counsel before the matching database versions are approved.

## Document 1 — California LLC Master Service Agreement

The MSA should hold durable relationship terms that do not need to be rewritten for each property or visit:

1. Exact legal seller name, entity type, business address, notice email, and phone.
2. Customer identity and the relationship between the MSA and future Service/Quote Agreements.
3. General service standards, reasonable property access, customer responsibilities, weather and safety rescheduling, and re-service process.
4. Payment-method authorization framework. Property-specific prices and cadence belong in the Service/Quote Agreement.
5. Warranty or satisfaction process, permitted subcontracting, insurance language, and records/electronic signatures.
6. A proposed responsibility framework, direct-loss treatment, good-faith dispute process, California governing law, assignment, severability, and complete-agreement terms for counsel to accept or redline.
7. Order of precedence: the property-specific Service/Quote Agreement controls a conflict about scope, price, cadence, cancellation disclosure, or property terms; the MSA controls the remaining relationship terms.

## Document 2 — Property Service & Quote Agreement

This document is the customer-facing deal sheet and must stay plain-language and specific:

1. Property address and customer contact information.
2. Exact first-visit price, recurring per-visit price, estimated annualized value, cadence, taxes/credits if applicable, and whether the first rate differs from the continuing rate.
3. Included work for every visit plus visit-specific work. Screens, interior glass, cobweb removal, pressure washing, solar panels, and other add-ons must be explicitly included, optional, or excluded.
4. The Jobber-scheduled-service payment authorization already used by HomeAtlas, including variable additional services, billing on the first of the scheduled service month, and no payment at the door.
5. Initial term, renewal period, frequency/range of charges, and a clear affirmative-consent block placed next to the signature.
6. Cancellation policy, cancellation email/link, any initial-term enrollment-savings reimbursement, and the precise effect of cancellation.
7. Material-change and fee-change process. A fee change is prospective, not retroactive, and its notice must include a direct cancellation method. HomeAtlas operations should send a retainable notice no fewer than 7 and no more than 30 days before the new fee takes effect.
8. Annual renewal/continuous-service reminder language and delivery channel.
9. The MSA version incorporated by reference and the order-of-precedence sentence.

The live member portal includes a direct, token-authenticated **Request membership cancellation** action. It timestamps a private customer service case without requiring a reason and is not blocked by the ordinary open-case limit. Counsel should approve the effective-date language and whether a separate email acknowledgment is required.

## Home-solicitation lane for David and future D2D sales

California Civil Code sections 1689.5–1689.7 may apply to qualifying service agreements made away from the seller's normal business premises. Counsel should confirm the exact lane and any exception for SqueegeeKing window-cleaning memberships before HomeAtlas sends the conditional insert.

The HomeAtlas handoff therefore records where the sale was made:

- `customer_home`: requires the owner to choose the attorney-approved 3-business-day or senior 5-business-day notice lane before sending.
- `business_premises`, `remote`, or `other`: does not automatically insert the home-solicitation notice; counsel controls the final template logic.

For the home-solicitation lane, counsel should confirm:

- same-language requirement as the oral presentation;
- the conspicuous cancellation statement next to the signature;
- seller name, address, notice email, signing date, and phone on page one;
- the required detachable/duplicate Notice of Cancellation treatment in an electronic DocuSign envelope;
- the oral explanation David must give at signing; and
- whether giving every D2D buyer a longer voluntary cancellation period changes the statutory wording that must appear.

The current working insert is in `docs/legal/drafts/CALIFORNIA_CUSTOMER_HOME_CANCELLATION_NOTICE_DRAFT.md`. It gives counsel concrete text and implementation questions instead of leaving this entire lane blank.

## DocuSign template contract

Create one DocuSign template containing both documents in this order:

1. `California LLC Master Service Agreement`
2. `Property Service & Quote Agreement` (including any required Notice of Cancellation pages)

The template must have one remote signer role named `Customer` and locked text tabs with the labels documented in `lib/enrollment/docusign-tabs.ts`. HomeAtlas will refuse to send unless both database document versions are approved and the provider configuration is complete.

The private `/hq/enrollment` Activation Map now exposes the exact production Connect callback, Customer-role name, required tab-label manifest, missing environment-variable names, and ordered launch steps. Its DocuSign probe is read-only: it obtains an OAuth token and reads the configured template definition, documents, recipients, and recipient tabs. It does not create an envelope, send an email, approve a document version, or touch Stripe. A passing probe therefore proves the JWT/template contract only; the HMAC-signed Connect path still requires one business-owned end-to-end rehearsal.

After counsel approves the exact PDFs/template:

1. Calculate a SHA-256 hash for each approved source document.
2. Change each matching `agreement_document_versions` row to `approved` with `content_sha256`, `approved_at`, and `approved_by`.
3. Configure the DocuSign, legal identity, Stripe, Resend, and public-origin environment variables in Vercel.
4. Grant DocuSign JWT impersonation consent once for the integration user.
5. Configure DocuSign Connect to post JSON envelope events to `/api/integrations/docusign/connect` with HMAC signing enabled.
6. Run the read-only DocuSign check in `/hq/enrollment` and resolve every template mismatch before any envelope is created.
7. Add `setup_intent.succeeded` to the existing Stripe webhook endpoint, then send a test packet to a business-controlled email, finish DocuSign, finish Stripe setup, and verify the portal.
8. Only after that end-to-end test succeeds, set `STRIPE_ENROLLMENT_SETUP_WEBHOOK_CONFIRMED=true` and use the workflow with a real customer.

## Sources counsel should review

- California Civil Code §§ 1689.5–1689.7 (home solicitation definition, cancellation rights, contract/notice mechanics).
- California Business and Professions Code § 17602 (automatic renewal and continuous-service consent, acknowledgments, cancellation, reminders, and fee/material-change notices).
- California Civil Code § 1671 (consumer liquidated-damages review for any initial-term savings reimbursement).
- California Civil Code § 1633.7 (legal effect of electronic records and signatures).
- Existing HomeAtlas Jobber-scheduled-service billing disclosure and automatic-billing authorization hash.
