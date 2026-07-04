import { ROUTES, type NavItem } from "./config";

/** Session shape for future auth — swap `getNavigationSession` implementation only */
export interface NavigationSession {
  displayName: string;
  portalHref: string;
  menuItems: NavItem[];
  signOutLabel?: string;
}

/** Authenticated member menu — wired when real portal URLs exist per member */
export const AUTHENTICATED_MEMBER_MENU: NavItem[] = [
  { label: "Member Portal", href: ROUTES.request, variant: "portal" },
  { label: "Contact", href: ROUTES.contact },
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
