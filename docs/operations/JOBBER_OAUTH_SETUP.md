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

1. Review and apply migrations `031_care_operations_foundation.sql` and
   `032_jobber_oauth_connection.sql` to the intended Supabase environment.
2. In Vercel, add these server-side environment variables to Production and
   the intended Preview environment:
   - `JOBBER_CLIENT_ID`
   - `JOBBER_CLIENT_SECRET`
   - `JOBBER_TOKEN_ENCRYPTION_KEY`
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

## Abort conditions

- The authorization screen shows create, edit, delete, invoice, payment, or
  cancellation access.
- The callback URL shown by HomeAtlas differs from the URL saved in Jobber.
- HomeAtlas verifies an account name other than the SqueegeeKing account.
- Migration `032` is not present in the target Supabase environment.
- Any Jobber token or secret appears in browser-visible output, logs, chat, or
  screenshots.

If any abort condition occurs, stop. Do not retry repeatedly and do not enable
sync or billing.
