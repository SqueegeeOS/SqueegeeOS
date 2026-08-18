# Source assets — THE HOME THAT REMEMBERS

Every asset used by the campaign, with provenance. No production customer
data appears anywhere; all portal content is sample data defined in
`src/brand.ts`.

## Existing brand footage (copied unmodified from `public/day/`)

| File | Used in | Notes |
|---|---|---|
| `public/footage/hour-pressure.mp4` | Act 3 montage "Pressure wash" | water/stone/garden detail; wand only, no hands, no architecture |
| `public/footage/hour-pressure.jpg` | Photo Proof screen ("Patio") | in-UI documentation still, no architecture |
| `public/footage/hero-film.mp4`, `hour-solar.mp4`, `hour-dusk.mp4`, `morning.jpg`, `hour-solar.jpg`, `hour-dusk.jpg` | staged in `public/footage/` but **unused** | show other identifiable properties — excluded under the house-continuity rule (see CONTINUITY.md) |

**Excluded on purpose:** `hour-window.mp4` / `hour-window.jpg` — depicts
close-up squeegee operation with a gloved hand, which this campaign's rules
do not allow.

## Generated atmospheric footage (Higgsfield — Cinema Studio Video 3.0)

Atmospheric background material only. No UI, text, logos, or people were
generated; all type and interface elements are deterministic DOM/SVG.

| File | Shot | Params |
|---|---|---|
| `public/footage/hero-vertical.mp4` | A — craftsman home, oaks, golden morning | 9:16 · 1080p · 5s · silent |
| `public/footage/window-detail-vertical.mp4` | B — clean window glass detail | 9:16 · 1080p · 5s · silent |

## Deterministic elements (no imagery)

- Atlas Ring mark — ported from `components/theme/atlas-mark.tsx` (SVG)
- Phone shell, status bar, portal screens — DOM/SVG in `src/`
- Fonts — Cormorant Garamond, Geist, Geist Mono via `@remotion/google-fonts`
  (same families as `app/layout.tsx`)
- All colors — `src/brand.ts`, sourced from `app/globals.css` and
  `components/marketing/day2-homepage.tsx`
