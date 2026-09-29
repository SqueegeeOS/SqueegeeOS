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
  questions: Array<{
    question: string;
    answer: string;
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
    questions: [
      {
        question: "Can I book one window-cleaning visit without a membership?",
        answer:
          "Yes. Start with one visit. If you want regular care later, we can build a three- or six-month schedule around your home.",
      },
      {
        question: "Do you clean inside windows and screens?",
        answer:
          "We can include interior glass and screens. Your Home Care Plan states which windows and extras are included before you approve the work.",
      },
      {
        question: "How do I get a window-cleaning quote in Chico?",
        answer:
          "Send us the property address and tell us whether you want exterior glass, interior glass, screens, or a combination. We confirm the scope and price in your plan.",
      },
    ],
  },
  {
    slug: "pressure-washing",
    name: "Pressure Washing",
    navLabel: "Pressure washing",
    pageTitle: "Pressure Washing in Chico, CA",
    headline: "Pressure washing in Chico, planned for each surface.",
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
    questions: [
      {
        question: "What can you pressure wash at my Chico home?",
        answer:
          "Common requests include walkways, patios, siding, and other exterior areas. We review the material and condition before confirming what belongs in the quote.",
      },
      {
        question: "Do you use the same pressure on every surface?",
        answer:
          "No. We choose the cleaning approach for the material and the condition of the area. Your plan identifies the surfaces and work before the visit.",
      },
      {
        question: "Can I combine pressure washing with window cleaning?",
        answer:
          "Yes. We can quote both services in one Home Care Plan and coordinate the work around the property.",
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
    questions: [
      {
        question: "How often should solar panels be cleaned in Chico?",
        answer:
          "It depends on dust, trees, weather, and the panel location. We can quote a single visit or discuss seasonal care after seeing the property.",
      },
      {
        question: "Will cleaning guarantee more solar production?",
        answer:
          "We remove accessible surface buildup; we do not promise a specific change in energy output. Your system's performance depends on other factors too.",
      },
      {
        question: "Can panel cleaning happen with my window service?",
        answer:
          "Yes. We can include solar panels and windows in one property-specific plan so you have a clear scope and one coordinated visit.",
      },
    ],
  },
  {
    slug: "home-care-memberships",
    name: "Home Care Memberships",
    navLabel: "Home care memberships",
    pageTitle: "Recurring Home Care in Chico, CA",
    headline: "Recurring home care in Chico, on your rhythm.",
    description:
      "Quarterly and bi-annual care plans combine preferred scheduling, member benefits, and HomeAtlas: a living record of what your property needs and what has already been done. A custom three-times-yearly plan is also available when it better fits the home.",
    metaDescription:
      "Recurring exterior home care in Chico, CA with quarterly, bi-annual, and custom 3x/year options. Membership includes a HomeAtlas property record.",
    image: "/day/hour-dusk.jpg",
    imageAlt: "A cared-for Chico-area home at the end of the day",
    serviceType: "Recurring exterior home maintenance",
    rhythm: "Every 3 months, every 6 months, or a custom 3x/year plan",
    promise:
      "The calendar is handled, the property history stays intact, and every visit begins with context instead of starting over.",
    inclusions: [
      {
        title: "A dependable care rhythm",
        description:
          "Choose quarterly or bi-annual service based on the property and the plan you approve, with a custom three-times-yearly option when needed.",
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
    questions: [
      {
        question: "Do I have to join a membership to book service?",
        answer:
          "No. One-time service is available. Membership is an option when you want the next visits and property history planned together.",
      },
      {
        question: "How often does a Home Care Plan schedule visits?",
        answer:
          "Quarterly and twice-yearly plans are available. We can discuss a different rhythm when it fits the property and the services you choose.",
      },
      {
        question: "What does HomeAtlas keep for my home?",
        answer:
          "Your private portal brings together the care plan, upcoming visits, property notes, service history, and available photos and documents.",
      },
    ],
  },
];

export function getPublicService(slug: string): PublicService | null {
  return PUBLIC_SERVICES.find((service) => service.slug === slug) ?? null;
}
