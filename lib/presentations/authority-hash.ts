import "server-only";

import { createHash } from "node:crypto";
import type { PresentationQuoteSnapshot } from "@/lib/presentations/quote-snapshot";
import type { PresentationTier } from "@/lib/presentations/types";

export interface PresentationAuthorityHashInput {
  clientName: string;
  clientAddress: string;
  clientEmail: string;
  homeSqft: number;
  tier: PresentationTier;
  twoStory: boolean;
  includeScreens: boolean;
  quoteSnapshot: PresentationQuoteSnapshot;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function computePresentationAuthoritySha256(
  input: PresentationAuthorityHashInput,
): string {
  return createHash("sha256").update(stableJson(input)).digest("hex");
}
