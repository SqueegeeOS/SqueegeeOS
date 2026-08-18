# House continuity sheet — THE HOME THAT REMEMBERS

**Master reference:** `public/footage/hero-house-master.png` (2160×3840)
Derived losslessly from the first frame (t≈0.05s) of the approved hero
generation `hero-vertical.mp4` (Higgsfield Cinema Studio 3.0, job
`4b1882e2-2cf1-4c5d-a185-27eaaba4dc54`), upscaled 2× with deterministic
Lanczos3 (sharp) — no AI resampling, so the reference cannot drift from the
footage it governs. For any future image-referenced generation, pass that
job id (or this PNG) as the reference — never independent text-to-video.

## The house

- **Style:** American Foursquare / craftsman hybrid, 2½ stories.
- **Roofline:** Hipped main roof, deep eaves; one large centered front
  gabled dormer with decorative shingle work and a green-trimmed attic
  window pair; slim brick chimney behind the left roof plane.
- **Windows:** Symmetric. Second floor: two double-hung windows either side
  of center, cream sash with deep forest-green trim. Dormer: paired attic
  windows. First floor concealed behind porch: door flanked by sidelight
  windows, wide windows left and right of entry.
- **Siding / trim:** Pale cream-butter lap siding; deep forest-green window
  trim, porch rails and accents (brand pine); white-cream columns and
  fascia.
- **Front door:** Centered natural-wood door with transom above, reached by
  ~5 brick-faced steps with cream risers.
- **Porch:** Full-width wraparound, paired square columns on cream
  pedestals, low green-and-cream balustrade, warm lantern glow patches on
  the right porch bay.
- **Landscaping:** Low boxwood/foundation planting band across the porch
  face; freshly striped lawn (mow lines run toward the house); two mature
  coast live oaks framing the top of frame, canopy vignetting the sky.
- **Environment:** Straight-on front elevation from the lawn, path of brick
  steps only (no visible driveway); neighboring greenery, no other
  structures identifiable.
- **Light:** Golden morning sun from camera-right, long soft lawn shadows,
  warm highlights raking the right face of the house.

## Continuity log

| Shot | Source | First vs last frame vs master | Verdict |
|---|---|---|---|
| Act 1 hero (`hero-vertical.mp4`) | Cinema Studio 3.0, 1080×1920 | Same roofline, dormer, column rhythm, door, steps, striped lawn, oak canopy. Master IS this shot's first frame. Minor gen drift in dormer shingle detail during push-in (sub-1%), no structural change. | **Accepted** |
| Act 3 "Windows" | Deterministic Ken Burns push-in on master | Pixel-identical to master by construction | **Accepted** |
| Act 3 "The finish" | Deterministic Ken Burns pull-back on master | Pixel-identical to master by construction | **Accepted** |
| Act 3 "Solar" (attempted) | `hour-solar.mp4` cropped ~2.1–2.35× to panels + brush | Render QA showed a different cottage's roofline/chimney still visible at the top of the crop, and heavy softness from upscaling | **Rejected — replaced by pressure-wash detail** |
| Act 3 "Pressure wash" | `hour-pressure.mp4`, near-native framing | Water, stone patio, garden wall only — no architecture from any property identifiable | **Accepted as detail shot** |
| Shot B test (window glass detail, 480p) | Independent t2v (generated before the continuity mandate) | Different architecture risk — cannot be tied to the master | **Rejected; 1080p final not generated** |
| `hour-dusk.mp4` / `hero-film.mp4` / `morning.jpg` full shots | Existing brand footage | Different identifiable properties | **Excluded from house-bearing slots** |

## Rules of use

1. Any new shot containing the house references the master (image
   reference / start frame) — never independent text-to-video.
2. Prefer deterministic movement derived from the master (crops, digital
   push/pull, parallax, lighting overlays in Remotion).
3. Reject any generation where roofline, windows, siding, door,
   landscaping, or layout changes; log the comparison here.
