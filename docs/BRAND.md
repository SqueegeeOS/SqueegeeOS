# HomeAtlas Brand Architecture

**Purpose:** Define how our brands relate, where each name appears, and what must never be confused.

---

## Canonical Terminology

Use one name per concept across docs and UI copy. Wargames may use exploratory language; product docs use these terms.

| Concept | Canonical term | Avoid (unless quoting) |
|---------|----------------|------------------------|
| Enrolled homeowner surface | **Member portal** | Customer portal, Homeowner Portal, HomeAtlas Home |
| Pre-membership presentation | **Home Care Plan** | Proposal only |
| Chronological visit history | **Property Timeline** | Care Record, visit log |
| Platform intelligence | **Atlas** (`lib/concierge/`) | AI Engine, AI Intelligence |
| Founder command center | **Headquarters** (`/hq`) | Admin, Admin Dashboard |
| Customer brand | **SqueegeeKing** | Squeegeeking (domain `squeegeeking.net` is infra only) |
| Platform brand | **HomeAtlas** | SqueegeeOS (repo name only) |
| Home metric | **Home Care Score** | Property health (informal) |
| Field worker | **Technician** | Tech (informal) |
| Entity | **Homeowner** → **Member** (after enrollment) | Customer (post-signup product copy) |

Strategic terms used in wargames only until promoted: *Care Record*, *Promise Ledger*, *Property Memory*.

---

## The Four Names

HomeAtlas uses four distinct names. They are not interchangeable.

| Name | Type | Audience | Meaning |
|------|------|----------|---------|
| **HomeAtlas** | Platform brand | Operators, partners, investors | The operating system for home service companies |
| **Atlas** | Internal codename | Engineering, product | The AI concierge and long-term intelligence layer |
| **Headquarters** | Product surface | Founders (Noah & Dasan) | The command center where the company is run |
| **SqueegeeKing** | Customer brand | Homeowners, market | Premium home care in Chico, California — first tenant on HomeAtlas |

---

## HomeAtlas

**Tagline:** *The Operating System for Home Service Companies.*

HomeAtlas is what operators and future partner companies see when we talk about the platform. It appears in:

- Page titles via `platformPageTitle()` (`lib/brand/platform.ts`)
- **Powered by HomeAtlas** footer on Headquarters and internal surfaces
- **HomeAtlas Morning Brief** — the concierge digest at `/hq`
- Setup wizards and operator tooling attribution

HomeAtlas is **not** the name homeowners hire for window cleaning. Homeowners hire SqueegeeKing.

### Voice

Calm. Engineered. Confident. Speaks to founders who care about systems — not hype, not startup clichés.

---

## Atlas

**Atlas** is the internal codename for the intelligence layer — not a separate public product name (yet).

Today Atlas powers:
- **Morning Brief** — rule-based insights from revenue, reviews, missions, and membership (`lib/concierge/`)
- Future: visit summaries, score updates, operator copilot, anomaly detection

In UI copy for founders, prefer **HomeAtlas Morning Brief** over "Atlas says…" until Atlas earns a public identity.

In code and docs, **Atlas** is the stable module name (`lib/concierge/`, `conciergeCodename: "Atlas"`).

---

## Headquarters

**Headquarters** is the founder command center at `/hq` — not "admin," not "dashboard," not "back office."

Headquarters exists to:
- Remember where the company came from (Legacy timeline, founder archive)
- Show where it is today (Operating System metrics, live reviews, closed jobs)
- Clarify where it is going (missions, growth journey, freedom meter)

Copy tone: *"Your company is alive."* Time-aware greetings (*Good evening, Noah.*). Cinematic boot sequence on unlock.

**Headquarters** is SqueegeeKing-specific in content but HomeAtlas in platform attribution (*Powered by HomeAtlas*).

Future: partner companies may get their own Headquarters instance with tenant-scoped data — same product pattern, different company name in the header.

---

## SqueegeeKing

**Tagline:** *Premium Home Care.*

SqueegeeKing is the customer-facing brand — every homeowner touchpoint:

- Public landing, request flow, Home Care Plans
- Member portal and membership unlock ceremony
- Google Reviews presentation
- Team portraits (Noah Thomas, Dasan Gramps)
- Location: Chico, California

Constants: `lib/brand/customer.ts` (`CUSTOMER_BRAND`, `CUSTOMER_CTAS`).

### Voice

Warm but refined. Family without casual slop. Craftsmanship without arrogance. *"Every customer becomes part of the SqueegeeKing family"* — from company philosophy, not marketing filler.

---

## Relationship Diagram

```
┌─────────────────────────────────────────────────────────┐
│                      HomeAtlas                          │
│         The Operating System (platform)                   │
│                                                         │
│   ┌─────────────┐    ┌──────────────┐    ┌───────────┐ │
│   │   Atlas     │    │ Headquarters │    │  Future   │ │
│   │ (intelligence)│  │  (/hq)       │    │  tenants  │ │
│   └─────────────┘    └──────────────┘    └───────────┘ │
│                                                         │
│   ┌─────────────────────────────────────────────────┐   │
│   │              SqueegeeKing (tenant #1)            │   │
│   │   Homeowners · Plans · Portal · Properties       │   │
│   └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Usage Rules

### Do

- Show **SqueegeeKing** on all customer acquisition and homeowner experiences.
- Show **Powered by HomeAtlas** on founder/operator surfaces where platform attribution is appropriate.
- Use **Headquarters** in founder-facing navigation and copy.
- Keep internal folder and package names (`squeegeeos`, `lib/concierge/`) stable during brand passes.

### Do not

- Put "HomeAtlas" on the main homeowner hero where they expect their care provider's name.
- Rename code modules to match marketing renames without an explicit migration task.
- Call Headquarters "Admin" in user-visible strings.
- Present Atlas as a chatbot mascot before it delivers real value.

---

## Visual Relationship

| Surface | Primary brand | Secondary |
|---------|---------------|-----------|
| `/` (landing) | SqueegeeKing | — |
| `/homecare/.../plan` | SqueegeeKing | — |
| `/hq` | SqueegeeKing Headquarters | Powered by HomeAtlas |
| Morning Brief | HomeAtlas | Atlas (internal) |
| `/setup/google-reviews` | Setup Wizard | HomeAtlas tooling |

Both brands share the **dark luxury aesthetic** — warm ivory foreground, champagne accent, generous serif headlines. HomeAtlas surfaces feel more *operating system*; SqueegeeKing surfaces feel more *home and family*.

---

## File Reference

| Constant | File |
|----------|------|
| `PLATFORM_BRAND` | `lib/brand/platform.ts` |
| `CUSTOMER_BRAND` | `lib/brand/customer.ts` |
| Company philosophy | `lib/admin/company-philosophy.ts` |
| Headquarters purpose | `HEADQUARTERS_PURPOSE` in same file |

---

*When adding a new tenant company on HomeAtlas, copy the SqueegeeKing pattern: customer brand for homeowners, HomeAtlas attribution for operator tools.*
