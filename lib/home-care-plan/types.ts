import type { ReviewsData } from "@/lib/reviews/types";

export interface HomeCarePlanHomeowner {
  firstName: string;
  fullName: string;
  slug: string;
}

export interface HomeCarePlanProperty {
  name: string;
  slug: string;
  address: string;
  city: string;
  state: string;
  heroImage: string;
  yearBuilt: number | null;
  homeCareScore: number | null;
  lastVisit: string | null;
  membershipRecommendation: string;
}

export interface HomeCarePlanFinding {
  id: string;
  title: string;
  severity: string;
  description: string;
  image: string;
}

export interface HomeCarePlanMembershipTier {
  id: string;
  name: string;
  price: string;
  /** Raw per-visit price backing `price` — lets the portal view model render
   * an honest visit-price label before a full portal/membership record exists. */
  visitPrice?: number;
  period: string;
  lifestyle: string;
  highlighted: boolean;
  badge?: string;
}

export interface HomeCarePlanData {
  homeowner: HomeCarePlanHomeowner;
  property: HomeCarePlanProperty;
  brand: {
    company: string;
    tagline: string;
    craftedFor: string;
    footerLines: string[];
  };
  hero: {
    title: string;
    subheadline: string;
    intro: string;
    cta: string;
  };
  propertyHealth: {
    rating: string;
    narrative: string;
  };
  propertyProfile: Array<{
    label: string;
    value: string;
    detail: string;
  }>;
  findings: HomeCarePlanFinding[];
  recommendation: {
    headline: string;
    paragraphs: string[];
    closing: string;
  };
  personalNote: {
    greeting: string;
    paragraphs: string[];
    signoff: string;
    title: string;
    company: string;
  };
  memberships: HomeCarePlanMembershipTier[];
  careJourney: Array<{ step: string; description: string }>;
  membershipBenefits: Array<{ title: string; description: string }>;
  team: Array<{
    id: string;
    slug: string;
    name: string;
    role: string;
    bio: string;
    image: string | null;
    quote?: string;
    roleDetail?: string;
  }>;
  reviews: ReviewsData;
  closing: {
    headline: string;
    subline: string;
    phone: string;
    location: string;
    cta: string;
  };
}
