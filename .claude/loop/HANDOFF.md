# HANDOFF — Lux Referral Rewards (APPROVED, execute in fresh context)
Founder-approved execution script + 5 mandatory conditions. Work from a clean
worktree based on the secure HQ-auth branch. Never touch dirty local main.
Read .claude/loop/SYSTEM.md + AGENTS.md first. Stop with both PRs open.

## Mission
Truthful reward lifecycle: earned → claimed(available) → reserved → redeemed.
Member taps "Claim my reward", sees a ~2s HomeAtlas Lux ceremony, gains Care
Credit for their next eligible charge. Extend the EXISTING referral system
(member_referral_rewards). No second subsystem, no Atlas pricing changes, no
production money movement, no prod data mutation.

## MANDATORY CONDITIONS (override everything below on conflict)
1. Referral codes issue server-side at membership activation; backfill
   eligible active memberships missing codes. Portal-summary reads NEVER
   create codes or rewards.
2. Inspect the existing reward-status constraint BEFORE changing defaults.
   Ensure earned/available/redeemed/expired permitted. Reservation lives in
   immutable ledger events, NOT reward status. If replacing the constraint,
   replace it before setting the new default (same migration, that order).
3. Ceremony only on outcome==="claimed"; auto-settle ~2s incl. tab
   backgrounding/navigation; reduced-motion + screen readers get the full
   confirmation via accessible dialog text.
4. Two PRs. PR1: issuance, claim ledger, API, portal ceremony, HQ
   visibility. PR2: billing allocator. creditApplicationReady=false until
   PR2 AND the legacy-charge-path audit pass independently.
5. Stop with both PRs open and Reliability-Guardian reviewed. Do NOT migrate
   prod, merge, deploy, alter Juanita's data, claim her reward, or move money.

## PR1 spec
Migration NNN_referral_reward_claims.sql (next free number, additive):
- Issuance status becomes 'earned' (existing 'available'/'redeemed' rows
  preserved). Add claimed_at.
- New immutable member_referral_reward_events: reward_id, membership_id,
  event_type (claimed|reserved|released|redeemed|restored), amount_cents,
  billing_order_id?, actor_type, UNIQUE idempotency_key, created_at,
  metadata. RLS enabled, zero anon/authenticated policies (service-role
  only). Trigger rejects UPDATE/DELETE.
- Issue 'earned' reward immediately on verified referral conversion; if
  issuance fails, preserve conversion + HQ reconciliation warning.
- Transactional claim fn: lock reward row; confirm ownership via membership
  resolved from portal token (never store/expose token); allow only
  earned→available; set claimed_at + one 'claimed' event; idempotent retry
  returns existing result.

POST /api/referrals/portal/claim
  req { portalToken, rewardId, idempotencyKey }
  res { outcome: claimed|already_claimed, reward{id,label,status,valueCents},
        availableCareCreditCents, creditApplicationReady:false }
  401 invalid token · 404 unrelated reward · 409 unclaimable. Membership
  resolved ONLY from token. Never log tokens or leak DB errors. Concurrent
  clicks → one event, one balance.

Portal referral section:
  Pre-claim: "A thank-you is waiting." / "$25 Care Credit unlocked." /
  "Another home you referred has joined the Care Network." Button:
  "Claim my reward".
  Ceremony (Framer Motion + existing AtlasMark): full-screen calm overlay,
  near-black field, warm ivory Atlas rings, restrained gold constellation
  sparks, ~2s, no sound/casino/coins. prefers-reduced-motion → static ring
  bloom. Accessible dialog semantics, focus mgmt, keyboard dismiss. Plays
  only on outcome "claimed"; never replays on refresh/idempotent retry.
  Message: "Congratulations, {first}." / "Your $25 HomeAtlas Care Credit is
  ready." / "Thank you for welcoming another home into the Care Network."
  While billing app disabled: "It is ready for your next eligible HomeAtlas
  care service." (Post-PR2 copy swap: "It will be applied toward your next
  eligible HomeAtlas charge.")
  Settled state: "$25 Care Credit / Claimed · Ready for your next eligible
  service". "Members joined" = verified converted count, claim-independent.

## PR2 spec (separate release gate)
Care Credits apply only against: authoritative appointment + immutable Atlas
pricing snapshot + valid billing order for same membership+property. Pricing
amount unchanged; credit recorded in credit_applied_cents; collected =
authorized − credit; oldest claimed credits first; cap at charge amount,
preserve remainder; never on cancellation repayment/penalties/fees; never
cross-membership. Reserve on billing-order lock; redeem only on verified
Stripe success; release on failure/void; restore idempotently on verified
refund. Central allocator or fail closed when credit exists. Percent-based
rewards stay manual. Policy: eligible for membership visits + approved
add-ons on authoritative billing orders; no expiration; no "cash value" or
expiration language without legal review (CA Civil Code §1749.5).

## Juanita acceptance run — FOUNDER-GATED, post-deploy only
Read-only verify Juanita+Shelby → HQ (authenticated, no SQL) associates
Shelby as Juanita's converted referral → portal shows Members joined: 1 +
$25 unlocked + Claim button → Juanita personally claims → verify one reward
row 'available', one immutable claimed event, 2500c balance, no replay. No
charging/refunds/pricing changes/credit consumption in this run.

## Verification (all required)
Portal reads create zero rows · unknown token + cross-membership reward fail
· duplicate/concurrent claims → one event · existing available rows survive
migration · earned ≠ spendable · reduced-motion equivalent confirmation ·
keyboard + SR accessible · pricing snapshots immutable under credit ·
reservations can't overdraw · Stripe success redeems once · failure/void
releases once · refund restore idempotent · no auto-apply promise while
flag false.
Run: npx tsc --noEmit · npm test · npm run lint · npm run build ·
npm run audit:migrations · npm run verify:supabase-security.
Then independent Reliability Guardian read-only review (RLS, idempotency,
concurrency, credit recovery, money boundaries). STOP: PRs open, report.
