import { foundersAsPlanTeam, NOAH_PERSONAL_NOTE } from "@/lib/team/founders";
import { emptyPlanReviews } from "@/lib/reviews/plan-placeholder";
import type { HomeCarePlanData } from "./types";

export const canyonOaksHomeCarePlan = {
  homeowner: {
    firstName: "Larry",
    fullName: "Larry Buckley",
    slug: "larry-buckley",
  },
  property: {
    name: "Canyon Oaks Residence",
    slug: "canyon-oaks-residence",
    address: "4125 Canyon Oaks Drive",
    city: "Chico",
    state: "California",
    heroImage:
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1920&q=85",
    yearBuilt: 2004,
    homeCareScore: 91,
    lastVisit: "June 24, 2026",
    membershipRecommendation: "Preferred Care",
  },
  brand: {
    company: "SqueegeeKing",
    tagline: "Premium Home Care.",
    craftedFor: "Crafted for Larry Buckley",
    footerLines: [
      "Crafted with pride in Chico, California.",
      "Built on trust.",
      "Maintained through consistency.",
    ],
  },
  hero: {
    title: "Your Personalized Home Care Plan",
    subheadline: "Created exclusively for your Canyon Oaks Residence.",
    intro:
      "We inspected your property and created a personalized maintenance strategy designed specifically for your home.",
    cta: "Begin Your Home Care Plan",
  },
  propertyHealth: {
    rating: "Excellent",
    narrative:
      "Canyon Oaks is in remarkable condition. Your score of 91 reflects consistent stewardship — original millwork intact, drainage performing well, and landscape thriving beneath the oak canopy. What remains is not repair, but rhythm: the kind of seasonal attention that keeps a twenty-two-year estate ahead of deterioration rather than chasing it.",
  },
  propertyProfile: [
    {
      label: "Property Type",
      value: "Canyon Estate",
      detail: "Single-family residence with pool terrace",
    },
    {
      label: "Maintenance Profile",
      value: "Proactive",
      detail: "Ahead of deterioration, never behind it",
    },
    {
      label: "Landscape Complexity",
      value: "High",
      detail: "Oak canopy, irrigated beds, pool surround",
    },
    {
      label: "Glass Exposure",
      value: "Elevated",
      detail: "West-facing bays, south pool wall",
    },
    {
      label: "Hard Water Risk",
      value: "Moderate",
      detail: "Early mineral buildup on south fixtures",
    },
    {
      label: "Last Visit",
      value: "June 24, 2026",
      detail: "Quarterly exterior care completed",
    },
  ],
  findings: [
    {
      id: "hard-water",
      title: "Hard Water Beginning",
      severity: "Early Stage",
      description:
        "Mineral deposits are forming on south-facing glass and pool terrace fixtures. At this stage, a gentle treatment preserves clarity without abrasion — waiting another season makes restoration more invasive.",
      image:
        "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80",
    },
    {
      id: "west-windows",
      title: "West Windows",
      severity: "Monitor",
      description:
        "Your west elevation catches afternoon sun beautifully — and bears the brunt of it. We noted early seal fatigue on two casements. A preservation treatment now protects the original frames you chose for this home.",
      image:
        "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=80",
    },
    {
      id: "spider-activity",
      title: "Spider Activity",
      severity: "Seasonal",
      description:
        "Eave lines and entry alcoves show typical canyon-season activity. Nothing structural — simply the kind of detail that accumulates quietly when a home sits between oak canopy and open sky.",
      image:
        "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800&q=80",
    },
    {
      id: "organic-growth",
      title: "Organic Growth",
      severity: "Attention",
      description:
        "North-facing stucco and stone pathways are developing moss in shaded micro-climates. Canyon Oaks' tree cover is part of its beauty — this simply asks for seasonal attention before moisture finds a foothold.",
      image:
        "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800&q=80",
    },
    {
      id: "landscape-debris",
      title: "Landscape Debris",
      severity: "Routine",
      description:
        "Oak litter along the pool terrace and gutter lines. Your landscape is thriving — debris is the natural byproduct of the canopy that makes 4125 Canyon Oaks unmistakable.",
      image:
        "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&q=80",
    },
  ],
  recommendation: {
    headline: "Why recurring care matters for Canyon Oaks.",
    paragraphs: [
      "Your home doesn't age in a single moment. It ages in seasons — a winter of rain against west-facing glass, a summer of canyon dust along the pool terrace, oak litter that finds the gutters when no one is watching.",
      "One visit can restore what today demands. Recurring care ensures nothing becomes an emergency repair. It is the difference between maintaining a residence and stewarding an estate.",
    ],
    closing:
      "This is not pressure. It is the same philosophy you already apply to everything you value — consistent, thoughtful, ahead of the problem.",
  },
  personalNote: {
    greeting: "Larry,",
    paragraphs: [
      "Thank you for inviting us to your home.",
      "Our mission is simple. Help you enjoy your property while we remember everything for you.",
      "We look forward to caring for your home for many years.",
    ],
    signoff: NOAH_PERSONAL_NOTE.signoff,
    title: NOAH_PERSONAL_NOTE.title,
    company: NOAH_PERSONAL_NOTE.company,
  },
  memberships: [
    {
      id: "one-time",
      name: "One-Time Refresh",
      price: "$680",
      period: "per visit",
      lifestyle:
        "Perfect for homeowners needing immediate service.",
      highlighted: false,
    },
    {
      id: "preferred",
      name: "Preferred Care",
      price: "$249",
      period: "per month",
      badge: "Recommended",
      lifestyle:
        "Designed for homeowners who value convenience and proactive maintenance.",
      highlighted: true,
    },
    {
      id: "estate",
      name: "Estate Care",
      price: "$449",
      period: "per month",
      lifestyle:
        "Designed for homeowners who want complete year-round property stewardship.",
      highlighted: false,
    },
  ],
  careJourney: [
    {
      step: "Assessment",
      description: "We walk your property and document everything that matters.",
    },
    {
      step: "First Visit",
      description: `We arrive knowing Canyon Oaks — not discovering it.`,
    },
    {
      step: "Property Timeline Begins",
      description: "Every visit, photo, and note preserved in your living archive.",
    },
    {
      step: "Quarterly Updates",
      description: "Seasonal care that matches how your home actually lives.",
    },
    {
      step: "Annual Home Review",
      description: "A year in review — the story of your property, documented.",
    },
  ],
  membershipBenefits: [
    {
      title: "VIP Priority Scheduling",
      description: "Your home moves to the front of the calendar — every season.",
    },
    {
      title: "Member Pricing",
      description: "Preferred rates that reward the relationship, not just the visit.",
    },
    {
      title: "Property History",
      description: "Every chapter of Canyon Oaks — preserved, never forgotten.",
    },
    {
      title: "Set It & Forget It",
      description: "We remember the seasons so you don't have to.",
    },
  ],
  team: foundersAsPlanTeam(),
  reviews: emptyPlanReviews,
  closing: {
    headline: "Begin stewarding Canyon Oaks the way it deserves.",
    subline: "Your plan is ready. We're honored to care for your home.",
    phone: "(530) 588-6235",
    location: "Chico, California",
    cta: "Become a Member",
  },
} as const satisfies HomeCarePlanData;

export type { HomeCarePlanData } from "./types";
