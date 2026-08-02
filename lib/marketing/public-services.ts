export interface PublicService {
  slug: string;
  name: string;
  navLabel: string;
  pageTitle: string;
  headline: string;
  description: string;
  metaDescription: string;
  image: string;
  imageAlt: string;
  serviceType: string;
  rhythm: string;
  promise: string;
  inclusions: Array<{
    title: string;
    description: string;
  }>;
}

export const PUBLIC_SERVICES: PublicService[] = [
  {
    slug: "window-cleaning",
    name: "Window Cleaning",
    navLabel: "Window cleaning",
    pageTitle: "Window Cleaning in Chico, CA",
    headline: "Window cleaning in Chico, done the right way.",
    description:
      "Professional window care built around your home, your glass, and the level of service you choose. Start with a clear Home Care Plan, then choose a one-time visit or a recurring rhythm.",
    metaDescription:
      "Professional window cleaning in Chico, CA from SqueegeeKing. Request a personalized plan for one-time, bi-annual, or quarterly home care.",
    image: "/day/hour-window.jpg",
    imageAlt: "A SqueegeeKing window cleaning visit at a Chico-area home",
    serviceType: "Residential window cleaning",
    rhythm: "One-time, every 6 months, or every 3 months",
    promise:
      "Clear expectations before the visit, careful work at the home, and a record your family can return to afterward.",
    inclusions: [
      {
        title: "A plan for your glass",
        description:
          "We shape the quote around the windows and access at your property instead of forcing every home into the same package.",
      },
      {
        title: "Interior care when requested",
        description:
          "Interior window cleaning can be added to the plan, along with screens and other quoted details.",
      },
      {
        title: "A home that is remembered",
        description:
          "Members receive HomeAtlas, where visits, observations, photos, and the next care rhythm stay connected to the property.",
      },
    ],
  },
  {
    slug: "pressure-washing",
    name: "Pressure Washing",
    navLabel: "Pressure washing",
    pageTitle: "Pressure Washing in Chico, CA",
    headline: "Exterior cleaning that respects the surface.",
    description:
      "Pressure washing for Chico homes, walkways, patios, and other quoted exterior areas. We begin with the property, choose an appropriate approach, and make the scope clear before work starts.",
    metaDescription:
      "Pressure washing in Chico, CA for home exteriors, walkways, patios, and quoted surfaces. Request a personalized SqueegeeKing Home Care Plan.",
    image: "/day/hour-pressure.jpg",
    imageAlt: "Professional pressure washing on an exterior surface",
    serviceType: "Residential pressure washing",
    rhythm: "One-time care or bundled with a recurring plan",
    promise:
      "The goal is a cleaner exterior without treating every material as if it needs the same amount of pressure.",
    inclusions: [
      {
        title: "Property-specific scope",
        description:
          "Your plan identifies the areas being cleaned so the work and price stay understandable from the beginning.",
      },
      {
        title: "Surface-aware care",
        description:
          "Walkways, patios, siding, and other exterior materials are considered individually before the cleaning approach is chosen.",
      },
      {
        title: "Easy service bundling",
        description:
          "Pressure washing can be planned alongside window or solar panel care so the property is handled in one coordinated visit.",
      },
    ],
  },
  {
    slug: "solar-panel-cleaning",
    name: "Solar Panel Cleaning",
    navLabel: "Solar panel cleaning",
    pageTitle: "Solar Panel Cleaning in Chico, CA",
    headline: "Solar panel care for Chico dust and seasons.",
    description:
      "Professional solar panel cleaning for homeowners who want seasonal buildup handled without another task to remember. Book it alone or coordinate it with the rest of the exterior.",
    metaDescription:
      "Solar panel cleaning in Chico, CA from SqueegeeKing. Schedule one-time care or bundle panel cleaning with windows and recurring home maintenance.",
    image: "/day/hour-solar.jpg",
    imageAlt: "Solar panels being professionally cleaned on a residential roof",
    serviceType: "Residential solar panel cleaning",
    rhythm: "One-time, seasonal, or coordinated with window care",
    promise:
      "A straightforward visit focused on removing the dust and surface buildup that collects on exposed panels.",
    inclusions: [
      {
        title: "Seasonal planning",
        description:
          "We can place panel care on the same 3- or 6-month rhythm as the rest of your exterior maintenance when that fits the home.",
      },
      {
        title: "One coordinated visit",
        description:
          "Solar, window, and pressure-washing services can be combined in a single personalized plan instead of managed separately.",
      },
      {
        title: "Documented property care",
        description:
          "HomeAtlas members keep the visit and property history together, so the next conversation starts with what has already been done.",
      },
    ],
  },
  {
    slug: "home-care-memberships",
    name: "Home Care Memberships",
    navLabel: "Home care memberships",
    pageTitle: "Recurring Home Care in Chico, CA",
    headline: "Put the exterior of your home on a rhythm.",
    description:
      "Quarterly and bi-annual care plans combine preferred scheduling, member benefits, and HomeAtlas: a living record of what your property needs and what has already been done.",
    metaDescription:
      "Recurring exterior home care in Chico, CA every 3 or 6 months. SqueegeeKing memberships include preferred care and a HomeAtlas property record.",
    image: "/day/hour-dusk.jpg",
    imageAlt: "A cared-for Chico-area home at the end of the day",
    serviceType: "Recurring exterior home maintenance",
    rhythm: "Every 3 months or every 6 months",
    promise:
      "The calendar is handled, the property history stays intact, and every visit begins with context instead of starting over.",
    inclusions: [
      {
        title: "A dependable care rhythm",
        description:
          "Choose quarterly or bi-annual service based on the property and the plan you approve.",
      },
      {
        title: "Member treatment",
        description:
          "Membership includes priority scheduling, preferred pricing, and the benefits listed in your personalized Home Care Plan.",
      },
      {
        title: "HomeAtlas included",
        description:
          "Your portal brings the next scheduled visit, care history, property notes, documents, and membership details into one place.",
      },
    ],
  },
];

export function getPublicService(slug: string): PublicService | null {
  return PUBLIC_SERVICES.find((service) => service.slug === slug) ?? null;
}
