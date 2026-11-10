# Membership gutters and unsigned enrollment revisions

## Scope

- Gutter cleaning is selectable in the custom membership plan for every visit, selected visits, or as an optional add-on.
- Gutter pricing is property-specific and starts at zero until the owner quotes it. Exact visit totals retain precedence.
- Included/optional gutter scope survives saved drafts, presentation slides, enrollment snapshots, review PDFs, signature completion, and member care plans.
- Earlier plans and frozen packets do not acquire gutter scope implicitly.

## Release order

1. Apply `20261110200806_safe_native_enrollment_revision.sql` before releasing application code.
2. Deploy application code and verify production uses the expected commit.
3. Allow older in-flight signature requests to finish. Database guards also reject stale snapshot insertion and conflicting signing paths.
4. Recheck the target presentation and packet are unsigned, with no started signature or membership.
5. Update the editable proposal with the owner-approved scope, prices, summary, and notes. Preserve unrelated customer details and disclosures.
6. Reopen the presentation's secure enrollment handoff. HQ can use **Revise and resend unsigned agreement**. Verify the recipient, saved plan, visit totals, annual total, and existing payment/sales context. Enter a reason and explicitly confirm old-link invalidation.
7. Submit once. Verify the revision audit event, corrected snapshot, previous-link revocation, and accepted email event. An uncertain response is not permission to resend.

## Safety behavior

The revision transaction locks the packet, archives the previous packet in the private event ledger, revokes old link history, rotates the current token, and preserves signed records. Native signing claims the same packet before side effects. A started signature permanently blocks revision until reviewed; do not clear the claim automatically.

Revision delivery is a single explicit attempt. If email acceptance or request completion is uncertain, inspect the event ledger and provider records before taking further action. Do not switch the packet back to a draft manually to force another email.

Signed documents, payment authorization, actual charges, and actual card setup are outside this release. A new enrollment email asks the customer to review and sign; it does not sign or charge for them.

## Validation

Run unit tests, lint, TypeScript, production build, and migration audit. The focused suites include gutter model/editor interactions, exact $714 twice-yearly scope continuity, frozen-packet legacy behavior, and revision/signature safety. Execute `scripts/test-native-enrollment-revision.mjs` using an isolated PGlite installation for database transaction and privilege checks. Never point the integration script at production.

## Rollback

The migration is additive. Do not drop its audit data or revoke history during rollback. Do not roll back to application code that can overwrite or reuse a revised packet without the new guards. Resolve deployment or delivery errors with the packet held closed for review.
