# Volume V Outline — The Experiential Layer of HomeAtlas (Planning Document)

**Status:** Outline only. No Volume V prose written yet.  
**Purpose:** Make Volume V feel inevitable before it’s written — distill the last week of learnings into a single table of contents with clear section intent.

---

## Inputs reviewed (present in this repo)

- `docs/ENGINEERING_BIBLE.md` (constitution)
- `docs/ARCHITECTURE.md`, `docs/ARCHITECTURE_GUIDELINES.md`
- `docs/VISION.md`
- `docs/HOMEATLAS_STORY.md`
- `docs/BRAND.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/MOTION_LANGUAGE.md`, `docs/ANIMATIONS.md`
- Wargames:
  - `wargames/001-production-hardening.md`
  - `wargames/002-first-customer.md`
  - `wargames/003-customer-portal-redesign.md`
  - `wargames/004-the-missing-product.md`
  - `wargames/005-the-view-from-2046.md`
  - `wargames/006-red-team-the-competitor.md`
  - `wargames/007-first-100-members-operating-gaps.md`
  - `wargames/008-twenty-year-competitive-pressures.md`
  - `wargames/009-the-constitution-test.md`

## Inputs referenced but not found in this repo snapshot

- **HomeAtlas Standard**: referenced as `THE_HOMEATLAS_STANDARD.md` in wargames, but not present here.
- **Standard process notes** (`STANDARD_PROCESS_NOTES.md`): not in repo.
- **Fable Constitution clarifications**: not found as standalone document; see `docs/ENGINEERING_BIBLE.md` and wargames.

---

## What Volume V *is*

Volume V is the **experiential layer** of HomeAtlas: the laws, principles, patterns, ceremonies, motion, honesty constraints, and continuity rules that make HomeAtlas feel like craftsmanship — not software.

It governs how every homeowner-facing surface should feel, and how every operator-facing surface earns trust through clarity and restraint.

---

## Table of contents (with short descriptions)

### 0. Preface: Why Volume V exists
- Defines the purpose of the experiential layer: trust, luxury stewardship, and continuity across time.
- Explains how Volume V relates to the Constitution and Architecture: it is “how the product feels,” enforced as seriously as correctness.

### 1. The North Star: Trust Through Design
- Trust is not a marketing slogan; it is a set of UI behaviors.
- Defines what “trust” looks like on-screen: clarity, honesty, calm, and certainty.

### 2. Luxury (as an engineering constraint)
- “Luxury over utility” translated into measurable rules: spacing, hierarchy, restraint, and simplicity.
- Defines luxury anti-patterns: contractor SaaS tables, noisy dashboards, frantic UI, playful motion.

### 3. Visual Honesty (the anti-fiction doctrine)
- Rules for real data vs. honest emptiness (no fabricated history, no invented savings).
- How to design empty states that feel like anticipation, not absence.
- What must never be shown while access links can leak (secrets, forensics, internal system words).

### 4. Communicate Before You Explain
- One headline answers “what is my situation?” before any detail appears.
- Defines hierarchy grammar: eyebrow → headline → one support line → surfaces.
- Forbids “narration” and explanation-first UI.

### 5. Continuity Between Surfaces (the Seamlessness Standard)
- The deck sold a promise; the portal must feel like the receipt.
- Side-by-side continuity rules: typography, stage, vocabulary, and the “✓ language.”
- Continuity across: presentation → portal → emails → future PWA install → year-in-review.

### 6. The Laws of Customer Surfaces
- Portal law: what belongs on day one (identity + certainty + “what happens next”), and what is earned later (history).
- Presentation law: what a “close” is allowed to do, and what it must never do.
- Defines “small honest product beats large dishonest product.”

### 7. Mobile-First as the default reality
- 375px is the design truth; desktop is the enhancement.
- Touch targets, safe-area, one-handed rhythms, scroll-first structure.
- No desktop tables compressed onto mobile.

### 8. Empty States Tell the Truth
- Empty states are primary product surfaces (especially at launch).
- Templates for empty-state emotional tone: reserved table vs empty room.
- Rules: never show zeros as accusations; omit sections that would read as “no value.”

### 9. Motion (engineering, not decoration)
- Motion’s job: hierarchy, state, craft.
- Canonical rules (durations, easing, blur-as-depth, “cards rise from the canvas”).
- Reduced-motion parity requirements.

### 10. Customer Ceremony
- What ceremonies are allowed (unlock moments) and when they must get out of the way.
- “Success is acknowledged, not celebrated forever.”
- Ceremony does not replace clarity; it is an accent on truth.

### 11. Emotional Design (calm precision)
- How the product should feel in the homeowner’s hand: calm, cared for, known.
- Tone rules: never apologetic, never frantic, never hype.
- “Receipt thinking”: every surface should reinforce the membership promise.

### 12. Accessibility as luxury
- Reduced motion, semantic hierarchy, focus states, contrast discipline.
- Accessibility is not a compliance add-on; it is part of “engineered calm.”

### 13. Installation Experience (PWA)
- Add-to-home-screen as the product strategy (not a native app yet).
- Manifest and icon constraints, safe-area, standalone display-mode behavior.
- Guidance: iPhone Share → Add to Home Screen; Android install prompts when supported.

### 14. The Tests (how we verify the experience)
- Grandma Test (5–8 second comprehension).
- Squint Test (one dominant headline; accent restraint).
- Continuity Test (close slide vs portal landing).
- Honesty Test (no fabricated history; no zero-stat “arguments against the customer”).
- Reduced-motion + keyboard parity check.

### 15. The Pattern Library (primitives Volume V depends on)
- Stage / environment: glow + grain rules.
- Typography primitives: serif headline behavior, balanced text, letter-spacing bands.
- Disclosure primitives: expanders, “view details,” hierarchy tokens.
- Loading primitives: shimmer skeletons (no spinners).

### 16. Governance: How Volume V becomes enforceable
- What is a Law vs Guideline vs Design Principle.
- How PRs assert compliance: checklists, screenshots, and “this screen passes X test.”
- How wargames feed changes into the Standard without rewriting history.

---

## Appendix A — Candidate promotions into the Standard (do not promote automatically)

Extracted primarily from `wargames/003-customer-portal-redesign.md` plus motion/design docs and first-customer/production-hardening constraints.

### Candidate Laws (non-negotiable)

- **Visual Honesty / No Fabrication**: Real data or honest emptiness; never invent visits, savings, or history.
- **No Secrets on Customer Surfaces (until real auth)**: Access instructions, gate codes, lockbox notes, signing forensics, and internal system words never appear on token-link surfaces.
- **Communicate Before You Explain**: One dominant headline answers the situation before details.
- **No Zero-Stats as Value Arguments**: Hide “0 completed,” “$0 saved,” etc. Omit rather than punish.
- **No Spinners**: Loading uses shimmer skeletons shaped like the content.

### Candidate Guidelines (strong defaults; exceptions require explicit rationale)

- **Grandma Test (5–8 second rule)**: A first-time viewer can explain what this screen means within 8 seconds.
- **Squint Test**: At a squint, the hierarchy is obvious; one headline dominates; accent used sparingly.
- **Continuity Test**: Presentation close and portal landing must feel like the same world (typography/stage/vocabulary).
- **Progressive Disclosure by Default**: Summaries first; detail behind “View details” expanders; avoid information dumps.
- **Mobile-First 375px**: Build at phone size; enhance up.
- **Success Exits Quickly**: Celebrate briefly, then get out of the way.

### Candidate Design Principles (directional; used to resolve ambiguous decisions)

- **The deck sold a promise; the portal is the receipt**: continuity is achieved by construction, not by later polish.
- **A reserved table, not an empty room**: emptiness should feel like anticipation and care, not absence.
- **Luxury is absence + hierarchy**: when unsure, remove and add space.
- **Motion is proof of engineering**: depth, focus, and intention — never playful.
- **Small honest product beats large dishonest product**: cut scope before bending truth.

---

## Appendix B — Canon placement proposal

See `docs/canon/README.md` for the proposed long-term canon folder taxonomy and where existing documents belong (no moves yet).

