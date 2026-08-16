const REP_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function salesWorkspacePath(repSlug: string): string {
  const normalized = repSlug.trim().toLowerCase();
  if (!REP_SLUG_PATTERN.test(normalized)) return "/sales/access";
  return normalized === "david"
    ? "/david"
    : `/sales/${encodeURIComponent(normalized)}`;
}

export function safeSalesReturnTo(
  value: unknown,
  fallback = "/sales/access",
): string {
  if (typeof value !== "string" || !value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.includes("\\")) return fallback;
  if (value === "/sales/access" || value.startsWith("/sales/access?")) {
    return fallback;
  }
  if (
    value === "/david" ||
    value.startsWith("/david?") ||
    value.startsWith("/sales/") ||
    value === "/presentations/new" ||
    value.startsWith("/presentations/new?") ||
    /^\/presentations\/[0-9a-f-]+\/(?:edit|present)(?:\?.*)?$/i.test(value)
  ) {
    return value;
  }
  return fallback;
}

export function salesAccessPath(input: {
  returnTo: string;
  repSlug?: string | null;
}): string {
  const fallback = input.repSlug
    ? salesWorkspacePath(input.repSlug)
    : "/sales/access";
  const params = new URLSearchParams({
    returnTo: safeSalesReturnTo(input.returnTo, fallback),
  });
  if (input.repSlug) params.set("rep", input.repSlug);
  return `/sales/access?${params.toString()}`;
}

export function salesReturnToForRep(value: unknown, repSlug: string): string {
  const workspace = salesWorkspacePath(repSlug);
  const resolved = safeSalesReturnTo(value, workspace);
  if (resolved === "/david" || resolved.startsWith("/david?")) {
    return repSlug.trim().toLowerCase() === "david" ? resolved : workspace;
  }
  if (resolved.startsWith("/sales/")) {
    return resolved === workspace || resolved.startsWith(`${workspace}?`)
      ? resolved
      : workspace;
  }
  return resolved;
}
