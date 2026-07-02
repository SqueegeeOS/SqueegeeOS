import { sampleHomeCarePlanPath } from "@/lib/acquisition/types";
import { CUSTOMER_BRAND } from "@/lib/brand/customer";

export const SITE_NAV_HEIGHT = "3.5rem";

export const ROUTES = {
  home: "/",
  request: "/request",
  contact: "/contact",
  samplePlan: sampleHomeCarePlanPath,
  samplePortal: "/homecare/larry-buckley/canyon-oaks-residence/portal",
  employeeHome: "/employee",
  createPlan: "/employee/home-care-plan/create",
  properties: "/properties",
  requests: "/employee/requests",
  settings: "/employee/settings",
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
  { label: "Sample Plan", href: ROUTES.samplePlan },
];

export const CUSTOMER_MEMBER_PORTAL: NavItem = {
  label: "Member Portal",
  href: ROUTES.samplePortal,
  variant: "portal",
};

export const CUSTOMER_TAIL_NAV: NavItem[] = [
  { label: "Contact", href: ROUTES.contact },
];

/** @deprecated Use CUSTOMER_PRIMARY_NAV + CUSTOMER_MEMBER_PORTAL + CUSTOMER_TAIL_NAV */
export const CUSTOMER_NAV_ITEMS: NavItem[] = [
  ...CUSTOMER_PRIMARY_NAV,
  CUSTOMER_MEMBER_PORTAL,
  ...CUSTOMER_TAIL_NAV,
];

export const EMPLOYEE_NAV_ITEMS: NavItem[] = [
  { label: "Employee Home", href: ROUTES.employeeHome },
  { label: "Create Home Care Plan", href: ROUTES.createPlan },
  { label: "Properties", href: ROUTES.properties },
  { label: "Requests", href: ROUTES.requests },
  { label: "Settings", href: ROUTES.settings },
];

export const CUSTOMER_BRAND_NAME = CUSTOMER_BRAND.name;
export const EMPLOYEE_BRAND_NAME = "SqueegeeOS";
