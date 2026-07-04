# visionOS — Design Philosophy Reference

**For HomeAtlas engineers and designers**  
**Scope:** Spatial and immersion **principles** for web — we are not building a Vision Pro app.

---

## Why visionOS Matters to HomeAtlas

visionOS treats the interface as **existing in space** — depth, focus, and ambient environment matter as much as buttons. HomeAtlas translates this to the web through:

- Layered boot sequences (foreground settles from background)
- Blur as focus metaphor
- Ambient fields that breathe
- Content that materializes rather than pops

We create **spatial feeling on flat glass** — the founder's monitor becomes a window into Headquarters, not a spreadsheet.

---

## Core Principles

### 1. Environment first

In visionOS, passthrough and lighting adapt before UI appears.

**HomeAtlas application:** `AmbientField` — grain, top glow, mouse-reactive radial light, bottom fog. HQ arrival starts with defocus (`backdrop-blur-md`) resolving to sharp UI.

### 2. Depth hierarchy

Windows float at different Z levels; focus brings front glass forward.

**HomeAtlas application:**
- `scale: 0.985 → 1` on materialize
- Shadow growth on focus-in
- `filter: blur(10px) → 0`
- Staggered children — cards arrive after header, not with it

### 3. Gaze-adjacent hover (pointer equivalent)

visionOS uses eye tracking; web uses cursor. Both need **generous hit areas and highlight feedback**.

**HomeAtlas application:** `CursorSurface` — 520px radial highlight follows pointer. Border mask glow. Subtle scale on hover — not lift.

### 4. Calm motion amplitude

visionOS animations are slow enough to perceive depth, fast enough to never block.

**HomeAtlas application:** HQ boot ~2.8s total choreography. Arrival ceremony ~6.8s with skip at 1.4s. `breathe` spring on ambient — 10–14s loops.

### 5. Typography in space

Text on visionOS uses weight and depth cues — floating titles feel anchored.

**HomeAtlas application:** `HeadlineReveal` per-word blur settle. Serif headlines large and light — they occupy space like floating titles.

---

## Translation Table (visionOS → Web)

| visionOS concept | HomeAtlas implementation |
|------------------|--------------------------|
| Passthrough | Dark canvas + ambient grain |
| Window material | `bg-surface/55 backdrop-blur-sm` |
| Depth focus | `materialize` variant |
| Environments | `AmbientFieldScoped` wrapper |
| Dismiss blur | Arrival overlay defocus → clear |

---

## Reduced Motion

visionOS offers Reduce Motion — spatial transitions simplify. HomeAtlas honors `prefers-reduced-motion` identically: skip ceremony, instant values, static shimmer.

Accessibility in spatial design is non-optional. Same here.

---

## What We Do Not Attempt on Web V1

- True stereoscopic depth or WebXR
- Eye tracking
- Volumetric 3D models as default chrome
- Spatial audio requirement (optional sound layer only)

---

## Key Takeaway

> *Depth is a story about attention — what is foreground, what is environment, what is settling into place.*

Headquarters unlock should feel like the room lights adjusting and the desk coming into focus — not like a page refresh.

---

*Implementation: `components/motion/ambient-field.tsx`, `headquarters-arrival-sequence.tsx`*
