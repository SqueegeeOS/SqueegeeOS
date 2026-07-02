export const larryBuckley = {
  firstName: "Larry",
  fullName: "Larry Buckley",
  hero: {
    eyebrow: "Your Home Care Experience",
    headline: "Crafted for Larry Buckley",
    subline:
      "A private portrait of your home — its condition, its needs, and the care it deserves.",
    address: "1847 Vallejo Street",
    city: "San Francisco, California",
  },
  property: {
    style: "Pacific Heights Victorian",
    yearBuilt: 1924,
    squareFeet: 4200,
    bedrooms: 5,
    bathrooms: 4,
    lotSize: "0.14 acres",
    lastInspection: "June 18, 2026",
    narrative:
      "A distinguished 1924 Victorian with original millwork, bay windows facing the bay, and a garden terrace that defines the character of Vallejo Street. Your home carries a century of craftsmanship — and deserves a care plan written with the same intention.",
  },
  homeCareScore: {
    score: 84,
    label: "Well Maintained",
    summary:
      "Your home is in strong condition. A few targeted investments this season will preserve its value for decades.",
    dimensions: [
      { name: "Exterior Envelope", score: 88 },
      { name: "Roof & Drainage", score: 79 },
      { name: "Windows & Seals", score: 72 },
      { name: "Landscape & Grounds", score: 91 },
    ],
  },
  inspections: [
    {
      id: "roof",
      title: "Roof & Gutters",
      caption: "Clay tile in good condition. Minor moss noted on north slope.",
      image:
        "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80",
    },
    {
      id: "exterior",
      title: "Exterior & Paint",
      caption: "Original stucco preserved. South facade due for touch-up.",
      image:
        "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80",
    },
    {
      id: "windows",
      title: "Windows & Seals",
      caption: "Bay windows retain character. Seal restoration recommended.",
      image:
        "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80",
    },
    {
      id: "landscape",
      title: "Garden Terrace",
      caption: "Irrigation efficient. Boxwood hedges thriving.",
      image:
        "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1200&q=80",
    },
    {
      id: "interior",
      title: "Interior Millwork",
      caption: "Original woodwork intact. Humidity levels optimal.",
      image:
        "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200&q=80",
    },
  ],
  recommendations: [
    {
      priority: "This Season",
      title: "Window Seal Restoration",
      description:
        "South-facing bay windows are showing early seal fatigue. Addressing this now prevents moisture intrusion and protects original sash.",
      investment: "$2,400 – $3,200",
    },
    {
      priority: "Before Winter",
      title: "Roof Moss Treatment",
      description:
        "A gentle treatment on the north slope will extend tile life and maintain your roof's integrity through the rainy season.",
      investment: "$680 – $920",
    },
    {
      priority: "Annual Care",
      title: "Exterior Wood Preservation",
      description:
        "Original trim and fascia benefit from a preservation treatment every 18 months. Your millwork is irreplaceable.",
      investment: "$1,800 – $2,400",
    },
  ],
  memberships: [
    {
      id: "essential",
      name: "Essential Care",
      price: 149,
      description: "Foundational protection for your home.",
      features: [
        "Bi-annual home inspection",
        "Digital care report",
        "Email support",
        "10% repair discount",
      ],
      highlighted: false,
    },
    {
      id: "preferred",
      name: "Preferred Care",
      price: 249,
      description: "The plan we recommend for your home.",
      badge: "Recommended for Larry",
      features: [
        "Quarterly inspections",
        "Priority scheduling",
        "Dedicated care advisor",
        "Annual deep care report",
        "15% repair discount",
        "Emergency response line",
      ],
      highlighted: true,
    },
    {
      id: "estate",
      name: "Estate Care",
      price: 449,
      description: "White-glove stewardship for distinguished properties.",
      features: [
        "Monthly wellness visits",
        "Concierge scheduling",
        "Vendor management",
        "Seasonal preparation",
        "20% repair discount",
        "24/7 priority line",
      ],
      highlighted: false,
    },
  ],
  benefits: [
    {
      title: "Proactive, Not Reactive",
      description:
        "We find what others miss — before it becomes an emergency repair.",
    },
    {
      title: "Written for Your Home",
      description:
        "Every recommendation is specific to 1847 Vallejo. Nothing generic. Nothing templated.",
    },
    {
      title: "Trusted Craftsmen",
      description:
        "Vetted specialists who respect historic homes and original materials.",
    },
    {
      title: "A Single Relationship",
      description:
        "One team that knows your property, your preferences, and your standards.",
    },
  ],
  reviews: {
    count: 127,
    rating: 5,
    isSample: true,
    featured: [
      {
        quote:
          "They treated our home with real care. Every detail mattered.",
        author: "Homeowner, Chico",
        location: "Chico",
      },
      {
        quote:
          "I've never seen a care report this thoughtful. It changed how we think about our home.",
        author: "Member, Bidwell Park",
        location: "Chico",
      },
      {
        quote:
          "Preferred Care paid for itself in the first year. Not a single surprise repair.",
        author: "Preferred Care Member",
        location: "Chico",
      },
    ],
  },
} as const;
