# HomeAtlas Motion Language

**Status:** Canonical playbook — all motion follows this document.  
**Implementation:** `lib/motion/`, `components/motion/`  
**Deep reference:** [ANIMATIONS.md](./ANIMATIONS.md) (architecture, ceremonies, file map)

Every engineer and every AI agent implements motion from this playbook. If a animation is not described here or in the motion system code, it does not ship.

---

## Purpose

Motion on HomeAtlas is not decoration. It communicates **hierarchy**, **state**, and **craft**. Users should feel that the interface is engineered — calm, precise, and intentional — like Apple Vision Pro setup, a Linear panel opening, or a Stripe Sessions reveal.

Motion answers three questions:

1. **Where did this come from?** (origin / depth)
2. **What changed?** (state)
3. **What matters now?** (hierarchy)

If an animation answers none of these, remove it.

---

## Golden Rules

| Rule | Standard |
|------|----------|
| **Minimum duration** | No animation under **120 ms** unless it is a defined micro-interaction |
| **Page transitions** | **300–450 ms** with spring easing — never linear |
| **Card entrance** | Cards **rise from the canvas** (scale + Y + shadow) — never fade-only |
| **Blur** | Indicates **depth and focus** — not decoration |
| **Hover scale** | **1.01–1.02** — never exaggerated zoom |
| **Success** | Celebrate **briefly**, then **get out of the way** |
| **Hierarchy** | Motion shows what is foreground, background, and settling |

---

## Timing Scale

Use these durations. Do not invent arbitrary values.

| Category | Duration | When |
|----------|----------|------|
| **Micro-interaction** | 80–120 ms | Button press down, toggle snap, ripple start |
| **Micro release** | 120–180 ms | Button spring back, input focus ring |
| **Component transition** | 200–350 ms | Card hover settle, dropdown open, tab switch |
| **Page / section transition** | 300–450 ms | Route feel, modal present, section boot layer |
| **Ceremony beat** | 600–1200 ms | Single keynote moment (one message) |
| **Full ceremony** | 4–12 s | Unlock sequence, HQ arrival — skippable |
| **Ambient loop** | 8–14 s | Grain breathe, glow pulse — almost imperceptible |

**Hard floor:** 120 ms minimum for anything the user perceives as a "transition." Below that is micro-interaction territory only.

**Hard ceiling for blocking UI:** No mandatory animation over 12 s. Skip available by 1.2–1.5 s on ceremonies.

---

## Easing & Physics

### Default: springs, not curves

Product surfaces use **spring physics** from `lib/motion/system.ts`:

| Token | Use |
|-------|-----|
| `spring.glass` | Cards materializing, surfaces rising |
| `spring.settle` | Typography, navigation, content landing |
| `spring.press` | Button tap and release |
| `spring.magnetic` | Hover attraction |
| `spring.breathe` | Ambient background |
| `spring.draw` | Chart paths, stroke reveals |

When a fixed duration is required (page transition band), use **`easeEngineered`**: cubic-bezier `[0.16, 1, 0.3, 1]`.

### Banned

- `ease-in-out` on hero or card content
- `bounce`, `elastic`, playful overshoot
- `linear` on anything user-facing except shimmer sweep progress
- Generic `transition-all duration-300`

---

## Cards Rise From the Canvas

**Cards never plain-fade.** A fade without spatial change reads as cheap SaaS.

### Required entrance (`materialize` variant)

```
hidden:
  opacity: 0
  scale: 0.985
  y: 10px
  filter: blur(10px)
  box-shadow: none

visible:
  opacity: 1
  scale: 1
  y: 0
  filter: blur(0px)
  box-shadow: soft growth (0 24px 48px -24px rgba(0,0,0,0.45))
  transition: spring.glass
```

The card **rises** — it comes forward from the canvas into focus. Shadow growth sells depth. Blur reduction sells focus.

### Stagger

When multiple cards appear, stagger **70–75 ms** per index. Never simultaneous pop-in for a grid.

Use `BootLayer`, `materialize`, or `staggerDepth` — do not hand-roll delays per component.

---

## Blur Means Depth

Blur is a **focus mechanic**, not atmosphere slapped on for fashion.

| Blur amount | Meaning |
|-------------|---------|
| **12–14px** | Far plane — headline words not yet in focus |
| **8–10px** | Mid plane — card entering, de-focused overlay |
| **4–6px** | Near plane — navigation sliding into lock |
| **0px** | Foreground — current attention target |

**Rules:**

- Blur **decreases** as elements come forward (sharp = here now).
- Do not blur body text for readability drama.
- Do not animate blur on large full-screen areas except **defocus → focus** overlays (HQ arrival).
- Reduced motion: blur jumps to 0 — opacity-only or instant.

---

## Hover States

Hover confirms **interactivity** and **quality** — not excitement.

| Property | Range | Notes |
|----------|-------|-------|
| **Scale** | **1.01–1.02** | `CursorSurface` uses ~1.002 default; cards may reach 1.015 on magnetic hover |
| **Shadow** | Slight growth | Never drop-shadow explosion |
| **Border** | Radial illumination at cursor | `CursorSurface` highlight |
| **Duration** | 200–350 ms spring | No instant snap |

**Never:**

- Scale above **1.03** on data cards
- `translateY(-8px)` lift as the only hover effect
- Rotate, skew, or bounce on hover

---

## Micro-Interactions (Under 120 ms)

These are the **only** exceptions to the 120 ms floor:

| Interaction | Target | Implementation |
|-------------|--------|----------------|
| Button press down | 80–100 ms | `scale: 0.97`, `y: 1px` — `LuxuryButton` |
| Toggle snap | 100–120 ms | Spring press |
| Ripple origin | 80 ms | Expand from pointer — accent at low opacity |
| Caret blink | 1100 ms cycle | Typewriter — not a transition |

Press **down** is fast. **Release** is spring-settle (120–180 ms).

---

## Page & Section Transitions (300–450 ms)

When the user moves between major contexts — modal open, section boot layer, route-level feel:

- **Duration band:** 300–450 ms perceived settle time
- **Easing:** `spring.settle` or `easeEngineered`
- **Pattern:** outgoing softens (opacity down, slight scale down); incoming rises from canvas
- **Navigation slide:** 8px horizontal + fade — not 40px dramatic slide

HQ boot layers use choreographed delays ([ANIMATIONS.md](./ANIMATIONS.md)); each **individual layer transition** still obeys the 300–450 ms settle band.

---

## State Change Motion

Motion must show **what changed**:

| State change | Motion language |
|--------------|-----------------|
| Loading → loaded | Shimmer → materialize rise — **no spinner** |
| Empty → has data | First card rises; count-up for numbers |
| Stale → fresh data | `StatusPulse` — single soft ring, 1.8 s decay |
| Closed → open | Section expands with spring; blur background overlay |
| Error | Amber border fade-in 200 ms — no shake animation |
| Success | See below |

Users should replay the transition in their mind and understand the new state.

---

## Success Animations

Success is **acknowledged, not celebrated forever**.

| Phase | Duration | Behavior |
|-------|----------|----------|
| **Peak** | 400–800 ms | Pulse, check draw, or count complete |
| **Hold** | 0 ms | Do not linger on triumph |
| **Exit** | 300–450 ms | Return to neutral UI — success chrome fades |

Examples:

- **Membership unlock:** ceremony plays once, then handoff to portal — no looping trophy
- **Job logged:** stat count-up + brief pulse on affected card — then static
- **Place ID confirmed:** inline confirmation copy — no confetti

**Never:** confetti, bounce checkmarks, green fullscreen flashes, looping success badges.

---

## Hierarchy & Boot Order

Nothing appears all at once. Order communicates importance:

```
1. Environment (grain, ambient glow)
2. Chrome (navigation, header)
3. Primary message (greeting, headline)
4. Supporting content (brief, subtitle)
5. Data surfaces (cards, charts)
6. Secondary actions (footer, links)
```

Headquarters timing: `HQ_BOOT_LAYERS` in `lib/motion/boot-sequence.ts`.

When adding a new surface, assign a boot layer — do not mount everything in one `useEffect`.

---

## Typography Motion

| Element | Treatment |
|---------|-----------|
| **Headline** | Word-by-word blur → sharpen (`HeadlineReveal`) |
| **Body line** | Line reveal — not word spam |
| **Metric** | Count-up roll — 1.2–1.6 s after card visible |
| **Brief insight** | Typewriter — ~14 ms/char, accent caret |

Headlines **settle**, they do not fly in from off-screen.

---

## Loading

| ✅ Do | ❌ Don't |
|-------|---------|
| Shimmer skeleton blocks | Spinners |
| Progressive reveal | Blank white flash |
| Chart path draw from zero | Pop-in fully rendered chart |
| `HeadquartersLoadingShell` | "Loading…" text alone |

---

## Ceremonies vs. UI Motion

| Type | Skippable | Sound | Example |
|------|-----------|-------|---------|
| **UI motion** | N/A | Optional micro | Card hover, boot layer |
| **Ceremony** | Yes after 1.2 s | `emitSound()` ready | Unlock, HQ arrival, squeegee wipe |

Ceremonies follow keynote pacing — one beat per message. UI motion stays in the timing scale above.

---

## Reduced Motion

When `prefers-reduced-motion: reduce`:

- Durations → 0 or ≤ 150 ms
- Ceremonies skip to end state
- Blur → 0
- Count-up shows final value instantly
- Ambient loops static
- Hover scale disabled

Accessibility is non-negotiable.

---

## Sound-Ready

UI motion emits events via `emitSound()` (`lib/motion/sound-events.ts`) at completion boundaries. Audio is optional; hooks are mandatory for ceremonies and confirmations.

Do not add sound-only feedback without a visual state change.

---

## Implementation Checklist

Before shipping motion:

- [ ] Uses `lib/motion/system.ts` springs or approved duration band
- [ ] Duration ≥ 120 ms OR registered micro-interaction
- [ ] Cards use `materialize` / `BootLayer` — not opacity-only
- [ ] Blur encodes depth — decorative blur removed
- [ ] Hover scale ≤ 1.02
- [ ] Success animation exits within 450 ms after peak
- [ ] State change is understandable without sound
- [ ] `prefers-reduced-motion` tested
- [ ] No bounce, no spinner, no generic fade-up

---

## Code Entry Points

| Need | Use |
|------|-----|
| Card / surface | `BootLayer`, `CursorSurface`, `materialize` |
| Headline | `HeadlineReveal` |
| Body | `LineReveal` |
| Number | `CountValue` |
| Loading | `ShimmerBlock` |
| Button | `LuxuryButton` |
| Fresh data | `StatusPulse` |
| HQ orchestration | `BootProvider`, `HQ_BOOT_LAYERS` |

**Do not** copy easing arrays into random components.

---

## Related Documents

| Doc | Role |
|-----|------|
| [ANIMATIONS.md](./ANIMATIONS.md) | Architecture, ceremonies, ambient field |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | Visual tokens alongside motion |
| [ENGINEERING_BIBLE.md](./ENGINEERING_BIBLE.md) | Constitution — motion as engineering |
| `/reference/apple.md`, `linear.md`, `visionos.md` | External philosophy |

---

*This is the playbook. [ANIMATIONS.md](./ANIMATIONS.md) is the atlas. The code in `lib/motion/` is the instrument.*
