# Atlas Pulse production activation

Atlas Pulse lives at `/hq/activation`. It is an exception-driven control tower,
not a second source of truth. Supabase owns HomeAtlas records, Jobber owns the
service calendar, Stripe owns payment methods, and Resend owns email delivery.

## What ships in code

- Seven-stage customer journey: Lead → Presentation → Agreement → Payment →
  Portal delivered → Jobber paired → Visit scheduled.
- Universal customer search across HomeAtlas and the complete synchronized
  Jobber customer index.
- Supervised match suggestions using exact email/phone plus name and property
  evidence. A founder must approve every pair.
- Rescue actions for agreements, payment setup, verified portal links, welcome
  email resend, Jobber pairing, and scheduling.
- Revenue Radar / Care Forecast using the canonical +$100 interior cleaning and
  +$50 screen cleaning standards. Unpriced services remain “quote after
  assessment.”
- Integration health for Supabase, Jobber, Stripe, Resend, Google Reviews, and
  Vercel deployment.
- Signed Jobber webhook ingestion with an immediate acknowledgement,
  deduplication, coalescing, and background read-only synchronization.
- Signed Resend/Svix webhook ingestion with replay protection and delivery,
  delay, bounce, failure, and complaint state.
- Automatic member-portal projection of the nearest future Jobber visit after a
  confirmed customer pair. Atlas Pulse creates the property link automatically
  only when Jobber and HomeAtlas each have exactly one eligible property;
  multi-property customers stay in supervised review.

## Production activation order

1. Apply `035_jobber_full_sync_and_customer_links.sql` if it is not already in
   production, then apply `036_atlas_pulse_delivery_and_webhooks.sql`.
2. Redeploy production and open `/hq/activation` behind the founder PIN.
3. In Jobber, register:

   `https://www.squeegeeking.net/api/integrations/jobber/webhook`

   The existing `JOBBER_CLIENT_SECRET` authenticates deliveries. Do not create
   a second shared secret or paste the client secret into chat.
4. In Resend, add a webhook for `email.sent`, `email.delivered`,
   `email.delivery_delayed`, `email.bounced`, `email.failed`, and
   `email.complained` at:

   `https://www.squeegeeking.net/api/integrations/resend/webhook`

5. Save the returned Resend signing secret as `RESEND_WEBHOOK_SECRET` in Vercel
   Production. Never prefix it with `NEXT_PUBLIC_`.
6. Redeploy, resend a welcome email from Atlas Pulse, and verify the state moves
   from **accepted** to **delivered** (or exposes the provider failure).
7. Run one complete Jobber sync, approve suggested customer pairs, and schedule
   each active membership in Jobber.

## Safety boundaries

- Webhook routes reject unsigned payloads before parsing them into operating
  state.
- Jobber payload bodies and Resend recipient addresses are not stored. Atlas
  Pulse stores hashes, provider IDs, masked destinations, and status only.
- Webhook retries are idempotent and delivery order is resolved using provider
  timestamps.
- HomeAtlas does not mutate Jobber appointments or auto-approve identity links.
- Portal appointment projection mirrors Jobber scheduling truth but never binds
  an obligation or enables billing on its own.
- A Jobber customer link does not grant billing authority.
