import type { PropertyHubContext } from "./types";

export const propertyHubContext: PropertyHubContext = {
  company: {
    name: "SqueegeeOS",
    slug: "squeegeeos",
  },
  homeowner: {
    slug: "larry-buckley",
    fullName: "Larry Buckley",
    firstName: "Larry",
    email: "larry.buckley@example.com",
    properties: [
      {
        slug: "canyon-oaks-residence",
        name: "Canyon Oaks Residence",
        address: "4125 Canyon Oaks Drive",
        city: "Chico",
        state: "CA",
        zip: "95928",
        type: "Residence",
        heroImage:
          "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80",
        homeCareScore: 91,
        membershipStatus: "Preferred Care",
        lastVisit: "June 24, 2026",
        nextScheduledVisit: "July 18, 2026",
        photoCount: 847,
        timelineLength: 64,
        aiStatus: "Active",
        healthStatus: "Excellent",
        yearBuilt: 2004,
        squareFeet: 3800,
        narrative:
          "A refined canyon estate with oak-lined approaches, pool terrace, and meticulous landscape stewardship spanning twelve seasons of documented care.",
        recentTimeline: [
          {
            id: "co-1",
            date: "June 24, 2026",
            technician: "Dasan Gramps",
            title: "Quarterly Exterior Care",
            summary:
              "Pool deck sealed. Gutters cleared. South elevation windows inspected — all seals intact.",
            photoCount: 24,
            scoreChange: 2,
            servicesCompleted: [
              "Exterior wash",
              "Gutter service",
              "Window inspection",
            ],
          },
          {
            id: "co-2",
            date: "March 12, 2026",
            technician: "Noah Thomas",
            title: "Spring Preparation Visit",
            summary:
              "Irrigation tuned for summer. Landscape health exceptional. Recommended annual deck treatment.",
            photoCount: 18,
            servicesCompleted: ["Irrigation audit", "Landscape assessment"],
          },
          {
            id: "co-3",
            date: "December 8, 2025",
            technician: "Noah Thomas",
            title: "Winter Readiness Review",
            summary:
              "Drainage pathways clear. Roof tiles inspected — no action required. Score elevated to 89.",
            photoCount: 31,
            scoreChange: 3,
            servicesCompleted: ["Roof inspection", "Drainage review"],
          },
        ],
      },
      {
        slug: "downtown-chico-office",
        name: "Downtown Chico Office",
        address: "141 Main Street, Suite 400",
        city: "Chico",
        state: "CA",
        zip: "95928",
        type: "Commercial",
        heroImage:
          "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=80",
        homeCareScore: 78,
        membershipStatus: "Essential Care",
        lastVisit: "June 10, 2026",
        nextScheduledVisit: "August 5, 2026",
        photoCount: 312,
        timelineLength: 28,
        aiStatus: "Idle",
        healthStatus: "Well Maintained",
        yearBuilt: 1988,
        squareFeet: 4200,
        narrative:
          "A distinguished downtown commercial space with original brick facade, storefront glass, and a care history focused on professional presentation and building envelope integrity.",
        recentTimeline: [
          {
            id: "dc-1",
            date: "June 10, 2026",
            technician: "Dasan Gramps",
            title: "Bi-Annual Building Envelope Review",
            summary:
              "Storefront glass cleaned and inspected. Mortar joints on east wall flagged for monitoring.",
            photoCount: 14,
            servicesCompleted: ["Glass care", "Facade inspection"],
          },
          {
            id: "dc-2",
            date: "February 3, 2026",
            technician: "Noah Thomas",
            title: "Winter Maintenance Visit",
            summary:
              "HVAC intake screens serviced. Exterior signage illumination verified.",
            photoCount: 9,
            servicesCompleted: ["Signage check", "Intake screen service"],
          },
        ],
      },
      {
        slug: "lake-almanor-home",
        name: "Lake Almanor Home",
        address: "287 Shoreline Circle",
        city: "Lake Almanor",
        state: "CA",
        zip: "96137",
        type: "Vacation",
        heroImage:
          "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1200&q=80",
        homeCareScore: 86,
        membershipStatus: "Estate Care",
        lastVisit: "May 30, 2026",
        nextScheduledVisit: "July 22, 2026",
        photoCount: 523,
        timelineLength: 41,
        aiStatus: "Active",
        healthStatus: "Excellent",
        yearBuilt: 1996,
        squareFeet: 2900,
        narrative:
          "A lakefront retreat where seasonal transitions demand vigilant stewardship — dock, deck, and shoreline care documented across every summer and winter cycle.",
        recentTimeline: [
          {
            id: "la-1",
            date: "May 30, 2026",
            technician: "Noah Thomas",
            title: "Summer Opening Preparation",
            summary:
              "Dock inspected and treated. Deck boards assessed — two boards scheduled for replacement. Lake-side windows sealed.",
            photoCount: 42,
            scoreChange: 1,
            servicesCompleted: [
              "Dock inspection",
              "Deck assessment",
              "Window sealing",
            ],
          },
          {
            id: "la-2",
            date: "October 14, 2025",
            technician: "Dasan Gramps",
            title: "Winterization Visit",
            summary:
              "Plumbing winterized. Storm shutters secured. Property secured for off-season.",
            photoCount: 28,
            servicesCompleted: ["Winterization", "Storm prep"],
          },
        ],
      },
      {
        slug: "rental-property",
        name: "Rental Property",
        address: "918 Ivy Street",
        city: "Chico",
        state: "CA",
        zip: "95926",
        type: "Rental",
        heroImage:
          "https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=1200&q=80",
        homeCareScore: 72,
        membershipStatus: "Essential Care",
        lastVisit: "June 2, 2026",
        nextScheduledVisit: "July 9, 2026",
        photoCount: 198,
        timelineLength: 19,
        aiStatus: "Processing",
        healthStatus: "Needs Attention",
        yearBuilt: 1972,
        squareFeet: 1650,
        narrative:
          "A well-located rental with steady tenancy. Care focus on turnover readiness, exterior durability, and preserving long-term asset value between lease cycles.",
        recentTimeline: [
          {
            id: "rp-1",
            date: "June 2, 2026",
            technician: "Noah Thomas",
            title: "Post-Tenancy Inspection",
            summary:
              "AI processing turnover documentation. Exterior paint touch-up recommended on north fence. Gutters require attention before next season.",
            photoCount: 36,
            scoreChange: -4,
            servicesCompleted: ["Turnover inspection", "Exterior assessment"],
          },
          {
            id: "rp-2",
            date: "April 18, 2026",
            technician: "Dasan Gramps",
            title: "Spring Exterior Care",
            summary:
              "Driveway pressure washed. Landscape trimmed. Fence stain fading noted for Q3.",
            photoCount: 12,
            servicesCompleted: ["Exterior wash", "Landscape trim"],
          },
        ],
      },
    ],
  },
};

export const { company, homeowner } = propertyHubContext;
