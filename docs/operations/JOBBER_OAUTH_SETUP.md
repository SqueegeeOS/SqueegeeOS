# Jobber OAuth Connection Setup

**State:** Connection foundation only. Read-only synchronization is not enabled.

## What this connection does

- Sends Noah through Jobber's OAuth authorization screen.
- Verifies the exact Jobber account ID and company name.
- Encrypts access and refresh tokens before storing them in Supabase.
- Rotates refresh tokens under a database lease so concurrent workers cannot
  redeem the same refresh token.
- Pins the Jobber GraphQL API version.

It does **not** import clients, properties, jobs, visits, or technicians. It
does not create, edit, complete, invoice, or cancel anything in Jobber. It does
not enable HomeAtlas billing.

## Required order

1. Review and apply migrations `031_care_operations_foundation.sql`,
   `032_jobber_oauth_connection.sql`, `035_hq_authenticated_access.sql`, and
   `044_jobber_oauth_authority_hardening.sql` to the intended Supabase
   environment in numeric order. This remediation branch is now stacked on
   the authoritative-visit-completion branch, so migration 043 precedes 044
   in repository history. Preserve that order and do not renumber migration
   044. This ordering does not satisfy either migration's rehearsal, catalog
   proof, production-application, merge, or deployment gates.
2. In Vercel, add these server-side environment variables to Production and
   the intended Preview environment:
   - `JOBBER_CLIENT_ID`
   - `JOBBER_CLIENT_SECRET`
   - `JOBBER_TOKEN_ENCRYPTION_KEY`
   - `JOBBER_EXPECTED_ACCOUNT_ID` set to the independently verified
     SqueegeeKing Jobber account ID
   - `JOBBER_OAUTH_REDIRECT_URI`
   - `JOBBER_GRAPHQL_VERSION=2025-04-16`
3. Generate `JOBBER_TOKEN_ENCRYPTION_KEY` as 32 random bytes. One safe command
   is `openssl rand -base64 32`. Store the result as a secret. Never paste it
   into chat or expose it to the browser.
4. Set `JOBBER_OAUTH_REDIRECT_URI` to the stable production application origin
   plus this exact path:

   `/api/admin/care-operations/jobber/oauth/callback`

5. Redeploy HomeAtlas so the server receives the new variables.
6. Open **Headquarters → Production Health → Jobber connection**.
7. Copy the callback URL shown there into the draft Jobber app's editable
   **Callback URL** field and save the Jobber app.
8. Return to Production Health and press **Connect Jobber**.
9. Confirm the Jobber authorization page lists view-only permissions, then
   allow access.
10. Confirm HomeAtlas returns to Production Health and shows the correct Jobber
    account name as **Connected**.

## Expected account provenance checklist

Complete and retain this checklist before setting
`JOBBER_EXPECTED_ACCOUNT_ID`. The callback being authorized is not an
independent source.

- Read the opaque account ID from SqueegeeKing's intended Jobber account using
  an already trusted Jobber administrator session or a separately authorized,
  read-only provider query.
- Confirm the Jobber account/company name, tenant environment, and OAuth app
  are the intended SqueegeeKing production or preview combination.
- Record the source surface or query, verification date, environment, and the
  operator who verified it in the release evidence. Do not record tokens or
  secrets.
- Have a second authorized operator compare the configured value character for
  character with the independent source before deployment.
- Keep the value server-only. Browser readiness may expose only whether it is
  configured, never the value itself.

## Wrong-account revocation and recovery

If Jobber returns the wrong account, HomeAtlas rejects it before any connection
row or immutable connection event is inserted. Do not keep retrying the
callback.

1. In the mistakenly authorized Jobber account, revoke/remove the HomeAtlas
   OAuth app authorization using Jobber's provider-side connected-app or app
   authorization controls. The rejected grant is not stored by HomeAtlas, but
   provider-side revocation is still required so the wrong-account tokens no
   longer remain valid.
2. If the account cannot revoke the grant directly, hold the integration and
   use Jobber support/account administration to revoke it. Do not enable sync
   while revocation is unresolved.
3. Repeat the expected-account provenance checklist and correct the server
   environment through the approved secret/deployment process if needed.
4. Start a fresh OAuth authorization from the intended SqueegeeKing Jobber
   administrator session and verify the connected account name.

There should be no HomeAtlas connection row or OAuth operation event to clean
up after a rejected first connection. If either exists, stop and investigate
instead of deleting or rewriting evidence.

## Abort conditions

- The authorization screen shows create, edit, delete, invoice, payment, or
  cancellation access.
- `JOBBER_EXPECTED_ACCOUNT_ID` is absent or has not been independently
  verified against the intended SqueegeeKing Jobber account.
- The callback URL shown by HomeAtlas differs from the URL saved in Jobber.
- HomeAtlas returns an account ID different from `JOBBER_EXPECTED_ACCOUNT_ID`
  or an account name other than the SqueegeeKing account.
- Migration `032`, `035`, or `044` is not present in the target Supabase
  environment.
- Any Jobber token or secret appears in browser-visible output, logs, chat, or
  screenshots.

If any abort condition occurs, stop. For a wrong-account authorization, follow
the provider-side revocation and recovery procedure above. Do not retry
repeatedly and do not enable sync or billing.
