# HomeAtlas Animation Language

**Status:** Production system (`lib/motion/`, `components/motion/`)  
**Playbook:** [MOTION_LANGUAGE.md](./MOTION_LANGUAGE.md) — **read this first** for timing rules and implementation checklist.  
**Philosophy:** Motion is engineering — not decoration, not "website animations."

---

## What Motion Communicates

Every transition on HomeAtlas must communicate at least one of:

- **Confidence** — nothing frantic, nothing apologetic
- **Precision** — measured timing, intentional stagger
- **Craftsmanship** — blur-to-sharp typography, glass materialization
- **Luxury** — calm, deliberate, never playful
- **Intention** — the interface knows what it is doing

If motion does not communicate one of these, remove it.

---

## What We Reject

| Banned | Why |
|--------|-----|
| Generic `fade-up 0.3s` | Reads as template SaaS |
| Bounce easing | Playful — wrong brand |
| Spinners | Anxiety — use shimmer skeletons |
| Everything at once | No hierarchy, no boot sequence |
| Linear CSS transitions on hero content | No weight, no physics |
| Parallax carnival | Cheap — we use subtle cursor-reactive glow only |

---

## Inspiration (Principles, Not Copies)

| Reference | What we take |
|-----------|--------------|
| **Apple Vision Pro** | Spatial depth, blur-to-focus, breathing ambient |
| **Linear** | Engineered springs, dark UI, staggered reveal |
| **Arc Browser** | Premium hover, border light, calm confidence |
| **Stripe Sessions** | Cinematic keynote pacing, count-ups, path draws |
| **Fable** | Product demo clarity — one focal point per beat |
| **Nothing OS** | Restrained glyph motion, monochrome calm |

Deep dives: `/reference/apple.md`, `linear.md`, `stripe.md`, `visionos.md`

---

## Architecture

```
lib/motion/
├── system.ts          # Springs, variants, easing
├── boot-sequence.ts   # HQ layer timing, greetings
├── sound-events.ts    # emitSound() — audio-ready hooks
└── index.ts

components/motion/
├── ambient-field.tsx       # Grain, glow, mouse-reactive light
├── boot-provider.tsx       # Session boot orchestration
├── boot-layer.tsx          # Layered entrance wrapper
├── cursor-surface.tsx      # Intelligent card hover
├── typography-reveal.tsx   # HeadlineReveal, LineReveal
├── count-value.tsx         # Numeric roll-up
├── typewriter-text.tsx     # Morning Brief typing
├── shimmer-block.tsx       # Loading skeletons
├── status-pulse.tsx        # Data refresh pulse + LuxuryButton
└── mission-reveal.tsx      # Sequential mission lines
```

---

## Physics

All motion uses **springs** — never raw linear easing on product surfaces.

Defined in `lib/motion/system.ts`:

| Spring | Stiffness / Damping | Use |
|--------|---------------------|-----|
| `glass` | 280 / 32 | Cards materializing |
| `settle` | 220 / 28 | Typography, navigation |
| `press` | 520 / 34 | Button tap release |
| `magnetic` | 180 / 22 | Hover attraction |
| `breathe` | 40 / 18 | Ambient background |
| `draw` | 120 / 24 | Chart path animation |

Engineered ease curve (when springs are not used): `[0.16, 1, 0.3, 1]`

---

## Materialize (Glass Into Focus)

Cards never plain-fade. Default hidden state:

```
opacity: 0
scale: 0.985
y: 10px
filter: blur(10px)
boxShadow: none
```

Visible state resolves to full opacity, scale 1, blur 0, soft shadow growth.

Variant: `materialize` in `system.ts`. Used by `BootLayer`, stat cards, sections.

---

## Boot Sequence (Headquarters)

The page **boots** — nothing appears simultaneously.

Layer timing (`HQ_BOOT_LAYERS` in `boot-sequence.ts`):

```
Ambient grain / glow
  ↓
Navigation + header (8px slide, fade)
  ↓
Time-aware greeting — blur → sharpen per word
  ↓
Morning Brief (typewriter insights)
  ↓
Stat cards (stagger + count-up)
  ↓
Charts (path draw)
  ↓
Google Reviews (status pulse on fresh data)
  ↓
Missions (line-by-line reveal)
  ↓
Footer settle
```

Total choreography ~2.8s. `HeadquartersArrivalSequence` plays on first PIN unlock per session (~6.8s cinematic intro with defocus → focus).

Session key: `squeegeeking:hq-session-booted` — cleared on lock.

---

## Typography Motion

**Headlines:** word-by-word `HeadlineReveal` — blur 14px → 0, slight Y, spring settle.

**Body:** `LineReveal` — paragraph-level, not word spam.

**Data:** `CountValue` — cubic ease-out roll from zero (currency-aware parsing).

**Brief:** `TypewriterText` — 14ms/char default, blinking caret in accent.

---

## Intelligent Hover (`CursorSurface`)

On pointer move within card bounds:
- Radial highlight tracks cursor (`520px` circle, accent at ~14% opacity)
- Border mask glow on hover
- Scale 1.002 on hover — magnetic spring

Not a generic lift shadow.

---

## Loading

| State | Treatment |
|-------|-----------|
| HQ data fetch | `HeadquartersLoadingShell` — shimmer blocks |
| Google Reviews | `ShimmerBlock` card skeleton |
| Cloud sync | Grain + shimmer bars — no text spinner |

CSS: `.motion-shimmer` sweep in `globals.css`

---

## Ambient Background

`AmbientField` layers:
1. **Grain** — SVG fractal noise, 4% opacity, slow opacity breathe
2. **Volumetric top glow** — radial accent ellipse, scale breathe 10s
3. **Mouse glow** — `--mouse-x/y` CSS variables, 640px radial follow
4. **Depth fog** — bottom vignette

Almost imperceptible individually. Together: the room has air.

---

## Signature Ceremonies

Beyond HQ boot, these are **product ceremonies** — full-screen, skippable, sound-ready:

| Ceremony | Route / trigger | Duration |
|----------|-----------------|----------|
| Membership Unlock | Stripe success → portal | ~11s full / ~5.6s fast |
| Request Plan Transition | `/request` submit | ~4.7s squeegee wipe |
| Headquarters Arrival | `/hq` unlock | ~6.8s |

Experience Lab previews: `/experience/*` (PIN-gated)

All ceremonies: Skip after 1.2–1.5s, honor `prefers-reduced-motion`.

---

## Sound-Ready Architecture

`emitSound(event)` dispatches `homeatlas:sound` CustomEvents:

| Event | Intended sound |
|-------|----------------|
| `surface.tap` | Soft click |
| `glass.focus` | Glass tap |
| `glass.tap` | Lighter contact |
| `boot.complete` | Subtle chime |
| `data.refresh` | Quiet notification |
| `status.pulse` | Single tone |

Audio layer subscribes via `onSound()` — no animation redesign required.

Membership unlock already uses Web Audio mechanical click (`lib/membership/unlock-sound.ts`).

---

## Reduced Motion

When `prefers-reduced-motion: reduce`:
- Boot completes immediately
- Ceremonies skip to content
- Shimmer static opacity
- Grain minimized
- Count-up shows final value instantly
- Typewriter shows full text

Never block access for animation.

---

## Adding Motion to New Surfaces

1. Check if a primitive exists in `components/motion/`.
2. If boot-layered, wrap in `BootLayer` with appropriate `HQ_BOOT_LAYERS` key (or define new layer in `boot-sequence.ts` for non-HQ surfaces).
3. Use springs from `system.ts` — do not invent new curves inline.
4. Emit sound events at completion boundaries if user-facing confirmation.
5. Update this doc if introducing a new ceremony or layer.

---

## Quality Bar

Ask before shipping:

> *Would this feel at home in an Apple keynote segment, a Linear changelog video, or a Stripe Sessions walkthrough?*

If it feels like a Tailwind tutorial, rework it.

---

*Implementation reference: commit `feat: add cinematic motion system for Headquarters` (July 2026).*
