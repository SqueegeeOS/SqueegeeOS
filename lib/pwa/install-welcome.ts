/** One-time install welcome — shown after onboarding "Open My Home", never again. */
export const INSTALL_WELCOME_SEEN_KEY = "homeatlas:install-welcome-seen";

export function buildPortalWelcomePath(token: string): string {
  return `/portal/${encodeURIComponent(token)}/welcome`;
}

/** Onboarding links here; falls back to portal URL if token cannot be parsed. */
export function portalWelcomePathFromUrl(portalUrl: string): string {
  const match = portalUrl.match(/\/portal\/([^/?#]+)/);
  if (!match?.[1]) return portalUrl;
  return buildPortalWelcomePath(decodeURIComponent(match[1]));
}

export function hasSeenInstallWelcome(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(INSTALL_WELCOME_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markInstallWelcomeSeen(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(INSTALL_WELCOME_SEEN_KEY, "1");
  } catch {
    // ignore
  }
}
