# Jobber visit classification — PR3 runbook

**Status:** Repository implementation only; migration 039 is not applied
**Scope:** Supervised, per-visit schedule authority after PR2 coverage proof
**Authority:** Jobber remains appointment and dispatch truth; HomeAtlas stores the reviewed classification and customer-visible appointment projection
**Non-goals:** Automatic matching, obligation fulfillment, Jobber writes, completed-visit promotion, provider pricing, pricing snapshots, billing execution, Stripe, agreement or membership changes, add-ons, Property Memory, assets, or service observations

## What PR3 changes

An authenticated Headquarters owner or operator may approve or reject one
exact synced Jobber visit. Approval is one migration-039 security-definer
transaction callable only by the service role. The transaction locks and
rechecks:

1. the authenticated, active Headquarters actor row with `FOR SHARE`, so a
   concurrent role change or deactivation orders before or after the decision;
2. the exact connection's PR2 sync-reservation row with `FOR UPDATE`, requiring
   `active_run_id` to be null even when a prior lease has expired;
3. the exact projection ID and 64-character source hash;
4. the exact active property-link ID and `updated_at` review token;
5. projection and property-link connection equality;
6. projection and property-link external-property equality;
7. the exact membership/property/homeowner relationship, completed agreement,
   active status, payment-setup timestamp, tier, and visit price;
8. an existing member profile for the membership homeowner;
9. the projection/hash in pass two of the latest PR2 watermark run, with the
   causally latest run (ordered by the monotonic sequence assigned by the
   post-lock reservation insert) exactly equal to that COMPLETE watermark, no
   unfinished reservation (including an expired lease), and a watermark no
   older than 30 minutes;
10. an explicit service type from `isMembershipAppointmentType`; and
11. an unambiguously future provider record with `visit_status='UPCOMING'`,
    `is_complete=false`, `completed_at=null`, and a non-null future
    `scheduled_start`.

Jobber title text is evidence for the operator only. It never selects the
HomeAtlas service type. Unknown, missing, past, completed, or contradictory
provider state cannot be approved. An operator may record a rejection against
stable evidence, but rejection creates no appointment authority.

Approval creates or advances exactly one `member_appointments` row identified by
`provider='jobber'` and the real external visit ID. It binds the reviewed
classification, projection, connection, property link, link token, membership,
property, source hash, selected service type, and scheduled instant.
`matched_obligation_id` remains null. Replays return the existing decision;
one global provider/external advisory lock plus unique classification and
provider/external appointment identities serialize concurrent attempts. An
existing appointment is reusable only when its connection, projection,
property link, property, membership, member profile, classification, and
provider/external identity all match. Otherwise the whole decision conflicts.
Reapproval advances only reviewed schedule/source authority fields; it does not
clear technician, notes, completion, obligation, or unrelated history.

The concurrency order is deliberately compatible with PR2. A decision locks
the actor, then the exact connection sync row, then projection/link/membership,
watermark, classification, and appointment authority. PR2 begin locks that same
sync row before reserving a run. PR2 finalization locks its run, then the sync
row, then the watermark; the decision never locks a run row, so it introduces
no reverse run-to-sync edge. If approval holds the sync row first, it commits
against stable current coverage before begin can reserve. If begin/finalize
holds it first, approval waits and then either sees a new COMPLETE watermark or
fails because a run remains reserved.

## Evidence and invalidation

`jobber_visit_classifications` holds current authority. Every approved,
rejected, and revoked decision is copied to the immutable
`jobber_visit_classification_events` ledger with actor, reason, exact projection
snapshot, source hash, property-link token, membership, property, service type,
appointment identity, and timestamps.

The existing PR2 projection event and source-observation ledgers remain the
immutable provider-source history. Migration 039 adds three fail-closed fences:

- a changed projection source hash moves an approved classification and its
  appointment to `pending_review` in the same PR2 finalization transaction;
- any property-link token change, including revocation, does the same in the
  property-link transaction;
- after a later durable COMPLETE watermark is finalized, omission of the exact
  connection/projection external visit moves approved classification and
  appointment authority to `pending_review` in that same transaction and
  appends `manifest_omission_invalidated` evidence.

No fence marks a visit cancelled, deleted, or complete. The previously reviewed
source and link evidence remain on the classification event. A later explicit
approval against the new source hash or link token updates the same
provider/external appointment identity and appends new decision evidence. If
the existing appointment is completed, cancelled, obligation-bound, or bound
to a different classification, reapproval fails closed instead of overwriting
it.

If reviewed source, schedule, or link-token evidence changes before rejection,
or a revoked link is relinked to a different HomeAtlas home, the mutable current
classification detaches its old `appointment_id` before recording the new
evidence-only decision. A `binding_detached` event preserves the complete prior
appointment pairing.
A matching transactional update also clears the prior appointment's live
`jobber_visit_classification_id`, preventing either side of the old relationship
from reaching mutable evidence for the new home. Detachment requires the old
provider/external identity, profile/homeowner, property, membership, projection,
link token, source identity, service, schedule, and safe non-completed state to
match the immutable evidence; any mismatch conflicts without rebinding.
A rejection updates appointment state only when the appointment's profile,
property, classification, connection, projection, property link, membership,
source, schedule, provider/external identity, and safe scheduled state all
match the current review. A changed-source, changed-link-token, or
different-home rejection is evidence only: its event carries the newly reviewed
evidence and a null appointment ID, while the prior appointment retains its old
source/link/history under the earlier fail-closed state. Only approval may
advance appointment source or link authority tokens after full exact
revalidation. Technician assignment, notes, and unrelated history are never
cleared.

Explicit classification revocation records a new immutable actor decision and
removes appointment authority without deleting the classification, appointment,
or prior events. It locks and revalidates the appointment's complete historical
provider, profile/homeowner, property, membership, classification, projection,
link-token, source, schedule, and non-completed authority before either row is
changed; drift conflicts without writing revocation state.

## Today, Headquarters, and portal visibility

All touched Headquarters and portal schedule reads retain the existing Jobber
provider/provenance/verification/match checks and additionally require:

- `jobber_authority_state='approved'`; and
- a non-null classification binding; and
- the exact classification-bound membership ID.

Today obtains the same appointment ID and `scheduled_at` instant that the
portal consumes. Display grouping converts that instant to the
`America/Los_Angeles` calendar date; it no longer slices the UTC date. Today
continues to show `memberships.visit_price`. No Jobber price or total is read.

The operator listing is capped at 100 rows and says when the bound is reached.
It queries nearest future `UPCOMING` visits first, then fills unused capacity
with newer non-priority evidence, so older coverage rows cannot crowd out the
next visits awaiting review.
Its coverage badge reports complete, partial, or stale PR2 state, but the list
always sets `routeCompletenessClaimed=false`. A fresh individual approval is
not proof that the whole route was observed. Approve/reject controls are
disabled unless coverage is complete, no older than 30 minutes, and no sync is
currently running. A newer running row with an expired or absent lease remains
`coverage_not_ready`; the status API truthfully reports no active sync while it
does not mislabel the older watermark complete. Revocation remains available as
a fail-closed safety action.

## API boundary

- `GET /api/admin/care-operations/jobber/visit-classifications` is uncached and
  returns the bounded supervised review workspace.
- `POST /api/admin/care-operations/jobber/visit-classifications` records
  `approve` or `reject` using the actor returned by `authorizeHqApiRequest()`.
- `POST /api/admin/care-operations/jobber/visit-classifications/revoke`
  revokes the exact current classification/update token with the same actor
  boundary.

Authorization runs before JSON parsing or domain work. Invalid input is 400,
missing durable evidence is 404, stale or contradictory evidence is 409, and
storage failure is 503. Routes do not log request bodies, projection payloads,
source hashes, property data, reasons, or actor details.

## Hard boundaries

PR3 application code and migration 039 make no writes or calls to obligations,
pricing snapshots or the Atlas Pricing Engine, billing orders or charges,
Stripe, signed agreements, membership state or price, add-ons, property assets,
service observations, or Property Memory. The approval transaction reads
membership and completed-agreement truth only to fail closed.

No Jobber API call is added. PR3 operates only on PR2's durable projections and
coverage evidence.

## Release prerequisites

These steps require separate approval. This runbook does not authorize a
migration, deployment, real sync, or customer-data write.

1. Prove the production migration ledger through 038 before considering 039.
2. Rehearse migrations 035–039 twice on a disposable Supabase project.
3. Run the rollback-only SQL harness:

   ```bash
   psql --set ON_ERROR_STOP=1 --file lib/persistence/supabase/tests/039_jobber_visit_classification.sql
   ```

4. Prove classification tables have RLS, no `anon`/`authenticated` access,
   service-role select only, and service-role-only execute on both decision
   RPCs. Prove the legacy anonymous `member_appointments` policy is absent.
5. Exercise inactive/revoked HQ actors, stale source hashes, stale link tokens,
   stale/partial/running coverage (including expired unfinished reservations),
   membership disagreement, same external ID across different homes/connections,
   approve-home-A → revoke/relink-home-B → reject, property-link revocation,
   source reschedule, current-manifest omission, replay, and two concurrent
   approvals using synthetic data.
6. Confirm Today and a token portal show the same approved appointment identity
   on the same Pacific calendar day, then confirm source/link/manifest-omission
   invalidation removes it from both without cancellation or completion.
7. Compare forbidden-domain row counts/hashes before and after the rehearsal.
   They must remain unchanged.
8. Independently review migration 039 and this release evidence before any
   founder migration/deployment decision.

The disposable two-session matrix must include approval racing PR2 begin and
finalize, actor deactivation racing decide and revoke, approval racing source or
link invalidation, and same external identity across connections. Static tests
and the single-session rollback harness document the intended order but are not
PostgreSQL concurrency proof.

## Repository verification

Run from the isolated PR3 worktree:

```bash
npm test
npm run lint
npx tsc --noEmit
git diff --check
```

The rollback-only SQL harness was authored but has not been executed because
this implementation session has no approved disposable database target.
Repository tests are not proof that migration 039 has run successfully in
PostgreSQL.

Repository evidence recorded July 16, 2026:

- Focused PR3 tests: 10 files and 75 tests passed.
- Full `npm test`: 97 files passed, 3 skipped; 564 tests passed, 10 skipped.
- Scoped ESLint over all changed TypeScript, TSX, and MJS files: exit 0 with
  0 errors and 4 inherited warnings in existing PR3/base code.
- Full `npm run lint`: exit 0 with 0 errors and 103 inherited warnings.
- Full `npx tsc --noEmit --incremental false --pretty false`: exit 2 with 24
  diagnostics in six unchanged test-fixture files:
  `lib/membership/member-vs-onetime.test.ts`,
  `lib/membership/member-wallet-card-data.test.ts`,
  `lib/membership/portal-view-model.test.ts`,
  `lib/persistence/supabase/client.test.ts`,
  `lib/presentations/calculations.test.ts`, and
  `lib/presentations/tier-benefits.test.ts`. No diagnostic names a PR3-changed
  file. These inherited release diagnostics require a separate founder
  decision and are not repaired in PR3.
- `git diff --check` covers tracked changes. Untracked PR3 files were checked
  separately for trailing whitespace because Git cannot include them in
  ordinary diff evidence until they are tracked.
- `npm run audit:migrations` was attempted and exited 2 before opening a
  connection because neither `SUPABASE_DB_URL` nor `DATABASE_URL` is present.
  No database target was contacted and the rollback-only SQL harness remains
  unexecuted.

## Rollback and recovery

Migration 039 is additive except for closing the obsolete anonymous
`member_appointments` policy, which is a required security correction for the
new authority fields. Do not restore that policy.

After real decision evidence exists, do not drop classification tables, remove
events, delete appointments, or rewrite states. Disable the decision UI/routes
or ship a forward fix. Existing approved appointments remain governed by their
stored authority; source/link/complete-manifest triggers continue to fail
closed. If an approval
must be removed, use the authenticated revocation transaction while it is
available, then verify both Today and portal reads omit it.

The forward-only emergency decision kill is a new reviewed migration that
revokes `service_role` execute from the approval/rejection RPC while leaving
read visibility, revocation, demotion triggers, tables, and immutable evidence
intact:

```sql
begin;
revoke execute on function public.decide_jobber_visit_classification(
  text, uuid, text, uuid, timestamptz, uuid, uuid, text, text, uuid
) from service_role;
commit;
```

After applying that separately approved migration, verify an HQ decision POST
fails closed, the revoke RPC still works, existing approved appointments retain
their current state, and source/link/complete-manifest invalidation still hides
stale authority. Recovery is another reviewed forward migration that restores
`service_role` execute only after the defect is fixed and the entire disposable
039 harness plus two-session races pass. This SQL is a documented procedure,
not an applied or rehearsed migration; the rehearsal remains a release gate.

Destructive schema rollback is appropriate only in a disposable database and
still requires explicit approval. No destructive production rollback is
shipped.
