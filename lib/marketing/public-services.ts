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
  pricing?: { heading: string; description: string; factors: string[] };
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
      "Interior and exterior window cleaning for Chico homes, with screen, track, and sill cleaning available in your quote. Choose a one-time cleaning or recurring visits every three or six months. We confirm the windows, access, and included details before you approve the work.",
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
          "Exterior window cleaning removes dirt and buildup from the glass. Tell us about second-story windows, difficult access, and any glass you are especially concerned about so we can plan the visit and confirm what is included.",
      },
      {
        title: "Interior care when requested",
        description:
          "Add interior glass, screen cleaning, tracks, and sills to suit your home. These details are listed in your quote so you can compare exterior-only care with a more complete inside-and-out cleaning.",
      },
      {
        title: "Hard-water spots and glass condition",
        description:
          "Point out mineral spots when requesting your quote. Hard-water treatment is assessed separately from routine glass cleaning; permanent etching or damaged glass may remain visible after cleaning. Members also receive a HomeAtlas record for ongoing care.",
      },
    ],
    pricing: {
      heading: "What affects window cleaning prices in Chico?",
      description: "Your quote is based on the work at your property. Share the address, approximate home size, number of stories, and whether you want inside, outside, or both. Photos of unusual windows help us confirm the scope.",
      factors: ["Window quantity, size, and style", "Second-story windows and access", "Interior glass, screens, tracks, and sills", "Hard-water buildup and glass condition", "One-time cleaning or recurring service"],
    },
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
    pricing: {
      heading: "What affects pressure washing prices?",
      description: "Tell us which surfaces need cleaning and send photos if possible. We review the material, condition, and access before recommending pressure washing or a lower-pressure soft wash for appropriate surfaces.",
      factors: ["Size of the driveway, patio, walkway, or exterior", "Surface material and condition", "Algae, dirt, stains, and other buildup", "Water access and surrounding landscaping", "Combining the visit with window or solar cleaning"],
    },
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
    headline: "Solar panel cleaning in Chico, CA.",
    description:
      "Solar panel cleaning for Chico homeowners dealing with dust, pollen, bird droppings, and other surface buildup. Share the panel count and roof access so we can quote the work. Book a single visit or coordinate recurring panel cleaning with your window service.",
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
    pricing: {
      heading: "What affects solar panel cleaning prices?",
      description: "Panel count is a useful starting point, but access and buildup also affect the work. Send the property address, approximate number of panels, and a photo of the array when requesting your quote. Cleaning is separate from electrical repairs or system diagnostics.",
      factors: ["Number of panels and array layout", "Roof height, pitch, and safe access", "Dust, bird droppings, and other buildup", "One-time or recurring cleaning", "Combining solar panel and window cleaning"],
    },
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
    slug: "gutter-cleaning",
    name: "Gutter Cleaning",
    navLabel: "Gutter cleaning",
    pageTitle: "Gutter Cleaning in Chico, CA",
    headline: "Gutter cleaning in Chico, CA.",
    description: "Gutter cleaning for Chico homes with leaves, roof debris, and blocked gutter runs. Request a quote for debris removal and a review of accessible downspout flow. We confirm the roofline, access, and included work before scheduling your visit.",
    metaDescription: "Gutter cleaning in Chico, CA from SqueegeeKing. Request a quote for gutter debris removal and accessible downspout checks, alone or with window cleaning.",
    image: "/day/hour-dusk.jpg",
    imageAlt: "A residential home exterior in evening light",
    serviceType: "Residential gutter cleaning",
    rhythm: "One-time cleaning or seasonal care by arrangement",
    promise: "A clear scope for the gutter runs we can safely reach, with any visible access concerns or additional work discussed before you approve the service.",
    inclusions: [
      { title: "Leaves and gutter debris", description: "We quote removal of leaves and debris from the agreed gutter runs. Let us know about overflowing sections, nearby trees, or areas that have not been cleaned recently so we can account for the buildup." },
      { title: "Downspouts and drainage concerns", description: "Accessible downspout flow can be checked as part of the quoted work. Tell us where water is backing up. A blockage inside a concealed pipe or underground drain may require separate work; the quote makes the scope clear." },
      { title: "One- and two-story access", description: "Share the number of stories, roofline photos, and any gutter guards before the visit. Height, roof pitch, landscaping, and guard design affect access and the cleaning approach. We confirm which sections can be safely serviced." },
    ],
    pricing: {
      heading: "What affects gutter cleaning prices in Chico?",
      description: "Gutter length, access, and debris determine the scope. Send your address and photos of the roofline or overflowing sections for a property-specific quote. Gutter repairs, guard installation, and exterior gutter washing are separate services unless included in writing.",
      factors: ["Length and layout of gutter runs", "Number of stories and safe ladder access", "Debris depth and downspout blockages", "Existing gutter guards", "Combining gutter and window cleaning"],
    },
    questions: [
      { question: "When should I schedule gutter cleaning in Chico?", answer: "Check your gutters as leaves collect and before the rainy season. If you notice overflowing water or visible debris, request a cleaning assessment. Homes with trees close to the roof may need attention more often than homes with little leaf buildup." },
      { question: "Can you clean second-story gutters or gutters with guards?", answer: "We assess second-story work and existing gutter guards before confirming the quote. Send roofline photos and tell us about the guards, roof height, and access restrictions so we can identify the sections we can safely clean." },
      { question: "Can I book gutters and windows together?", answer: "Yes. Request both services in the same quote. We confirm the gutter cleaning scope, window options, and scheduling before you approve the visit. One-time service is available without a membership." },
      { question: "Does gutter cleaning include repairs or gutter washing?", answer: "Debris removal, exterior washing, repairs, and guard installation involve different work. Your quote states what is included. Mention leaks, sagging sections, stains, or damaged guards when requesting service so we can discuss the appropriate next step." },
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
