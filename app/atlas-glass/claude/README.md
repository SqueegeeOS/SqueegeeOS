# Concept B — The Atlas Dial

**Route:** `/atlas-glass/claude` (hidden from nav, `robots: noindex, nofollow`)
**Files:** `page.tsx`, `concept-b.tsx`, `concept-b.css` — entirely self-contained.
Concept A (`/atlas-glass`) and the production homepage are untouched.

---

## The idea

Concept A asks you to *clear* something before you can see it. Concept B does
the opposite: it hands you the finished artifact immediately.

**HomeAtlas is literal cartography.** Your home sits at the center of its own
atlas plate, and the year of care runs around it like a compass bezel:

- **Behind you** — a solid meridian through visits that already happened,
  each stamped with a check.
- **Right now** — a gold hearth beneath the house, quietly pulsing.
- **Ahead** — a dashed bronze road marching toward the next scheduled visit.

One glance answers the question the business is actually selling: *does
anyone remember my home?* The plate says yes, and shows the receipts.

## The three-second read

Within the first viewport a homeowner sees the headline "Your home keeps
**its own atlas**", the plate with their home at the center, a cartouche
reading **HomeAtlas — Property record**, and a field note naming a real
date, service, and arrival window. The subhead ties it to the offer:
*every SqueegeeKing membership includes HomeAtlas.*

## Motion, and what each piece means

| Motion | Meaning |
|---|---|
| Contours and the care meridian **ink themselves in** on load (bold moment) | The record is being drawn — this map is made, not generic |
| The dial then **turns by itself** from today to Oct 14, unprompted, at 2.6s | Anticipation. The atlas is already looking ahead for you |
| Dashed future road **marches** slowly | Something is scheduled and moving toward you |
| Hearth **pulses** under the house | The home is current, live, occupied |
| Outer meridian **drifts** over 150s | Ambient life, borrowed from the Atlas Ring's calibration idle |

Nothing floats, sparkles, or exists as filler.

## The surprising interaction

**You can grab the year and spin it.** Drag anywhere on the plate and the
whole calendar turns under the needle with 1:1 pointer tracking; release and
it snaps to the nearest waypoint, which becomes the field note. Tap a marker
or use arrow keys for the same result. Month letters counter-rotate so the
year stays legible while it turns — they track the plate on the identical
easing rather than snapping at the end.

Only the waypoint under the needle is labelled; the rest are glyphs. (Jul 18
and "today" are 21 days apart, so permanent chips collided.) The glyph
vocabulary — stamped check, dashed hearth ring, dashed arrow — is repeated
exactly in the Map Legend section below, so the plate teaches its own key.

## Brand fit

Palette, type, and voice come straight from the existing system: pine
`#173f32`, bronze `#99683d`, cream `#f5f0e6`, paper `#fffdf8`, gold
`#c9a35c`, Cormorant Garamond / Geist / Geist Mono, and the production
`AtlasMark` component. The cartography metaphor is a direct read of the
brand's own logo concepts (meridian rings around a roofline) and of the name
*HomeAtlas* itself — it is not a new visual language bolted on.

It still sells the cleaning company: the eyebrow leads with "SqueegeeKing ·
Window cleaning · Chico, California", there is a four-craft services grid,
and every CTA is the real one — **Get your free Home Care Plan → `/request`**.

## Data & assets

- **Zero Higgsfield credits spent.** The concept needed no new generated
  material: it reuses `public/atlas-glass/hero-house.jpg` (the campaign's
  continuity master frame) plus `public/day/hour-pressure.jpg`. Generating
  more would have risked breaking the established house continuity for no
  creative gain.
- All sample data is fictional and sanitized, defined in one `WAYPOINTS`
  array. The plate is explicitly labelled **"Sample member home."**
- Every word, icon, logo, and number is real DOM/SVG. Nothing readable is
  baked into an image.

## Accessibility & performance

- Dial is a labelled `group` with arrow-key navigation; each waypoint is a
  real `<button>` with `aria-pressed` and a descriptive label. Field note is
  `aria-live="polite"`.
- Focus-visible rings on every interactive element, including the service
  cards and jump link.
- `prefers-reduced-motion`: no ink-in, no auto-turn, no drift or pulse. The
  map renders complete and rests on **today**; the affordance line changes to
  "Select a visit to explore". Read via `useSyncExternalStore`, so it also
  responds if the OS setting changes mid-session.
- Only `transform`/`opacity`/`stroke-dashoffset` animate — no layout thrash.
  One `IntersectionObserver` for section ink-in, one for the CTA dock.
- SVG coordinates are rounded (`fx()`) because server and client `Math.sin`
  can disagree in the 15th decimal, which produced a real hydration mismatch.

## Mobile

Mobile is a different composition, not a squeeze. The grid reorders so the
plate sits directly under the headline (the metaphor lands before the ask),
the dial scales to `78vw`, and a **sticky CTA dock** rides the bottom of the
screen whenever both the hero and closing buttons are off-screen — the same
pattern `day2-homepage.tsx` already uses. Verified with no horizontal
overflow down to a 320px viewport, where the CTA is a full-width 54px target.

## Verified

- `npx eslint app/atlas-glass/claude/ --max-warnings=0` → clean.
- Fresh-load console → clean (no errors, no hydration warnings).
- All 5 waypoints click through correctly; all four arrow keys step in both
  directions; drag tracks live and snaps; every proof photo loads on every
  waypoint; CTA dock shows and hides at the right scroll positions.
- Desktop 1440/1280, mobile 390, narrow 320 — no overflow at any width.
- Screenshots in `docs/concept-b/`.

## If this wins — production considerations

1. **Real data.** `WAYPOINTS` maps cleanly onto the existing portal shapes
   (`PortalNextCareVisit`, visit history, photo counts). A logged-in member
   could see their own plate; a visitor keeps the sample.
2. **The house photo** is currently the campaign's continuity house. In
   production it should be the member's own property photo, with a tasteful
   default for visitors.
3. **A year is only one page of an atlas.** Multi-year membership history
   wants either a year selector or concentric rings — decide before this
   ships to long-tenured members.
4. **Dial density.** Five waypoints is comfortable; a member with monthly
   visits needs clustering or a zoom affordance.
5. Route is noindexed and nav-hidden; promoting it means removing that and
   moving `/atlas-glass` out of `HIDDEN_PREFIXES` in
   `lib/navigation/resolve.ts`.
6. Not committed, not deployed, not wired into the production homepage.
