# THE HOME THAT REMEMBERS — render project

A 15-second vertical advertisement for SqueegeeKing memberships, built as an
isolated Remotion project. Nothing here touches the production app; existing
brand footage was copied (never moved) into `public/footage/`.

## Key documents

- `STORYBOARD.md` — the four-act timeline and design system
- `CONTINUITY.md` — the house continuity sheet and shot log (non-negotiable)
- `ASSETS.md` — provenance of every source asset
- `deliverables/captions.srt` — timed captions

## Requirements

Node 18+ (this machine: portable Node at
`C:\Users\homea\Tools\node-v24.19.0-win-x64` — prepend it to `PATH`).

```
cd campaigns/the-home-that-remembers
npm install
```

## Rendering

```
npm run render:master   # out/the-home-that-remembers-9x16.mp4 (1080x1920)
npm run render:feed     # out/the-home-that-remembers-4x5.mp4  (1080x1350)
npm run poster:master   # out/poster-9x16.png
npm run poster:feed     # out/poster-4x5.png
```

If another server occupies port 3000, add `--port 3777`. If edits don't
show up in a render, add `--bundle-cache=false` (a stale webpack bundle
cache produced exactly that once).

`npm run studio` opens Remotion Studio for interactive preview.

## Hook / CTA variants

Every line of copy is a prop on the `Master` composition — no code changes:

```
npx remotion render master-9x16 out/variant-hook-b.mp4 --props='{
  "hook": "Alternate hook line",
  "cta": "Alternate CTA"
}'
```

See `MasterProps` in `src/Master.tsx` for the full list (hook, hookAccent,
portalCaption, montageCaption, headline, headlineAccent, cta, url, heroSrc,
montageClips).

## Rules encoded in this project

- All UI, logos, captions, and type are deterministic DOM/SVG (Remotion).
  No AI-generated readable text anywhere.
- The house is always THE house — `public/footage/hero-house-master.png`
  governs; see CONTINUITY.md before adding any shot.
- Sample member data only (`src/brand.ts` → `SAMPLE`). Never production
  customer data.
- No squeegee-operation close-ups, no fake customers or testimonials.
