import { canyonOaksHomeCarePlan } from "@/lib/home-care-plan/canyon-oaks";
import {
  EMPLOYEE_BRAND_NAME,
  ROUTES,
  type NavItem,
} from "./config";

export type NavigationMode = "customer" | "employee" | "hidden";

export interface Breadcrumb {
  label: string;
  href?: string;
}

export interface FloatingBackConfig {
  href: string;
  label: string;
  bottomClass?: string;
}

const EMPLOYEE_PREFIXES = ["/employee", "/properties", "/presentations", "/tech"];
const HIDDEN_PREFIXES = ["/hq", "/admin"];

function isPresentationPresentMode(pathname: string): boolean {
  return /^\/presentations\/[^/]+\/present$/.test(pathname);
}

export function getNavigationMode(pathname: string): NavigationMode {
  if (HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return "hidden";
  }
  if (isPresentationPresentMode(pathname)) {
    return "hidden";
  }
  if (EMPLOYEE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return "employee";
  }
  return "customer";
}

export function shouldUseOverlayNav(pathname: string): boolean {
  if (pathname === ROUTES.home) return true;
  if (pathname.startsWith("/homecare/") && pathname.endsWith("/portal")) {
    return true;
  }
  if (pathname.startsWith("/homecare/") && pathname.endsWith("/plan")) {
    return true;
  }
  return false;
}

export function isActiveNavItem(pathname: string, href: string): boolean {
  if (href === ROUTES.home || href === ROUTES.employeeHome) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getBreadcrumbs(pathname: string): Breadcrumb[] {
  if (pathname.startsWith("/employee")) {
    return getEmployeeBreadcrumbs(pathname);
  }

  if (pathname.startsWith("/properties")) {
    return getPropertyBreadcrumbs(pathname);
  }

  if (pathname.startsWith("/homecare/")) {
    return getHomecareBreadcrumbs(pathname);
  }

  if (pathname.startsWith("/presentations")) {
    return getPresentationBreadcrumbs(pathname);
  }

  return [];
}

function getEmployeeBreadcrumbs(pathname: string): Breadcrumb[] {
  const crumbs: Breadcrumb[] = [
    { label: "Employee", href: ROUTES.employeeHome },
  ];

  if (pathname === ROUTES.employeeHome) {
    return [{ label: "Employee" }];
  }

  if (pathname === ROUTES.createPlan) {
    crumbs.push({ label: "Create Home Care Plan" });
    return crumbs;
  }

  if (pathname === ROUTES.requests) {
    crumbs.push({ label: "Requests" });
    return crumbs;
  }

  if (pathname === ROUTES.settings) {
    crumbs.push({ label: "Settings" });
    return crumbs;
  }

  return crumbs;
}

function getPropertyBreadcrumbs(pathname: string): Breadcrumb[] {
  const crumbs: Breadcrumb[] = [
    { label: "Employee", href: ROUTES.employeeHome },
    { label: "Properties", href: ROUTES.properties },
  ];

  if (pathname === ROUTES.properties) {
    return [
      { label: "Employee", href: ROUTES.employeeHome },
      { label: "Properties" },
    ];
  }

  const match = pathname.match(/^\/properties\/([^/]+)(?:\/(.+))?$/);
  if (!match) return crumbs;

  const [, slug, subpath] = match;
  const propertyName = formatSlug(slug);

  crumbs.push({
    label: propertyName,
    href: subpath ? `/properties/${slug}` : undefined,
  });

  if (subpath === "home-care-plan") {
    crumbs.push({ label: "Home Care Plan" });
  }

  return crumbs;
}

function getHomecareBreadcrumbs(pathname: string): Breadcrumb[] {
  const match = pathname.match(/^\/homecare\/([^/]+)\/([^/]+)\/(plan|portal)$/);
  if (!match) return [];

  const [, homeownerSlug, propertySlug, page] = match;
  const propertyName =
    homeownerSlug === canyonOaksHomeCarePlan.homeowner.slug &&
    propertySlug === canyonOaksHomeCarePlan.property.slug
      ? canyonOaksHomeCarePlan.property.name
      : formatSlug(propertySlug);

  const crumbs: Breadcrumb[] = [{ label: "Home", href: ROUTES.home }];

  if (page === "plan") {
    crumbs.push({ label: propertyName });
    crumbs.push({ label: "Home Care Plan" });
  } else {
    crumbs.push({ label: "Member Portal" });
  }

  return crumbs;
}

function getPresentationBreadcrumbs(pathname: string): Breadcrumb[] {
  const crumbs: Breadcrumb[] = [
    { label: "Employee", href: ROUTES.employeeHome },
    { label: "Presentations", href: ROUTES.presentations },
  ];

  if (pathname === ROUTES.presentations) {
    return [
      { label: "Employee", href: ROUTES.employeeHome },
      { label: "Presentations" },
    ];
  }

  const editMatch = pathname.match(/^\/presentations\/([^/]+)\/edit$/);
  if (editMatch) {
    crumbs.push({ label: "Edit Presentation" });
    return crumbs;
  }

  return crumbs;
}

export function getFloatingBack(pathname: string): FloatingBackConfig | null {
  if (pathname === ROUTES.createPlan) {
    return { href: ROUTES.employeeHome, label: "Back to Dashboard" };
  }

  if (pathname === ROUTES.presentations) {
    return { href: ROUTES.employeeHome, label: "Back to Dashboard" };
  }

  const presentationEditMatch = pathname.match(/^\/presentations\/[^/]+\/edit$/);
  if (presentationEditMatch) {
    return { href: ROUTES.presentations, label: "Back to Presentations" };
  }

  const propertyPlanMatch = pathname.match(
    /^\/properties\/([^/]+)\/home-care-plan$/,
  );
  if (propertyPlanMatch) {
    return {
      href: `/properties/${propertyPlanMatch[1]}`,
      label: "Back to Property",
    };
  }

  if (
    pathname.startsWith("/homecare/") &&
    (pathname.endsWith("/plan") || pathname.endsWith("/portal"))
  ) {
    return {
      href: ROUTES.home,
      label: "Back to Home",
      bottomClass: pathname.endsWith("/plan") ? "bottom-24 md:bottom-6" : undefined,
    };
  }

  return null;
}

export function getMobileBackItem(
  pathname: string,
  mode: NavigationMode,
): NavItem | null {
  const floating = getFloatingBack(pathname);
  if (!floating) return null;

  return {
    label:
      mode === "employee"
        ? floating.label.replace("Back to ", "")
        : floating.label.replace("Back to ", ""),
    href: floating.href,
  };
}

function formatSlug(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function getBrandName(mode: NavigationMode): string {
  return mode === "employee" ? EMPLOYEE_BRAND_NAME : "SqueegeeKing";
}
