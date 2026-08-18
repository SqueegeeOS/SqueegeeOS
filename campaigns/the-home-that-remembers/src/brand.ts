/**
 * SqueegeeKing / HomeAtlas brand tokens.
 * Sourced from the production app:
 *  - marketing palette: components/marketing/day2-homepage.tsx
 *  - portal (HomeAtlas) dark tokens: app/globals.css :root
 * Do not invent new colors here — extend from the app first.
 */
export const BRAND = {
  // Marketing surfaces (cream + pine + bronze)
  canvas: "#f5f0e6",
  warmWhite: "#fffaf0",
  paper: "#fffdf8",
  pine: "#173f32",
  pineDeep: "#0f2c22",
  sage: "#526b60",
  bronze: "#99683d",
  bronzeText: "#8f5f37",

  // HomeAtlas portal (dark, warm)
  portalBg: "#070605",
  portalFg: "#f5f2eb",
  portalMuted: "#8a8680",
  champagne: "#c9b896",
  champagneSoft: "rgba(201, 184, 150, 0.2)",
  glassBorder: "rgba(255, 248, 235, 0.08)",
  glassHighlight: "rgba(255, 248, 235, 0.06)",
} as const;

/** Sanitized sample member data — never production customer information. */
export const SAMPLE = {
  property: "Oak Hollow Residence",
  locality: "Chico, California",
  memberSince: "Member since 2024",
  nextVisit: {
    month: "OCT",
    day: "14",
    dateLong: "October 14",
    service: "Exterior window detail · Solar rinse",
    window: "Morning arrival · 8–11 AM",
    support: "We’ll text when your crew is on the way.",
    reassurance: "No need to call — your plan already knows.",
  },
  history: [
    { date: "Jul 18", service: "Full exterior wash", photos: "42 photos" },
    { date: "Apr 12", service: "Windows + screens", photos: "28 photos" },
    { date: "Jan 9", service: "Solar panel care", photos: "12 photos" },
  ],
  // HOUSE CONTINUITY: photo proof shows crops of THE house (the master
  // frame) plus one panels-only solar detail — never another property.
  photoProof: {
    note: "42 photos from your last visit",
    shots: [
      { src: "footage/hero-house-master.png", chip: "Front · Jul 18", position: "50% 30%", zoom: 1.5 },
      { src: "footage/hero-house-master.png", chip: "Porch · Jul 18", position: "50% 47%", zoom: 2.4 },
      { src: "footage/hour-pressure.jpg", chip: "Patio · Jul 18", position: "50% 72%", zoom: 1.6 },
    ],
  },
  plan: [
    { service: "Window cleaning", cadence: "Every 3 months" },
    { service: "Solar panel care", cadence: "Every 6 months" },
    { service: "Pressure washing", cadence: "Each spring" },
  ],
  guarantee: "Seven-day rain guarantee",
} as const;
