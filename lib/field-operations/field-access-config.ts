export const FIELD_SESSION_COOKIE_NAME = "homeatlas-field-session";
export const FIELD_INVITE_TTL_MS = 24 * 60 * 60 * 1_000;
// Technician Access is employment-scoped, not a monthly pass. The long-lived
// device credential is still checked against the database on every request so
// HQ revocation takes effect immediately. Browsers may eventually require a
// fresh one-time install link after this safety horizon.
export const FIELD_SESSION_TTL_MS = 400 * 24 * 60 * 60 * 1_000;
