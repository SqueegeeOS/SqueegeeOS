import type { MembershipUnlockContext } from "@/lib/membership/unlock-sequence";

/** Demo-only — Larry Buckley sample property for lab previews */
export const EXPERIENCE_UNLOCK_CONTEXT: MembershipUnlockContext = {
  homeownerFirstName: "Larry",
  homeownerFullName: "Larry Buckley",
  propertyName: "Canyon Oaks Residence",
  propertySlug: "canyon-oaks-residence",
  homeownerSlug: "larry-buckley",
  propertyHeroImage:
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1920&q=85",
  planName: "Preferred Care",
};

export const EXPERIENCE_ROUTES = {
  home: "/experience",
  unlock: "/experience/unlock",
  requestTransition: "/experience/request-transition",
  headquartersArrival: "/experience/headquarters-arrival",
} as const;

export const EXPERIENCE_LAB_ITEMS = [
  {
    id: "unlock",
    title: "Membership Unlock Ceremony",
    description:
      "Padlock, crown key, light bloom, and welcome copy — the moment a customer becomes family.",
    href: EXPERIENCE_ROUTES.unlock,
    timings: ["Full (~11s)", "Fast (~5.6s)"],
  },
  {
    id: "request-transition",
    title: "Request Plan Transition",
    description:
      "The squeegee wipe and status messages after a Home Care Plan request is submitted.",
    href: EXPERIENCE_ROUTES.requestTransition,
    timings: ["~4.7s wipe"],
  },
  {
    id: "headquarters-arrival",
    title: "Headquarters Arrival",
    description:
      "The quiet morning sequence when Noah opens Headquarters — welcome back, company alive.",
    href: EXPERIENCE_ROUTES.headquartersArrival,
    timings: ["~6s sequence"],
  },
] as const;
