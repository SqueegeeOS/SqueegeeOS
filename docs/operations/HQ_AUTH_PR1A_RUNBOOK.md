# Headquarters authenticated access — PR1a runbook

**Status:** Repository implementation only; not applied or proven in production
**Migration:** `035_hq_authenticated_access.sql`
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
2. Configure and prove an edge/global abuse control for `POST /auth/hq/request` in the actual Vercel project. Record the provider rule identifier and a preview-deployment test showing requests are throttled before the function. Do not set `HQ_AUTH_EDGE_RATE_LIMIT_VERIFIED=1` from intent alone; the application returns the neutral response without contacting Supabase while it is unset.
3. Verify the Vercel request supplies one valid `x-vercel-forwarded-for` address. Vercel documents this as its preserved client address; comma lists, malformed values, generic `x-forwarded-for`, non-Vercel execution, and missing values fail closed before limiter reservation.
4. Add `${NEXT_PUBLIC_APP_URL}/auth/hq/callback` to the Supabase Auth redirect allowlist.
5. Create each intended Supabase Auth user through an approved administrative process. Do not use public signup.
6. Add one explicit normalized `hq_admin_users` row per approved Auth UUID, with role `owner` or `operator` and `active = true`. No email addresses or UUIDs are prescribed by this repository. Migration 035 rejects mismatched approval emails, makes the authorization UUID immutable, and synchronizes a later Auth email change in the same transaction; removal or a uniqueness conflict blocks the Auth change rather than allowing identity drift. Reassign access with a separately audited revoke and grant. Runtime authorization also compares both records and fails closed.
7. Confirm migration 035 has been applied before deploying the PR1a application code. Deploying code first intentionally makes Headquarters unavailable rather than falling back to PIN authority.

PR1a intentionally gives `owner` and `operator` the same Headquarters and Care Operations privileges. The role is retained in immutable authorization evidence for a separately approved least-privilege follow-up; code must not imply a privilege distinction that does not yet exist.

## Read-only migration verification

Run the repository migration audit with read-only database credentials:

```bash
npm run audit:migrations
```

The 035 line must pass. Independently verify:

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
6. In an isolated disposable database with no Jobber connection, run `psql --set ON_ERROR_STOP=1 --file lib/persistence/supabase/tests/035_atomic_jobber_connection_failure.sql`. The transaction injects an event-write failure, proves `save_jobber_connection_with_event` leaves no successful connection-state change, and rolls back all rehearsal objects.
7. In the same class of empty disposable database, run `psql --set ON_ERROR_STOP=1 --file lib/persistence/supabase/tests/035_atomic_jobber_refresh_transitions.sql`. It proves atomic success/failure evidence, rolls both state transitions back when event insertion is injected to fail, and proves a stale lease cannot overwrite a newer token generation.
8. A supervised Jobber property link/revoke event and a Jobber connection event show the authenticated actor UUID.
9. No request to `/api/admin/care-operations/**` succeeds with only `x-admin-pin`.
10. No pricing, billing execution, appointment, obligation, Stripe, or Property Memory state changes during this verification.

## Rollback

Leave migration 035 in place. It is additive, and dropping it after use would erase immutable auth audit evidence. Do not restore the previous application version: that would re-enable shared-PIN authority.

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
