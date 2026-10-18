export interface WebsiteAttribution { source: string; medium: string | null; campaign: string | null }

function token(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= 100 && /^[a-zA-Z0-9_. -]+$/.test(text) ? text : null;
}

/** Visitor-supplied labels, never an authoritative source or an authorization input. */
export function parseWebsiteAttribution(value: unknown): WebsiteAttribution | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const source = token(input.source);
  if (!source) return null;
  return { source, medium: token(input.medium), campaign: token(input.campaign) };
}

export function websiteAttributionFromParams(params: Pick<URLSearchParams, "get">) {
  return parseWebsiteAttribution({ source: params.get("utm_source"), medium: params.get("utm_medium"), campaign: params.get("utm_campaign") });
}

export function websiteAttributionNote(value: unknown): string | null {
  const attribution = parseWebsiteAttribution(value);
  if (!attribution) return null;
  return `Website campaign (visitor-supplied): ${[attribution.source, attribution.medium, attribution.campaign].filter(Boolean).join(" / ")}`;
}
