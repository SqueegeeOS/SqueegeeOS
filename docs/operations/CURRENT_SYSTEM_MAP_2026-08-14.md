# HomeAtlas current system map — 2026-08-14

This is an evidence-first release map. It separates the production deployment,
the verified local release branch, provider state, and intentional prototypes.
It does not treat the presence of a route or a successful unit test as proof
that a provider-backed workflow is live.

## Evidence used

- Production Vercel project: `squeegee-os`
- Current production deployment: `dpl_6spj2VpUqcUezbWhwwcVT7GjhHEy`
- Current production commit: `41b5e19a88a0600e5bc3bea171986bed044d0a94`
- Production deployment state: `READY`
- Local release branch: `codex/communications-readiness`
- Verified local base before this exception-management batch: `9452ac9`
- Local branch position with this exception-management commit: 37 commits ahead of
  the deployed production commit
- Repository size: 76 page entrypoints, 96 API entrypoints, 38 `lib/` domains,
  60 numbered SQL migrations (`002` through `061`), and 192 test source files
- Full local verification after the owner-leverage work:
  - 189 test files passed
  - 903 tests passed
  - TypeScript passed
  - ESLint passed with 0 errors and 90 inherited warnings
  - Next.js 16.2.10 production Webpack build passed; 133 static-generation
    units completed
- Live public checks:
  - `https://www.squeegeeking.net/` returned 200
  - `/api/persistence/health` returned 401 without HQ authorization
  - `/api/system/production-check` returned 401 without HQ authorization
  - `/api/reviews/google` returned live Google Places data: 130 reviews,
    5.0 average, with Google's supported five-review preview
- Seven-day production error review: the dominant failures are Jobber webhook
  and reconcile attempts reporting `jobber_not_connected`; one older signed
  agreement object is also missing from private storage

## Executive truth

HomeAtlas is already a substantial operating application, not a mockup. The
public acquisition, presentation, enrollment, portal, sales-representative,
HQ, communications, billing, review, and Jobber integration surfaces all
exist. The most important constraint today is release and provider state:

1. Production is running commit `41b5e19`, not the 37-commit verified local
   operations branch.
2. Production Jobber is currently disconnected. Jobber webhooks are arriving,
   but background synchronization and the reconcile cron cannot use them.
3. The field evidence, property-memory, technician access, visit-event, portal
   proof, dispatch, customer-aftercare, member case-intake, and owner-leverage
   release requires migrations `054` through `061` and an application deployment.
4. Customer messaging and unattended billing are correctly fail-closed. They
   must not be described as active until provider verification and owner
   controls prove that they are armed.

## Current-state classification

### LIVE

| System | What production can do now | Evidence boundary |
| --- | --- | --- |
| Public site and local SEO | Serves the SqueegeeKing site, service pages, metadata, structured local-business data, sitemap, request path, and responsive navigation | Live homepage returned 200 from the current production deployment |
| Google review preview | Loads real Google review totals and a moving customer-facing preview | Live API reported 130 reviews, 5.0 average, `provider=google_places`, `coverage=preview` |
| Lead intake | Validates and durably records website inquiries, captures source and SMS-consent evidence, attaches referrals, and attempts customer/founder notifications only after the record is saved | Deployed API and durable repository path; provider delivery readiness is separate |
| Presentations and enrollment | Creates editable recurring plans, preserves complete drafts, supports biannual, optional triannual, and quarterly plans, signs agreements, sets up Stripe payment methods, and activates memberships idempotently | All code is in the deployed production commit lineage |
| Address entry | Accepts ZIP and ZIP+4 and supports Google Places address autocomplete while retaining manual editing | Deployed before the current production commit |
| David sales workspace | Provides a private rep workspace, door/conversation activity, lead capture, follow-up state, presentation handoff, signed-close attribution, ARR tracking, and audit-safe activity reversal | PRs 45, 46, 47, 50, 51, and 52 are in production history |
| Membership and token portal foundation | Serves private bearer-token member portals, membership status, care-plan information, payment state, savings/referrals, and the paired next Jobber appointment when current synchronized data exists | Deployed code; current Jobber disconnection limits appointment freshness |
| Referral foundation | Creates member referral codes, records attributed visits, carries attribution into lead intake, and calculates reward milestones | Deployed repository and portal API paths |
| HQ security boundary | Protects HQ data APIs and operational health endpoints; missing configuration fails closed | Public health checks returned 401; server uses signed, expiring admin sessions and timing-safe PIN checks |
| Integration safety | Verifies webhook signatures, uses idempotency keys and provider event ledgers, and prevents Jobber GraphQL mutations in the current connector | Deployed tests and server guards |

### BUILT BUT NOT LIVE

These capabilities are implemented and verified on
`codex/communications-readiness`, but are absent from the production commit.

| Release area | Capability | Required release boundary |
| --- | --- | --- |
| Visit evidence | Durable notes, before/after/detail photos, private versus customer-visible proof, resumable uploads, local unsaved-draft recovery, and idempotent closeouts | Apply migration `054`; deploy matching application |
| HQ field exceptions | Missing proof, private-only proof, open follow-ups, incomplete closeouts, and exact owner-action links | Apply `054`; deploy |
| Lead-to-presentation lineage | One inquiry maps safely to one resumable presentation; retries do not create duplicates | Apply `055`; deploy |
| Exact service scope | Mirrors Jobber line items with explicit unavailable/partial states and preserves the purchased service scope for technicians | Apply `056`; deploy |
| Technician Field Pass | One-time install link, hashed token, revocable device session, assignment-bounded read/write access, and no owner-level HQ permission | Apply `057`; deploy |
| Technician Field Run | Assigned route, active/next stop, service scope, property context, required proof, closeout, and recovery after interrupted saves | Apply `054`–`057`; deploy |
| Visit event automation | Monotonic On my way → Arrived → Working → Service complete → Departed event ledger; completion requires a saved closeout | Apply `058`; deploy |
| Customer live service | Bearer-token portals receive a deliberately limited live visit stage without technician IDs, route data, internal notes, or provider IDs | Apply `058`; deploy |
| Technician dispatch | HQ shows scheduled crew, usable Field Pass state, active stop, proof state, route-complete state, unassigned work, and the exact stop needing attention; refreshes every minute while visible | Apply `054`–`058` and deploy |
| Owner attention queue | HQ ranks current website/Meta leads, David follow-ups, salesperson retention drift, dispatch drift, field follow-ups and proof gaps, completed visits awaiting independence review, stale Growth Sessions, billing exceptions, communication gates, review-ready visits, annual member check-ins, referral rewards, stale referred leads, and uncovered production safeguards; each item deep-links to the exact record when possible and treats unreadable sources as unknown | Deploy the local branch and verify the authorized `/api/admin/attention` response in production |
| Referral and retention aftercare | Read-only projections identify converted referrals awaiting reward review, available Care Credit, referred leads pending at least seven days, cancelled-member attribution drift, and due salesperson retention checkpoints without invoking the existing reward or lifecycle writers | Deploy and verify exact links against non-customer/internal records; operational changes remain explicit owner actions |
| Customer aftercare | A private Care workspace derives review opportunities only after a verified completed Jobber visit has a saved field record, customer-visible proof, and no open service follow-up; it also derives annual care check-ins from the real membership start date and stores explicit owner outcomes without sending a message | Apply migrations `054` and `059`; deploy; verify with non-customer/internal records |
| Customer service recovery | The bearer-token portal can create and re-display a private care case tied only to the server-resolved member/property and an optional verified visit; retries are idempotent, unresolved intake is capped, private owner notes never enter the portal response, HQ can acknowledge/resolve explicitly, and open cases rank in owner attention without sending a message | Apply migration `060`; deploy; verify only with an internal/non-customer portal token before opening to members |
| Multi-property member portal | A token proves one durable homeowner record, then a mobile-first Your homes switcher projects only that homeowner’s current memberships and navigates each card to the property’s canonical portal so payment, referral, visit, theme, and case actions remain correctly scoped; cancelled history and malformed joins are excluded | Deploy; verify with an internal homeowner who has two current property memberships before exposing it to customers |
| Owner leverage loop | Today records one private field-independence review per verified, matched, completed, assigned, documented Jobber visit; only normal, quality-verified, zero-owner, measured work with no open exception counts toward the 8 → 16 → 24 → 32 hour ladder. Growth clocks for Noah and Dasan connect completed effort to agreement-backed attributed ARR, alert after eight hours, and allow an overlong timer to be cancelled but never counted—all without sending, charging, compensating, invoicing, or mutating Jobber | Apply migration `061`; deploy; rehearse on an internal/non-customer record while Jobber is connected |
| Local reliability improvements | Billing rehearsal explanations, communications readiness proof, safer presentation retries, expanded David follow-up visibility, hardened portal truth, visit-story history, owner-attributed presentations, stale-session recovery, and production migration audits through `061` | Deploy the 37-commit local branch with its migrations |

### PARTIAL

| System | What exists | What prevents a complete claim |
| --- | --- | --- |
| Jobber | OAuth/PKCE, encrypted tokens, full client/property/visit pagination, supervised HomeAtlas pairing, assignment/scope/invoice visibility degradation, webhook inbox, daily reconcile, portal projection, and billing snapshots | Production is currently disconnected. Runtime errors show webhook and cron work stopping at `jobber_not_connected` |
| Customer portal | Strong token portal, care plan, payment/referral state, deployed next-appointment support, plus locally verified customer-care intake and homeowner-scoped multi-property switching | Current Jobber data cannot stay fresh; field proof, visit stories, live-stage cards, service-case intake, and the property switcher remain local |
| Property memory | Properties, assessments, health checks, notes, assets, observations, and portal structures exist | The coherent visit evidence/follow-up layer is local behind migration `054`; property summaries and cross-visit intelligence are not yet complete |
| Communications | Durable conversations/messages, Resend and Twilio providers, signed webhooks, consent ledger, STOP handling, quiet hours, manual send, lead acknowledgement, and appointment reminder workers exist | Twilio sender approval and current webhook proof are not confirmed; Resend readiness is not re-verified in this audit; no real message was sent during validation |
| Automatic billing | First-business-day cron, fresh-Jobber-snapshot gate, standing authorization checks, Stripe PaymentIntent idempotency, amount caps, leases, retries, webhook reconciliation, preview, pause, and kill switches exist | Jobber is disconnected; live Stripe webhook verification and the founder's armed state were not proven here; no charge was attempted |
| AI presentation assistant | A private, schema-constrained OpenAI plan assistant turns owner notes into editable visit scope without making the model a source of truth | Production `OPENAI_API_KEY` configuration is not proven; the broader operational copilot is not built |
| Technician workflow | Legacy `/tech` field and property routes exist in production | The secure assignment-bound Field Pass and automated Field Run are still local |
| Meta lead ads | Signed Meta webhook intake, source attribution fields, idempotency, owner-alert state, and lead acknowledgement integration exist | Meta app/page/form subscription and current provider verification are not proven |
| Payments | Stripe payment-method onboarding and membership activation are deployed | This audit did not make a real payment; unattended monthly collection remains gated as described above |

### MOCK / PLACEHOLDER / LAB

- `/day`, `/day2`, `/night`, `/night2`, `/experience/*`, `/rightway-lab`, and
  `/atlas-glass/claude` are design or comparison laboratories, not operating
  truth.
- `/properties` is still an employee placeholder route.
- Parts of `/employee/requests` and `/employee/settings` remain transitional.
- `lib/admin/mock-data.ts`, `lib/property/mock-data.ts`, and older membership
  mock checkout/agreement helpers remain in the repository for demo or fallback
  paths. They must never be reported as production customer or financial truth.
- Slug-based `/homecare/.../portal` routes are legacy/demo views. The token
  `/portal/[token]` route is the customer production boundary.

### NOT BUILT

- Churn-risk scoring and a contractual renewal workflow are not built. Direct
  customer case intake, annual care check-ins, review opportunities, referral
  rewards, and salesperson-retention exceptions are implemented locally.
- Automatic lead scoring and duplicate resolution across website, Meta, Jobber,
  sales-rep, email, and phone identities
- A household-level billing/contact-preference account view beyond the locally
  implemented property switcher
- Weather-aware route/reschedule recommendations
- Automatic technician assignment or route optimization
- Safe Jobber close/invoice mutations; the connector intentionally rejects
  mutations today
- A general HomeAtlas operational copilot with tool permissions, citations,
  approval gates, and durable action history
- Automated review/referral orchestration tied to verified visit completion
  and customer communication eligibility

### BLOCKED

| Blocker | Human/provider boundary | Safe next action |
| --- | --- | --- |
| Jobber production disconnected | OAuth authorization cannot be fabricated by code | Owner reconnects Jobber once; then run read-only full sync and verify account identity |
| Field and aftercare release not deployed | GitHub push/PR access is unavailable from this current session; production follows `main` | Preserve a complete Git bundle and publish the verified branch when access returns |
| Migrations `054`–`061` not proven in production | Local checkout has no production DB URL and no database connector was available in this audit | Apply in order, verify each schema effect, then deploy matching code |
| Twilio not armed | Sender registration/approval and signed webhook verification are provider-controlled | Keep SMS rules off; after approval, verify with the owner's opted-in number |
| Meta lead subscription unproven | Requires the correct Meta business, page, form, and webhook subscription | Connect one test form, use a provider test lead, verify source attribution, then enable |
| Automatic billing unproven | Requires connected Jobber, current Stripe webhook proof, signed authorization, owner cap, and explicit arming | Use preview only until every gate is green; rehearse with a non-customer/internal record |
| OpenAI production status unproven | Requires an explicit key-storage choice and production environment configuration | Choose `Reuse existing key` or `Create Codex key`; never paste the key into chat |

## Highest-leverage sequence

1. Reconnect Jobber and prove a complete read-only sync. Almost every next
   automation—Today, portal appointment truth, field assignment, scope,
   billing preview, and dispatch—depends on it.
2. Release the verified field, aftercare, service-recovery, and owner-leverage
   branch with migrations `054` through `061`.
3. Run the technician acceptance test using an internal/demo Jobber client:
   assigned route, Field Pass, scope, proof, closeout, departure, owner
   exception, and safe customer portal status. Send no customer message.
4. Deploy the ranked owner attention queue and owner-leverage scoreboard, then
   verify that production leads,
   David follow-ups, Jobber visits, field proof, customer-reported cases,
   customer aftercare, field-independence reviews, Growth Sessions, attributed
   ARR, billing, communications, and production safeguards resolve to the
   correct records without causing implicit writes.
5. Verify provider readiness in order: Resend, Twilio, Meta, Stripe. Only then
   enable narrowly scoped automation rules with kill switches and audit logs.
6. Build the household/multi-property account layer on top of the trustworthy
   property switcher rather than adding another disconnected portal surface.
7. Add a cited operational copilot only after the underlying records and
   approval boundaries are stable. The copilot should explain and propose;
   structured records and explicit commands should remain authoritative.

## Operating principle

The next product milestone is not a larger dashboard. It is a quieter one:
normal work advances from durable events, and HomeAtlas asks the owner for help
only when the data proves that human judgment is needed.
