import { canyonOaksHomeCarePlan } from "@/lib/home-care-plan/canyon-oaks";
import { ROUTES } from "./config";

export interface HqSiteBrowseLink {
  label: string;
  href: string;
  description?: string;
}

const samplePlanPath = `/homecare/${canyonOaksHomeCarePlan.homeowner.slug}/${canyonOaksHomeCarePlan.property.slug}/plan`;
const samplePortalPath = `/homecare/${canyonOaksHomeCarePlan.homeowner.slug}/${canyonOaksHomeCarePlan.property.slug}/portal`;

/** Founder shortcuts — leave Headquarters without locking the session. */
export const HQ_SITE_BROWSE_LINKS: HqSiteBrowseLink[] = [
  { label: "Employee dashboard", href: ROUTES.employeeHome },
  { label: "Marketing home", href: ROUTES.home, description: "Public homepage" },
  { label: "Request plan", href: ROUTES.request, description: "Lead intake form" },
  { label: "Contact", href: ROUTES.contact, description: "Public contact page" },
  { label: "Employee dashboard", href: ROUTES.employeeHome },
  { label: "Properties", href: ROUTES.properties },
  { label: "Presentations", href: ROUTES.presentations },
  { label: "Field visits", href: ROUTES.tech },
  { label: "Sample home care plan", href: samplePlanPath },
  { label: "Sample member portal", href: samplePortalPath },
];
