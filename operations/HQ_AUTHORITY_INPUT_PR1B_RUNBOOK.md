# PR1b — Headquarters authority-input closure

**Status:** RED release gate; implementation is not authorized for production  
**Scope:** Migration 036 and presentation/Home Care Plan/signing authority only  
**Non-goals:** Jobber, appointments, obligations, Stripe behavior, cancellation policy, portal UI, Property Memory, pricing policy, and customer communication

## Authority contract

Public signing uses the existing presentation UUID as a bearer capability. The UUID is generated with `crypto.randomUUID()`, carried in the private `noindex` presentation URL, and resolved server-side. Migration 036 removes direct browser access to `presentations`, while PR1b requires PR1a-authenticated HQ access for presentation listing, creation, and editing. This makes the UUID non-enumerable through supported database and application paths. Migration 036 also closes the pre-existing browser authority over `pricing_settings`; Atlas Pricing Engine settings remain service-role-only server state.

Migration 036 also removes every direct `public`/`anon`/`authenticated` read policy and grant from `home_care_plans`. A cloud generated-plan URL uses the existing plan UUID as its bearer capability and includes both readable slugs. The server requires all three values, accepts only `generated` or `published` rows, and returns only the matching `presentation` JSON; it does not return plan IDs, drafts, customer foreign keys, or a list endpoint. The slug-only plan route reads session storage only when cloud persistence is disabled. Legacy cloud slug portal and home-health routes fail closed; the current token portal resolves its opaque token before any privileged plan, member, or health read.

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

The harness uses real anonymous and password-authenticated clients created from the disposable project's anon key. It proves global and exact-row `home_care_plans` SELECTs fail for both roles; proves INSERT, UPDATE, and DELETE fail for all eight authority tables, including `presentations` and `pricing_settings`; proves the server-only UUID-plus-slugs presentation loader succeeds only for the matching capability; proves all three service-only RPCs deny EXECUTE; races two same-tier/same-signature calls through the real `/api/sign-agreement` route; checks replay convergence; checks conflicting tier and signature rejection; verifies exactly one coherent completed agreement remains; proves even `service_role` cannot update or delete that completed agreement; and proves a service-role incomplete agreement can still be inserted, updated, and deleted. It intentionally preserves signed test evidence; reset the disposable project after inspection.

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
    'signed_agreements', 'property_assets', 'presentations',
    'pricing_settings'
  )
order by tablename, policyname;

select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'homeowners', 'properties', 'home_care_plans', 'memberships',
    'signed_agreements', 'property_assets', 'presentations',
    'pricing_settings'
  )
  and grantee in ('PUBLIC', 'anon', 'authenticated')
order by table_name, grantee, privilege_type;

select p.proname,
       pg_get_function_result(p.oid) as result_type,
       p.prosecdef as security_definer,
       p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'reject_completed_signed_agreement_mutation';

select grantee, routine_name, privilege_type
from information_schema.routine_privileges
where specific_schema = 'public'
  and routine_name = 'reject_completed_signed_agreement_mutation'
  and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
order by grantee, privilege_type;

select t.tgname, pg_get_triggerdef(t.oid, false) as definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'signed_agreements'
  and t.tgname = 'signed_agreements_complete_immutable'
  and not t.tgisinternal;
```

Pass conditions:

- no public/anon/authenticated INSERT, UPDATE, DELETE policy or grant exists on all eight authority tables;
- `presentations` has no public/anon/authenticated policy or direct grant;
- `pricing_settings` has no public/anon/authenticated policy or direct grant, and `service_role` keeps explicit SELECT/INSERT/UPDATE/DELETE authority for server-only pricing settings reads and saves;
- no public/anon/authenticated SELECT policy or grant exists on `home_care_plans`;
- the generated plan route requires the plan UUID capability plus both slugs, loads only its exact `generated` or `published` presentation document, and a missing `SUPABASE_SERVICE_ROLE_KEY` fails closed;
- slug-only cloud plan, portal, portal-manifest, and home-health paths perform no privileged customer-data read; the token portal resolves its token before those reads;
- authenticated presentation authoring succeeds;
- anon and authenticated clients cannot execute any PR1b service-only RPC;
- the completed-agreement guard is exactly one `BEFORE UPDATE OR DELETE` row trigger backed by the dedicated `SECURITY INVOKER` trigger function with `search_path=pg_catalog`;
- `PUBLIC`, `anon`, and `authenticated` have no function EXECUTE privilege, while `service_role` can finalize/insert but receives `Completed signed agreements are immutable` on any update or delete whose stored `OLD.status` is `complete`;
- pending/incomplete signed-agreement rows remain updateable and deletable for retry or repair workflows;
- the partial unique index has exactly `presentation_id` and predicate `presentation_id is not null and status = 'complete'`;
- a private presentation capability signs once, concurrent/identical retries return the same IDs, and conflicting evidence is held without replacing the winner;
- no unrelated Stripe, Jobber, appointment, obligation, portal, or Property Memory state changes.

## Rollback

Migration 036 is not rolled back by reopening browser writes.

If the application fails before migration 036, revert or fix the application within the server-authority design. If it fails after migration 036, keep the revocations in place, pause the affected authoring/signing entry point operationally, and roll forward a server-route fix. A code rollback target must retain:

- PR1a HQ authorization for authoring;
- service-role-only customer mutations;
- non-enumerable presentation capabilities;
- UUID-bound Home Care Plan presentation links and token-bound member portals;
- no direct browser reads from `home_care_plans`;
- no client-supplied signing prices or customer/source IDs;
- the completed-agreement immutability function and trigger.

Never restore migration 030 anon mutation policies as a recovery action. Do not delete partial rows or signed objects. Retry the same presentation capability after repair; unique source keys and the completed-agreement index make retries converge. Escalate any linkage discrepancy for read-only reconciliation.

## Evidence record

- Scoped immutability focused tests (July 18, 2026): 2 files and 17 tests passed (`authority-closure.test.ts` plus the migration-037 dependent suite); the disposable integration file/test skipped because its required non-production acknowledgement and credentials were absent and this work order prohibited database access.
- Targeted ESLint: passed with no findings across every changed TypeScript/TSX execution-path file.
- Standalone `tsc --noEmit`: not rerun for this SQL/test/audit/runbook-only change; the prior documented baseline reports only inherited fixture diagnostics outside this scope.
- Production build: not rerun for this SQL/test/audit/runbook-only change; the prior documented attempt was blocked before compilation by unavailable configured Google Fonts.
- `git diff --check`: passed.
- Actual disposable anon/authenticated rehearsal: not run; credentials and disposable-database acknowledgement are absent locally.
- Migration audit: exact function definition, function ACL, and trigger-definition checks added for migration 036; audit script syntax passed. The read-only live audit was not run because this work order prohibited database access.
- Production migration/deployment: not authorized and not performed.
