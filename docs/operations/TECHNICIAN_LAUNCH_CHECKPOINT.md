# Technician launch checkpoint — 2026-09-04

## Shipped before this phase

- PR #162: active Tyler roster and HomeAtlas staffing for exact future Jobber visits.
- PR #163: shared luxury foundation and role entry surfaces.
- Production Dispatch contains Tyler Germany. The owner subsequently assigned six visits.

## Closeout reliability phase

- Fixed ambiguous dual targets on member-linked native jobs across clock/upload/commit.
- Native timers and closeouts now win over stale legacy member snapshots.
- Native jobs no longer require member pairing or claim customer portal publication.
- Owner Today can review native technician names, elapsed time, notes, exceptions and private photos.
- Owner photo endpoint authorizes before reads; exact record paths only, five-minute links, no-store.
- Native clock/closeout row locks prevent reassignment races; saved closeouts replay after clock-out.

## Verification

- Reproduced the original post-clock-out retry failure against the database.
- Applied the backward-compatible retry migration and passed transaction-only SQL rehearsal:
  assign, assignment retry, wrong technician rejection, clock-in, repeated clock-in,
  finish-before-proof rejection, save closeout, finish, retry closeout, no duplicate
  clocks/closeouts, Jobber completion unchanged.
- Verified zero synthetic technician/visit rows remained after rollback; no real assignments created.
- Final local checks: 1,447 tests in 314 files passed; lint 0 errors/84 existing
  warnings; TypeScript passed; production build verification recorded in CI.
- Added owner-only invite SMS delivery to the active technician's registered phone,
  using the existing Twilio sender. No arbitrary message/destination is accepted.
  A private grant-row reservation prevents duplicate sends and unsafe timeout retries.
  SQL rehearsal verified first reservation succeeds, second is rejected, and rollback
  leaves no synthetic grants. Public table privileges remain denied.
- Added a read-only next-six-weeks schedule, scoped server-side to the technician's
  assignments. Mobile/desktop fixtures cover upcoming work, keyboard opening, error/retry.
- Owner has assigned Tyler six real upcoming visits. No assignment changes were made by this release.
- Local 390px and 1440px production-build UI fixture checks cover keyboard opening,
  notes/exceptions, failed photo signing, error/retry, no overflow and no page errors.
  Browser fixtures mock board/evidence responses; this is not a live technician session.
- Supabase security advisor: private service-role tables intentionally have no public
  RLS policies. Existing Auth leaked-password-protection warning remains outside this phase:
  https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Still not verified / launch handoff

- Tyler's complete real assigned-job run. Following explicit
  owner confirmation, one private activation invitation was sent to his registered
  phone on September 4 at 21:08 UTC. The original grant was successfully claimed
  at 21:30:12 UTC (2:30 PM Pacific) after the origin fix; current status is active.
  Do not replace that access or resend the consumed invitation.
- Actual camera file upload through Tyler's device and opening that stored image in HQ.
- Native exception resolution shipped in PR #170; real customer use remains
  unverified because no native customer closeout exists yet.
- Non-member payment collection remains a separate owner/provider action.
- Broader luxury audit remains open; this phase does not claim every site surface is finished.

## Technician visual consistency follow-up

- Removed the technician-only brighter-gold theme override; HQ and technician
  surfaces now inherit the shared champagne accent (#c9b896).
- Unified palette tokens across Team, readiness, capacity, dispatch, today's jobs,
  referral entry and the technician shell. Shared form/action primitives are reused.
- No business logic, permissions, API payloads or assignment behavior changed.
- Local verification: 1,449 tests in 315 files, quiet lint, TypeScript and production
  build passed. Browser fixtures passed at 390px and 1440px: keyboard interactions,
  notes/photo errors, schedule retry, invite duplicate prevention, referral layout,
  matching computed accent tokens, no horizontal overflow and no page errors.
- These browser checks use synthetic local responses, not Tyler's real session.

No customer messages, charges, billing arming, production deletes, or Jobber
schedule/completion writes were performed. The authorized technician invitation
described above is the only live SMS sent by this launch phase.

## Activation incident — September 4

- Tyler reported an inert activation button, then the exact `Invalid origin` error.
- Production logs confirmed repeated POST `/api/field/access/claim` responses with
  status 403. His grant stayed pending and unconsumed.
- Reproduced in a real local browser: the blanket private-page `no-referrer` policy
  generated `Origin: null` for native form navigation, rejected by the CSRF check.
- Narrow correction: `/tech/access` overrides the referrer policy to `strict-origin`.
  The browser sends only the site origin, never the token path/query. All other
  private pages keep `no-referrer`; cross-origin and opaque-origin rejection remain.
- Regression coverage includes successful mocked claim/cookie redirect, invalid
  token recovery, hostile/opaque origin rejection, ordered header override, and a
  local native-form browser reproduction with JavaScript enabled and disabled.
- No replacement invite or second SMS is required for a pending valid invitation.

## Native workday control audit

- A technician-role browser rehearsal exposed an extra `Add visit memory` action
  after the native closeout was saved, although storage permits only one closeout
  per assignment. Native capture now requires a running clock and zero saved records.
- A saved-record notice now directs the technician to pack up and clock out; it
  does not imply their timer stopped when they saved work.
- `scripts/verify-technician-workday.mjs` runs a real local claim/cookie/role journey
  against a narrowly scoped synthetic database adapter. Workday APIs and storage
  uploads are browser fixtures. It checks HQ isolation, native-only request targets
  even for member-linked jobs, clock-in, private photo upload, failed-save recovery,
  stable retry record ID, one photo upload, one successful commit, clock-out, no
  extra capture controls, unchanged Jobber completion and mobile/desktop overflow.
- This adds browser evidence for the technician controls, not proof of Tyler's
  physical-device upload, live storage signing or completion of his real jobs.

### Release verification / next audit

- PR #167 merged as `5e5911c`; CI tests/lint/build passed. Local suite: 1,455
  tests / 316 files, production build and both browser fixture sizes passed.
- Production `dpl_4JAd5KCsWF52F6MTr99y4y2EUY4q` is Ready on the canonical domain.
  Live owner-preview technician shell and Upcoming jobs open with no alert or
  horizontal overflow; the shared accent is #c9b896. No Jobber stops exist today,
  so real clock/photo/closeout behavior could not be exercised on a live stop.
- The next owner audit found HQ's customer-publication warning and crew counts
  still using legacy assumptions; see the correction below.
- Owner review/payment visibility and real-device photo evidence remain separate
  completion gates. Do not mark the overall launch goal complete from fixtures.

## HQ native review truth

- Shared customer-update predicate now exempts private native closeouts in both
  HQ Today and technician readiness; legacy portal closeout checks are preserved.
- Confirmed HomeAtlas assignments count as assigned even when Jobber has no crew
  seat or hides its crew list. Incomplete native identity does not fabricate a crew.
- Owner field-mode crew filters and technician cards use the native assignment
  ahead of the mirrored Jobber crew. Assignment summaries and instructions now
  mention HomeAtlas Dispatch without changing Jobber scheduling authority.
- Technician read authorization now makes native assignment authoritative too:
  stale mirrored Jobber crew cannot see reassigned customer/work details. Partial
  native identity fails closed. Regression tests cover both mismatches and missing IDs.
- Owner independence/performance reviews are stripped from technician responses,
  not just hidden in the UI; owner source data remains unchanged.
- HQ can review private native evidence without mandatory membership pairing.
  Optional portal pairing and existing owner publication controls remain available.
- Added regression tests for native/legacy publication, missing proof, unchanged
  Jobber completion, partial assignment identity, native crew counts and filters.
- Full local suite after privacy checks: 1,460 tests / 316 files; quiet lint and production build passed.
- Browser verifier passed completed native/legacy owner states and the native crew
  filter at 390px and 1440px, plus evidence retry, keyboard, no overflow, referral
  layout and shared accent. Inspected the completed-native mobile screenshot.
- Separate technician-role rehearsal passed activation, save retry, one private
  upload/commit, clock-out and unchanged Jobber completion at both viewport sizes.
  Browser APIs/storage remain synthetic; this is not a real customer job.
- Local access entry was also inspected with agent-browser. PR #168 merged as
  `148cbc7`; final CI run `33923716398` passed tests/lint/build in 2m34s.
  Production `dpl_AUqWa5Nv8K7ELiEmpVNeQSVLgT91` /
  `squeegee-poqg9739j-squeegee-os.vercel.app` is Ready (about two minutes).
- Canonical production browser verified corrected HQ assignment/Dispatch copy,
  no alerts or horizontal overflow, technician owner preview, and expanded
  Upcoming schedule loaded. Returned the owner's tab to HQ Today. Today still
  has no jobs; completed-native interactive evidence remains a local fixture.
- Deployment-specific error log scan after these browser checks returned no rows.
  Broad monitoring/drain configuration was not changed or re-audited in this pass.
- Remaining owner audit: native exception resolution (not merely viewing flags),
  and payment visibility. Jobber sync already observes invoice/invoiceReadState;
  HQ Today currently omits that from its DTO. Inspect source-specific payment
  evidence before adding any paid/unpaid label. No collection is authorized.
- Read-only production evidence: visits from the prior 30 through next 45 days
  have 19 `paid`, 18 `NONE`, and one `awaiting_payment` invoice projection. This
  confirms source visibility, not Stripe settlement or a live payment action.
- Owner's current design direction: fewer clicks, streamlined actions and visible
  bottlenecks. Observed HQ mobile friction: nine metrics stack before the route.
  Compact that summary and improve direct next actions in a subsequent UI pass.
- Next priority: navigation currently uses `propertyLabel`, populated from an
  optional Jobber client property name, rather than `property_address`. A live
  read-only count found eight future Tyler assignments, all eight with street1
  but only one with property_name. Add an actual address DTO from the exact visit
  projection and use it in today's directions/upcoming. Do not geocode names.
- Recheck the shared technician DTO allowlist before adding invoice fields;
  owner billing details and owner independence reviews must stay owner-only.

## Streamlined navigation and owner invoice visibility

- HQ Today now has a direct Go to jobs anchor and a two-column compact mobile
  summary instead of nine single-column metric cards above the route.
- Today and Upcoming directions now use the exact Jobber visit's structured
  street address, never a client/property nickname. Missing street or city shows
  an explicit Ask HQ warning rather than navigating to a guess.
- Read-only production audit: all eight future Tyler assignments have both
  street1 and city. No geocoding, schedule writes, or customer changes were made.
- HQ displays the invoice status observed at the last Jobber sync. Paid is
  source-qualified; no invoice is not a zero-balance assertion; unavailable
  status remains unknown. No charge or Stripe settlement is inferred.
- Invoice status is stripped from technician responses. Assigned technicians
  retain their job address; existing native assignment authorization is intact.
- Local validation: 1,468 tests / 318 files, lint and production build passed.
  Owner and technician browser rehearsals passed at 390px and 1440px, including
  actual-address direction links, compact grid, jump to jobs, owner-only invoice
  visibility, save retry, private upload, clock-out, and unchanged Jobber status.
  Mobile completed-job screenshot inspected; no horizontal overflow or page errors.
  Access entry also inspected with agent-browser. Work APIs/storage are fixtures,
  not a real Tyler device or customer job run.
- PR #169 merged as `9fdff48`; CI `33925003327` passed in 2m36s.
  Production `dpl_EykkmGo94Q9a1TLpK7WpgLgefHkv` /
  `squeegee-922s2tjb0-squeegee-os.vercel.app` reached Ready after about 100s.
- Canonical production owner preview loaded 17 upcoming direction links, all
  using the fixed Google Maps directions endpoint with comma-separated actual
  addresses. No alerts or horizontal overflow. This was owner preview, not Tyler's
  private session; assignment privacy was separately regression-tested.
- Canonical HQ Today has the compact responsive summary, no alerts/overflow and
  a valid empty-day state. No live jobs today: invoice/job-card behavior was tested
  in desktop/mobile fixtures, not by changing a production job.
- Deployment-specific 15-minute error scan returned no rows. Monitoring/drain
  configuration was not changed or re-audited. Returned owner's tab to HQ Today.
- Remaining bottlenecks: an owner resolution workflow for native exception flags,
  and a real technician-device/photo/full job run. Keep the launch goal active.

## Native technician issue resolution

- Added an owner-only unresolved issue queue in HQ Today. It includes prior visits,
  follow-up checkboxes and nonempty service exceptions; shows oldest 50 with a
  truthful overflow notice. A failed read is not presented as an empty queue.
- Owner opens the original notes/photos, enters a short resolution, and saves.
  An immutable separate record stores the note, server-owned HQ actor label and
  database timestamp. Original technician notes/flags/photos, clocks, customer
  publication and Jobber completion remain unchanged. No messages or charges.
- Exact assignment plus viewed field-record ID prevent stale/cross-job resolution.
  Assignment row lock serializes saves. Same-note retry returns the existing row;
  conflicting replacement returns 409, never overwrites history. Unknown state fails
  closed. Service exceptions count as open even without the follow-up checkbox.
- Mutation is owner-authorized with exact Origin validation; no technician/public
  access to issue notes or queue. New table has RLS, no public grants/policies,
  and service-role-only invoker RPCs. No security-definer escalation was added.
- Migration `20260904222625_native_field_issue_resolution.sql` applied. Transaction
  rehearsal passed before and after application: assignment, clock/closeout replay,
  owner queue, resolution/retry/conflict/cross-target denial, immutability, permission
  denial, and unchanged original flag/Jobber completion. Fixtures rolled back;
  verified 0 closeouts, 0 resolutions, 0 rehearsal technicians afterward.
- Security advisor's only new-object notice is INFO RLS enabled without policy,
  intentional for server-only tables with public grants revoked. Existing project
  warning: leaked-password protection disabled. Auth settings were not changed.
- 1,487 tests / 320 files, lint, standalone TypeScript and production build passed.
  Corrected a pre-existing test fixture's null stage to the supported not_started.
- Owner and tech-role browser rehearsals passed 390/1440, including error retries
  retaining notes, resolving an older visit on an empty Today schedule, no duplicate
  resolution, queue read failure, private evidence, original work summary, unchanged
  Jobber completion, upcoming navigation, referrals, keyboard and no overflow/errors.
  Inspected mobile saved-resolution screenshot; agent-browser checked entry screen.
- PR #170 merged `27e3dd0`; CI `33926367909` passed tests/lint/build in 2m12s.
  Production `dpl_AnmjN82upJqB6NtkPxW1krXWL9Bg` /
  `squeegee-6c23km592-squeegee-os.vercel.app` is Ready; build/deploy about 132s.
- Canonical owner HQ Today displays 0 open issues, the truthful empty queue and
  a working Refresh issues button; no alerts/overflow. Unauthenticated production
  issue GET and resolution PATCH both returned 401 without any record writes.
- Canonical technician owner-preview Upcoming still loads 17 direction links;
  no issue queue exposed there, no alerts/overflow. Returned owner's tab to Today.
  Deployment-specific 15-minute error scan returned no rows; drain/monitor setup
  was not re-audited. Customer resolution writes were not exercised in live UI.
- Live read-only assignment audit: Tyler has eight future nonremoved incomplete
  visits, Sep 7 08:00 Pacific through Sep 28 10:00 Pacific. No assignment changed.
- Real Tyler phone/photo/job run remains unverified; do not claim full launch
  completion from synthetic work. Next audit should cover remaining referral-to-sale
  attribution and owner history access, then prepare the real-device first-job check.

## 2026-09-04: Exact technician referral credit in HQ

- Read-only production audit found zero technician referrals; no test lead, owner
  alert email, customer message, commission, charge or provider mutation was created.
- HQ sales/request lists now show the authenticated referring technician directly.
  Customer workspaces show a shared, owner-only referral-credit card with a direct
  original-inquiry link. No circular link appears when already on that inquiry.
- Fixed a lineage/visibility gap: original technician inquiries no longer redirect
  via fuzzy email/address matching to a potentially different customer record.
  A sold property's credit follows membership -> exact presentation -> exact intake,
  not a newer draft or most recent email-matched lead. Existing nonreferral customer
  matching and all provider/commission business rules remain unchanged.
- Durable read failures show credit unavailable, never an invented replacement.
  No local presentation fallback is used for credit. No earnings/payout amount is
  inferred from a signature, active plan or saved card; collected-payment and agreed
  compensation review remain owner work. This is attribution, not a payroll ledger.
- Added 14 regression tests: exact lineage, missing metadata/read failures, no cloud
  fallback, exact original-workspace navigation, and signed-plan handoff. Full suite
  passed 1,501 tests / 322 files; lint passed (84 existing warnings, zero errors);
  production build and TypeScript passed.
- Local production-build browser fixture passed 390/1440: visible credit, keyboard
  original link, no self-link, unavailable/absent states, no horizontal overflow,
  no client errors or business writes. Mobile screenshot inspected. Re-ran owner
  closeout/issue/navigation and technician activation/clock/photo/retry/finish
  fixtures at both widths; all passed with Jobber completion unchanged. The local
  agent-browser check verified technician access entry; isolated browser closed.
- PR #171 merged `d41f222`; CI `33927834912` passed in 2m24s. Production
  `dpl_F7xeuPUbLAQg4WQyCrjLaf42J4nW` / `squeegee-9djjiazz5-squeegee-os.vercel.app`
  is Ready and aliased to the canonical site; build/deploy approximately two minutes.
- Canonical Requests, an existing inquiry workspace, and an existing member's
  property workspace loaded without failed-load states, false referral credit,
  or horizontal overflow. The property visit exercised the new durable lineage read.
  Unauthenticated customer-workspace GET returned 401. No live edits were made.
- Canonical technician owner-preview still opens Upcoming with 17 direction links,
  zero alerts/overflow, and no HQ referral card. This is owner-preview, not proof of
  Tyler's private scope; role isolation remains covered by the existing fixtures.
  Returned the owner's browser to HQ Today. Deployment-specific 15-minute error
  scans returned no rows; drains and monitoring configuration were not re-audited.
- A real technician referral sale, collected commission, and Tyler's real phone/
  photo/job run remain unverified. Attribution is now reviewable, not auto-payable.
- Next bottleneck verified in code: Dispatch deliberately filters incomplete future
  visits and disallows earlier months; it does not expose the shared private closeout
  review. Add a coherent owner history entry without changing dispatch scheduling
  semantics, then prepare the concise real-device first-job handoff.

## 2026-09-04: Owner technician history, fewer review dead ends

- Added Today -> Job history, a clock-led, owner-only monthly read surface.
  Dispatch remains future/open jobs; no provider scheduling semantics changed.
  Past/removed visits retain their recorded time and private closeout evidence.
- Reuses the existing private notes/photos/owner-resolution component. Jobber
  completion and last-synced invoice status are separate from clock-out; no
  payment, customer publishing, payroll or Jobber completion is triggered.
- Stable 25-row keyset pages preserve timestamp microseconds and UUID ordering.
  Pacific month boundaries handle DST. Failed reads stay unavailable, never
  falsely complete; failed refreshes preserve visible last-loaded records.
- Added 22 regression tests. Full suite: 1,523 tests / 324 files passed, lint
  zero errors, production build/TypeScript passed. Local production UI rehearsal
  passed at 390/1440: month switch, pagination, failed refresh/retry, keyboard
  evidence review, owner issue resolution without reload, no overflow/page errors.
  Re-ran existing owner closeout/issue/upcoming/invite fixtures at both widths.
- Live transaction-only SQL rehearsal passed through assignment, clock-in,
  closeout, clock-out, issue resolution, and clock-led history after removal of
  the synthetic visit. ROLLBACK left zero fixture technicians and zero job clocks.
  No real customer/provider state was changed. No schema migration required.
- PR #172 merged `b10004bc2402ccd51e380ad53881654b3706336d`; CI
  `33929523724` passed in 2m23s. Production `dpl_HhgrZ11jn3ZR7cKzXDJtidViq39b`
  / `squeegee-jfd84d1zc-squeegee-os.vercel.app` is Ready and canonically aliased
  after approximately two minutes. Feature commit `5ab2648`.
- Canonical Today -> Job history click passed in the authenticated owner browser;
  current September and previous August resolved to honest empty states, no load
  failure/alert or horizontal overflow. Back to Today works; owner left there.
  Live database has zero native clocks and zero persisted rehearsal fixtures.
- Direct browser navigation to the authenticated history API with a synthetic
  cursor was blocked by the browser client; stopped that path without bypassing
  the restriction. The normal supported HQ history UI succeeds. Populated live
  pagination therefore remains unverified; unit, local browser, and SQL checks
  cover it. The optional local unmocked API probe returned 503 because this local
  worktree lacks Supabase env variables; production UI confirms its live read.
- Re-ran technician workday fixtures at 390/1440: activation, private photo,
  closeout retry, single commit and clock-out passed; Jobber completion unchanged.
  Production deployment-specific 15-minute error scan returned no rows. Drains
  and monitoring configuration were not re-audited in this release.
- Real Tyler device/photo/job run remains unverified; this work does not claim
  that external acceptance test. Do not start a real clock or send another invite
  for a rehearsal. Current native clock history is empty until actual field use.

## 2026-09-04: Legacy write-target scope follow-up

- Previous goal turn was concrete progress: owner history shipped and verified.
  This acceptance audit found another actionable gap, not an external blockage.
- Legacy appointment write authorization still trusted mirrored Jobber staffing
  after HomeAtlas had assigned that visit natively. Added one joined staffing read
  to the common write guard; any native assignment now requires its native job card.
  Missing relation/read errors fail closed. Legacy Jobber-only work and explicit
  owner authority are preserved. No schema, customer or provider writes changed.
- Reproduced seven failing checks before repair. Added eleven regressions including
  real clock/event/upload/closeout route handlers with mocked persistence, all
  rejecting stale targets before side effects. Full 1,534 tests / 325 files passed;
  lint zero errors and production build/TypeScript passed. Re-ran the four existing
  desktop/mobile browser fixtures; all passed. Local unauthenticated tech entry
  correctly redirects to access; browser closed.
- Live read-only audit: Tyler active, eight future assigned jobs, zero native clocks
  and closeouts. Grant/assignment/clock/closeout tables have RLS and no public reads.
  Security advisor has only the existing leaked-password-protection warning above
  informational private-table policy entries. No access was resent or changed.
- See TECHNICIAN_LAUNCH_ACCEPTANCE.md for requirement-by-requirement evidence and
  the remaining real-device and cross-legacy/native concurrency checks. Do not
  treat this application preflight as proof of database commit serialization.
- CI, deployment and canonical follow-up pending.
