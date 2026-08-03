# Automated communications and member billing

This runbook is intentionally fail-closed. Deploying the code or applying the
schema does not arm SMS or automatic charges.

## 1. Database and deployment order

1. Apply `043_automatic_membership_billing.sql`.
2. Apply `044_sms_consent_evidence.sql`.
3. Apply `045_communications_consent_and_provider_readiness.sql`.
4. Deploy the matching application commit.
5. Open HQ Production Health and resolve every red schema check before using
   the controls.

Do not deploy the application before migration 043: HQ and onboarding read the
new billing-authorization fields immediately.

## 2. Stripe automatic billing

Create a live Stripe webhook endpoint at:

`https://www.squeegeeking.net/api/integrations/stripe/webhook`

Subscribe it to:

- `setup_intent.created`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `payment_intent.requires_action`

Store the endpoint signing secret as `STRIPE_WEBHOOK_SECRET` in Vercel, then
redeploy. In HQ Billing Control, choose **Verify live webhook (no charge)**.
Atlas creates and immediately cancels a live SetupIntent with no customer or
payment method; it cannot move money. Its signed `setup_intent.created` event
proves that the deployed live endpoint and current live signing secret agree.
A Stripe test-mode delivery does not unlock this live-only gate. Confirm the
panel says **Live delivery verified**. Stripe recommends webhook-based
success/failure handling for PaymentIntents; see
[Stripe webhook setup](https://docs.stripe.com/webhooks) and
[payment status updates](https://docs.stripe.com/payments/payment-intents/verifying-status).

Before arming:

1. In HQ Jobber, link each member's property and explicitly classify the
   recurring Jobber job as that membership's service job.
2. For a legacy member, open the signed PDF, verify the exact visit price and
   first-of-service-month language, record the authorization, and separately
   choose **Resume auto-bill**.
3. Run **Preview eligibility (no charge)** and resolve every blocker.
4. Confirm live Stripe mode, the webhook verification, and the founder charge
   cap.
5. Choose **Arm automation** only when the owner is ready.

The first-of-month billing cron performs a fresh, successful Jobber snapshot
before it can claim any charge. The normal daily reconcile is a second safe
first-day opportunity. Claims are taken one at a time with a function-time
budget, so a later first-day run can continue untouched work instead of
inheriting a bulk lease from a timed-out worker.

New signed memberships store a versioned price and terms hash. Legacy records
stay paused until reviewed. A first-ever charge discovered after the 1st stays
preview-only; Atlas does not create a surprise late catch-up charge. Exact
failed orders can be retried from the billing register after the member updates
their card.

The customer agreement and SetupIntent must remain aligned. Stripe says future
off-session permission should identify the payment series, frequency, and how
the amount is determined; see [Stripe SetupIntents](https://docs.stripe.com/payments/setup-intents).

## 3. Transactional email

Set these Vercel variables:

- `RESEND_API_KEY`
- `RESEND_COMMUNICATIONS_FROM`
- `RESEND_COMMUNICATIONS_REPLY_TO`
- `RESEND_WEBHOOK_SECRET`

Point the Resend webhook to:

`https://www.squeegeeking.net/api/integrations/resend/webhook`

Send one signed delivery test after deployment. Atlas stores a fingerprint of
the current webhook secret and will not enable an email automation rule until a
signed event for that same secret has arrived. Changing the secret requires a
new signed test.

Customer replies go to the monitored reply-to mailbox; they do not appear as
inbound HQ messages. Delivery events do appear in Atlas. Once HQ shows email as
configured, the owner can enable lead acknowledgements and verified-visit email
reminders.

## 4. Transactional SMS and two-way text

Use a Twilio Messaging Service, add the chosen sender, and complete the sender's
required U.S. registration before enabling SMS. Twilio states that U.S. traffic
sent from a local 10-digit number is A2P and requires registration; see
[A2P 10DLC overview](https://help.twilio.com/articles/1260800720410-What-is-A2P-10DLC)
and [Messaging Services](https://www.twilio.com/docs/messaging/services).

Set these Vercel variables:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_MESSAGING_SERVICE_SID` (preferred), or `TWILIO_FROM_NUMBER`
- `TWILIO_STATUS_CALLBACK_URL=https://www.squeegeeking.net/api/integrations/twilio/status`
- `TWILIO_SENDER_APPROVED=true` only after Twilio shows the chosen sender and
  required registration approved

Configure incoming messages as an HTTPS POST to:

`https://www.squeegeeking.net/api/integrations/twilio/inbound`

Keep every SMS rule off until the sender is approved, the app is redeployed,
and a signed inbound or status-callback test is recorded for the current Twilio
auth token. Then test with the owner's own explicitly opted-in number before
enabling customer rules. Atlas rechecks current consent and destination
immediately before a queued send, honors STOP/START and clear ordinary-language
opt-outs, and validates Twilio webhook signatures. Twilio documents both
inbound and status callbacks in [Messaging webhooks](https://www.twilio.com/docs/usage/webhooks/messaging-webhooks).

For an existing member, adding or editing a phone number never grants consent.
Open **HQ Communications**, select the customer, choose **Text**, record when
and how the customer explicitly approved transactional texts to that exact
number, and check the founder attestation. Atlas stores the decision in an
append-only evidence ledger and only then creates a verified, opted-in contact
point. Use **Stop texts now** immediately for any spoken, written, or texted
opt-out; fresh explicit permission is required before restoring texts.

Payment-action texts honor Pacific quiet hours. If a message is deferred, Atlas
rechecks that the billing order still needs customer action before delivery and
cancels stale notices.

## 5. Kill switches and recovery

- **HQ Communications:** turn off any email or SMS automation rule.
- **Per member:** pause auto-bill; unstarted orders for that member become inert.
- **Global billing:** turn off automatic billing; unattended claims stop and
  unstarted queued charges are voided.
- Never retry a reconciliation-required payment from HQ. Compare Stripe and the
  Atlas ledger first.
- A card update does not silently retry a failed charge. HQ must retry the exact
  current-month order explicitly.
