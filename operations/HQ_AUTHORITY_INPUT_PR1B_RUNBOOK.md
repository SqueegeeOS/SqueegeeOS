# PR1b — Headquarters authority-input closure

**Status:** RED release gate; implementation is not authorized for production  
**Scope:** Migration 036 and presentation/Home Care Plan/signing authority only  
**Non-goals:** Jobber, appointments, obligations, Stripe behavior, cancellation policy, portal UI, Property Memory, pricing policy, and customer communication

## Authority contract

Public signing uses the existing presentation UUID as a bearer capability. The UUID is generated with `crypto.randomUUID()`, carried in the private `noindex` presentation URL, and resolved server-side. Migration 036 removes direct browser access to `presentations`, while PR1b requires PR1a-authenticated HQ access for presentation listing, creation, and editing. This makes the UUID non-enumerable through supported database and application paths.

The public route accepts exactly:

- `presentationId`: UUID capability
- `agreementTier`: `biannual` or `quarterly`
- `signatureDataUrl`: bounded PNG signature evidence

The server reloads the presentation and derives homeowner/property identity, slugs, plan ID/name, quote snapshot, selected-tier visit price, annual value, source IDs, portal linkage, and signing time. It does not accept a client price or customer/source record ID.

Authenticated Home Care Plan authoring accepts one strictly validated draft, rebuilds the existing domain presentation on the server, and calls the service-role-only `save_hq_home_care_plan` database function. The function commits homeowner, property, and plan upserts atomically while preserving IDs selected by existing unique keys.

The legacy draft shape still carries three presentation price strings for UI compatibility, but they are not authority. The browser and server both replace them with the existing Atlas Pricing Engine output, and the server uses its current fetched company settings before persistence. If those settings cannot be read, the save fails closed.

## Preconditions

All are release-blocking:

1. A separate PR1c closes and rehearses the pre-existing public Stripe activation/identity authorization bypass. PR1b intentionally does not change Stripe behavior; PR1c is a named RED gate before any PR1b migration or deployment.
2. Founder approval for the specific production migration and deployment actions.
3. PR1a migration 035 applied and a real active HQ operator proven; no automatic user, seed, or PIN fallback.
4. `SUPABASE_SERVICE_ROLE_KEY` present only in the server environment.
5. Read-only migration audit proves the actual production baseline through migration 035.
6. This duplicate preflight returns no rows:

```sql
select presentation_id, count(*)
from public.signed_agreements
where presentation_id is not null and status = 'complete'
group by presentation_id
having count(*) > 1;
```

If it returns rows, stop. Do not delete, merge, void, or rewrite agreements automatically.

7. The disposable rehearsal below passes against a newly migrated non-production Supabase project and an app instance configured only for that project.

## Disposable rehearsal

Apply migrations through 036 to a disposable project, configure the test app to the same project, then set:

```bash
PR1B_DISPOSABLE_DB_ACK=I_ACKNOWLEDGE_THIS_IS_A_DISPOSABLE_DATABASE
PR1B_TEST_SUPABASE_URL=...
PR1B_TEST_SUPABASE_ANON_KEY=...
PR1B_TEST_SUPABASE_SERVICE_ROLE_KEY=...
PR1B_TEST_APP_URL=...
```

Run:

```bash
npm test -- lib/persistence/supabase/authority-closure.integration.test.ts
```

Also execute `lib/persistence/supabase/tests/036_home_care_plan_atomicity.sql` against that disposable database. It injects a plan-write failure and proves the preceding homeowner/property writes roll back, then proves a retry preserves all three source IDs and creates no duplicates. The script ends with `ROLLBACK`.

The harness uses real anonymous and password-authenticated clients created from the disposable project's anon key. It proves INSERT, UPDATE, and DELETE fail for all seven authority tables, including `presentations`; proves all three service-only RPCs deny EXECUTE; races two same-tier/same-signature calls through the real `/api/sign-agreement` route; checks replay convergence; checks conflicting tier and signature rejection; and verifies exactly one coherent completed agreement remains. It intentionally preserves signed test evidence; reset the disposable project after inspection.

For a one-shot fault/retry rehearsal, start a single non-production app instance with one of `after_claim`, `after_customer`, `after_storage`, or `after_finalize`:

```bash
PR1B_SIGNING_FAULT_STAGE=after_storage
PR1B_TEST_SIGNING_FAULT_STAGE=after_storage
```

The first request for the fault presentation must fail and its identical retry must converge. Fault injection is disabled when `NODE_ENV=production`.

Do not point these variables at production. Missing variables skip the test and are not a pass.

## Safe rollout order

1. Keep the release RED until PR1c and every precondition above is green.
2. Complete focused tests, full tests, lint, production build, migration audit source checks, disposable SQL/API rehearsals, and `git diff --check` on the release commit.
3. With separate explicit approvals, pause presentation authoring/signing, apply migration 036, then deploy the matching PR1b application build. The application requires migration 036's columns and functions; the old application must not run against closed browser writes.
4. Verify application health and the read-only checks below before reopening authoring/signing.
5. Do not restore old anon policies during rollout troubleshooting.
6. Exercise one disposable/test presentation through presentation → agreement → payment-method test mode → portal. Production money movement is not part of this runbook.

## Post-migration verification

Run read-only checks:

```sql
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in (
    'homeowners', 'properties', 'home_care_plans', 'memberships',
    'signed_agreements', 'property_assets', 'presentations'
  )
order by tablename, policyname;

select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'homeowners', 'properties', 'home_care_plans', 'memberships',
    'signed_agreements', 'property_assets', 'presentations'
  )
  and grantee in ('PUBLIC', 'anon', 'authenticated')
order by table_name, grantee, privilege_type;
```

Pass conditions:

- no public/anon/authenticated INSERT, UPDATE, DELETE policy or grant exists on all seven authority tables;
- `presentations` has no public/anon/authenticated policy or direct grant;
- only the existing `home_care_plans_anon_read` customer-table read policy remains;
- authenticated presentation authoring succeeds;
- anon and authenticated clients cannot execute any PR1b service-only RPC;
- the partial unique index has exactly `presentation_id` and predicate `presentation_id is not null and status = 'complete'`;
- a private presentation capability signs once, concurrent/identical retries return the same IDs, and conflicting evidence is held without replacing the winner;
- no unrelated Stripe, Jobber, appointment, obligation, portal, or Property Memory state changes.

## Rollback

Migration 036 is not rolled back by reopening browser writes.

If the application fails before migration 036, revert or fix the application within the server-authority design. If it fails after migration 036, keep the revocations in place, pause the affected authoring/signing entry point operationally, and roll forward a server-route fix. A code rollback target must retain:

- PR1a HQ authorization for authoring;
- service-role-only customer mutations;
- non-enumerable presentation capabilities;
- no client-supplied signing prices or customer/source IDs.

Never restore migration 030 anon mutation policies as a recovery action. Do not delete partial rows or signed objects. Retry the same presentation capability after repair; unique source keys and the completed-agreement index make retries converge. Escalate any linkage discrepancy for read-only reconciliation.

## Evidence record

- Focused local tests: 16 files and 68 tests passed.
- Full tests: 85 files and 443 tests passed; the disposable integration file/test was skipped because its explicit credentials and acknowledgement are absent.
- Lint: passed with zero errors and 104 inherited warnings.
- Production build/typecheck: Next.js 16.2.10 passed; 74 static pages generated.
- Standalone `npx tsc --noEmit`: not green because pre-existing test fixtures outside PR1b do not satisfy current domain types; the production build TypeScript gate passed.
- Migration audit script syntax: passed. Database-backed migration ledger: blocked locally because `SUPABASE_DB_URL`/`DATABASE_URL` is absent.
- `git diff --check`: pass at final handoff.
- Actual disposable anon-key rehearsal: not run; credentials are absent locally.
- Production migration/deployment: not authorized and not performed.
