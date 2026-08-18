# THE HOME THAT REMEMBERS — 15s vertical ad

**Client surfaces:** SqueegeeKing (marketing) × HomeAtlas (member portal)
**Formats:** 1080×1920 master (9:16), 1080×1350 feed (4:5), matching posters
**Frame rate:** 30 fps · 450 frames
**Tone:** warm, premium, neighborly, Northern California. Forest pine `#173f32`, bronze `#99683d`, champagne `#c9b896`, cream `#f5f0e6`. Cormorant Garamond serif + Geist / Geist Mono — identical to the production site.

---

## Act 1 — 0.0–2.2s (frames 0–66) · "The hook"

**Visual:** Warm residential exterior — native 9:16 Higgsfield hero clip
(craftsman home under oaks, golden morning light) full-bleed, slow settle
from 1.05× scale. Cream gradient floor rises from the bottom.
**Type:**
- Eyebrow (Geist Mono, tracked caps): `SQUEEGEEKING · CHICO, CALIFORNIA`
- Headline (Cormorant, pine): **"Your home shouldn't have to explain itself *twice.*"** — "twice." in italic bronze.

## Act 2 — 2.2–7.5s (frames 66–225) · "The memory"

**Visual:** Dark HomeAtlas portal stage (`#070605`, champagne radial warmth).
A deterministic DOM phone (no imagery, no AI) cycles four real portal screens,
each rebuilt 1:1 from production components with sample data only:

| Screen | Source component | Sample data |
|---|---|---|
| Next Visit | `components/portal/next-care-visit-hero.tsx` | Oct 14 · Exterior window detail · Solar rinse |
| Visit History | portal visit ledger pattern | Jul 18 / Apr 12 / Jan 9 |
| Photo Proof | portal documentation pattern | brand footage stills, "After · Jul 18" chips |
| Home Care Plan | membership cadence pattern | Windows q3mo · Solar q6mo · Pressure each spring |

Screen name (Cormorant) crossfades above the phone: Next Visit → Visit History → Photo Proof → Home Care Plan.
**Caption (bottom, cream serif):** "Every visit. Every photo. Every promise."
**Eyebrow:** `HOMEATLAS · INCLUDED WITH MEMBERSHIP`

## Act 3 — 7.5–11.8s (frames 225–354) · "The work"

**Visual:** Fast montage, ~1.4s per clip, scale-drift push, cream flash cuts.
House continuity governs every slot (see CONTINUITY.md):
1. Deterministic push-in on the master house toward its front windows —
   chip `WINDOWS`
2. `hour-pressure.mp4` — water-on-stone service detail, no architecture —
   chip `PRESSURE WASH`
3. Deterministic pull-back wide over the master house's striped lawn —
   chip `THE FINISH`

**Caption (cream floor, pine serif):** "Professional home care—remembered."

## Act 4 — 11.8–15.0s (frames 354–450) · "The brand"

**Visual:** Deep pine end card (`#0f2c22`), champagne radial warmth, film grain.
Atlas Ring mark draws itself (rings → roofline → hearth dot).
**Type stack (staggered rises):**
- `SqueegeeKing` — Cormorant light, warm white
- `WITH HOMEATLAS` — Geist Mono, champagne, wide tracking
- **"Window cleaning with a *memory.*"** — "memory." italic champagne
- CTA pill (cream bg, pine text): **Get your free Home Care Plan →**
- `SqueegeeKing.net` — Geist Mono

---

## Variants

All copy is `props` on the `Master` composition (`src/Master.tsx` →
`MasterProps`). To make a hook or CTA variant, render with `--props`:

```
npx remotion render master-9x16 out/variant.mp4 --props='{"hook":"New hook line","hookAccent":"twice."}'
```

No code changes needed for: hook, portal caption, montage caption, headline,
CTA, URL, hero clip, montage clip list.
