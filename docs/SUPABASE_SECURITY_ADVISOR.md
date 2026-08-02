# Supabase Customer Data Boundary — Migration 038

Migration `030_supabase_security_hardening.sql` closed anonymous access to HQ,
billing, and referral data, but intentionally left six customer persistence
tables anonymously readable and writable for the original browser adapter.
That exception included `memberships.portal_access_token` and is no longer an
acceptable production boundary.

Migration `038_close_customer_anon_access.sql` completes the move to
server-only persistence:

- removes every `anon`, `authenticated`, or `public` policy from
  `homeowners`, `properties`, `home_care_plans`, `memberships`,
  `signed_agreements`, and `property_assets`;
- revokes direct table privileges from `anon` and `authenticated`;
- preserves service-role access for authenticated Next.js route handlers;
- adds durable failed-attempt throttling for `/api/admin/unlock`; and
- exposes a service-role-only posture check used by
  `scripts/verify-supabase-security.mjs`.

The Supabase publishable/anon key is designed to be present in a browser. The
security guarantee comes from RLS and table privileges, not from hiding that
key. Portal bearer tokens should still be rotated if there is evidence they
were copied or as part of a deliberate customer-notification campaign.

## Required Vercel configuration

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PIN` (server-only)

`NEXT_PUBLIC_ADMIN_PIN` is no longer read by application code. Remove it from
Vercel after confirming `ADMIN_PIN` exists.

## Deployment order

1. Deploy the application release that includes the authenticated
   `/api/admin/home-care-plans` route.
2. Confirm the Home Care Plan builder saves and reloads through an active HQ
   session.
3. Apply `038_close_customer_anon_access.sql` in the Supabase SQL Editor.
4. Apply `039_preserve_membership_history.sql` after 038.
4. Run `npm run verify:supabase-security` with the service-role environment
   available.
5. Smoke-test `/hq`, `/hq/memberships`, one real `/portal/[token]`, and the
   presentation/signing flow.
6. Re-run Supabase Security Advisor.

Do not apply migration 038 before deploying the server-routed presentation
builder; the older browser adapter depends on the policies being removed.

## Expected verification

- customer public policy count: `0`
- customer public privilege count: `0`
- admin unlock rate limit: `READY`
- all six customer tables: `service=OK anon=CLOSED`

## Recovery

If the application cannot read customer data after migration 038, verify
`SUPABASE_SERVICE_ROLE_KEY` first and redeploy. Do not restore anonymous
customer-table policies as a routine rollback. The repository keeps migration
030 as historical evidence, not as the desired security state.
