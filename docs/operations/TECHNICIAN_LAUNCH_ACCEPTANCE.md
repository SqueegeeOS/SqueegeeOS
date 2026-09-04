# First-technician launch acceptance — September 4, 2026

Status: **not complete**. This is an evidence map, not a claim that green builds
prove real field use. Use current production/database results over this snapshot.

| Requirement | Evidence inspected | Remaining verification |
| --- | --- | --- |
| Owner assigns exact future Jobber visits | Live native roster/access active; eight future Tyler assignments. Exact projection/technician RPC, optimistic expected-assignee check, future/open guard, immutable assignment events. Earlier transaction-only assignment/retry rehearsal passed. | Do not alter real assignments for a test. |
| Secure private technician entry | Actual original grant claimed; live active status rechecked. Server checks hashed session, role, revocation and expiry per request. Local real claim/cookie/role fixture passes. | Tyler's real device after activation; no replacement invitation. |
| Assigned jobs and necessary details only | Server scopes Today/Upcoming by native identity before serialization, suppresses portal bearer links, invoice status and owner assessments. No global tech property list. Eight assigned future jobs observed in DB. | Owner preview is not a real Tyler session. |
| Navigation and upcoming weeks | Structured visit address; server-scoped 45-day upcoming range, Pacific day boundary. Mobile/desktop directions/upcoming/error fixtures pass. | Open navigation on Tyler's real phone; do not change a schedule. |
| Clock, work, photos, closeout, clock-out | Native SQL rehearsal and 390/1440 browser workday fixture: denied wrong technician, one clock, finish-before-proof guard, private photo, stable retry ID, one closeout, clock-out. | Actual camera file upload and HQ opening the stored photo on the first legitimate job. Live native clocks/closeouts remain zero. |
| Owner reviews times, evidence, exceptions, payment observation | Today private review, prior-visit issue queue, immutable owner resolution, monthly Job history, separate provider invoice observation. Desktop/mobile fixtures and live empty history/month switching passed. | Review a real closeout; populated live history pagination not yet exercised. |
| Private attributed referrals | Server-stamped technician identity and consent attestation; original intake -> exact presentation -> membership linkage. HQ displays credit without suggesting earned or paid commission. | No real technician referral/sale/payment exists yet; no fabricated conversion or payout. |
| No duplicate or false completion | Native unique constraints, assignment locks, closeout replay and immutable resolution rehearsals. Clock-out leaves Jobber completion unchanged. Native card suppresses redundant legacy capture. | Concurrency across legacy work beginning while HQ first adopts a native assignment still needs a DB-level rehearsal; an application preflight alone does not prove serialization. |
| Current assignment controls every write | Audit found legacy appointment writes ignored native staffing. New shared joined read rejects those stale targets before clock/event/upload/closeout. Eleven regression tests, including all four real route handlers, pass; seven failed before the fix. | Production deployment verification pending for this follow-up. |
| Customer privacy | Live RLS enabled and anon/authenticated SELECT denied on grants, assignments, native clocks and closeouts. Owner-only evidence API, exact object paths, expiring private image URLs. | No attempt to reuse, extract or impersonate Tyler's live credential. |
| Mobile/practical luxury | Shared theme; activation, upcoming, clock/photo/retry/finish, owner review/history/referral fixtures at 390/1440; keyboard and overflow checks passed. | Real phone camera and in-app-browser behavior remain separate from desktop emulation. |
| Jobber authoritative; billing safe | No schedule/completion/provider mutation in these releases; invoice is a read-only last-sync observation. | No automatic charging, customer notifications or service completion is authorized by this audit. |

Current follow-up validation: 1,534 tests / 325 files, lint zero errors, TypeScript
and production build passed. All four local browser fixture scripts passed again.
Supabase advisor: 112 informational no-public-policy entries for private tables;
one existing leaked-password-protection warning. This does not change technician
opaque-token authentication; the unrelated Supabase Auth setting was not changed.

## Next safe acceptance work

1. Finish this write-scope release and inspect its canonical production surfaces.
2. Rehearse legacy/native adoption concurrency without persistent fixtures. Review
   shared projection locks and legacy clocks/closeouts before claiming the complete
   duplicate-prevention invariant across both systems.
3. At Tyler's first legitimate assigned job: open the existing authenticated portal,
   confirm only his jobs, navigate, clock in on arrival, save actual work/photo,
   pack up and clock out. Owner reviews time/photo/exception in HQ. Do not manufacture
   a real job, clock-in, charge or message to close this checklist.
