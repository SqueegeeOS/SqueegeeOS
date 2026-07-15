# HomeAtlas Current State

**Status:** Operational index
**Last verified:** July 14, 2026
**Authority:** This document records what the repository can prove today. Product law remains in the Engineering Bible; membership truth remains in `operations/MEMBERSHIP_SOURCE_OF_TRUTH.md`; execution remains in `wargames/014-stabilization-master-plan.md`.

## One operating objective

Prove one dependable lifecycle for real SqueegeeKing customers:

`lead → presentation → signed agreement → payment method → active membership → scheduled visit → documented visit → member portal history → truthful Headquarters reporting`

New surfaces, themes, and speculative platform work stay behind reliability work until this loop passes twice without duplicate records, manual SQL, or contradictory status.

## Verified repository baseline

| Gate | Result | Evidence |
|---|---:|---|
| Unit tests | **Pass locally** | 85 files and 443 tests passed; the credential-gated disposable PR1b integration file/test was skipped |
| Production build | **Pass** | Next.js 16.2.10; 74 static pages generated plus dynamic routes |
| TypeScript | **Pass** | Production build typecheck completed |
| ESLint blocking errors | **Pass** | Zero blocking errors |
| React 19 effect migration | **Open** | Existing `set-state-in-effect` findings are warnings and must be reduced by domain |
| Production database state | **Unverified locally** | Repository contains migrations 002–036; applied-production ledger is not yet proven |
| Production secrets | **Not inferred** | Local build warns when the Supabase service-role credential is absent |

The React effect rule is temporarily warning-level so the inherited migration backlog cannot hide unrelated blocking failures. New occurrences are not acceptable; existing occurrences should be removed as each domain is touched.

## Canonical sources of truth

| Concern | Canonical implementation or record |
|---|---|
| Product and engineering law | `docs/ENGINEERING_BIBLE.md` |
| Product module map | `docs/ARCHITECTURE.md` |
| Stabilization order | `wargames/014-stabilization-master-plan.md` |
| Membership lifecycle | `lib/membership/membership-lifecycle-resolver.ts` |
| Membership ownership map | `docs/operations/MEMBERSHIP_SOURCE_OF_TRUTH.md` |
| Customer and property identity | Supabase `homeowners` and `properties` |
| Signed promise | `signed_agreements` plus immutable stored PDF |
| Membership tier and visit price | `memberships.sales_tier` and `memberships.visit_price` |
| Payment truth | Stripe; membership Stripe fields are the local mirror |
| Visit schedule | `member_appointments` |
| Portal access | `memberships.portal_access_token` |
| Application persistence boundary | `lib/persistence/` repositories and queries |
| Public application origin | `NEXT_PUBLIC_APP_URL`, then `VERCEL_URL` |

No UI component should create a second lifecycle, pricing, revenue, or persistence definition.

## Surface classification

| Surface | Canonical purpose | Current disposition |
|---|---|---|
| `/hq/*` | Founder operations and diagnostics | **Keep; Supabase Auth outer boundary implemented, production rollout unverified** |
| `/portal/[token]/*` | Production member experience | **Keep; customer canonical** |
| `/homecare/[homeownerSlug]/[propertySlug]/portal` | Internal/demo portal | **Keep clearly non-production; never email** |
| `/presentations/*` | Sales presentation and enrollment | **Keep; money-path critical** |
| `/tech/*` | Field assessment, health, and visit workflow | **Keep; close the visit loop next** |
| `/employee/*` | Employee navigation and plan creation | **Transitional; requests/settings contain placeholders** |
| `/properties/*` | Property hub and demo/property views | **Mixed; separate real records from demo data** |
| `/experience/*`, `/day`, `/night` | Design and ceremony laboratories | **Freeze; not operational scope** |
| `/setup/google-reviews` | Founder integration setup | **Keep; isolate from customer flow** |

## Confirmed duplication and transition debt

1. Root-level and `docs/design/` copies exist for `HOMEATLAS_UI_RENAISSANCE_BRIEF.md` and `PASS_3A_IMPLEMENTATION_PLAN.md`. They are byte-for-byte identical as of this audit. The `docs/design/` copies are the intended canonical location; root copies can be removed after founder approval because they are currently uncommitted work.
2. Customer portal routing intentionally has token and slug forms. Token routing is production; slug routing is demo/internal. This is not accidental duplication, but the boundary must stay explicit.
3. `/hq/pricing` and `/hq/settings/pricing` coexist with `/hq/care-plan-builder`; navigation marks the older pricing path deprecated. Redirect or archive only after confirming bookmarked founder workflows.
4. Session/local storage remains in presentation drafts, founder preferences, motion/PWA state, and transitional repositories. Business records must continue moving behind repository or server boundaries; UI preferences may remain local.
5. Several large modules remain refactor candidates, led by the Google Reviews setup wizard, place resolver, care-plan wizard, production health, membership command center, and customer workspace loader. Split them only along tested domain boundaries.

## Security and production boundaries

- `/hq/*` has a server-side Supabase Auth plus active `hq_admin_users` boundary in repository code. Scoped Proxy refresh/no-cache handling also covers every Care Operations route. Care Operations and Jobber OAuth require that session and no longer accept the shared PIN. An emergency environment switch fails all PR1a paths closed; other legacy Headquarters APIs retain the inner PIN flow until `operations/RETIRE_LEGACY_HQ_PIN.md` is implemented.
- Service-role Supabase access is server-only and must never enter client bundles.
- Portal tokens are credentials. Do not log, expose in screenshots, or substitute enumerable membership IDs.
- Agreement PDFs belong in the private signed-agreements bucket and are served with short-lived signed URLs.
- Production migration state is unknown until a read-only ledger proves which migrations are applied.
- Referral RLS and portal referral authorization remain release-blocking items until verified against production.
- Migration 036 closes direct `anon` and `authenticated` mutations on customer authority tables and makes public presentation UUID capabilities non-enumerable. It has not been applied or rehearsed against a disposable Supabase project yet.
- **RED release gate — PR1c Stripe activation identity authorization:** PR1c is implemented on its isolated branch with capability-bound, server-authoritative setup and atomic activation migration 037. It is not disposable-database rehearsed, Stripe-test proven, migrated, merged, deployed, or production-proven. Those gates must pass before migrations 036/037, deployment, or any production presentation-to-payment activation.

## Execution queue

### Newly implemented — verify before production use

- Headquarters authenticated access (PR1a) adds migration 035, cookie-aware Supabase sessions, a durable database-backed and allowlist-gated magic-link flow, truthful accepted/rejected/unknown provider evidence, immutable authorization-change evidence, atomic Jobber connection and refresh transition events, `/hq` server-layout authorization, and authenticated Care Operations/Jobber routes. It has no automatic users or approvals and has not been migrated, deployed, or production-proven. Edge abuse control, disposable-database SQL rehearsals, and rollback rehearsal remain explicit release prerequisites. See `operations/HQ_AUTH_PR1A_RUNBOOK.md`.
- Headquarters authority-input closure (PR1b) adds migration 036, removes browser writes to homeowners, properties, Home Care Plans, memberships, signed agreements, and property assets, protects presentation authoring with the PR1a HQ actor, and binds public signing to the existing non-enumerable presentation UUID. The signing route reloads customer identity, source links, tier pricing, quote snapshot, and plan terms server-side; the client can provide only the capability, allowed tier, and PNG signature evidence. The real anon-key/disposable-database rehearsal remains an external release gate. See `operations/HQ_AUTHORITY_INPUT_PR1B_RUNBOOK.md`.
- Stripe setup authorization closure (PR1c) adds migration 037, removes mock activation, rejects bare membership/browser identity authority, exclusively binds one membership-bound Stripe customer and SetupIntent to the signed pending membership, verifies Stripe customer/payment-method/metadata truth, and atomically appends immutable activation evidence while locking every Supabase link plus the signed Atlas tier/price/visit/hash authority. Activation performs no post-SetupIntent Stripe mutation and does not charge. Disposable Supabase and Stripe test-mode rehearsals remain external release gates. See `operations/STRIPE_AUTHORIZATION_PR1C_RUNBOOK.md`.
- Headquarters Billing now contains a reviewed **Complete & Charge Visit** flow connecting scheduled appointments, itemized Stripe invoices, payment outcomes, add-on records, and the savings ledger.
- Stable operation and Stripe idempotency keys prevent duplicate invoices and payments during retries.
- This code has unit/build verification but still requires a Stripe test-mode lifecycle pass before production activation. See `operations/COMPLETE_CHARGE_VISIT.md`.

### Now — reliability gate

1. Independently review and rehearse PR1c migration 037 plus the Stripe test-mode failure matrix. This remains a RED gate before any PR1b/PR1c migration or deployment.
2. Run the read-only migration ledger and compare migrations 002–036 with production; do not apply 036 until its duplicate-agreement preflight and disposable rehearsal pass.
3. Verify referral-table RLS and change portal referral reads from membership ID to portal-token authorization if still required.
4. Audit Supabase client boundaries: public anon reads only where RLS is proven; service role for protected server work.
5. Run the Sylvia golden-case audit read-only and record discrepancies without automatic repairs.
5. Run a fresh test customer through the complete lifecycle twice and prove idempotency.

### Next — one operational truth

1. Reconcile Headquarters, portal, agreement, appointments, and Stripe for status and money.
2. Add Stripe reconciliation and event idempotency. The audit confirms there is no Stripe webhook or automated recurring billing engine; V1 billing remains a documented manual operation.
3. Finish visit documentation feeding a permanent customer-visible timeline record.
4. Add monitoring for build failure, protected-read failure, webhook backlog, and Stripe/database divergence.
5. Migrate React effect warnings and oversized modules domain by domain, with tests around every extracted boundary.

### Later — controlled expansion

Only after the complete lifecycle is repeatable: richer portal history, property photo archive, Atlas automation, broader marketing, second-tenant architecture, and new experiential work.

## Rules for streamlining

- Preserve user-owned uncommitted work.
- Prefer one canonical file plus links over copied plans.
- Delete only after replacement behavior is verified and rollback is understood.
- Refactor around business boundaries, not arbitrary file-size targets.
- A passing build is necessary, not proof of production database correctness.
- When documentation and runtime disagree, runtime evidence wins and documentation is updated.
