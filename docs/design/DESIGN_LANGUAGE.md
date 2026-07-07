# HomeAtlas Design Language

**Status:** Enduring visual philosophy — living document  
**Authority:** [HOMEATLAS_UI_RENAISSANCE_BRIEF.md](./HOMEATLAS_UI_RENAISSANCE_BRIEF.md)  
**Implementation:** [CRAFT_GUIDELINES.md](./CRAFT_GUIDELINES.md) · [../DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md)

This document describes *why* HomeAtlas looks and feels the way it does. Read it before designing or restyling any surface. For class names, tokens, and file paths, use CRAFT_GUIDELINES.

---

## The rule above all others

> **If someone notices the design, we've probably gone too far.**

Nobody should walk away saying "amazing shadows." They should say "that just felt… really nice." The goal is not to impress. It is to feel **expensive through restraint** — the same quiet confidence we want homeowners to feel after our crew leaves their home.

Study *why* reference surfaces feel expensive. Do not copy effects.

---

## What HomeAtlas is

Not tech. Not AI. Not future. **Quiet confidence.**

HomeAtlas should feel like walking into a high-end architectural home — concrete, oak, stone, warm indirect lighting, silence. Everything intentional. Not a Lamborghini dashboard.

When someone opens HomeAtlas, the feeling should be: *these people clearly care about details.* That is the same feeling we want after a visit. The product and the service share one brand promise.

| Surface | Character |
|---------|-----------|
| **Member portal** | Editorial home journal — Apple Photos × luxury real estate portfolio |
| **Headquarters** | Founder operating room — may carry density, but each card still carries one fact |
| **Marketing** | Arrival — one promise, one path, honest darkness below the fold |

The **timeline remains the product.** Property memory is the spine; everything else supports it.

---

## Five principles

### 1. Light is a material

Not an effect. Light should feel like **sunlight hitting smoked glass** — not glow, not bloom, not neon. Depth comes from where the lamp catches an edge, not from stacking visual tricks.

We do not add light to make something "pop." We place objects in a room that is already lit.

### 2. One hero per screen

Every page gets **one** thing that is special. Morning Brief. Membership card. Timeline. Nothing else competes. This is the rim budget — assigned in the brief, not improvised at implementation time.

The moment two surfaces in one viewport both demand attention, neither is the hero.

### 3. Quiet navigation

Navigation almost hides itself. That is confidence. **The content becomes the interface.** Active states are soft whispers — a fill, a hairline, a dot — not a row of pill buttons that all look clickable.

If the nav is the first thing you notice, it is too loud.

### 4. Remove before adding

Before a border: *can spacing solve this?*  
Before a shadow: *can light solve this?*  
Before a new card: *can this live inside an existing surface?*  
Before an animation: *does the eye need help understanding where this came from?*

If not, leave it still.

### 5. Motion should explain

Cards do not animate because animation is cool. They animate because your eye needs help understanding **where something came from** — a settle, a rise, a handoff. Nothing loops on a settled page. Reduced motion must render a complete, equally premium static experience.

---

## The one lamp

Every page shares a single implied light source: **upper center-left**, off-screen. All lighting derives from it. The scene has one lamp, not a light show.

```
                    ☀ implied lamp (off-screen, upper center)
   ┌────────────────────────────────────────────────┐
   │ ①  stage warmth   — wall wash, brightest top   │
   │ ②  film grain     — air in the room             │
   │ ③  cursor glow    — whisper only (HQ, landing)  │
   │ ④  glass cards    — objects lit by ①            │
   │ ⑤  rim            — ONE hero catches the edge   │
   └────────────────────────────────────────────────┘
```

Darkness below the fold is intentional. Do not fill the lower viewport with light or clutter to "balance" the page. Falloff is a feature.

---

## Lighting

### Ambient warmth

The entire scene is lit from above — a champagne wash that falls off before the bottom of the viewport. Nothing is uniformly lit. This is what makes frames feel like evening in a home rather than a screen at full brightness.

Ambient warmth is always on. It is the room.

### Directional rim

Certain cards catch a champagne edge — brighter along one edge and one corner, fading around the perimeter. It is **directional**, as if one lamp lights the wall of cards. It marks the card that matters.

Rim is never animated on entrance. It is lighting, not an event. Peak intensity stays restrained — a catch, not a neon outline.

**Rim budget (assigned):**

| View | Hero surface |
|------|----------------|
| HQ overview | Morning Brief |
| Homepage | Membership tier card |
| Member portal | Wallet / membership card |
| Customer workspace | Timeline |
| Requests inbox | None |

### Cursor light

On desktop operator and marketing surfaces only: a whisper spotlight that follows the pointer. It must never compete with stage warmth or the rim. Portal and mobile get stage warmth alone — pointer effects add nothing there.

---

## Hierarchy

Each frame has exactly one hero. Everything else steps back. You should know where to look within one second.

**One obvious path.** One primary action per region. Secondary actions become text links or workspace facts — not competing buttons in every row.

**One idea per surface.** Inside a card: a title, one value or one visual, nothing else competing. Density that *looks* rich but each card carries one fact is texture, not overload.

**Values above labels; values larger than labels.** Reference card grammar. If the value renders smaller or dimmer than surrounding prose, hierarchy has failed.

**Three sizes do the work:** headline (serif, light, large), value (sans, medium, tabular), label (10px uppercase, tracked, muted). Mid-weight body between label and headline is where hierarchy dies.

---

## Glass and depth

Cards are **smoked glass slabs** resting on a darker surface — not floating UI panels, not crystal you can see through.

- **Graphite glass** — low transparency, warm ivory tint, heavy blur. You never see sharp detail through a card; only the suggestion of the room behind it.
- **Hairline borders** — visible only where light catches them. Warm ivory, never cold pure white.
- **Two depth levels only:** card → inset tray. Nested tiles sit *inside* cards one step darker, like a tray within a drawer. Never inset inside inset.
- **Depth from light**, not from exaggerated drop shadows. Contact shadow supports the object; rim light marks importance.

| Tone | Role |
|------|------|
| `default` | Standard surfaces; may carry rim |
| `elevated` | Rare modal-weight panels |
| `subtle` | Lists, secondary panels — never rim'd |
| `inset` | Nested content inside a card — darker recess |

---

## Spacing

Generous and even. Each card reads as its own object because gaps are wide enough to breathe.

- Base unit: 4px (Tailwind).
- Page padding: `px-5 sm:px-8 lg:px-10`.
- Card padding: deep — `sm` 16–20px · `md` 20–24px · `lg` 24–32px.
- Section gaps: `space-y-14`–`space-y-16` on HQ; portal stays editorial single column.
- Prefer spacing over borders. Prefer borders over shadows. Prefer light over color.

---

## Typography

| Role | Treatment |
|------|-----------|
| **Headline** | Cormorant, light, `text-3xl`+ — arrival and memory |
| **Value** | Geist Sans, medium, `tabular-nums`, foreground |
| **Label** | 10px uppercase, tracked — structure and quiet context |

**Serif** for page headlines, timeline moments, footer purpose lines. **Never serif** on buttons, table cells, or form labels.

Card titles favor one or two words: "Membership", "Timeline", "Morning Brief." Titles are big relative to their cards.

Tracking scale for 10px uppercase: **0.16 / 0.2 / 0.24 / 0.28em** — closed set. Do not invent new tracking values.

Eyebrows are signature but scarce. Where an eyebrow and a card title both exist, keep one.

---

## Color

Palette stays warm: char, ivory, champagne, bronze. No pure `#000` / `#fff`, no cyan, purple, or neon.

| Voice | Use |
|-------|-----|
| **Champagne (`--accent`)** | Material — rims, eyebrows, one CTA per region, focus rings. Not success, not warning. |
| **Green** | Active / confirmed / healthy — at most once per view |
| **Amber** | Attention / pending |
| **Red** | Problem |

Champagne gilds; it does not signal state. State speaks in three voices, each at most once per view.

Photography and home imagery render behind warm dark gradients — the interface stays foreground; photos are atmosphere, not wallpaper at full brightness.

---

## Motion

Motion vocabulary is small and purposeful:

- **Materialize** — hero surfaces settle into place (opacity, slight vertical shift, blur resolve).
- **Rise subtle** — list rows and secondary blocks rise gently.
- **Press** — buttons acknowledge touch with a controlled spring.

Cards **settle**; they do not bounce, spin, or perform. Rim light does not animate on entrance. Shimmer is for **loading states only** — never on settled content.

Stagger is capped: index × 0.06s; rows past ~8 appear instantly. Long inboxes must not become a two-second cascade.

Hover on cards: optional warmth transition — a surface catching light when you lean toward it. Not scaling up. Not glowing like a button.

---

## Interaction

- **One primary CTA per region** — champagne filled button. Everything else steps back to ghost links or quiet secondary buttons.
- **Row click as path** — where a list item opens a detail view, the row is the interface. Inline actions are rare and earned (one per row, hover-revealed on desktop, always visible on touch).
- **Read first, edit on intent** — steward surfaces show facts as label-over-value rows; forms appear only when editing. A workspace should not feel like a CRM record at rest.
- **Honest empty states** — teach what will appear and why. No fake metrics, no placeholder charts, no invented activity.

---

## What we reject

**Content sins:** fake data, decorative charts, gauges, sparklines, animated deltas, software jargon in customer copy ("scroll-driven").

**Visual sins:** rim on every card, animated border sweeps, icon docks, portal bento grids, equal-weight everything, compressed desktop tables on mobile.

**The AI-website trap:** everything glows, every card floats, particles drift, glass stacks on glass, gradients compete for attention. There should be very little going on. That is why it works.

**Feature creep disguised as design:** new metrics, new charts, new dashboard tiles — if it does not feed the timeline or answer a founder question, it does not ship.

---

## Review tests

Before shipping UI work, run:

1. **Notice test** — if someone comments on the design itself, pull back.
2. **Squint test** — one dominant lit surface per view.
3. **Grandma test** — purpose readable in 5–8 seconds without narration.
4. **Honesty test** — no invented data; empty states teach.
5. **Calm test** — nothing loops on settled pages; reduced-motion is equally premium.
6. **Mobile test** — 375px first; no horizontal scroll from craft layers.

---

## Operational principles (quick reference)

| Principle | Meaning |
|-----------|---------|
| **Calm over clever** | No bounce, no neon, no decorative motion |
| **Light over color** | Depth from lighting, not saturated fills |
| **Space over decoration** | Generous padding; one idea per surface |
| **Trust over excitement** | Honest empty states; no fake metrics |
| **One illuminated surface** | Exactly one rim per view |
| **One obvious path** | One primary action per region |

---

*Make HomeAtlas feel less like software and more like a quiet room for the home.*
