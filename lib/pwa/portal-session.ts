/** Stable localStorage key — survives PWA installs; portal URL stays /portal/[token]. */
export const PORTAL_ACCESS_TOKEN_KEY = "homeatlas:portal-access-token";

export function readStoredPortalToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(PORTAL_ACCESS_TOKEN_KEY)?.trim();
    return value || null;
  } catch {
    return null;
  }
}

export function storePortalAccessToken(token: string): void {
  if (typeof window === "undefined") return;
  const normalized = token.trim();
  if (!normalized) return;
  try {
    localStorage.setItem(PORTAL_ACCESS_TOKEN_KEY, normalized);
  } catch {
    // Private browsing or storage quota — portal still works via direct link.
  }
}

export function clearStoredPortalToken(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(PORTAL_ACCESS_TOKEN_KEY);
  } catch {
    // ignore
  }
}
