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
- Native exception resolution workflow beyond viewing the flag/notes.
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
