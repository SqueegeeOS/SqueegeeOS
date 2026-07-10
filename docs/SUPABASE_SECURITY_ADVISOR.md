# Supabase Security Advisor — Hardening Pass (Migration 030)

Applied in `lib/persistence/supabase/migrations/030_supabase_security_hardening.sql`.

**Prerequisite:** `SUPABASE_SERVICE_ROLE_KEY` on Vercel/server. `createServerSupabaseClient()` uses the service role when set (bypasses RLS for HQ, portal loaders, billing, add-ons).

## Advisor findings

| Advisor warning | Status | Why |
|-----------------|--------|-----|
| **Function `set_updated_at` has a role mutable search_path** | **Fixed** | Recreated with `SET search_path = public` and `SECURITY INVOKER`. |
| **RLS disabled on `referral_codes`** | **Fixed** | RLS enabled; no anon policies (server/service role only). |
| **RLS disabled on `referral_visits`** | **Fixed** | Same as referral_codes. |
| **RLS disabled on `referrals`** | **Fixed** | Same as referral_codes. |
| **Permissive RLS policy `*_anon_all` (USING true / WITH CHECK true)** | **Fixed** (admin tables) | Dropped on all HQ/ledger/billing/intelligence tables. Anon key no longer has blanket ALL access. |
| **Permissive RLS on customer persistence tables** | **Intentionally scoped** | Replaced `FOR ALL` with explicit `SELECT` + `INSERT` + `UPDATE` for anon on: homeowners, properties, home_care_plans, memberships, signed_agreements, property_assets. **No anon DELETE.** Required until browser `supabaseAdapter` moves behind API routes. |
| **Anon key can read/write HQ tables via PostgREST** | **Fixed** | closed_jobs, headquarters_profile, member_addon_transactions, billing, savings ledger, referrals, presentations, lead_intakes, etc. have RLS enabled with **no anon policy** → denied for anon. |
| **Storage: signed-agreements bucket anon insert/update** | **Fixed** (017 + 030) | Bucket private; `signed_agreements_service_role_all` policy for service role only. |
| **Service role not used server-side** | **Fixed** | `createServerSupabaseClient()` prefers `SUPABASE_SERVICE_ROLE_KEY`. |
| **No Supabase Auth / JWT-scoped portal RLS** | **Left as-is** | Portal still loads via server routes + `portal_access_token` in app code. Token-scoped RLS is a follow-up (wargame 001 Phase 4+). |
| **Customer tables still world-readable to anyone with anon key** | **Left as-is** | Anon SELECT remains on persistence tables for signing + home care plan flows. Tighten when Supabase Auth or API-only writes ship. |
| **Extensions in public schema** | **Not changed** | Supabase-managed; no app migration. |
| **Leaked password protection / MFA** | **N/A** | No Supabase Auth users yet. |

## Apply migration

```bash
psql "$SUPABASE_DB_URL" -f lib/persistence/supabase/migrations/030_supabase_security_hardening.sql
```

Or paste into Supabase SQL Editor.

## Post-deploy verification

1. `SUPABASE_SERVICE_ROLE_KEY` set on Vercel → redeploy.
2. `GET /api/persistence/health` → 200.
3. HQ PIN → `/hq`, `/hq/memberships` load (service role).
4. Sylvia portal `/portal/[token]` loads care add-ons + savings.
5. Sign flow / home care plan save still works (anon write on persistence tables).
6. Supabase Dashboard → **Security Advisor** → re-run lint.

## Rollback

Re-run permissive policies from `schema.sql` pre-030 only if service role is unavailable — not recommended for production.
