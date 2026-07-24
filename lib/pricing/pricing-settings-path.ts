/** Pricing settings are not consumed by either production or demo portal routes. */
export function isPortalRoute(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] === "portal") {
    return true;
  }

  return (
    segments[0] === "homecare" &&
    Boolean(segments[1]) &&
    Boolean(segments[2]) &&
    segments[3] === "portal"
  );
}
