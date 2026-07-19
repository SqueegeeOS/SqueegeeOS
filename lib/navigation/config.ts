import { CUSTOMER_BRAND } from "@/lib/brand/customer";
import { PLATFORM_BRAND } from "@/lib/brand/platform";

export const SITE_NAV_HEIGHT = "3.5rem";

export const ROUTES = {
  home: "/",
  day2: "/day2",
  request: "/request",
  contact: "/contact",
  employeeHome: "/employee",
  createPlan: "/employee/home-care-plan/create",
  properties: "/properties",
  requests: "/employee/requests",
  settings: "/employee/settings",
  hq: "/hq",
  hqOurStory: "/hq/our-story",
  hqCarePlanBuilder: "/hq/care-plan-builder",
  hqPricingSettings: "/hq/settings/pricing",
  hqProductionCheck: "/hq/production-check",
  hqProductionHealth: "/hq/production-health",
  hqPendingRequests: "/hq/requests",
  hqToday: "/hq/today",
  hqBilling: "/hq/billing",
  hqMembership: "/hq/memberships",
  hqCustomerWorkspace: (type: string, id: string) =>
    `/hq/customers/${type}/${encodeURIComponent(id)}`,
  /** @deprecated Use hqCarePlanBuilder — redirect remains at /hq/pricing */
  hqPricing: "/hq/care-plan-builder",
  tech: "/tech",
  experience: "/experience",
  experienceUnlock: "/experience/unlock",
  experienceRequestTransition: "/experience/request-transition",
  experienceHeadquartersArrival: "/experience/headquarters-arrival",
  setupGoogleReviews: "/setup/google-reviews",
  presentations: "/presentations",
  newPresentation: "/presentations/new",
} as const;

export interface NavItem {
  label: string;
  href: string;
  external?: boolean;
  /** Reserved for auth-aware rendering (portal CTA, account menu) */
  variant?: "default" | "portal" | "account";
}

export const CUSTOMER_PRIMARY_NAV: NavItem[] = [
  { label: "Home", href: ROUTES.home },
  { label: "Request Plan", href: ROUTES.request },
];

export const CUSTOMER_TAIL_NAV: NavItem[] = [
  { label: "Contact", href: ROUTES.contact },
];

/** @deprecated Use CUSTOMER_PRIMARY_NAV + CUSTOMER_TAIL_NAV */
export const CUSTOMER_NAV_ITEMS: NavItem[] = [
  ...CUSTOMER_PRIMARY_NAV,
  ...CUSTOMER_TAIL_NAV,
];

export const EMPLOYEE_NAV_ITEMS: NavItem[] = [
  { label: "Employee Home", href: ROUTES.employeeHome },
  { label: "Field Visits", href: ROUTES.tech },
  { label: "Presentations", href: ROUTES.presentations },
  { label: "Create Home Care Plan", href: ROUTES.createPlan },
  { label: "Properties", href: ROUTES.properties },
  { label: "Requests", href: ROUTES.requests },
  { label: "Settings", href: ROUTES.settings },
];

export const CUSTOMER_BRAND_NAME = CUSTOMER_BRAND.name;
export const EMPLOYEE_BRAND_NAME = PLATFORM_BRAND.name;
