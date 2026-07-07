# HomeAtlas Corpus Alignment Report

**Date:** July 2026  
**Scope:** Repository documentation consistency pass (not philosophy rewrite)  
**Authority:** [ENGINEERING_BIBLE.md](./ENGINEERING_BIBLE.md) · [BRAND.md](./BRAND.md)  
**Confidence:** **High** for in-repo docs vs codebase; **Medium** for Standard cross-refs (Standard not in repo)

---

## Executive summary

This pass aligned product, engineering, and roadmap documentation with the **current codebase** and normalized **canonical terminology** across core docs. Philosophy in wargames and the external HomeAtlas Standard was **not rewritten**.

**Major wins:**
- `ARCHITECTURE.md` and `ROADMAP.md` now reflect token portal, SetupIntent payment, agreement PDF pipeline, PWA, and Headquarters naming.
- Canonical terminology table added to `BRAND.md`.
- Cursor rule, architecture guidelines, and AI/Vision docs aligned on **Atlas** and **Member portal**.

**Intentionally unchanged:**
- Wargame prose (exploratory language preserved; `wargames/README.md` added for context).
- HomeAtlas Standard (external — not in repository).
- Product behavior / code (documentation-only pass).

---

## Documents read

### In repository (reviewed)

| Area | Files |
|------|-------|
| Core docs | `ENGINEERING_BIBLE.md`, `ARCHITECTURE.md`, `ARCHITECTURE_GUIDELINES.md`, `ROADMAP.md`, `VISION.md`, `BRAND.md`, `HOMEATLAS_STORY.md`, `DESIGN_SYSTEM.md`, `MOTION_LANGUAGE.md`, `ANIMATIONS.md` |
| Product / AI | `APOLLO_DIRECTIVE.md`, `AI_CONCIERGE.md`, `MEMBER_INTELLIGENCE.md`, `ATLAS_PRICING_ENGINE.md` |
| Wargames | `001`–`009` |
| Meta | `README.md`, `docs/canon/README.md`, `VOLUME_V_OUTLINE.md`, `.cursor/rules/squeegeeos-architecture.mdc` |
| Reference | `reference/*.md` (inspiration only — not edited) |

### Referenced but not in repository

| Document | Notes |
|----------|-------|
| **HomeAtlas Standard** (`THE_HOMEATLAS_STANDARD.md`, Volumes I–VII) | Cited by wargames 003–009; lives in founder session outputs |
| **STANDARD_PROCESS_NOTES.md** | Five-step promotion process (build → notice → name → test → promote) |
| **Fable Constitution clarifications** (A1–C2) | Referenced by wargames 007, 008, 009 |

Engineering constitution **in this repo** is `ENGINEERING_BIBLE.md`. It implements property-first, luxury, timeline, and Atlas principles aligned with Standard themes — but is not a verbatim copy of the Standard.

---

## Inconsistencies fixed

### Terminology & naming

| Issue | Resolution |
|-------|------------|
| `SqueegeeOS Architecture` title | Renamed to **HomeAtlas Architecture**; repo name noted as `squeegeeos` |
| `Customer Home Care Portal` / `Homeowner Portal` / five portal synonyms | Core docs → **Member portal** (`/portal/[token]` production, slug demo) |
| `AI Engine` / `AI Intelligence` in architecture | → **Atlas** with link to `AI_CONCIERGE.md` |
| `Admin Dashboard` / `Admin Command Center` | → **Headquarters** (`/hq` canonical) |
| `Squeegeeking` as brand spelling | → **SqueegeeKing** in architecture; domain `squeegeeking.net` noted as infra |
| `HomeAtlas Home` in Apollo product tree | → **Member portal (SqueegeeKing homeowner surface)** |
| Cursor rule outdated modules and routes | Rewritten to match `BRAND.md` and current routes |

### Roadmap vs reality

| Was documented | Now documented |
|----------------|----------------|
| Member portal "prototype" only | Token portal, wallet card, founding member, install prompt, unlock ceremony |
| PWA "foundation only" | Manifest scoped to `/portal`, install card, portal session storage |
| Persistence "Supabase ready" stub | Supabase adapter **implemented**; session default without env |
| Stripe Checkout as live path | **SetupIntent + Elements** live; Checkout redirect still unbuilt |
| Agreement "future production" | PDF, storage, customer email, welcome email **shipped** |
| Unlock after Stripe Checkout | Unlock after **payment setup** + first portal visit |

### Cross-references added

- `BRAND.md` — canonical terminology table
- `ENGINEERING_BIBLE.md` — Standard external note, corpus report link
- `ARCHITECTURE.md` — links to BRAND, AI_CONCIERGE, MOTION_LANGUAGE, ENGINEERING_BIBLE
- `AI_CONCIERGE.md` — Atlas field automation cross-ref (replaces stale "AI Engine" bridge)
- `wargames/README.md`, `docs/archive/README.md` — document status and scope

### Dead / stale documentation marked

| Item | Action |
|------|--------|
| `wargames/001` "PLAN ONLY, no code changed" | Status banner → partial execution note |
| `VOLUME_V_OUTLINE.md` | Confirmed planning-only; added wargame 009 to inputs |
| `app/portal/home-health?propertyId=` | Removed in prior portal work (unauthenticated route) — noted in security section |
| `saveMembershipAgreementMock` | Documented as legacy unused path |

---

## Inconsistencies intentionally left

| Item | Reason |
|------|--------|
| Wargame exploratory terms (*Care Record*, *Promise Ledger*, *Property Memory*) | Strategic language; not promoted to product spec per user instruction |
| `customer` in BRAND philosophy quote | Intentional voice ("SqueegeeKing family"); table clarifies member vs customer |
| `SQUEEGEEKING_TIERS` code identifier | Internal constant name — not user-facing |
| Apollo Directive brand references (Apple, Porsche, etc.) | Aspirational snapshot document — aging noted in wargame 009, not edited |
| `reference/` inspiration docs | External companies — not HomeAtlas canon |
| Wargame 002 email drift note ("email says HomeAtlas") | Historical ops finding — may still need code fix separately |
| `/admin` route may still exist | Documented as legacy; `/hq` canonical |
| HomeAtlas Standard volumes | Outside repo — cannot align text without import |

---

## Canonical terminology (post-pass)

Defined in [BRAND.md](./BRAND.md#canonical-terminology). Summary:

| Concept | Use |
|---------|-----|
| Member portal | Enrolled homeowner surface — `/portal/[token]` |
| Home Care Plan | Pre-membership presentation artifact |
| Property Timeline | Chronological visit spine (not "Care Record" in product docs) |
| Atlas | Platform intelligence — `lib/concierge/` |
| Headquarters | Founder surface — `/hq` |
| SqueegeeKing | Customer brand |
| HomeAtlas | Platform brand |
| Home Care Score | Metric name |
| Technician | Field role |

---

## Engineering alignment: principles → implementation

| Principle (Engineering Bible) | Observable implementation | Gap |
|------------------------------|----------------------------|-----|
| Property-first | Property Hub, property-scoped routes, `properties` table | — |
| Luxury over utility | Home Care Plan, Member portal, motion system | Some employee surfaces still utilitarian |
| Timeline as story | Dashboard `recentTimeline` preview only | **No live visit → timeline loop** |
| Real people, real brand | `lib/team/founders.ts`, portrait workflow | — |
| Secrets server-side | API routes for Stripe, Resend, Google | RLS hardening incomplete (wargame 001) |
| Motion is engineering | `lib/motion/`, UnlockCeremony, HQ boot | Legacy `Reveal` fade-ups remain |
| AI as invisible craftsmanship | Morning Brief at `/hq` | Field post-visit automation **not built** |
| Handcrafted over generated | Presentation onboarding, portal empty states | — |

### Membership journey (recent — now documented)

| Step | Implementation |
|------|----------------|
| Sign agreement | `POST /api/sign-agreement` → `completeSignOnboarding()` |
| Portal token | `memberships.portal_access_token` |
| Payment | SetupIntent → `setup-payment` |
| Welcome email | `send-welcome-email.ts` |
| Portal | `/portal/[token]` |
| PWA | `app/manifest.ts`, `InstallHomeAtlas` |

### Missing implementations (documented, not invented)

| Capability | Doc reference | Status |
|------------|---------------|--------|
| Property Timeline (live) | ARCHITECTURE, VISION | Preview mock only |
| Technician App | ARCHITECTURE, ROADMAP V2 | Not started |
| Atlas field automation | AI_CONCIERGE Phase 5 | Not started |
| Member portal Documents UI | ARCHITECTURE, ROADMAP | "Coming soon" in UI |
| Stripe Checkout redirect | Legacy modal path | `/api/stripe/checkout` not built |
| Stripe webhook | ROADMAP gap | Not wired |
| Service worker / offline PWA | ROADMAP | Not built |
| Scheduling handoff (sign → Jobber) | Wargame 007 | **Operating gap** |
| HomeAtlas Standard in repo | Wargame 009 | External only |
| Token hashing at rest | Wargame 001 Phase 5 | Plain token in DB |
| RLS default-deny | Wargame 001 | Permissive policies remain |

---

## Files changed in this pass

| File | Change type |
|------|-------------|
| `docs/ARCHITECTURE.md` | Major reality + terminology update |
| `docs/ROADMAP.md` | Shipped items, gaps, V1.1 status columns |
| `docs/ARCHITECTURE_GUIDELINES.md` | Routes, Stripe, persistence, HQ |
| `docs/BRAND.md` | Canonical terminology table |
| `docs/ENGINEERING_BIBLE.md` | Standard note, corpus report link |
| `docs/VISION.md` | AI Engine → Atlas |
| `docs/APOLLO_DIRECTIVE.md` | Product hierarchy naming |
| `docs/AI_CONCIERGE.md` | Cross-reference update |
| `docs/MEMBER_INTELLIGENCE.md` | Portal route + payment path |
| `docs/canon/README.md` | Wargame 009, open items |
| `docs/archive/README.md` | **New** — planning doc registry |
| `wargames/README.md` | **New** — wargame index + terminology note |
| `wargames/001-production-hardening.md` | Stale status banner |
| `VOLUME_V_OUTLINE.md` | Wargame 009 input |
| `.cursor/rules/squeegeeos-architecture.mdc` | Full alignment |
| `README.md` | Doc entry points |

---

## Canon Debt

Tracked gaps between **declared canon** (BRAND, Engineering Bible, wargame promotions) and **what exists in this repository**. Not blockers for shipping — explicit debt so future passes do not re-litigate.

| Debt item | Canon source | Current state | Resolution path |
|-----------|--------------|---------------|-----------------|
| HomeAtlas Standard (Volumes I–VII) | Wargames 003–009, Engineering Bible | **Not in repo** — lives in founder session outputs | Import to `docs/canon/Volumes/` or link as submodule |
| `STANDARD_PROCESS_NOTES.md` | Wargames 004, 008, 009 | **Not in repo** | Import promotion process doc |
| Fable Constitution clarifications (A1–C2) | Wargame 009 | **Not in repo** | Import or fold into Engineering Bible |
| Wargames at repo root (`wargames/`) | `docs/canon/README.md` taxonomy | Exploratory docs outside canon folder | Move on founder approval; `wargames/README.md` indexes until then |
| `Care Record` / `Property Memory` product naming | Wargame 003 exploratory | Code uses **Care record** section; architecture docs use **Property Timeline** | Promote one term in BRAND before renaming UI |
| Legacy `/admin` route | BRAND → Headquarters `/hq` | May still exist in code | Consolidate or redirect |
| `SQUEEGEEKING_TIERS` identifier | BRAND customer-facing Quarterly/Bi-Annual | Internal constant name unchanged | Code-only; portal UI already uses deck vocabulary |
| Token storage at rest | Wargame 001 Phase 5 | Plain `portal_access_token` in DB | Hash or rotate policy (001 follow-up) |
| RLS default-deny | Wargame 001, Engineering Bible | Permissive policies remain | Production hardening pass |
| Agreement email vs welcome email branding | BRAND SqueegeeKing / HomeAtlas split | Agreement email defers portal link until welcome email | Verify copy in `send-agreement-email.ts` + `send-welcome-email.ts` |
| `VOLUME_V_OUTLINE.md` at repo root | Canon taxonomy | Planning stub only | Move to `docs/canon/Volumes/` when Volume V promoted |
| Motion doc vs unlock implementation | ARCHITECTURE motion section | References retired chrome-padlock stack | Trim ARCHITECTURE to `UnlockCeremony` only |
| Operating Manual | Wargames 002, 007 | **Not written** | Next Fable artifact — scheduling, Jobber handoff, support playbooks |

**Rule:** new ships update ROADMAP + ARCHITECTURE first; append rows here when canon and code diverge intentionally.

---

## Recommended future cleanups

1. **Import or link HomeAtlas Standard** into repo (or `docs/canon/Volumes/`) so wargame promotion candidates can cite in-repo anchors.
2. **Import STANDARD_PROCESS_NOTES.md** — amendment and promotion process referenced but absent.
3. **Resolve wargame 002 email branding** — code may still say HomeAtlas where SqueegeeKing is required (verify `send-agreement-email.ts`, `send-welcome-email.ts`).
4. **Consolidate `/admin` → `/hq`** in routes if `/admin` still exists as duplicate.
5. **Wargame terminology pass** (optional) — add one-line glossaries at top of 003–008 without rewriting philosophy.
6. **ARCHITECTURE.md motion section** — unlock file map still references removed chrome-padlock stack; trim to `UnlockCeremony.jsx` only.
7. **Move wargames into `docs/canon/Wargames/`** when founder approves taxonomy migration (per `docs/canon/README.md`).
8. **Operating Manual** — next artifact; wargames 002 + 007 are seeds (not yet written).

---

## Confidence levels

| Area | Confidence | Notes |
|------|------------|-------|
| ARCHITECTURE / ROADMAP vs codebase | **High** | Verified against routes, APIs, migrations |
| BRAND / terminology normalization | **High** | Core docs aligned; wargames explicitly excluded |
| Engineering Bible ↔ Standard Laws | **Medium** | Standard not in repo; mapping is thematic |
| Wargame internal consistency | **Low** (unchanged) | By design — not edited |
| Complete corpus "one sitting" read | **Medium** | All in-repo docs reviewed; external Standard not available |

---

## How to maintain alignment

1. On ship: update `ROADMAP.md` shipped table + `ARCHITECTURE.md` status row.
2. New customer-facing surface: check [BRAND.md](./BRAND.md) terminology table.
3. New engineering principle: add to `ENGINEERING_BIBLE.md` with implementation pointer or explicit gap.
4. Wargame findings promoted to product: update BRAND/ARCHITECTURE first, then trim exploratory terms from wargames if desired.
5. Annual or milestone: re-run corpus audit; append to this report or create `CORPUS_ALIGNMENT_REPORT_YYYY.md`.

---

*This report documents a clarity pass only. No philosophy was invented or rewritten.*
