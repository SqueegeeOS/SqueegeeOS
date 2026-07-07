# HomeAtlas Engineering Bible

**Status:** Living constitution  
**Audience:** Founders, engineers, AI coding sessions  
**Authority:** This document overrides convenience. When in doubt, read here first.

---

## What HomeAtlas Is

HomeAtlas is the operating system for home service companies. It is not a CRM, not a scheduling tool, and not a website builder with a dashboard bolted on.

We document the **life of a property** — visits, photos, recommendations, membership, and the story of care over years. Every technical decision should make that story clearer, more trustworthy, and more beautiful for the homeowner.

The repository (`squeegeeos`) is the engineering home of HomeAtlas. **SqueegeeKing** is the first company on the platform — our proof of concept, our design lab, and our conscience.

---

## The Constitution

These principles are non-negotiable. They apply to every pull request, every AI session, and every late-night shortcut temptation.

### 1. Property-first

The home is the hero entity. Jobs, invoices, and tickets are implementation details. Data models, routes, and UI hierarchy start at **property**, then homeowner, then company.

### 2. Luxury over utility

We compete on feeling, not feature count. If a screen looks like contractor software, it fails — even if it works. Spacing, typography, motion, and restraint matter as much as correctness.

### 3. Handcrafted over generated

Homeowners should wonder whether we built this experience for their home alone. Copy, layout, and motion should feel intentional — never templated, never "AI slop."

### 4. Experience over features

Emotional clarity beats information density. One unforgettable Home Care Plan beats ten average admin pages.

### 5. Quality over speed

Ship one module at a time, fully aligned to architecture. Partial luxury is worse than delayed luxury.

### 6. Timeline as story

Every visit adds a chapter. The Property Timeline is the spine of the product — not an activity log sidebar.

### 7. AI as invisible craftsmanship

AI handles tedious work and elevates output. It does not announce itself with chat bubbles on every screen. **Atlas** (the concierge codename) earns trust through usefulness, not personality theater.

### 8. Real people, real brand

Customer-facing team content uses real SqueegeeKing members or clearly marked placeholders. Never stock photos. Never fictional names presented as real.

### 9. Secrets stay server-side

API keys, OAuth secrets, admin PINs, and Stripe credentials never ship to the client. Server routes and environment variables are the boundary.

### 10. Motion is engineering, not decoration

Animation communicates confidence, precision, and intention. Generic fade-ups, bounce easing, and spinners are banned. See [MOTION_LANGUAGE.md](./MOTION_LANGUAGE.md) — the canonical playbook. Implementation details in [ANIMATIONS.md](./ANIMATIONS.md).

---

## How We Build

### Incremental modules

Features must fit the product map in [ARCHITECTURE.md](./ARCHITECTURE.md). If a feature does not have a natural home in that map, we design its home before writing code.

### Minimal diffs

Change only what the task requires. Match surrounding conventions. Reuse existing abstractions. A five-line fix that solves the root problem beats a hundred-line refactor.

### Persistence is swappable

Application code talks to `lib/persistence/repository.ts`. Adapters (`sessionStorage`, Supabase) are interchangeable. Never embed storage logic in UI components.

### Server-first integrations

Google Reviews, Stripe, Supabase, and future AI providers integrate through API routes. Client components fetch our APIs — never third-party APIs directly with secrets.

### PIN-gated internal surfaces

Headquarters (`/hq`), setup wizards (`/setup/*`), and Experience Lab (`/experience/*`) require admin unlock. Treat these as founder tooling, not public product.

---

## Code Standards

| Area | Standard |
|------|----------|
| **Language** | TypeScript strict. No `any` unless documented. |
| **Framework** | Next.js App Router. Server Components default; `"use client"` only when needed. |
| **Styling** | Tailwind v4 + CSS variables in `app/globals.css`. No inline style sprawl. |
| **Motion** | Framer Motion via `lib/motion/` primitives. Always respect `prefers-reduced-motion`. |
| **Brand (user-facing)** | `lib/brand/platform.ts` (HomeAtlas), `lib/brand/customer.ts` (SqueegeeKing). |
| **Internal names** | Package `squeegeeos`, folders like `lib/concierge/` — do not rename for branding passes. |

### Naming clarity

- **HomeAtlas** — platform brand shown to operators and in "Powered by" attribution.
- **Atlas** — internal codename for the AI concierge layer.
- **Headquarters** — founder command center at `/hq`.
- **SqueegeeKing** — customer-facing home care brand.

User-facing strings use brand constants. Internal code names remain stable across rebrands.

---

## What We Never Do

- Spinners for loading (use shimmer skeletons and progressive reveal).
- Bounce or playful easing on product surfaces.
- Fake review counts or unaudited social proof.
- Force-push to `main` without review (founders excepted for solo hotfixes — still document).
- Commit secrets (`.env.local`, API keys pasted in chat).
- Duplicate motion curves in random components (use the motion system).
- Build "website animations" when the brief asks for cinematic UI.

---

## Documentation Protocol

This repository maintains a permanent knowledge base:

| Document | Purpose |
|----------|---------|
| [ENGINEERING_BIBLE.md](./ENGINEERING_BIBLE.md) | Constitution (this file) |
| [VISION.md](./VISION.md) | Ten-year direction |
| [ROADMAP.md](./ROADMAP.md) | Shipped vs planned by version |
| [BRAND.md](./BRAND.md) | Brand architecture |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | Visual and component language |
| [ANIMATIONS.md](./ANIMATIONS.md) | Motion architecture, ceremonies, file map |
| [MOTION_LANGUAGE.md](./MOTION_LANGUAGE.md) | **Canonical motion playbook** — timing, rules, checklist |
| [HOMEATLAS_STORY.md](./HOMEATLAS_STORY.md) | Why we exist |
| [ARCHITECTURE_GUIDELINES.md](./ARCHITECTURE_GUIDELINES.md) | How code is organized |
| [CORPUS_ALIGNMENT_REPORT.md](./CORPUS_ALIGNMENT_REPORT.md) | Documentation consistency audit |
| [AI_CONCIERGE.md](./AI_CONCIERGE.md) | Atlas intelligence layer |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Module map and implementation status |

**After every major feature:** update the relevant doc if vision, architecture, design, motion, or roadmap changed. AI coding sessions should read `/docs` before large tasks.

**HomeAtlas Standard:** The full Standard (Volumes I–VII) lives outside this repository. Engineering constitution in this repo is [ENGINEERING_BIBLE.md](./ENGINEERING_BIBLE.md). Wargames reference Standard principles — see [CORPUS_ALIGNMENT_REPORT.md](./CORPUS_ALIGNMENT_REPORT.md).

Reference material lives in `/reference` — design philosophy of companies we admire, not assets to copy.

---

## Decision Hierarchy

When principles conflict, resolve in this order:

1. **Homeowner trust** — would a homeowner feel respected and safe?
2. **Founder clarity** — does Headquarters reflect true company state?
3. **Craft** — does it feel engineered and calm?
4. **Correctness** — does the data model hold for ten years?
5. **Speed** — only after the above are satisfied.

---

## Founders

| Role | Name |
|------|------|
| Founder & Visionary | Noah Thomas |
| Co-Founder & COO | Dasan Gramps |

Headquarters is built for both. The product is built for every home service company that chooses to run on HomeAtlas — starting with SqueegeeKing.

---

*Last updated: July 2026 — cinematic motion system, HomeAtlas branding, Headquarters cloud sync, Atlas Morning Brief v0.1.*
