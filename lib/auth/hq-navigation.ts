export const DEFAULT_HQ_NEXT_PATH = "/hq";

export function resolveSafeHqNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_HQ_NEXT_PATH;
  }

  try {
    const parsed = new URL(value, "https://homeatlas.invalid");
    if (parsed.origin !== "https://homeatlas.invalid") {
      return DEFAULT_HQ_NEXT_PATH;
    }
    if (parsed.pathname !== "/hq" && !parsed.pathname.startsWith("/hq/")) {
      return DEFAULT_HQ_NEXT_PATH;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return DEFAULT_HQ_NEXT_PATH;
  }
}

export function resolveHqAuthOrigin(requestUrl: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    const url = new URL(configured);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("NEXT_PUBLIC_APP_URL must use http or https");
    }
    return url.origin;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_APP_URL is required for Headquarters auth");
  }
  return new URL(requestUrl).origin;
}
