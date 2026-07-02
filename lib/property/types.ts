export type MembershipStatus =
  | "Preferred Care"
  | "Essential Care"
  | "Estate Care"
  | "Inactive";

export type AIStatus = "Active" | "Processing" | "Idle";

export type PropertyHealthStatus =
  | "Excellent"
  | "Well Maintained"
  | "Needs Attention"
  | "Under Review";

export interface TimelineEntry {
  id: string;
  date: string;
  technician: string;
  title: string;
  summary: string;
  photoCount: number;
  scoreChange?: number;
  servicesCompleted: string[];
}

export interface Property {
  slug: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  type: "Residence" | "Commercial" | "Vacation" | "Rental";
  heroImage: string;
  homeCareScore: number;
  membershipStatus: MembershipStatus;
  lastVisit: string;
  nextScheduledVisit: string | null;
  photoCount: number;
  timelineLength: number;
  aiStatus: AIStatus;
  healthStatus: PropertyHealthStatus;
  yearBuilt: number;
  squareFeet: number;
  narrative: string;
  recentTimeline: TimelineEntry[];
}

export interface Homeowner {
  slug: string;
  fullName: string;
  firstName: string;
  email: string;
  properties: Property[];
}

export interface Company {
  name: string;
  slug: string;
}

export interface PropertyHubContext {
  company: Company;
  homeowner: Homeowner;
}

export function getPropertyBySlug(
  context: PropertyHubContext,
  slug: string,
): Property | undefined {
  return context.homeowner.properties.find((p) => p.slug === slug);
}

export function getAllPropertySlugs(context: PropertyHubContext): string[] {
  return context.homeowner.properties.map((p) => p.slug);
}
