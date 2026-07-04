/** Server-side audit log for Google Reviews setup — visible in Vercel/runtime logs. */
export function logGoogleReviewsSetup(
  event:
    | "place_resolved"
    | "connection_test"
    | "managed_businesses_listed"
    | "production_place_checked",
  details: Record<string, string | number | boolean | null | undefined>,
): void {
  console.info(
    `[google-reviews-setup] ${event}`,
    JSON.stringify({
      at: new Date().toISOString(),
      ...details,
    }),
  );
}
