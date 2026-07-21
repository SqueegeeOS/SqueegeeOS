# Headquarters authenticated access — PR1a runbook

**Status:** Repository implementation only; not applied or proven in production
**Migrations:** `035_hq_authenticated_access.sql` plus forward hardening in
`044_jobber_oauth_authority_hardening.sql`
**Scope:** Supabase-authenticated `/hq`, Care Operations APIs, and Jobber OAuth
**Non-goal:** Migration-030 anonymous authority-table policies (PR1b)

**Release gate:** YELLOW after code verification. It cannot become GREEN until the edge abuse rule, migration/disposable-database rehearsals, trusted Vercel network identity, approved-user setup, and isolated-preview rollback are all proven and recorded. Repository tests or a successful build do not satisfy those operational gates.

## What PR1a changes

- Adds the official `@supabase/ssr` 0.12.1 dependency for App Router cookie and PKCE handling; this also resolves the compatible Supabase JS 2.110.4 patch release in the lockfile.
- `/hq/*` now has a server-rendered Supabase Auth and `hq_admin_users` authorization boundary.
- Every `/api/admin/care-operations/**` handler, including Jobber OAuth start and callback, requires the same active actor.
- Care Operations and Jobber browser calls no longer send `NEXT_PUBLIC_ADMIN_PIN`.
- Existing property-link and Jobber connection audit fields receive the authenticated `auth.users.id` UUID.
- The database rejects an allowlist email that does not match the referenced Auth user, synchronizes later Auth email changes transactionally, and retains a runtime fail-closed comparison.
- Magic-link issuance queries that same service-role-only allowlist by normalized email and contacts Supabase Auth only for an active owner/operator row. Every public response remains the same neutral `202`.
- Headquarters grant, revoke, role, active, and email mutations append immutable before/after evidence in `hq_admin_user_events`.
- A Jobber connection becomes `connected` only in the same database transaction that appends its authenticated actor event.
- Jobber OAuth fails closed without the server-only independently verified `JOBBER_EXPECTED_ACCOUNT_ID`; the callback and transaction both reject a different returned account before connection or event insertion.
- Jobber connection persistence serializes and checks exact immutable operation evidence before current actor authorization, so a committed lost-response replay converges even if that actor is later inactive or deleted. Every evidence-free mutation locks and revalidates the exact active owner/operator actor in the saving transaction.
- PostgreSQL, not the application caller, computes the canonical replay SHA-256 from the operation ID, independently configured expected account ID, returned account ID/name, both encrypted tokens, normalized expiry, GraphQL version, and actor UUID. Immutable OAuth event details retain only that digest.
- Jobber refresh success and failure transitions append their immutable system event in the same transaction. Lease acquisition, completion, and failure all bind to the token generation read by the worker, so reauthorization or lease loss cannot be overwritten by stale refresh work.
- Scoped Proxy refresh and no-cache handling covers `/hq/*`, every Care Operations API, and the two public magic-link routes used by fail-closed rollback.
- Other legacy Headquarters APIs and the inner browser PIN gate remain unchanged pending the named retirement follow-up.

The migration creates no Auth users and no `hq_admin_users` rows. Missing identity, authorization, environment, or database truth fails closed.

## Release prerequisites

These are prerequisites for a separately approved migration/deployment; this runbook does not authorize either action.

1. Verify these server/deployment values without printing them:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` using the canonical HTTPS application origin
   - `HQ_AUTH_LIMITER_SECRET`, a dedicated random value of at least 32 characters
   - `HQ_AUTH_EMERGENCY_DISABLED=0`
   - `HQ_AUTH_EDGE_RATE_LIMIT_VERIFIED=1` only after prerequisite 2 is proven
   - `JOBBER_EXPECTED_ACCOUNT_ID` set from an independent verification of the intended SqueegeeKing Jobber account, never from the OAuth callback being authorized
2. Configure and prove an edge/global abuse control for `POST /auth/hq/request` in the actual Vercel project. Record the provider rule identifier and a preview-deployment test showing requests are throttled before the function. Do not set `HQ_AUTH_EDGE_RATE_LIMIT_VERIFIED=1` from intent alone; the application returns the neutral response without contacting Supabase while it is unset.
3. Verify the Vercel request supplies one valid `x-vercel-forwarded-for` address. Vercel documents this as its preserved client address; comma lists, malformed values, generic `x-forwarded-for`, non-Vercel execution, and missing values fail closed before limiter reservation.
4. Add `${NEXT_PUBLIC_APP_URL}/auth/hq/callback` to the Supabase Auth redirect allowlist.
5. Create each intended Supabase Auth user through an approved administrative process. Do not use public signup.
6. Add one explicit normalized `hq_admin_users` row per approved Auth UUID, with role `owner` or `operator` and `active = true`. No email addresses or UUIDs are prescribed by this repository. Migration 035 rejects mismatched approval emails, makes the authorization UUID immutable, and synchronizes a later Auth email change in the same transaction; removal or a uniqueness conflict blocks the Auth change rather than allowing identity drift. Reassign access with a separately audited revoke and grant. Runtime authorization also compares both records and fails closed.
7. Confirm migration 035 has been applied before deploying the PR1a application code. Deploying code first intentionally makes Headquarters unavailable rather than falling back to PIN authority.
8. Before publication, restack this remediation branch onto
   `codex/authoritative-visit-completion`, which owns migration 043. Then apply
   migrations through 044 in numeric order and confirm 044 follows 043. Keep
   the hardening numbered 044; do not rewrite 035 or renumber the rehearsed
   migration.
9. Confirm `pgcrypto` supplies `extensions.digest(bytea,text)` before applying
   044. Migration 044 fails closed if that exact digest function is absent.
10. Complete and retain the expected-account provenance checklist and
    wrong-account recovery procedure in `JOBBER_OAUTH_SETUP.md`.

PR1a intentionally gives `owner` and `operator` the same Headquarters and Care Operations privileges. The role is retained in immutable authorization evidence for a separately approved least-privilege follow-up; code must not imply a privilege distinction that does not yet exist.

## Read-only migration verification

Run the repository migration audit with read-only database credentials:

```bash
npm run audit:migrations
```

The 035 and 044 lines must pass. Migration 044 uses exact catalog evidence for
the function body/signature and overload inventory, function ACL, UUID column,
partial unique index, immutable trigger, RLS, and browser denials.

### Paste-ready migration 044 catalog proof

Run this whole block with read-only database credentials after the approved
migration. It does not apply or mutate schema:

```sql
begin read only;

select pg_catalog.to_regprocedure('extensions.digest(bytea,text)') as digest_function;

select table_schema, table_name, column_name, data_type, udt_name,
       is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'jobber_connection_events'
  and column_name = 'oauth_operation_id';

select index_namespace.nspname as index_schema,
       index_relation.relname as index_name,
       table_namespace.nspname as table_schema,
       table_relation.relname as table_name,
       access_method.amname as access_method,
       index_info.indisunique,
       index_info.indisvalid,
       index_info.indisready,
       index_info.indnkeyatts,
       index_info.indnatts,
       pg_catalog.pg_get_expr(index_info.indpred, index_info.indrelid) as predicate,
       pg_catalog.pg_get_indexdef(index_info.indexrelid) as definition
from pg_catalog.pg_index index_info
join pg_catalog.pg_class index_relation
  on index_relation.oid = index_info.indexrelid
join pg_catalog.pg_namespace index_namespace
  on index_namespace.oid = index_relation.relnamespace
join pg_catalog.pg_class table_relation
  on table_relation.oid = index_info.indrelid
join pg_catalog.pg_namespace table_namespace
  on table_namespace.oid = table_relation.relnamespace
join pg_catalog.pg_am access_method
  on access_method.oid = index_relation.relam
where index_namespace.nspname = 'public'
  and index_relation.relname = 'jobber_connection_events_oauth_operation_uidx';

select procedure.oid::regprocedure as exact_signature,
       procedure.proargnames,
       pg_catalog.pg_get_function_result(procedure.oid) as result_type,
       language.lanname as language,
       procedure.prosecdef as security_definer,
       procedure.proisstrict as strict,
       procedure.provolatile as volatility,
       procedure.proparallel as parallel_mode,
       procedure.proconfig,
       pg_catalog.md5(procedure.prosrc) as body_fingerprint,
       procedure.prosrc as canonical_body
from pg_catalog.pg_proc procedure
join pg_catalog.pg_namespace procedure_namespace
  on procedure_namespace.oid = procedure.pronamespace
join pg_catalog.pg_language language
  on language.oid = procedure.prolang
where procedure_namespace.nspname = 'public'
  and procedure.proname = 'save_jobber_connection_with_event'
order by procedure.oid::regprocedure::text;

select procedure.oid::regprocedure as exact_signature,
       owner_role.rolname as owner,
       case when acl.grantee = 0 then 'PUBLIC' else grantee_role.rolname end as grantee,
       acl.privilege_type,
       acl.is_grantable
from pg_catalog.pg_proc procedure
join pg_catalog.pg_namespace procedure_namespace
  on procedure_namespace.oid = procedure.pronamespace
join pg_catalog.pg_roles owner_role on owner_role.oid = procedure.proowner
cross join lateral pg_catalog.aclexplode(
  coalesce(procedure.proacl, pg_catalog.acldefault('f', procedure.proowner))
) acl
left join pg_catalog.pg_roles grantee_role on grantee_role.oid = acl.grantee
where procedure_namespace.nspname = 'public'
  and procedure.proname = 'save_jobber_connection_with_event'
order by procedure.oid::regprocedure::text, grantee, acl.privilege_type;

select table_namespace.nspname as table_schema,
       relation.relname as table_name,
       trigger_info.tgname as trigger_name,
       trigger_info.tgisinternal,
       trigger_info.tgtype::integer,
       trigger_info.tgenabled,
       function_namespace.nspname as function_schema,
       trigger_function.proname as function_name,
       language.lanname as language,
       trigger_function.prosecdef as security_definer,
       trigger_function.proconfig,
       pg_catalog.md5(trigger_function.prosrc) as body_fingerprint,
       trigger_function.prosrc as canonical_body
from pg_catalog.pg_trigger trigger_info
join pg_catalog.pg_class relation on relation.oid = trigger_info.tgrelid
join pg_catalog.pg_namespace table_namespace
  on table_namespace.oid = relation.relnamespace
join pg_catalog.pg_proc trigger_function
  on trigger_function.oid = trigger_info.tgfoid
join pg_catalog.pg_namespace function_namespace
  on function_namespace.oid = trigger_function.pronamespace
join pg_catalog.pg_language language
  on language.oid = trigger_function.prolang
where trigger_info.tgname = 'jobber_connection_events_immutable';

select relation.relname, relation.relrowsecurity, relation.relforcerowsecurity
from pg_catalog.pg_class relation
join pg_catalog.pg_namespace relation_namespace
  on relation_namespace.oid = relation.relnamespace
where relation_namespace.nspname = 'public'
  and relation.relname in ('jobber_connections', 'jobber_connection_events')
order by relation.relname;

select tablename, policyname, roles, cmd
from pg_catalog.pg_policies
where schemaname = 'public'
  and tablename in ('jobber_connections', 'jobber_connection_events')
order by tablename, policyname;

select relation.relname as table_name,
       case when acl.grantee = 0 then 'PUBLIC' else grantee_role.rolname end as grantee,
       acl.privilege_type,
       acl.is_grantable
from pg_catalog.pg_class relation
join pg_catalog.pg_namespace relation_namespace
  on relation_namespace.oid = relation.relnamespace
cross join lateral pg_catalog.aclexplode(
  coalesce(relation.relacl, pg_catalog.acldefault('r', relation.relowner))
) acl
left join pg_catalog.pg_roles grantee_role on grantee_role.oid = acl.grantee
where relation_namespace.nspname = 'public'
  and relation.relname in ('jobber_connections', 'jobber_connection_events')
  and (
    acl.grantee = 0
    or pg_catalog.pg_has_role('anon', acl.grantee, 'MEMBER')
    or pg_catalog.pg_has_role('authenticated', acl.grantee, 'MEMBER')
  )
order by relation.relname, grantee, acl.privilege_type;

rollback;
```

Expected 044 proof: one nullable UUID column with no default; one valid/ready
unique btree index on that column with the `IS NOT NULL` predicate; exactly one
save-function overload with the nine-argument 044 signature, `text` result,
`SECURITY DEFINER`, and `search_path=pg_catalog`; ACL rows only for the owner
and non-grantable `service_role` execute; one enabled BEFORE ROW UPDATE+DELETE
trigger (`tgtype=27`) using the exact immutable
`reject_jobber_connection_event_change` body from migration 032; RLS enabled on
both tables; and zero browser policies or grants. Compare the save-function
canonical body or fingerprint with reviewed migration 044 and the trigger
function with reviewed migration 032; a fingerprint is useful only when
calculated from that exact reviewed source.

Independently verify the existing 035 authority objects:

```sql
select relname, relrowsecurity
from pg_class
join pg_namespace on pg_namespace.oid = pg_class.relnamespace
where pg_namespace.nspname = 'public'
  and relname in (
    'hq_admin_users',
    'hq_admin_user_events',
    'hq_magic_link_request_events',
    'hq_magic_link_delivery_events'
  );

select tablename, policyname, roles
from pg_policies
where schemaname = 'public'
  and tablename in (
    'hq_admin_users',
    'hq_admin_user_events',
    'hq_magic_link_request_events',
    'hq_magic_link_delivery_events'
  );

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'reserve_hq_magic_link_request',
    'validate_hq_admin_user_auth_email',
    'sync_hq_admin_user_auth_email',
    'record_hq_admin_user_change',
    'save_jobber_connection_with_event',
    'acquire_jobber_refresh_lease_for_generation',
    'complete_jobber_refresh_with_event',
    'fail_jobber_refresh_with_event'
  );

select event_object_schema, event_object_table, trigger_name
from information_schema.triggers
where trigger_name in (
  'hq_admin_users_validate_auth_email',
  'hq_admin_users_sync_auth_email',
  'hq_admin_users_record_change',
  'hq_admin_user_events_immutable'
);
```

Expected: all four tables have RLS enabled; no policy grants `anon`, `authenticated`, or `public`; all eight SECURITY DEFINER functions have `search_path=pg_catalog`; the five service RPCs are executable only by `service_role`; email-integrity, authorization-audit, and immutability triggers exist.

## Limiter audit growth

The request ledger is intentionally append-only. Advisory locking and denial deduplication cap a repeated denied flood to one `rate_limited` marker per matching email or network fingerprint in each 15-minute window. Allowed attempts are capped at three per email fingerprint and ten per network fingerprint in the same window.

The ledger does not have a global finite size: a distributed attacker that continually rotates both email and network identifiers can still grow it. PR1a does not prune or overwrite immutable evidence. After deployment, monitor request-event rows per hour and `pg_total_relation_size('public.hq_magic_link_request_events')`. If growth is abnormal, block `/auth/hq/request` at the deployment edge while preserving established HQ sessions, then forward-fix with separately reviewed edge controls or append-only partition archival. Do not respond by making the limiter instance-local or deleting audit rows.

## Behavior verification after an approved deployment

1. An unauthenticated Care Operations request returns `401`.
2. A valid Supabase session with no active `hq_admin_users` row returns `403` at the API boundary and cannot enter `/hq`.
3. An active approved actor can enter `/hq`, inspect Jobber status, and sign out.
4. Repeated magic-link requests always return the same neutral `202` response. Missing, inactive, invalid-role, and mismatched allowlist rows never call Supabase OTP. Accepted, definitively rejected, and unknown/retryable provider outcomes remain distinct immutable evidence. The database records HMAC fingerprints only, and the limit is shared across function instances.
   Denials are represented by at most one immutable marker per matching email/network window, so a rejected-request flood does not append one audit row per request.
5. Grant, deactivate, reactivate, role-change, email-change, and delete rehearsal mutations each produce immutable `hq_admin_user_events` evidence with truthful before/after values. Use a disposable Auth user; do not mutate a real operator for testing.
6. In an isolated disposable database with no Jobber connection, apply migration
   044 twice, then run
   `psql --set ON_ERROR_STOP=1 --file lib/persistence/supabase/tests/044_jobber_oauth_authority_hardening.sql`.
   The rollback-only transaction proves wrong-account rejection before state,
   first connection, normalized exact replay while the actor is active,
   inactive, and deleted, negative replay changes for every payload field,
   DB-computed digest-only evidence, and reauthorization.
7. In the same class of empty disposable database, run `psql --set ON_ERROR_STOP=1 --file lib/persistence/supabase/tests/035_atomic_jobber_refresh_transitions.sql`. It proves atomic success/failure evidence, rolls both state transitions back when event insertion is injected to fail, and proves a stale lease cannot overwrite a newer token generation.
8. With `JOBBER_J1_DISPOSABLE_DB_ACK=I_ACKNOWLEDGE_THIS_IS_A_DISPOSABLE_DATABASE` and `JOBBER_J1_TEST_DATABASE_URL` targeting only that disposable database, run `npx vitest run lib/persistence/supabase/jobber-oauth-authority.integration.test.ts`. The harness applies 044 twice and uses catalog-observed lock barriers to prove both lock orderings for actor deactivation, deletion, and owner/operator role change; concurrent same-operation first insert/replay; and a concurrent distinct-operation first insert. It must show rejected evidence-free mutations leave no OAuth event, committed saves remain valid while holding actor authority through commit, and exact replay still converges after later deactivation or deletion. Preserve the synthetic authorization and immutable evidence until the disposable database is discarded.
9. A supervised Jobber property link/revoke event and a Jobber connection event show the authenticated actor UUID.
10. No request to `/api/admin/care-operations/**` succeeds with only `x-admin-pin`.
11. No pricing, billing execution, appointment, obligation, Stripe, or Property Memory state changes during this verification.

## Rollback

Leave migrations 035 and 044 in place. Migration 044 preserves existing rows and
events; dropping or rewriting either migration after use would break authority
or replay guarantees and risks audit evidence. Do not restore the previous
application version: it lacks the 044 RPC contract and would also re-enable
shared-PIN authority.

The executable application rollback is `HQ_AUTH_EMERGENCY_DISABLED=1`. The scoped Proxy returns `503` before route execution for `/hq/*`, `/api/admin/care-operations/**`, `/auth/hq/request`, and `/auth/hq/callback`. It ignores cookies and `x-admin-pin`, so shared-PIN authority cannot return. Activating this in production still requires explicit environment/deployment approval.

### Rollback rehearsal in an isolated preview

1. Set `HQ_AUTH_EMERGENCY_DISABLED=1` only on an isolated preview and deploy that preview.
2. Request each path below with both a valid test session and an `x-admin-pin` header. Every request must return `503` with `Cache-Control: private, no-cache, no-store, must-revalidate, max-age=0`, `Expires: 0`, and `Pragma: no-cache`:
   - `GET /hq`
   - `GET /api/admin/care-operations/jobber/oauth/status`
   - `POST /auth/hq/request`
   - `GET /auth/hq/callback?code=rollback-rehearsal`
3. Confirm no Care Operations handler, Supabase magic-link request, OAuth exchange, connection mutation, or audit mutation occurred.
4. Set the preview flag back to `0`, redeploy, and prove unauthenticated `401`, unapproved `403`, and approved-session access again.
5. Record the preview deployment identifier and response headers. A failed check leaves the release RED; never fall back to the previous PIN build.

If the application flag cannot be deployed during an incident, block the same four path scopes at the Vercel edge and forward-fix. Do not reopen the previous build.

Once any real request evidence exists, use a forward fix; do not drop or rewrite these ledgers. A schema rollback is appropriate only in a disposable, pre-production database and would require explicit approval for destructive SQL. It must first drop `hq_admin_users_sync_auth_email` from `auth.users`, then remove the migration-035 functions and tables in dependency order, including `hq_admin_user_events` and all immutable-audit and email-integrity functions. This repository does not execute or ship that destructive rollback.
