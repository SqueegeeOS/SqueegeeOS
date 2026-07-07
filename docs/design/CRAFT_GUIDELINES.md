# HomeAtlas Craft Guidelines

**Status:** Implementation reference for engineers  
**Philosophy:** [DESIGN_LANGUAGE.md](./DESIGN_LANGUAGE.md)  
**Authority:** [HOMEATLAS_UI_RENAISSANCE_BRIEF.md](./HOMEATLAS_UI_RENAISSANCE_BRIEF.md)  
**Tokens:** [../DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md)

Read this before adding or restyling UI. Use the existing craft layer — **do not invent parallel class names.**

> **If someone notices the design, we've probably gone too far.**

---

## Before you add anything

| Temptation | Ask first |
|------------|-----------|
| Another border | Can spacing solve this instead? |
| Another shadow | Can light solve this instead? |
| Another animation | Does the eye need help understanding where this came from? |
| Another glass layer | Is this card doing too much? (Max depth: card → inset) |
| Another rim / glow | Is there already a hero on this view? |
| Another 10px label style | Does an existing token already cover this? |

Remove before adding. Restraint reads as expensive; effects read as software.

---

## File map

| Concern | Location |
|---------|----------|
| CSS variables, glass, rim, grain | `app/globals.css` |
| Class recipes (Tailwind strings) | `lib/craft/tokens.ts` |
| Card primitive | `components/craft/glass-card.tsx` |
| Stage wrapper | `components/craft/ambient-stage.tsx` |
| Rim pointer tracking | `components/craft/use-rim-pointer.ts` |
| Motion variants & springs | `lib/motion/system.ts` |
| Cursor spotlight | `components/motion/cursor-spotlight.tsx` |
| Loading shimmer | `components/motion/shimmer-block.tsx` |
| Page reveal wrapper | `components/craft/motion-reveal.tsx` |

Do not duplicate craft CSS in component files. Extend tokens or globals.

---

## Stage setup

Every operator and customer craft surface mounts `AmbientStage`:

```tsx
import { AmbientStage } from "@/components/craft/ambient-stage";

export function MyPage() {
  return (
    <AmbientStage className="px-4 py-10 sm:px-6 sm:py-12">
      {/* content */}
    </AmbientStage>
  );
}
```

`AmbientStage` automatically renders:

1. `.craft-stage-warmth` — top-down champagne wash (when `warm={true}`, default)
2. `.motion-grain` — film grain at opacity **0.028**
3. Optional founding wash (`founding={true}`) — portal founding members only

**Do not hand-roll** `craft-stage` divs. Swap legacy wrappers to `AmbientStage` when touching a page.

### Stage warmth (exact)

From `app/globals.css`:

```css
.craft-stage-warmth {
  background:
    radial-gradient(ellipse 90% 55% at 50% -14%, rgba(201, 184, 150, 0.09), transparent 62%),
    radial-gradient(ellipse 60% 40% at 100% 0%, rgba(168, 152, 120, 0.04), transparent 55%),
    radial-gradient(ellipse 50% 35% at 0% 100%, rgba(120, 110, 95, 0.05), transparent 50%);
}
```

Light is brightest at the top. Do not add competing radial gradients on the same page.

---

## Glass treatments

### CSS classes

| Class | Shadow token | Use |
|-------|--------------|-----|
| `.craft-glass` | `--shadow-float` | Standard cards; may carry rim |
| `.craft-glass-elevated` | `--shadow-lift` | Rare modal-weight panels |
| `.craft-glass-subtle` | `--shadow-ambient` | Lists, secondary panels — **never rim'd** |
| `.craft-glass-inset` | none | Nested tray inside a card only |

Glass borders use warm ivory `rgba(255, 248, 235, …)` — never pure white hairlines.

Inset has **no** `backdrop-filter` and **no** shadow. It is a recess, not a floating card.

### `GlassCard` API

```tsx
<GlassCard
  as="div" | "section" | "article"
  tone="default" | "elevated" | "subtle" | "inset"
  rim={false}                    // true only on assigned hero surfaces
  motion="none" | "materialize" | "rise"
  padding="none" | "sm" | "md" | "lg"
  index={0}                      // stagger delay: index × 0.06s
  className=""
>
  {children}
</GlassCard>
```

### Glass rules

1. **`rim` requires `tone="default"` or `"elevated"`** — never `subtle` or `inset`.
2. **`tone="inset"`** — parent must be a glass card. No rim. No top-level use.
3. **One `.craft-rim` per rendered view** — see rim budget below.
4. **Two depth levels max:** card → inset. If you need a third level, split the card.
5. Prefer `GlassCard` over raw `craft-glass` classes on new work.

### Token shortcuts

```ts
import {
  craftGlassSurface,    // default + radius + float shadow
  craftGlassElevated,   // elevated + lg radius + lift shadow
  craftGlassInset,      // inset tray only
} from "@/lib/craft/tokens";
```

### Padding scale

| Token | Size |
|-------|------|
| `none` | 0 |
| `sm` | 16–20px (`p-4 sm:p-5`) |
| `md` | 20–24px (`p-5 sm:p-6`) — default |
| `lg` | 24–32px (`p-6 sm:p-8`) |

---

## Rim lighting

### What it is

A 1px champagne conic gradient on one edge of the hero card — sunlight catching smoked glass. Static on entrance. Not a neon outline.

### CSS (do not drift)

```css
.craft-rim::before {
  /* from 210deg at var(--rim-x, 18%) var(--rim-y, 0%) */
  /* peak alpha: 0.55 — never higher */
  /* padding: 1px ring */
  /* transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1) */
}
```

Resting origin is always **`--rim-x: 18%`, `--rim-y: 0%`** — upper center-left, matching the one lamp. Do not vary resting origin per page.

### React usage

```tsx
<GlassCard rim tone="default">
  {/* hero content — one title, one value */}
</GlassCard>
```

`useRimPointer` (in `glass-card.tsx` when `rim={true}`):

- Damping: **0.08** per frame
- Idle loop sleeps when |Δ| < **0.1%**
- Disabled when `prefers-reduced-motion` or `(pointer: coarse)`

### Rim budget (assigned — do not add without brief update)

| View | Hero surface | File |
|------|--------------|------|
| HQ overview | Morning Brief | `components/admin/morning-brief.tsx` |
| Homepage | Membership tier card | `components/marketing/sections/membership-section.tsx` |
| Member portal | Wallet / membership card | `components/membership/member-portal-experience.tsx` |
| Customer workspace | Timeline section | `components/admin/customer-workspace-page.tsx` |
| Requests inbox | **None** | — |

Verify in browser: `document.querySelectorAll('.craft-rim').length === 1` (or 0 on inbox).

---

## Cursor light

### Where it mounts

`CursorSpotlightPage intensity="whisper"` only on:

- `components/marketing/scroll-cinema-landing.tsx` (homepage)
- `components/admin/admin-command-center.tsx` (HQ overview)

**Never mount** on portal, inbox, workspace, or mobile-first flows.

### Whisper values (locked for settled pages)

| Property | Value |
|----------|-------|
| Core alpha | 0.028 |
| Halo alpha | 0.014 |
| Radius | 520px |
| Spring | stiffness 38, damping 24, mass 1.4 |

Higher intensities (`subtle`, `medium`, `bright`) are reserved for presentation moments — not HQ overview or homepage at rest.

### Guards (do not remove)

`cursor-spotlight.tsx` disables when:

- `(pointer: fine)` is false
- `navigator.connection.saveData`
- `hardwareConcurrency ≤ 4`
- `prefers-reduced-motion`

### Double-glow rule

HQ overview uses `AmbientStage` + whisper spotlight only. **Do not stack** `AmbientFieldScoped` pointer layers on the same page — if warmth reads too bright, remove the competing layer, don't add more light elsewhere.

Portal gets stage warmth alone. No cursor spotlight by design.

---

## Typography tokens

**Use tokens.** Do not copy-paste inline 10px tracking strings.

| Token | Tracking | Use |
|-------|----------|-----|
| `craftEyebrow` | 0.28em | Section/card openers (muted) |
| `craftEyebrowAccent` | 0.28em | Stage/state context (accent) |
| `craftLabel` | 0.24em | Form labels above inputs |
| `craftFieldLabel` | 0.16em | Read-only label-over-value rows |
| `craftTableHead` | 0.20em | `<th>` typography only |
| `craftValue` | — | Metrics, dates, prices (`tabular-nums`) |
| `craftHeading` | — | Serif section titles |
| `craftBody` | — | Supporting prose |

**Closed tracking set for 10px uppercase:** 0.16 / 0.2 / 0.24 / 0.28em only.

`craftTableHead` is typography only — table borders and row backgrounds stay per-table.

Values must never render smaller or dimmer than surrounding prose.

---

## Buttons and inputs

| Token | Use |
|-------|-----|
| `craftPrimaryButton` | One filled champagne CTA per region |
| `craftSecondaryButton` | Secondary actions — quiet, bordered |
| `craftGhostLink` | Tertiary / inline text actions |
| `craftInput` | Text fields, search |
| `craftTextarea` | Multi-line fields |

Primary button minimum height: **52px**. Secondary: **48px**. These satisfy touch target requirements.

One primary CTA per viewport region. Demote extras to `craftGhostLink`.

---

## Motion

### Variants (`lib/motion/system.ts`)

| Variant | Use | Notes |
|---------|-----|-------|
| `materialize` | Hero surfaces | opacity + y:8 + blur:6 → settle |
| `riseSubtle` | Lists, rows, dense grids | opacity + y:6 |
| `pageEnter` | HQ scoreboard metrics | — |

`GlassCard` maps `motion="rise"` → `riseSubtle`, `motion="materialize"` → `materialize`.

### Stagger

```ts
const delay = reduceMotion ? 0 : index * 0.06;
```

Cap list stagger at **index 8** — rows beyond appear instantly:

```ts
const delay = reduceMotion ? 0 : Math.min(index, 8) * 0.06;
```

### Easing

Default engineered ease: **`cubic-bezier(0.16, 1, 0.3, 1)`** (`easeEngineered` in motion system).

### Forbidden on settled content

- Shimmer loops on loaded UI
- Rim rotation or animated border sweeps
- Pulse on static cards
- Bounce, spin, or decorative entrance

### Loading only

```tsx
import { ShimmerBlock } from "@/components/motion/shimmer-block";

<ShimmerBlock className="h-5 w-40 rounded-full" />
```

Use shimmer shells that match the shape of the content they replace — not bare "Loading…" text.

Every motion path ships with a `useReducedMotion()` branch.

---

## Hover behavior

| Element | Behavior |
|---------|----------|
| Rim cards | `::before` opacity transition 300ms — no scale on rim heroes |
| Primary/secondary buttons | Opacity + `active:scale-[0.985]` press |
| Ghost links | Color transition to accent only |
| Inbox rows | Background `hover:bg-surface/20`; inline action revealed via `group-hover` on desktop |

Do not add hover glow that reads as a second light source. Scale on cards: **≤ 1.01** if used at all.

### Desktop-only hover reveal pattern

For actions that should always show on touch but hide on desktop until hover:

```tsx
className="max-sm:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
```

Parent row needs `group` class.

---

## Shadows

CSS variables in `:root`:

| Token | Role |
|-------|------|
| `--shadow-ambient` | Subtle cards — contact only |
| `--shadow-float` | Default glass |
| `--shadow-lift` | Elevated glass |

Shadows support contact with the surface. They do **not** replace rim light for hierarchy. Before adding a shadow, ask if light can solve it instead.

---

## Borders

| Surface | Border |
|---------|--------|
| Default glass | `rgba(255, 248, 235, 0.08)` |
| Elevated glass | `0.10` |
| Subtle glass | `0.05` |
| Inset | `0.04` |
| Row dividers | `border-border/20` |
| Section dividers (HQ) | `border-border/15`–`/20` |

Hairlines only. No 2px decorative borders. Prefer spacing over borders.

---

## Accessibility

- **Touch targets:** 44px minimum on interactive controls (`min-h-[44px]` or button tokens above).
- **Rim and spotlight are decorative** — meaning must not depend on them.
- **Section landmarks:** `aria-labelledby` on major sections (e.g. Morning Brief).
- **Semantic tables:** `<th>` remains `<th>` after `craftTableHead` styling.
- **Loading:** shimmer containers include `sr-only` status text.
- **Keyboard rows:** clickable rows need `role="button"`, `tabIndex={0}`, Enter/Space handlers.
- **Reduced motion:** full static premium fallback — see below.

---

## Reduced motion

When `prefers-reduced-motion: reduce`:

| Layer | Behavior |
|-------|----------|
| Glass (`default`, `elevated`, `subtle`) | `backdrop-filter: none` |
| Inset | Darker solid gradient fallback |
| Rim `::before` | Static opacity **0.65**, no transition, origin frozen at 18%/0% |
| Grain | Opacity **0.02** |
| Shimmer | Animation off |
| `GlassCard` motion | Instant, no stagger |
| Cursor spotlight | Not mounted |
| Rim pointer | Disabled |

Reduced-motion users must receive a **complete, equally premium** static page — not a degraded one.

---

## Surface-specific notes

### HQ overview

- `AmbientStage` + `CursorSpotlightPage intensity="whisper"`
- Morning Brief: only rim on page
- Ledger table: legitimate table — keep, use `subtle` card + `craftTableHead` on headers

### Requests inbox

- No rim, no spotlight
- Row list inside one `GlassCard tone="subtle" padding="none"`
- Two-line rows; phone/email in workspace only
- One inline action max (Schedule presentation for new leads)

### Member portal

- `AmbientStage` only — no cursor spotlight
- Wallet card: rim hero
- Editorial single column — do not bento

### Customer workspace

- Timeline: rim hero
- Contact/Property: read-first with edit toggle (Pass 3c)
- Swap hand-rolled stage divs to `AmbientStage` when touching

---

## Pass roadmap

| Pass | Scope | Status |
|------|-------|--------|
| **3a** | Light system — rim, inset, tokens, HQ spotlight | ✅ Shipped |
| **3b** | Requests inbox — row list, shimmer loading | ✅ Local |
| **3c** | Customer workspace — layout, read-first fields | Pending |
| **3d** | Portal polish, homepage copy, nav restyle | Pending |

Do not skip ahead. Each pass is independently mergeable and browser-verifiable at desktop + 375px + reduced motion.

Detail: [PASS_3A_IMPLEMENTATION_PLAN.md](./PASS_3A_IMPLEMENTATION_PLAN.md)

---

## Pre-ship checklist

- [ ] At most one `.craft-rim` in the DOM per view
- [ ] No new 10px tracking values outside 0.16 / 0.2 / 0.24 / 0.28em
- [ ] No fake metrics or decorative charts added
- [ ] No shimmer on settled content
- [ ] `prefers-reduced-motion` branch present for new motion
- [ ] `npm run build` clean
- [ ] 375px — no horizontal scroll from craft layers
- [ ] Notice / Squint / Grandma / Honesty / Calm tests ([DESIGN_LANGUAGE.md](./DESIGN_LANGUAGE.md))

---

## Adding new UI — decision flow

```
New surface needed?
  ├─ Can it live inside an existing GlassCard? → inset or subtle
  ├─ Does this view already have a rim hero? → no second rim
  ├─ Does it need motion? → materialize (hero) or riseSubtle (list)
  ├─ Does it need loading state? → ShimmerBlock matching content shape
  ├─ Is it a table? → justify: only ledger-style founder decisions qualify
  └─ Still adding a border/shadow? → spacing/light first, then ship
```

When in doubt, remove one element and check if the page still works. It usually does.
