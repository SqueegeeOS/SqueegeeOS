# Membership service-text consent and reminder timing

## Operation
- Sign-together has a separate unchecked optional service-text checkbox. It does not authorize marketing or substitute for payment authorization.
- The immutable signature snapshot and audit RPC bind opt-in to the exact customer and mobile number. Existing agreements remain unconsented. Existing STOP status is never cleared by this flow.
- In the customer communications inbox, Visit reminder timing offers one week, one day, both, off, or up to four custom hour offsets (1–720). Saving timing never changes consent or automation switches.
- Default remains one day. New preference settings apply only to future due times, not historical reminders.
- The cron checks every five minutes (288 invocations/day), reading current verified Jobber appointments. The existing Jobber synchronization and billing schedules are unchanged.
- Business timezone and quiet hours remain centralized in the existing automation code. A reminder falling in quiet hours moves to the next allowed time; started visits are skipped.
- Existing 24-hour idempotency keys are preserved. Other offsets get distinct keys; rescheduling changes the schedule key. Existing message reservation prevents overlapping cron runs from duplicating sends.
- Schedule is checked again immediately before sending, while current consent/provider-readiness gates stay in the outbound service. There is still a narrow external-provider race if a visit changes after that final database read.

## Release and validation
Apply both 20261114 migrations before deploying the application. They are additive and do not enable automation rules or backfill customer consent. Anonymous and authenticated roles cannot call the consent recorder or access preferences; only the service-role backend can.

Run the communications, enrollment and onboarding Vitest suites, TypeScript, changed-file ESLint and the production webpack build. The rollback-only `scripts/test-sign-together-visit-sms.sql` is for a disposable database, never production. It covers original evidence, STOP preservation, ownership, retry idempotency, immutable snapshots and actual ordinary-role execution denial. No provider calls are needed for these tests.

Production verification should be read-only: check migrations/ACLs, deployment SHA/status, auth rejection on the admin API and routine runtime logs. Do not manually invoke the reminder cron or send a customer test message.

Rollback the application to the prior deployment if needed; leave additive tables/columns and evidence intact. Do not delete evidence or reset consent to roll back a release.
