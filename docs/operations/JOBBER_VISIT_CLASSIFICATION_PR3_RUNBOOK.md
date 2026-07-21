# Jobber visit classification — PR3 runbook

**Status:** Repository implementation only; migrations 039-041 are not applied
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

### Property-link revocation transaction (migration 041)

The property-link safety action calls the service-role-only
`revoke_jobber_property_link` RPC. One transaction locks the active HQ actor,
exact connection sync row, projection, and link in approval-compatible order,
then revalidates the exact connection/projection/external-property/link identity
and pre-revocation `updated_at` token. The existing automatic immutable link
event trigger inserts the sole revocation event and records the projection and
pre-revocation token. Only an exact lost-response retry by the same actor and
reason returns `already_jobber_only`; stale or different retries conflict.

Migration 041 replaces the migration-039 link-fence function. The existing
trigger demotes every approved classification and authoritative appointment
derived from the link to `pending_review` and appends one classification event
per approved classification. The RPC does not invoke the helper again. Nothing
is deleted, cancelled, completed, detached, priced, billed, obligation-matched,
sent to Stripe, or written to Property Memory.

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
2. Rehearse migrations 035–041 twice on a disposable Supabase project.
3. Run the rollback-only SQL harness:

   ```bash
   psql --set ON_ERROR_STOP=1 --file lib/persistence/supabase/tests/039_jobber_visit_classification.sql
   psql --set ON_ERROR_STOP=1 --file lib/persistence/supabase/tests/040_jobber_member_property_search_link.sql
   psql --set ON_ERROR_STOP=1 --file lib/persistence/supabase/tests/041_jobber_property_link_revocation.sql
   ```

4. Prove classification/link tables have RLS, no `anon`/`authenticated` access,
   service-role select only, and service-role-only execute on both decision
   RPCs plus `revoke_jobber_property_link`. Prove the legacy anonymous
   `member_appointments` policy is absent.
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
link invalidation, property-link revocation racing approval, stale revocations
with different expected tokens, exact replay after a lost response, and same
external identity across connections. Static tests and the single-session
rollback harness document the intended order but are not PostgreSQL concurrency
proof; this matrix remains a release gate.

### Manual two-session migration-041 concurrency procedure

Use only the acknowledged disposable database after migrations 001-041. Seed
the synthetic migration-039 authority fixture through its first approved visit,
then record the projection ID, property-link ID, and pre-revocation
`jobber_property_links.updated_at`. Open two `psql` sessions with
`ON_ERROR_STOP=1`; never point either session at production.

1. **Missing reviewed identity versus link/relink:** in session A begin a
   transaction and call `revoke_jobber_property_link` with a new nonexistent
   link UUID but the real projection/version. In session B concurrently call
   migration 040's link RPC for that external property. Commit whichever
   obtains the connection lock first. Session A must return
   `jobber_link_revoke_conflict`, never `already_jobber_only`; session B may
   serialize before or after it, but no revoke response may claim success over
   the new active link.
2. **Approval versus exact revoke:** session A begins, calls the exact revocation
   RPC, and holds the transaction open before commit. Session B calls the
   migration-039 approval RPC and must wait, then conflict after A commits.
   Repeat with approval obtaining the link lock first; revocation must wait,
   then demote that approval and its appointment in the same transaction.
3. **Concurrent exact replay:** call the same exact revocation request from both
   sessions. The committed outcomes must be one `revoked` and one
   `already_jobber_only`, with one immutable `revoked` link event and one
   `property_link_invalidated` event for each classification approved before
   the winner acquired the link lock.
4. After each case compare link/classification/appointment rows and immutable
   event counts, then compare hashes for obligations, obligation events, Atlas
   pricing snapshots, billing tables, savings ledger, property health and
   assessment tables, service observations, and property assets. Roll back or
   discard the disposable database after recording both session transcripts.

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

Migration 041 has an opt-in disposable integration wrapper. It runs only when
`JOBBER_J1_DISPOSABLE_DB_ACK` is exactly
`I_ACKNOWLEDGE_THIS_IS_A_DISPOSABLE_DATABASE` and
`JOBBER_J1_TEST_DATABASE_URL` is set. Without that configured target it is
skipped and the two-session concurrency rehearsal remains unproven.

Migration 040 now has the same opt-in boundary and actually invokes
`link_jobber_member_property_from_search` through its rollback-only SQL
rehearsal. The exact isolated command is:

```bash
JOBBER_J1_DISPOSABLE_DB_ACK=I_ACKNOWLEDGE_THIS_IS_A_DISPOSABLE_DATABASE \
JOBBER_J1_TEST_DATABASE_URL='postgresql://DISPOSABLE-ONLY' \
npm test -- lib/persistence/supabase/jobber-member-property-search-link.integration.test.ts
```

Disposable migration-040 evidence recorded July 20, 2026:

- Disposable project: `care-operations-rehearsal`
  (`zgpvucrrhjmzcgfgxrtn`).
- Worktree HEAD: `f86c2ad246a200a58c2b1cfc4a3feb3edaef5104`.
- Current `lib/persistence/supabase/tests/040_jobber_member_property_search_link.sql`
  SHA-256:
  `04224eacc0b5cf2e413f7311239b42297f566236f4cde9bfc350c4417207b4a1`.
- The corrected migration 040 and expanded rollback-only harness ran together
  inside one outer transaction and returned `Success` / `No rows`.
- No migration persisted. Post-run residue counts were all `0` for
  `auth.users`, `public.homeowners`, `public.properties`,
  `public.memberships`, and `public.signed_agreements`.

Migration-043 prerequisite evidence recorded July 20, 2026:

- Migration 043 was not run. A read-only prerequisite check found
  `jobber_visit_completion_events`, `visit_text_evidence`, and
  `confirm_jobber_visit_completion` all absent.
- No migration 043 was applied under this approval.
- Migration-043 concurrency remains pending separate approval to install it on
  a disposable database only.

Migration-041 repository evidence recorded July 18, 2026:

- Focused UI, runtime, route, authority-scope, migration, and audit tests: 9
  files and 67 tests passed; 2 opt-in disposable integration tests were
  skipped.
- Scoped ESLint, `node --check scripts/audit-migrations.mjs`, and
  `git diff --check` exited 0.
- Full TypeScript checking still exits 2 on inherited test-fixture diagnostics;
  no diagnostic names a migration-041 changed implementation or test file.
- No SQL harness, two-session race, migration, deployment, or production write
  was executed in this implementation session.

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

For a migration-041 defect, preserve all link/classification events and keep
the migration-039 fail-closed fences active. Disable only service-role execute
on `revoke_jobber_property_link` through a separately reviewed forward
migration, fix forward, and rerun both SQL harnesses plus the two-session matrix
before restoring execute authority.
