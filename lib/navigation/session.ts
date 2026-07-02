import { ROUTES, type NavItem } from "./config";

/** Session shape for future auth — swap `getNavigationSession` implementation only */
export interface NavigationSession {
  displayName: string;
  portalHref: string;
  menuItems: NavItem[];
  signOutLabel?: string;
}

/** Authenticated member menu — ready for auth provider */
export const AUTHENTICATED_MEMBER_MENU: NavItem[] = [
  { label: "Dashboard", href: ROUTES.samplePortal },
  { label: "Properties", href: ROUTES.samplePlan },
  { label: "Settings", href: ROUTES.contact },
];

/**
 * Returns the signed-in navigation session, or null when anonymous.
 * Wire to Supabase / session cookie when authentication ships.
 */
export function getNavigationSession(): NavigationSession | null {
  return null;
}

export function buildNavigationSession(user: {
  fullName: string;
  portalHref: string;
}): NavigationSession {
  return {
    displayName: user.fullName,
    portalHref: user.portalHref,
    menuItems: AUTHENTICATED_MEMBER_MENU,
    signOutLabel: "Sign Out",
  };
}
