# WARGAME 001 — Production Hardening

**Status:** PLAN + partial execution. See [CORPUS_ALIGNMENT_REPORT.md](../docs/CORPUS_ALIGNMENT_REPORT.md) for what shipped since this plan (portal tokens, agreement PDF, SetupIntent payment, PWA). Do not treat "PLAN ONLY / No code changed" as current.
**Executor:** Jerry (or any model/engineer). Follow phases in order. Do not skip phase gates.
**Mission:** Make HomeAtlas safe to run real customers through presentation → sign → email PDF → card on file → active membership.
**Scope:** (1) RLS/security, (2) signed-agreement storage integrity, (3) admin auth, (4) portal privacy, (5) Stripe/payment correctness, (6) pricing truth. Nothing else. No redesigns, no refactors beyond what each move names.

---

## Rules of Engagement

1. **Every phase runs on a staging Supabase project + Vercel preview first.** Never test a policy flip against the production database.
2. **One phase per PR.** If a phase fails verification, revert that PR only.
3. **The dependency trap (memorize this):** the permissive RLS policies are load-bearing. Every server route uses the **anon** key (`lib/persistence/supabase/client.ts:42` — there is no service-role key anywhere in the codebase). If you flip RLS to default-deny before Phase 3 is complete, **every write in the app dies simultaneously**, including customer signing. Phase order is not a suggestion.
4. Global abort condition: if at any point the staging signing flow (present → sign → PDF → activate) fails and the cause is not understood within one working session, **revert the phase and stop**. Do not stack fixes on an ununderstood failure.

---

## Phase 0 — RECON (do before anything)

No changes in this phase. Produce a written answer for each item and paste into the PR description of Phase 1.

| # | RECON item | How to find out |
|---|-----------|-----------------|
| R1 | **Which code paths hit Supabase from the browser?** | Grep `createBrowserSupabaseClient` and `supabaseAdapter` usage. Known: `lib/persistence/adapters/supabase.ts` (home care plans, memberships, agreements, assets — used by both server pages and client saves via `lib/persistence/repository.ts`). List every caller and whether it runs client-side or server-side. |
| R2 | **Schema drift.** Which of `schema.sql` + migrations 002–014 have actually been run in production? There is no migrations table. | In Supabase SQL editor: `select table_name from information_schema.tables where table_schema='public';` and compare against the 14 migration files in `lib/persistence/supabase/migrations/`. Also check `select * from pg_policies where schemaname='public';` — record every existing policy name. |
| R3 | **Existing PDFs in the public bucket.** | Supabase Storage → `signed-agreements` bucket. Count objects. If any real-customer PDFs exist, they are currently world-readable at guessable URLs — note filenames for the Phase 2 migration. |
| R4 | **Activation-link token mechanism.** Commit `0bd345d` added "membership activation links after agreement signing." | Read that commit's diff. Determine: is the link tokenized (unguessable) or slug/id-based? This decides how much of Phase 5 already exists. |
| R5 | **Does `pricing_settings` differ from code defaults?** | `select settings from pricing_settings where id='default';` — diff against `DEFAULT_COMPANY_SETTINGS` in `lib/pricing/company-settings.ts`. If identical or row missing, Phase 6 risk is dormant. If different, Phase 6 is **urgent** (agreements are computing retail comparisons from stale defaults). |
| R6 | **Vercel env inventory.** | List: `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, `NEXT_PUBLIC_SUPABASE_ENABLED`, `NEXT_PUBLIC_PERSISTENCE_BACKEND`, `NEXT_PUBLIC_ADMIN_PIN`, `STRIPE_SECRET_KEY` (test or live prefix?), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `RESEND_API_KEY`, `RESEND_AGREEMENT_FROM`, `GOOGLE_*`. Record which exist, not their values. |
| R7 | **Is the anon key rotatable without downtime?** | Supabase dashboard → API keys. Rotation invalidates the key baked into currently-deployed bundles; plan rotation for immediately after Phase 4 (once the client no longer needs write power). |
| R8 | **Real data already at risk.** | `select count(*) from homeowners; select count(*) from signed_agreements; select count(*) from closed_jobs;` — if closed_jobs holds real revenue history, treat production DB as containing sensitive founder data *today*. |

---

## Phase 1 — Admin auth: fail closed, secret off the client

**Why first:** independent of everything else, zero customer-flow risk, and it closes the widest-open door (admin APIs are fully open if the PIN env var is unset, and the PIN ships in the JS bundle as `NEXT_PUBLIC_ADMIN_PIN`).

### Moves

| Move | Detail |
|------|--------|
| 1.1 | Add server-only env `ADMIN_PIN` (no `NEXT_PUBLIC_` prefix) in Vercel. |
| 1.2 | Change `authorizeAdminRequest` (`lib/admin/pin.ts:66`) to compare against `process.env.ADMIN_PIN` and **return `false` when unset**. Same for `verifyAdminPin` — but note it runs client-side today (called from the PIN gate component); the client can no longer verify locally. The PIN gate must verify by calling any admin API (e.g. `GET /api/admin/overview`) with the `x-admin-pin` header and treating 401 as "wrong PIN." |
| 1.3 | Keep the UX unchanged: user types PIN → stored in `sessionStorage` (as now, `ADMIN_PIN_SESSION_KEY`) → sent as `x-admin-pin` header. The only thing that dies is the PIN living in the bundle. |
| 1.4 | Sweep every route in `app/api/admin/**` and confirm each one calls `authorizeAdminRequest`. Known gap to check: `google-reviews` debug/status routes. |
| 1.5 | Remove `NEXT_PUBLIC_ADMIN_PIN` from Vercel after deploy is verified. |

### Expected observation
`/hq` prompts for PIN; wrong PIN shows rejection (via API 401); right PIN unlocks; all admin API calls without header return 401.

### Likely failures & counters

| Failure | Signals | Counter-move |
|---------|---------|--------------|
| HQ locks founders out entirely | 401 on all admin APIs even with correct PIN | `ADMIN_PIN` env not set in the deployed environment, or client sends stale sessionStorage PIN — clear session, re-enter. Check `x-admin-pin` header arrives (log header presence, never the value). |
| "Private beta" mode paths break | `isAdminPrivateBeta()` logic assumed unset-PIN = open | This is the *intended* behavior change. Update the beta-mode gate to require the env explicitly (`ADMIN_PRIVATE_BETA=true`) if founders still want a demo mode. Never infer openness from an absent secret. |
| Some admin page calls an API without attaching the header | One HQ panel 401s while others work | Grep `x-admin-pin` in `lib/admin/api-client.ts` — route the missed fetch through the same client. |

### Verification run
1. `curl -s -o /dev/null -w '%{http_code}' https://<preview>/api/admin/overview` → **401**.
2. Same with `-H "x-admin-pin: <correct>"` → **200**.
3. `grep -r "NEXT_PUBLIC_ADMIN_PIN" .next/static` on a fresh build → **no matches** (nothing in `.next/static` should ever match).
4. Full HQ click-through with correct PIN.

### Abort conditions
- Founders cannot unlock HQ on production after 30 minutes of debugging → revert, keep old behavior, but **set** `NEXT_PUBLIC_ADMIN_PIN` so at least the unset-means-open hole is plugged while regrouping.

---

## Phase 2 — Signed-agreement storage integrity

**Why second:** legal documents are currently in a **public** bucket with anon **insert + update** on the whole bucket (`migrations/014`), uploaded with `upsert: true` (`lib/agreement/store-signed-pdf.ts:30`) at guessable names `{homeowner}-{property}-agreement-{timestamp}.pdf`. Anyone can read or **replace** any contract. This must close before a real customer signs.

**Key enabling fact:** the email sender (`lib/agreement/send-agreement-email.ts`) already supports **attachment mode** — it attaches `pdfBytes` whenever the URL isn't email-safe. So the bucket can go private without breaking email: force attachment mode. Customer keeps a copy forever; no link rot.

### Moves

| Move | Detail |
|------|--------|
| 2.1 | New SQL migration: `update storage.buckets set public=false where id='signed-agreements';` drop policies `signed_agreements_public_read`, `signed_agreements_anon_insert`, `signed_agreements_anon_update`. Add: insert allowed only to `service_role` (or keep anon-insert *temporarily* until Phase 3 swaps the server to service-role — RECON R1 determines whether uploads happen server-side only; they do: `storeSignedPdf` runs in API routes). Prefer: allow insert to service_role only, and do Phase 2 *after* confirming upload runs server-side with the key available. If Phase 3 is not done yet, an interim policy `insert with check (bucket_id='signed-agreements')` for anon **without** update/select is still a strict improvement: write-once, no read, no overwrite. |
| 2.2 | In `store-signed-pdf.ts`: change `upsert: true` → `upsert: false` (write-once; a name collision should be an error, not a silent replace), and replace `getPublicUrl` with `createSignedUrl(fileName, 60*60*24*30)` (30-day link) **or** return a non-email-safe marker so email falls back to attachment. Simplest safe route: store the storage *path* in `agreement_pdf_url`-adjacent field, email the PDF as attachment (already supported), and serve founder/HQ downloads through a server route that mints signed URLs on demand. |
| 2.3 | Store an integrity hash: compute sha256 of `pdfBytes` and persist alongside the agreement row (needs one new column — allowed: this is hardening, not redesign). Tamper-evidence for legal docs. |
| 2.4 | Migrate existing objects (RECON R3): download, re-upload to the now-private bucket under new randomized names (`{uuid}.pdf`), update `signed_agreements.agreement_pdf_url` rows, delete old guessable objects. |
| 2.5 | Note for later (not this phase): `signature_image_url` stores raw base64 PNG in table rows. Leave it — changing it touches the signing flow. Record as debt. |

### Expected observation
Signing in staging still produces: PDF row saved, email arrives **with attachment**, HQ can download via signed URL. Direct URL access to the bucket object → 400/403.

### Likely failures & counters

| Failure | Signals | Counter-move |
|---------|---------|--------------|
| Email arrives with dead link instead of attachment | `emailDeliveryMode: "link"` in sign-agreement response while bucket is private | `isEmailSafePdfUrl` still sees an https URL (signed URL) and chooses link mode — acceptable *if* expiry ≥ 30 days; otherwise force `pdfBytes` attachment always. Decide one mode, assert it in verification. |
| Upload fails entirely | 500 from `/api/sign-agreement`; log: "signed-agreements upload failed" | Storage policy rejected the anon/service key in use. Check which key the server holds at this phase (pre-Phase-3 it's still anon — the interim write-once anon policy from 2.1 must exist). |
| Duplicate filename collision (double-submit) errors the whole signing | 500 with storage 409 after switching `upsert:false` | This is the **known double-submit race** (no idempotency in `completeSignOnboarding`). The collision is now your canary, not a bug. Counter: catch the 409 → treat as already-signed → return the existing agreement. Full idempotency is Phase 5-adjacent debt; minimum viable is the catch. |
| Old emails referencing old public URLs break | Customer clicks old link → 403 | Expected after 2.4. Keep a redirect list only if real customers already received links (RECON R3 says whether anyone did). |

### Verification run
1. Sign a test agreement in staging. Assert response: `pdfStorageBackend: "supabase"`, `emailStatus: "sent"`, `emailDeliveryMode: "attachment"` (or signed-link if chosen).
2. `curl -o /dev/null -w '%{http_code}' https://<supabase>/storage/v1/object/public/signed-agreements/<file>` → **400/403**.
3. Attempt overwrite with anon key (`curl -X POST` upload same filename) → rejected.
4. sha256 in DB matches sha256 of the emailed attachment.

### Abort conditions
- Any configuration where signing succeeds but **no** retrievable PDF exists (no attachment sent AND no working signed URL) → revert immediately; a signed agreement without a deliverable document is worse than the public bucket for the next 24h.

---

## Phase 3 — Server-side persistence boundary (service-role key)

**Why now:** prerequisite for Phase 4. Goal: the browser stops needing write access; the server gets a privileged key.

### Moves

| Move | Detail |
|------|--------|
| 3.1 | Add `SUPABASE_SERVICE_ROLE_KEY` (server-only) to Vercel. Change `createServerSupabaseClient()` (`lib/persistence/supabase/client.ts:42`) to use it, with a hard guard: `if (typeof window !== "undefined") throw` — this function must never be importable into client bundles. Verify with `grep -r "createServerSupabaseClient" components/` → must be empty. |
| 3.2 | From RECON R1, classify every `supabaseAdapter` call site: (a) server components / API routes — already fine, now privileged; (b) genuine browser-side writes. Known browser-side writers to check: the create-plan wizard save path (`saveGeneratedHomeCarePlan` from a client component) and anything in `components/` importing `lib/persistence/repository.ts`. |
| 3.3 | For each browser-side write path found: route it through an existing or thin new API route (`/api/presentations` pattern already exists and is server-side — mirror it). **Minimal diffs**: same payloads, same functions, moved behind `app/api/`. |
| 3.4 | Do **not** delete the sessionStorage adapter or fallback logic in this phase (that's a simplification project, not hardening). Only ensure no *Supabase* call originates in the browser. |

### Expected observation
App behaves identically. Network tab on any customer/HQ page shows **zero** requests to `*.supabase.co` from the browser (all go to your own `/api/*`), except Storage signed-URL GETs if link mode was chosen in Phase 2.

### Likely failures & counters

| Failure | Signals | Counter-move |
|---------|---------|--------------|
| Service key leaks into client bundle | Build succeeds but `grep -r "service_role\|SUPABASE_SERVICE_ROLE" .next/static` matches | A client component imports a server module transitively. Find the import chain (`next build` will often flag `server-only` if you add the `server-only` package marker to `client.ts`). Fix the import, rebuild, re-grep. **This failure is a stop-ship.** |
| A missed browser write path starts failing *after Phase 4* | Worked in Phase 3, dies in Phase 4 | That's why Phase 3 verification includes the network-tab sweep on **every** page in the flow: `/`, `/request`, presentation editor+viewer, signing modal, member portal, HQ. |
| Latency regression on portal pages | Pages feel slower | Server routes add a hop for reads. Acceptable for hardening; note it, don't optimize now. |

### Verification run
1. Full staging E2E: create presentation → present → sign → activate.
2. Browser devtools network sweep per page: no direct `supabase.co/rest` calls.
3. `.next/static` grep for the service key name and value fragments → empty.

### Abort conditions
- Any page still requires direct browser Supabase writes and cannot be routed server-side within the phase → **do not proceed to Phase 4.** Phase 4 waits until R1's list is fully green.

---

## Phase 4 — RLS default-deny flip

**The point of the whole campaign.** Only after Phase 3 verification passes.

### Moves

| Move | Detail |
|------|--------|
| 4.1 | New migration: for every table in RECON R2's list (homeowners, properties, home_care_plans, memberships, signed_agreements, property_assets, closed_jobs, headquarters_profile, member_profiles, member_savings_transactions, member_appointments, service_observations, ai_quotes, presentations, pricing_settings, lead_intakes, property_visit_health_checks, property_assessments) — `drop policy "<table>_anon_all"`. Leave RLS **enabled** with no anon policies. Service role bypasses RLS; the server keeps working. |
| 4.2 | If any table intentionally needs public read (none should — reviews are fetched server-side; testimonials are code constants), it must be argued in the PR, not assumed. |
| 4.3 | Run the flip on staging first, run full E2E, then production during a low-traffic window. |
| 4.4 | **Immediately after** production flip verifies: rotate the anon key (RECON R7) — the old key had months of god-mode and may be cached in old bundles/screenshots/HARs. Redeploy with the new anon key (it's still used for… almost nothing now, which is the point). |

### Expected observation
App unchanged for users. Anon REST access returns empty/denied.

### Likely failures & counters

| Failure | Signals | Counter-move |
|---------|---------|--------------|
| A forgotten anon-dependent path dies | Specific feature 401s/"row-level security" errors in logs; `formatCloudPersistenceError` maps it to the RLS message (`lib/persistence/repository.ts:69`) | The error string tells you the table. Route that path server-side (Phase 3 miss). **Do not** re-add an anon policy as a "temporary" fix — that re-opens the exact hole and it will never be temporary. |
| Silent fallback masks the breakage | Nothing errors, but new presentations vanish on redeploy | This is the known trap: `lib/presentations/repository.ts` falls back to `.data/presentations.json` (ephemeral on Vercel) and `saveGeneratedHomeCarePlan` falls back to sessionStorage, both logging only warnings. **During the flip window, watch Vercel logs for `[presentations] Supabase … failed — using local store` and `[persistence] Supabase save failed`.** Any occurrence = a broken path hiding behind the fallback. |
| Supabase Storage policies interact | PDF upload starts failing | Storage policies are separate from table RLS but review them in the same pass (Phase 2 set them). |

### Verification run
1. `curl 'https://<proj>.supabase.co/rest/v1/homeowners?select=*' -H "apikey: <anon>" -H "Authorization: Bearer <anon>"` → **empty array or 401** for *every* table in the list. Script the loop; paste the output into the PR.
2. Full E2E signing flow on production with a test customer record.
3. Vercel log sweep: zero fallback warnings for 24h.
4. `/hq/production-check` still reports `mode: "production"`.

### Abort conditions
- Signing flow breaks in production and the failing table isn't identified within 15 minutes → re-apply the anon policies **for the affected table only** (keep the rest locked), fix forward next day.
- More than 2 tables need re-opening → the R1 recon was wrong; revert the whole flip, redo Phase 3.

---

## Phase 5 — Public portal privacy

**Today:** `/homecare/[homeownerSlug]/[propertySlug]/portal` and `/plan` are fully public, slugs are derived from customer names (guessable), and the portal query surfaces `access_instructions` and service notes. Phase 4 protects the *API*; server-rendered pages still fetch with the service key, so the pages themselves remain public. This phase closes the page.

### Moves

| Move | Detail |
|------|--------|
| 5.1 | RECON R4 decides the shape: if activation links (commit `0bd345d`) already carry an unguessable token, extend the same token to gate the portal/plan pages (`?key=<token>` checked server-side against the membership/plan row before rendering). If not, add a `portal_token uuid default gen_random_uuid()` column to memberships (or home_care_plans) and require it. |
| 5.2 | The plan page (`/homecare/.../plan`) is a *sales* artifact — decide with Noah: token-gated too (recommended; it contains price and address) or public-by-obscurity accepted short-term (document the decision). |
| 5.3 | Not-found behavior must be **identical** for "wrong token" and "no such property" — no enumeration oracle. The existing `MemberPortalNotFound` component serves both. |
| 5.4 | Rotate/regenerate tokens capability: a SQL one-liner documented in HQ runbook, not a UI (no scope creep). |
| 5.5 | Real member auth (Supabase Auth) is explicitly **out of scope** — token links are the bridge. Record as the next campaign. |

### Expected observation
Portal opens only via tokened link (from email/activation flow). Bare slug URL → not-found page.

### Likely failures & counters

| Failure | Signals | Counter-move |
|---------|---------|--------------|
| Existing member bookmarks break | Customer reports portal "gone" | Expected; only affects pre-hardening customers (RECON R8 count). Re-send tokened links. |
| Token leaks via referrer/logs | Token in query string appears in analytics | Acceptable for bridge phase; note that path segments (`/portal/<token>`) beat query strings if trivial to route. Don't over-engineer. |
| Demo/prototype pages (`/homecare/larry-buckley`) get gated and break demos | Larry Buckley pages 404 for the team | Keep the hardcoded demo route ungated — it's fictional seed data. Gate only the dynamic `[homeownerSlug]` routes. |

### Verification run
1. Bare URL `/homecare/<real-slug>/<real-slug>/portal` → not-found.
2. Same URL with token → renders.
3. Wrong token → not-found, byte-identical response to nonexistent slug (diff the HTML).
4. `/homecare/larry-buckley/...` demo still renders.

### Abort conditions
- Any real customer left with no working portal link and no way to re-send → pause rollout of 5.1 until the re-send path (manual email is fine) is written into the runbook.

---

## Phase 6 — Stripe / payment activation correctness

**Today's gaps (all verified in code):**
- `setup-intent` route does check-then-create on the Stripe customer with **no idempotency key** → concurrent calls create duplicate customers (`app/api/stripe/setup-intent/route.ts:80`).
- `setup-payment` accepts SetupIntents with **absent** membership metadata (`intentMembershipId && …` — the check passes when metadata is missing).
- **Mock mode**: when Stripe env vars are unset, `setup-payment` activates any membership by ID with no payment and no auth.
- No `setup_intent.succeeded` webhook → customer confirms card, closes tab before the client calls `setup-payment` → card on file in Stripe, membership stuck `pending_payment`, nobody notices.

### Moves

| Move | Detail |
|------|--------|
| 6.1 | `stripe.customers.create(..., { idempotencyKey: "cust-" + membership.id })` — one line; kills the duplicate-customer race. |
| 6.2 | Make the metadata check strict in `setup-payment`: reject when `setupIntent.metadata.membership_id` is **missing** or mismatched. All legit intents get metadata from our own `setup-intent` route, so absence = foreign intent. |
| 6.3 | Kill mock activation in production: gate mock mode behind explicit `ALLOW_MOCK_PAYMENT=true` (server env), never on "Stripe unconfigured." Production-check (Phase 7 tie-in) should flag if this var is set in prod. |
| 6.4 | Reconciliation instead of webhook (smaller change, same safety): a documented daily query + runbook action for "succeeded SetupIntent, membership still pending" — see SQL below. Webhook (`setup_intent.succeeded` → call the same activation logic) is the better end-state; implement if time allows, otherwise the reconciliation query is the floor. |
| 6.5 | Confirm keys: `STRIPE_SECRET_KEY` starts `sk_live_` in production and `pk_live_` pairs with it (RECON R6). Test keys in prod or live keys in preview = misconfiguration either way. |

**Reconciliation query (runbook):**
```sql
select id, plan_name, stripe_customer_id, created_at
from memberships
where status = 'pending_payment'
  and stripe_customer_id is not null
  and created_at < now() - interval '1 hour';
```
For each row: check the customer in Stripe dashboard → if a succeeded SetupIntent with a payment method exists, manually `POST /api/membership/setup-payment` with `membershipId`, `paymentMethodId`, `setupIntentId` (all visible in dashboard).

### Expected observation
Double-clicking through the payment step never yields two Stripe customers; foreign SetupIntent IDs are rejected; unsetting Stripe env in staging causes activation to **fail loudly**, not silently succeed.

### Likely failures & counters

| Failure | Signals | Counter-move |
|---------|---------|--------------|
| Idempotency key conflict on retry with different params | Stripe 400 `idempotency_error` | Key must cover identical requests only — scope it to creation (`cust-<membershipId>`), never reuse for updates. |
| Strict metadata check rejects a legacy in-flight intent | A customer mid-flow during deploy gets "does not match" | Window is minutes; retry creates a fresh intent. Accept. |
| Mock-mode removal breaks the demo environment | Demos can't activate | Set `ALLOW_MOCK_PAYMENT=true` in the preview environment only. |

### Verification run
1. Staging: run the card step twice concurrently (two tabs) → exactly **one** customer in Stripe test dashboard.
2. Craft a SetupIntent via Stripe CLI without metadata → `setup-payment` returns 400.
3. Production env sweep: `sk_live_`/`pk_live_` pair present, `ALLOW_MOCK_PAYMENT` absent.
4. Reconciliation query returns zero rows after a clean E2E.

### Abort conditions
- Any state where a customer's card saves but no path (automatic or runbook) activates the membership → stop, fix the runbook first. Card-saved-but-dead-membership is the worst customer experience in the flow.

---

## Phase 7 — Pricing truth consistency

**Today:** the engine is single but its **settings input forks.** HQ builder and the create-plan wizard pass live Supabase settings; `lib/presentations/calculations.ts`, `lib/agreement/agreement-pricing.ts:144`, and `lib/membership/tier-config.ts:214` silently use `DEFAULT_COMPANY_SETTINGS`. If HQ pricing settings ≠ code defaults, presentations and agreement PDFs show different numbers than the builder.

### Moves

| Move | Detail |
|------|--------|
| 7.1 | RECON R5 first. If `pricing_settings` row is absent or identical to defaults: the fork is **dormant**. For first-customer safety, the cheap counter is a **freeze**: document in HQ runbook that pricing settings must not be edited until 7.2 ships. Add a production-check line item that compares the row to defaults and reports "pricing settings diverged — presentations may misprice" (a check, not a fix — smallest possible change with the biggest safety yield). |
| 7.2 | The real fix (schedule after first customer, before pricing edits): make `settings` a **required** parameter on `calculateWindowCarePricing` / `visitPriceForMembershipTier` / `calculateExteriorPrice` and let the compiler enumerate every negligent call site. Server call sites resolve settings via `fetchPricingSettingsFromSupabase()` once per request. This is a mechanical change but touches ~6 files — do not bundle it into phases 1–6. |
| 7.3 | Quote-snapshot precedence already exists (`buildAgreementPricingSnapshot` prefers `visitPrice`/`quoteSnapshot`) — verify with a test that a snapshot-locked price survives even when defaults drift. That test is the tripwire protecting signed customers from later settings edits. |

### Verification run
1. R5 diff output attached to PR.
2. Production-check page shows the new pricing-consistency line (green).
3. Existing vitest suite still green (67 tests); add one test: agreement snapshot with `visitPrice` set ≠ default-derived price → PDF math uses the locked price.

### Abort conditions
- If R5 shows divergence **and** any live presentation was created from HQ-builder numbers → reconcile before any customer signs: either reset `pricing_settings` to defaults or regenerate the presentation. A customer shown price A who signs an agreement PDF computing price B is a trust breach — the one thing the Standard exists to prevent.

---

## Campaign order & gates (summary)

```
Phase 0 RECON ──► Phase 1 Admin auth ──► Phase 2 Storage integrity
                                              │
                       Phase 3 Server boundary (gate: R1 list fully green)
                                              │
                       Phase 4 RLS flip (gate: Phase 3 network sweep clean)
                                              │
                       Phase 5 Portal tokens ──► Phase 6 Stripe ──► Phase 7 Pricing check
```

Phases 1, 2 can run in parallel. 3→4 is strictly serial. 5–7 can interleave after 4.
After Phase 4 verification: **rotate the anon key** (R7).
After Phase 7: run `wargames/002-first-customer.md`.

## Standing abort condition for the whole campaign

If production customer data (real homeowner rows, real signed agreements) exists **before** Phase 4 completes, the campaign is running behind the threat. Compress: Phases 1+2 within 48h, 3+4 within the week. The database being world-writable is not a background risk — it is the active condition.
