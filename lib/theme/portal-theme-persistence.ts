import {
  DEFAULT_ATLAS_THEME,
  isAtlasThemeId,
  type AtlasThemeId,
} from "@/lib/theme/atlas-themes";

export const PORTAL_THEME_STORAGE_PREFIX = "homeatlas-portal-theme";

/** Membership-scoped localStorage key; falls back to a generic portal key. */
export function portalThemeStorageKey(membershipId?: string | null): string {
  const id = membershipId?.trim();
  return id ? `${PORTAL_THEME_STORAGE_PREFIX}:${id}` : PORTAL_THEME_STORAGE_PREFIX;
}

export function readPortalThemeFromStorage(
  membershipId?: string | null,
): AtlasThemeId | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(portalThemeStorageKey(membershipId));
    return isAtlasThemeId(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function writePortalThemeToStorage(
  theme: AtlasThemeId,
  membershipId?: string | null,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(portalThemeStorageKey(membershipId), theme);
  } catch {
    // private mode — non-persistent preview still works
  }
}

/** Server preference wins, then membership-scoped localStorage, then default. */
export function resolvePortalThemePreference(
  serverTheme: unknown,
  membershipId?: string | null,
): AtlasThemeId {
  if (isAtlasThemeId(serverTheme)) return serverTheme;
  const stored = readPortalThemeFromStorage(membershipId);
  if (stored) return stored;
  return DEFAULT_ATLAS_THEME;
}
