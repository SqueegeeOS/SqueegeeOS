# HomeAtlas Canon (Long-Term IP Library)
  
**Goal:** a stable home for HomeAtlas’s “long-lived ideas” — the intellectual property that should compound for years: volumes, wargames, philosophy, vision, architecture, and engineering law.
  
**Rule:** do **not** move existing files yet if it creates churn. This folder is a *target taxonomy* first.
  
---
  
## Proposed folder taxonomy
  
- `docs/canon/Volumes/`
  - Long-form volumes (Volume I–VII, plus future Volume V “Experiential Layer”).
- `docs/canon/Wargames/`
  - Adversarial / scenario planning docs (battle plans, red-team notes, first-customer playbooks).
- `docs/canon/Architecture/`
  - Product map + system architecture + technical doctrine that outlives implementations.
- `docs/canon/Vision/`
  - 10–20 year direction, north-star narratives, “view from 2046”.
- `docs/canon/Roadmap/`
  - Sequenced execution plans, milestones, shipped vs planned.
- `docs/canon/Philosophy/`
  - The “why”: trust, luxury stewardship, visual honesty, homeowner-first framing.
- `docs/canon/Engineering/`
  - Constitutions, engineering bible, hard constraints, security posture, integration policies.
- `docs/canon/History/`
  - Company history, founding cohort records, memos, changelogs that matter culturally.
  
---
  
## Where existing documents *belong* (proposal — no moves yet)
  
### Wargames (current location: `wargames/`)
  
- `wargames/001-production-hardening.md` → `docs/canon/Engineering/` (Security + production hardening doctrine)
- `wargames/002-first-customer.md` → `docs/canon/Wargames/` (Operational playbook)
- `wargames/003-customer-portal-redesign.md` → `docs/canon/Volumes/` **or** `docs/canon/Wargames/` (it’s a wargame, but functions as Volume V seed)
- `wargames/004-the-missing-product.md` → `docs/canon/Vision/` (Product discovery + strategic missing pieces)
- `wargames/005-the-view-from-2046.md` → `docs/canon/Vision/`
- `wargames/006-red-team-the-competitor.md` → `docs/canon/Wargames/`
- `wargames/007-first-100-members-operating-gaps.md` → `docs/canon/Wargames/`
- `wargames/008-twenty-year-competitive-pressures.md` → `docs/canon/Vision/`
- `wargames/009-the-constitution-test.md` → `docs/canon/Philosophy/` (governance audit)
  
### Core docs (current location: `docs/`)
  
- `docs/ENGINEERING_BIBLE.md` → `docs/canon/Engineering/` (Constitution)
- `docs/ARCHITECTURE.md` → `docs/canon/Architecture/`
- `docs/ARCHITECTURE_GUIDELINES.md` → `docs/canon/Architecture/`
- `docs/BRAND.md` → `docs/canon/Philosophy/` (Brand architecture is “law” for customer trust)
- `docs/DESIGN_SYSTEM.md` → `docs/canon/Volumes/` (Volume V material) **or** `docs/canon/Philosophy/` (design doctrine)
- `docs/MOTION_LANGUAGE.md` → `docs/canon/Volumes/` (Volume V material)
- `docs/ANIMATIONS.md` → `docs/canon/Engineering/` (motion system architecture) **and** `docs/canon/Volumes/` (motion doctrine) — choose one canonical home later
- `docs/VISION.md` → `docs/canon/Vision/`
- `docs/ROADMAP.md` → `docs/canon/Roadmap/`
- `docs/HOMEATLAS_STORY.md` → `docs/canon/History/` **and** `docs/canon/Philosophy/` (it’s both; pick one canonical home later)
- `docs/APOLLO_DIRECTIVE.md` → `docs/canon/Vision/` (future-state intelligence direction)
- `docs/MEMBER_INTELLIGENCE.md` → `docs/canon/Architecture/` (data model + intelligence shape)
- `docs/AI_CONCIERGE.md` → `docs/canon/Architecture/` **or** `docs/canon/Engineering/` (system doctrine)
- `docs/ATLAS_PRICING_ENGINE.md` → `docs/canon/Engineering/` (pricing law implementation doctrine)
  
### Reference (current location: `reference/`)
  
- `reference/apple.md`, `reference/linear.md`, `reference/stripe.md`, `reference/visionos.md`, `reference/notion.md`
  - Keep in `reference/` (these are inspirations; canon is HomeAtlas IP).
  
---
  
## Open items (inputs not found in repo)

- **HomeAtlas Standard**: referenced as `THE_HOMEATLAS_STANDARD.md` in wargames, but not present in this repository. Volumes I–VII live in founder session outputs.
- **Standard process notes** (`STANDARD_PROCESS_NOTES.md`): referenced by wargames 004, 008, 009 — not in repo.
- **Fable Constitution clarifications** (A1–C2): not found as standalone document.
- **Corpus alignment**: [`docs/CORPUS_ALIGNMENT_REPORT.md`](../CORPUS_ALIGNMENT_REPORT.md) (July 2026 pass).
