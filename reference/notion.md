# Notion — Design Philosophy Reference

**For HomeAtlas engineers and designers**  
**Scope:** Information architecture and calm productivity principles — not Notion's editor or block UI.

---

## Why Notion Matters to HomeAtlas

Notion made **structured knowledge feel approachable** — blocks, databases, and pages without enterprise ERP energy. HomeAtlas Property Timeline and document vault (future) share Notion's challenge: **years of information must remain navigable and human.**

We study Notion's **information hierarchy** and **calm density** — not their block editor paradigm for HQ.

---

## Core Principles

### 1. Everything is a page ( metaphor )

Notion users think in pages linked together — not folders of files.

**HomeAtlas application:** Property as root page → timeline entries, plans, documents as linked views. URL structure mirrors mental model: `/properties/[slug]`, `/homecare/.../plan`.

### 2. Progressive complexity

Blank page → add blocks → add database → add automation. Complexity appears when needed.

**HomeAtlas application:** Founder onboarding before full HQ. Setup wizard steps before OAuth. Home Care Plan wizard — homeowner → property → findings → pricing. Never show all fields at once.

### 3. Calm visual noise floor

Notion UI is mostly monochrome with subtle hover. Color means something when it appears.

**HomeAtlas application:** Muted default chrome. Accent for CTAs and Current Mission card only. Amber strictly for warnings (wrong Google Place ID).

### 4. Database behind beautiful views

Databases power tables, boards, calendars — users see the view, not the schema.

**HomeAtlas application:** Closed jobs table in HQ — founders see ledger narrative; schema lives in Supabase. Persistence adapter hides storage backend.

### 5. Templates that feel personal

Notion templates are starting points users customize — they do not feel locked.

**HomeAtlas application:** Home Care Plan generated from draft — same flagship design as Canyon Oaks reference, but content is property-specific. *"Crafted for [Name]"* energy.

---

## Timeline as Notion-Analogy

| Notion | HomeAtlas Property Timeline (future) |
|--------|--------------------------------------|
| Page history | Visit entries with date + author |
| Linked databases | Photos ↔ visits ↔ recommendations |
| Rollups | Home Care Score changes per entry |
| Filtered views | Homeowner sees customer summary; HQ sees revenue |

---

## Where HomeAtlas Intentionally Differs

| Notion trait | HomeAtlas choice |
|--------------|------------------|
| Light mode default | Dark luxury default |
| User-editable layout | Curated luxury layouts — not drag-drop |
| Blank canvas anxiety | Guided wizards and ceremonies |
| Generic workspace | Vertical-specific: home care only |

We are **not** building Notion for windows. We are building the **archive a premium homeowner wants to scroll** — Notion informs structure, SqueegeeKing brand informs feeling.

---

## Founder Journal Parallel

HQ Founder Journal (`components/admin/founder-journal.tsx`) is the closest Notion-like surface — long-form reflection. Guidelines:

- Serif headings, calm textarea
- Autosave future — not modal "Save"
- Private to founders — never customer-visible without explicit share

---

## Key Takeaway

> *The best knowledge systems disappear — you think about the content, not the tool.*

Property Timeline success means homeowners scroll ten years of care without wondering how the software works.

---

*Property Timeline status: [ROADMAP.md](../docs/ROADMAP.md) V2*
