import { sampleHomeCarePlanPath } from "@/lib/acquisition/types";
import { propertyHubContext } from "@/lib/property/mock-data";
import type {
  AdminIncomingRequest,
  AdminMembershipOverview,
  AdminOverview,
  AdminPropertyIntel,
  AdminRecentPlan,
  AdminStats,
} from "./types";

const properties = propertyHubContext.homeowner.properties;

export const MOCK_ADMIN_STATS: AdminStats = {
  totalHomeowners: 1,
  totalProperties: properties.length,
  activeMembers: 2,
  homeCarePlansCreated: 3,
  pendingRequests: 4,
  signedAgreements: 2,
  estimatedMrr: 1840,
  upcomingVisits: 8,
  photosDocumentsStored: properties.reduce((sum, p) => sum + p.photoCount, 0),
  averageHomeCareScore: Math.round(
    properties.reduce((sum, p) => sum + p.homeCareScore, 0) / properties.length,
  ),
};

export const MOCK_INCOMING_REQUESTS: AdminIncomingRequest[] = [
  {
    id: "req-1",
    name: "Sarah Mitchell",
    phone: "(530) 555-0142",
    serviceAddress: "892 Magnolia Lane, Chico",
    services: ["Window Cleaning", "Full Home Care Membership"],
    submittedAt: "2026-07-02T14:20:00Z",
    status: "new",
    source: "mock",
  },
  {
    id: "req-2",
    name: "James & Elena Ruiz",
    phone: "(530) 555-0198",
    serviceAddress: "2201 Bidwell Ave, Chico",
    services: ["Exterior Home Care"],
    submittedAt: "2026-07-01T09:45:00Z",
    status: "contacted",
    source: "mock",
  },
  {
    id: "req-3",
    name: "Whitney Cole",
    phone: "(530) 555-0116",
    serviceAddress: "455 Vallombrosa Ave, Chico",
    services: ["Gutter Cleaning", "Pressure Washing"],
    submittedAt: "2026-06-30T16:10:00Z",
    status: "scheduled",
    source: "mock",
  },
  {
    id: "req-4",
    name: "Marcus Chen",
    phone: "(530) 555-0177",
    serviceAddress: "1184 Esplanade, Chico",
    services: ["Window Cleaning"],
    submittedAt: "2026-06-29T11:30:00Z",
    status: "new",
    source: "mock",
  },
];

export const MOCK_RECENT_PLANS: AdminRecentPlan[] = [
  {
    id: "mock-canyon-oaks",
    homeownerName: "Larry Buckley",
    propertyName: "Canyon Oaks Residence",
    membershipRecommendation: "Preferred Membership",
    createdAt: "2026-06-18T10:00:00Z",
    status: "published",
    href: sampleHomeCarePlanPath,
    source: "mock",
  },
  {
    id: "mock-downtown",
    homeownerName: "Larry Buckley",
    propertyName: "Downtown Chico Office",
    membershipRecommendation: "Essential Care",
    createdAt: "2026-06-12T15:30:00Z",
    status: "generated",
    href: "/properties/downtown-chico-office/home-care-plan",
    source: "mock",
  },
];

export function buildMockMembershipOverview(): AdminMembershipOverview {
  return {
    active: MOCK_ADMIN_STATS.activeMembers,
    pending: 1,
    canceled: 0,
    estimatedMrr: MOCK_ADMIN_STATS.estimatedMrr,
    popularTier: "Preferred Membership",
    source: "mock",
  };
}

export function buildMockPropertyIntel(): AdminPropertyIntel {
  const sorted = [...properties].sort((a, b) => b.homeCareScore - a.homeCareScore);

  return {
    topProperties: sorted.slice(0, 3).map((property) => ({
      name: property.name,
      homeowner: propertyHubContext.homeowner.fullName,
      score: property.homeCareScore,
      href: `/properties/${property.slug}`,
    })),
    averageScore: MOCK_ADMIN_STATS.averageHomeCareScore,
    needsAttention: properties
      .filter((p) => p.healthStatus === "Needs Attention" || p.homeCareScore < 80)
      .map((p) => ({
        name: p.name,
        reason:
          p.healthStatus === "Needs Attention"
            ? "Health review recommended"
            : "Score below target threshold",
        href: `/properties/${p.slug}`,
      })),
    timelineDepth: properties.reduce((sum, p) => sum + p.timelineLength, 0),
    source: "mock",
  };
}

export function buildMockOverview(privateBeta: boolean): AdminOverview {
  return {
    stats: MOCK_ADMIN_STATS,
    recentPlans: MOCK_RECENT_PLANS,
    incomingRequests: MOCK_INCOMING_REQUESTS,
    membership: buildMockMembershipOverview(),
    propertyIntel: buildMockPropertyIntel(),
    dataSources: {
      stats: "mock",
      plans: "mock",
      requests: "mock",
      membership: "mock",
      propertyIntel: "mock",
    },
    supabaseConnected: false,
    privateBeta,
  };
}
