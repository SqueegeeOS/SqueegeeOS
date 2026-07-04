# Linear — Design Philosophy Reference

**For HomeAtlas engineers and designers**  
**Scope:** Principles — not copying Linear's UI pixel-for-pixel.

---

## Why Linear Matters to HomeAtlas

Linear proved that **B2B software can feel fast, dark, and opinionated** — without becoming a game or a social network. It treats engineering work as craft. HomeAtlas treats home care operations the same way.

Headquarters is our Linear-like surface: founders who care about quality deserve software that respects their attention.

---

## Core Principles

### 1. Speed as a feeling

Linear's interface feels instant — keyboard-first, optimistic UI, no blocking spinners.

**HomeAtlas application:** Shimmer skeletons instead of spinners. Silent dashboard refresh after closed job log. Charts and counts animate while data is already present — motion masks latency, it does not create it.

### 2. Opinionated structure

Linear does not let you configure everything. Strong defaults reduce chaos.

**HomeAtlas application:** Growth journey tiers (Foundation → Dynasty), fixed HQ sections (Legacy / Today / Forward), plan section order on Home Care Plans. Configuration exists where businesses differ — not on layout philosophy.

### 3. Dark UI done correctly

Not gray-on-gray — layered surfaces, hairline borders, single accent.

**HomeAtlas application:** Token system in [DESIGN_SYSTEM.md](../docs/DESIGN_SYSTEM.md) — `#060606` background, `#111111` surfaces, `#ffffff12` borders.

### 4. Micro-interactions with purpose

Hover states, selection glows, and transitions confirm action — subtle, never carnival.

**HomeAtlas application:** `CursorSurface` border illumination. Revenue period filter bar. PIN gate focus rings (future: illuminate inputs).

### 5. Typography density control

Linear uses small caps labels, medium body, tight vertical rhythm in lists — but generous padding in detail views.

**HomeAtlas application:** `text-[10px] uppercase tracking-[0.28em]` eyebrows. Compact tables only where necessary (closed jobs ledger) — surrounded by whitespace.

---

## Motion Language Overlap

Linear popularized **spring-based, engineered motion** on the web. HomeAtlas `lib/motion/system.ts` springs (`glass`, `settle`, `press`) follow the same philosophy:

- High stiffness for snappy UI feedback
- Controlled damping — no wobble
- Stagger for lists — 70ms children, not simultaneous pop

---

## What Linear Does That HQ Should Eventually Match

| Linear capability | HQ direction |
|-------------------|--------------|
| Command palette | Quick actions bar (partial — link grid today) |
| Real-time sync | Supabase live closed jobs |
| Issue status language | Mission + growth milestone vocabulary |
| Keyboard shortcuts | Future founder power user mode |

---

## Anti-Patterns from Generic SaaS Linear Copies

- Purple gradient hero (Linear uses restrained accent)
- Fake "AI sorting" badges on every view
- Sidebar with 40 icons
- Light mode toggle on v1 (HomeAtlas: dark luxury first)

---

## Key Takeaway

> *Operators deserve software that feels as sharp as the work they do.*

Headquarters should feel like opening Linear on Monday morning — calm, dark, ready — not like opening a 2014 ERP dashboard.

---

*Motion implementation: [ANIMATIONS.md](../docs/ANIMATIONS.md)*
