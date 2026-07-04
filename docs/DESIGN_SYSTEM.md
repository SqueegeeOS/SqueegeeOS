# HomeAtlas Design System

**Status:** Production tokens + philosophy  
**Implementation:** `app/globals.css`, Tailwind v4 `@theme`, component conventions

---

## Design Intent

HomeAtlas and SqueegeeKing share one visual language: **dark luxury** — the feeling of a high-end watch brochure, a Vision Pro setup screen, or a Linear product page at midnight.

We optimize for:
- Generous negative space
- Cinematic serif headlines
- Restrained champagne accent (used sparingly)
- Surfaces that feel like glass and machined metal — not flat Bootstrap cards

We reject:
- Dense admin tables as default UI
- Bright primary blues and SaaS purple gradients
- Icon-heavy toolbars
- Equal-weight everything — hierarchy is mandatory

---

## Color

Defined in `:root` (`app/globals.css`):

| Token | Value | Role |
|-------|-------|------|
| `--background` | `#060606` | App canvas — near black, not pure `#000` |
| `--foreground` | `#f5f2eb` | Primary text — warm ivory |
| `--muted` | `#8a8680` | Secondary text, labels |
| `--accent` | `#c9b896` | Champagne gold — CTAs, eyebrows, focus |
| `--accent-soft` | `#c9b89633` | Selection, subtle fills |
| `--surface` | `#111111` | Card backgrounds |
| `--surface-elevated` | `#161616` | Raised panels |
| `--border` | `#ffffff12` | Hairline borders — 7% white |

### Usage

- **Background** never competes with content. Ambient gradients sit at 6–8% accent opacity max.
- **Accent** marks importance — one primary CTA per viewport region.
- **Muted** carries eyebrows (`text-[10px] uppercase tracking-[0.28em]`).
- Never use accent for body paragraphs.

---

## Typography

| Role | Font | Tailwind / CSS |
|------|------|----------------|
| UI & body | Geist Sans | `font-sans`, `--font-geist-sans` |
| Display & headlines | Cormorant | `font-serif`, `--font-cormorant` |
| Code & IDs | Geist Mono | `font-mono`, Place IDs, SQL snippets |

### Scale (headquarters & plans)

| Element | Classes |
|---------|---------|
| Page title | `font-serif text-4xl sm:text-6xl font-light leading-[1.05]` |
| Section title | `font-serif text-2xl sm:text-3xl font-light` |
| Card metric | `font-serif text-4xl sm:text-5xl font-light tracking-tight` |
| Eyebrow | `text-[10px] uppercase tracking-[0.28em]` |
| Body | `text-sm sm:text-base leading-relaxed text-muted` |

Headlines use **light** weight — never bold serif shouting.

Letter-spacing on uppercase labels: `0.22em`–`0.32em` depending on hierarchy.

---

## Spacing

Base unit: **4px** (Tailwind default). Prefer multiples of 4.

| Context | Pattern |
|---------|---------|
| Page horizontal padding | `px-5 sm:px-8 lg:px-10` |
| Section vertical rhythm | `mt-10`, `mt-14` between major blocks |
| Card padding | `p-6 sm:p-8` (large), `px-5 py-5` (compact) |
| Touch targets | Minimum **52px** height on mobile CTAs |
| Nav height | `--site-nav-height: 3.5rem` |

**Rule:** When unsure, add space. Luxury is partly absence.

---

## Radius

| Token | Value | Use |
|-------|-------|-----|
| Small control | `rounded-full` | Pills, buttons, badges |
| Card | `rounded-[1.75rem]` – `rounded-[2rem]` | Primary surfaces |
| Inner panel | `rounded-[1.35rem]` – `rounded-[1.5rem]` | Nested cards |
| Input | `rounded-2xl` | Form fields |

Avoid `rounded-md` on marketing surfaces — it reads generic.

---

## Shadows & Depth

Shadows are **subtle and directional** — not Material Design elevation steps.

| Pattern | Example |
|---------|---------|
| Stat card | `shadow-[0_24px_48px_-32px_rgba(0,0,0,0.5)]` |
| Materialize (motion) | `0 24px 48px -24px rgba(0,0,0,0.45)` on focus-in |
| Hover | Border illumination + radial cursor highlight — see [ANIMATIONS.md](./ANIMATIONS.md) |

Glass effect stack:
1. `bg-surface/55` or `/80`
2. `backdrop-blur-sm` where appropriate
3. `border border-border/80`
4. Optional gradient: `bg-gradient-to-br from-accent/[0.07] via-surface/70 to-background/30`

---

## Borders

Default: `border-border` or `border-border/80` — hairline, low contrast.

Accent borders (`border-accent/20`–`/30`) only for featured cards (Current Mission, primary CTA containers).

Status colors:
- Live / success: `border-accent/30 text-accent`
- Warning: `border-amber-500/30`, `text-amber-700` / `900`
- Neutral badge: `border-border text-muted/70`

---

## Component Philosophy

### Cards (`CursorSurface`)

Interactive cards use intelligent hover — radial highlight follows cursor, border glow, 0.2% scale — not naive `translateY(-4px)`.

Implementation: `components/motion/cursor-surface.tsx`

### Sections (`AdminSection`, plan sections)

Structure:
1. Eyebrow (category)
2. Serif title
3. Optional description (muted, max-width constrained)
4. Content with internal spacing

### Buttons

Primary: `rounded-full border border-accent/30 bg-accent/[0.12] text-accent` with uppercase tracking.

Secondary: `rounded-full border border-border text-muted hover:border-accent/30 hover:text-accent`

Press behavior: spring scale via `LuxuryButton` — never instant color swap only.

### Forms

Inputs: `rounded-2xl border border-border bg-background px-4 py-3.5` — full width, calm focus states (future: illuminate + label animation per motion spec).

### Loading

**No spinners.** Use `ShimmerBlock` — animated gradient sweep on surface skeleton.

### Data display

Metrics use **CountValue** roll-up for numbers. Charts draw paths — they do not pop in fully rendered.

---

## Layout Patterns

| Surface | Max width | Notes |
|---------|-----------|-------|
| Headquarters | `max-w-7xl` | Two-column with sticky sidebar on XL |
| Home Care Plan | Full bleed sections | Mobile CTA bar on small screens |
| Setup wizard | `max-w-3xl` | Single column, step indicator |
| Experience Lab | `max-w-4xl` | Preview cards |

Sticky sidebar: `xl:sticky xl:top-10` — founder cockpit pattern.

---

## Iconography

Minimal. Prefer typography and whitespace over icon grids. External links use `↗`; internal use `→`.

When icons are needed, they should be thin-stroke, monochromatic, muted until hover.

---

## Accessibility

- `prefers-reduced-motion`: disable ceremony, shorten transitions, static shimmer opacity.
- Semantic headings — one `h1` per page.
- PIN gates and modals: `role="dialog"`, `aria-modal`, live regions for status.
- Color contrast: ivory on `#060606` meets WCAG for body; amber warnings checked for small text.

---

## Anti-Patterns

| Avoid | Instead |
|-------|---------|
| `animate-bounce` | Spring settle |
| `transition-all duration-300` on everything | Named motion primitives |
| Pure `#fff` text | `--foreground` warm ivory |
| 12-column dense grids | Spacious 2–3 column with breathing room |
| Generic "Dashboard" title | Named surfaces (Headquarters, Property Hub) |

---

## Reference Implementation

| Surface | File |
|---------|------|
| Headquarters | `components/admin/admin-command-center.tsx` |
| Home Care Plan | `components/home-care-plan/experience.tsx` |
| Member portal | `components/membership/member-portal-experience.tsx` |
| Tokens | `app/globals.css` |

External inspiration analysis: `/reference/*.md`

---

*Design changes that alter tokens or component contracts must update this document.*
