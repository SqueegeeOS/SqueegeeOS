/** Session keys — client only */
export const ADMIN_UNLOCK_KEY = "squeegeeking:admin-unlocked";
export const FOUNDER_NOTES_KEY = "squeegeeking:founder-notes";
export const FOUNDER_JOURNAL_KEY = "squeegeeking:founder-journal";

export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

/**
 * PIN access is a temporary founder control. Named accounts with MFA remain
 * the recommended long-term boundary for customer data.
 */
export const ADMIN_PIN_ARCHITECTURE_NOTE =
  "Your PIN is verified on the server and never embedded in the site. Named accounts with MFA are the next security milestone.";
