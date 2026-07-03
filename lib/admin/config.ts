/** Session keys — client only */
export const ADMIN_UNLOCK_KEY = "squeegeeking:admin-unlocked";
export const ADMIN_PIN_SESSION_KEY = "squeegeeking:admin-pin-session";
export const FOUNDER_NOTES_KEY = "squeegeeking:founder-notes";

export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export function isAdminPinConfigured(): boolean {
  if (typeof window !== "undefined") {
    return Boolean(process.env.NEXT_PUBLIC_ADMIN_PIN?.trim());
  }
  return Boolean(process.env.NEXT_PUBLIC_ADMIN_PIN?.trim());
}

export function isAdminPrivateBeta(): boolean {
  return !process.env.NEXT_PUBLIC_ADMIN_PIN?.trim();
}

/**
 * PIN gate is private beta only. Replace with Supabase Auth before real customer data is exposed.
 */
export const ADMIN_PIN_ARCHITECTURE_NOTE =
  "PIN gate is private beta only. Replace with Supabase Auth before real customer data is exposed.";
