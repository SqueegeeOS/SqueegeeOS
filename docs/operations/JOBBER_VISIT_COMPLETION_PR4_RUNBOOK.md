# Authoritative Jobber visit completion and evidence — PR4 runbook

**Status:** Repository implementation; migration 043 is applied only to
disposable project `zgpvucrrhjmzcgfgxrtn`; production remains unapplied and
untouched
**Scope:** Authenticated, supervised confirmation of one exact Jobber-completed member appointment and private immutable HQ text evidence
**Authority:** Jobber remains appointment/dispatch/completion truth; HomeAtlas stores the exact reviewed completion projection and authenticated evidence
**Non-goals:** Automatic completion, obligations, pricing, billing, Stripe, agreements, membership changes, Property Memory/customer publication, assets/images, customer communication, or AI/OpenAI calls

## Provider evidence

Read-only Jobber GraphiQL introspection with
`X-JOBBER-GRAPHQL-VERSION: 2025-04-16` established the exact
`VisitStatusTypeEnum` values `ACTIVE`, `COMPLETED`, `LATE`, `TODAY`, and
`UNSCHEDULED`. Every value reported `isDeprecated=false` and a null
`deprecationReason`. The sanitized evidence is tracked in
`lib/care-operations/fixtures/jobber-2025-04-16-schema.json`; it contains no
token, account identifier, or customer data. The fixture records its capture
timestamp and a SHA-256 of the normalized non-sensitive enum result.

Only `visit_status='COMPLETED'` can satisfy the status leg. The transaction also
requires `is_complete=true` and a non-null provider `completed_at` no later than
both the source observation and confirmation time. Missing, unknown, malformed,
or contradictory completion state remains review.

## Supervised completion transaction

`confirm_jobber_visit_completion` is a security-definer RPC callable only by
the service role. The protected route supplies the authenticated HQ actor; the
browser cannot supply actor, property, or membership authority.

The transaction locks and revalidates:

1. an active HQ owner/operator row;
2. the appointment-bound singleton `squeegeeking` connection row, locked in the
   transaction and still `connected` at GraphQL version `2025-04-16`;
3. the exact connection sync lock with no reserved run, including expired but
   unfinished reservations;
4. the exact appointment-bound projection and caller-reviewed latest source
   hash;
5. the exact active property link and unchanged `updated_at` version;
6. the link/projection connection and external-property identity;
7. the exact membership/property/homeowner relationship, completed agreement,
   active status, payment completion, tier, and visit price;
8. a fresh (30 minutes), causally latest, complete PR2 watermark/run whose
   immutable `graphql_version` is exactly `2025-04-16`;
9. the exact latest projection/hash/observation in pass two of that run;
10. the exact prior approved PR3 classification/appointment binding and its
   immutable approval event;
11. the source-change invalidation as the latest classification event; and
12. the unchanged scheduled appointment with no obligation binding or prior
    completion.

The successful write updates that same `member_appointments` row to
`status='completed'`, copies Jobber's `completed_at` and latest source tokens,
and sets `jobber_authority_state='completed'`. It never inserts another
appointment. One unique immutable `jobber_visit_completion_events` row stores
the old approved projection, new completed projection, source hashes,
connection/external identity, link version, property, membership, provider
completion fields, authenticated actor, and supervised reason. A retry returns
the existing event only after full revalidation and only when the requesting
actor and trimmed reason exactly match the immutable first request. A different
actor or normalized reason conflicts and never rewrites evidence.

## Private text evidence

`append_visit_text_evidence` accepts only an idempotency UUID, appointment UUID,
text (1–4000 trimmed characters), and the authenticated actor. It reloads the
authoritative completion event and derives property/membership entirely
server-side. It rechecks the unchanged active property link and strictly active
membership before inserting one immutable `visit_text_evidence` row. Reusing
the UUID with identical evidence is a replay; any changed scope, actor, or text
conflicts.

Evidence is HQ-only and text-only. There is no image upload, interpretation,
AI summary, Property Memory publication, timeline publication, or customer
surface in this slice.

## API boundary

- `POST /api/admin/care-operations/jobber/visit-completions`
- `POST /api/admin/care-operations/jobber/visit-completions/evidence`

Both authorize before parsing, are covered by the Headquarters Supabase Auth
proxy scope, return no-store responses, and never log request bodies, source
hashes, evidence text, property data, or actor details. Invalid input is `400`,
missing authority is `404`, stale/contradictory truth is `409`, and unavailable
storage is `503`.

## Migration and verification

Migration 043 is additive and idempotent. Both new tables have RLS enabled, no
browser policies, service-role read only, immutable update/delete triggers, and
service-role-only RPC execution. The migration audit ledger verifies exact
non-owner table/function ACLs, zero browser policies, key constraints and FKs,
every migration-critical CHECK definition (including both altered appointment
authority constraints), constraint validation/deferrability metadata, enabled
immutable triggers, and exact deployed function definitions against a
required-clause-guarded migration 043 source.

The rollback-only disposable rehearsal is:

```bash
psql --set ON_ERROR_STOP=1 \
  --file lib/persistence/supabase/tests/043_authoritative_visit_completion_evidence.sql
```

The opt-in Vitest wrapper runs only when
`JOBBER_J1_DISPOSABLE_DB_ACK=I_ACKNOWLEDGE_THIS_IS_A_DISPOSABLE_DATABASE` and
`JOBBER_J1_TEST_DATABASE_URL` are set. Static/unit tests are not PostgreSQL or
concurrency proof.

Run the rollback rehearsal and the true multi-session race matrix as separate
isolated commands so no other disposable integration file shares the singleton
Jobber fixture:

```bash
JOBBER_J1_DISPOSABLE_DB_ACK=I_ACKNOWLEDGE_THIS_IS_A_DISPOSABLE_DATABASE \
JOBBER_J1_TEST_DATABASE_URL='postgresql://DISPOSABLE-ONLY' \
npm test -- lib/persistence/supabase/jobber-visit-completion.integration.test.ts

JOBBER_J1_DISPOSABLE_DB_ACK=I_ACKNOWLEDGE_THIS_IS_A_DISPOSABLE_DATABASE \
JOBBER_J1_TEST_DATABASE_URL='postgresql://DISPOSABLE-ONLY' \
npm test -- lib/persistence/supabase/jobber-visit-completion-concurrency.integration.test.ts
```

The race harness verifies distinct PostgreSQL backend PIDs and observed lock
blocking for begin/finalize, revocation, deactivation, membership lifecycle,
and exact-confirmation races. Because cross-session fixtures must be committed
to become visible, its guarded cleanup uses transaction-local
`session_replication_role=replica` only for reserved synthetic identities; the
disposable database role must support that setting. It refuses to clean a
non-harness `squeegeeking` connection.

The canonical Node rollback and concurrency integration commands are
**UNEXECUTED / BLOCKED** solely because no disposable direct database URL and
password are available. The manual SQL Editor evidence below is complementary;
it is not a substitute for those canonical Node runs.

### Disposable project evidence

- The only disposable target was `zgpvucrrhjmzcgfgxrtn`.
- Corrected migrations 040 and 043 applied successfully there. Production was
  not contacted or changed.
- Migration 040 catalog/security audit: `9/9` passed.
- Migration 043 catalog/security audit: `9/9` passed.
- The migration-043 rollback harness passed; its residue audit total was `0`.
- A manual two-session SQL Editor matrix used distinct PostgreSQL backend PIDs
  and passed all nine semantic cases:

  1. completion-before-sync;
  2. sync-first fail-closed;
  3. property-link revocation fail-closed;
  4. actor deactivation fail-closed;
  5. membership pause fail-closed;
  6. cancellation after completion;
  7. finalize then completion;
  8. reserved finalization fail-closed; and
  9. duplicate completed/replay.

- The final synthetic residue count was `0` across every listed fixture table:
  `auth.users`, `public.hq_admin_users`, `public.hq_admin_user_events`,
  `public.homeowners`, `public.properties`, `public.memberships`,
  `public.signed_agreements`, `public.member_profiles`,
  `public.jobber_connections`, `public.jobber_connection_events`,
  `public.jobber_schedule_sync_runs`, `public.jobber_schedule_sync_locks`,
  `public.jobber_schedule_sync_watermarks`,
  `public.jobber_schedule_sync_partitions`,
  `public.jobber_visit_source_observations`,
  `public.jobber_visit_projections`, `public.jobber_visit_projection_events`,
  `public.jobber_property_links`, `public.jobber_property_link_events`,
  `public.jobber_visit_classifications`,
  `public.jobber_visit_classification_events`, `public.member_appointments`,
  `public.appointment_source_events`,
  `public.jobber_visit_completion_events`, and `public.visit_text_evidence`.

Current SHA-256 evidence manifest:

```text
58410663445c4f760c9fea57e871d26b0654f153da65a0d30695db99e3f1b50b  lib/persistence/supabase/migrations/040_jobber_member_property_search_link.sql
04224eacc0b5cf2e413f7311239b42297f566236f4cde9bfc350c4417207b4a1  lib/persistence/supabase/tests/040_jobber_member_property_search_link.sql
4a55a75838e52499d84e39255af07373c05d814127bbc79068e19b8c559b59f9  lib/persistence/jobber-member-property-search-link-migration.test.ts
9ed3aa3ad70d4cbe49b361293812f85cd236d518c9a635eecc7e785aea7ab3f7  lib/persistence/supabase/jobber-member-property-search-link.integration.test.ts
fdf1eb9a7312ee6b6e01ea8e0c632ec6b812dbab14791a9848278cac0129b2a6  lib/persistence/supabase/migrations/043_authoritative_visit_completion_evidence.sql
f15c2af8fcd4d8401abee166b28a1369557dabd2101ac5bdaad6da628ff28c8f  lib/persistence/supabase/tests/043_authoritative_visit_completion_evidence.sql
cc8264ea01ece00eb8394c1b78ed459738457d11d5485c186c355bcbbb0244e9  lib/persistence/supabase/tests/support/043_authoritative_visit_completion_concurrency_fixture.sql
ed3e7a520670fc496c684a4e91ee790868cc95e319c22a8b50149523f5e73885  lib/persistence/supabase/tests/support/043_authoritative_visit_completion_concurrency_cleanup.sql
514d795164e66c3e4496484563b12290ea8220a6febac762a0bbd6121c0f241d  lib/persistence/jobber-visit-completion-migration.test.ts
eb26ada26e86b17b53b2dbb44a1e02384fb7b7954dc3ca94e0cf4891cedd7b12  lib/persistence/supabase/jobber-visit-completion.integration.test.ts
69c2c135d65cde43f0c8fa92af5ee5a1602dc152414cc1f9407226a6183c25  lib/persistence/supabase/jobber-visit-completion-concurrency.integration.test.ts
dcff9889ec9caa148f7dcdff9f3f38c6610fb9a9131e07e409ab003bff201e57  lib/persistence/supabase/tests/support/forbidden_domain_fingerprints.sql
```

Before any migration or deployment decision:

1. Prove the production ledger through 042 read-only.
2. Apply 035–043 twice to an acknowledged disposable database and run the 039,
   041, and 043 rollback rehearsals.
3. Run a two-session race for completion versus PR2 begin/finalize, link
   revocation, actor deactivation, membership pause/cancel, and two concurrent
   confirmations. Outcomes must serialize to one completion event and one
   unchanged appointment identity, or fail closed.
4. Verify RLS/ACL catalog evidence and immutable-trigger behavior.
5. Compare deterministic whole-row content fingerprints—not counts alone—before
   and after for every present obligation/event table, pricing setting/snapshot,
   billing order/event, Stripe/payment/reconciliation ledger, agreement/signing
   record, membership/savings/referral record or ledger, add-on, property asset/photo or
   storage object, health check/assessment, service observation/Property Memory
   surface, and customer-facing homeowner/property/plan/presentation/sale
   surface. Optional absent tables are recorded as absent; any changed present
   table fails the rehearsal.
6. Confirm no outbound provider, email, Stripe, OpenAI, or other AI call occurs.
7. Obtain independent Reliability Guardian review before migration/merge/deploy.

## Rollback and recovery

Do not destructively remove completion or text evidence after real records
exist. If a defect is found, disable the two protected routes and ship a
reviewed forward migration revoking service-role execute on
`confirm_jobber_visit_completion` and `append_visit_text_evidence`. Preserve
the tables, immutable triggers, appointment rows, and all evidence.

Recovery is a reviewed forward fix followed by both rollback rehearsals and the
two-session matrix before execute authority is restored. Dropping migration-043
objects is acceptable only on a disposable database and is not an authorized
production rollback.
