import { createHash } from "node:crypto";
import {
  calculateWindowCarePricing,
  normalizeCompanySettings,
  type CompanySettings,
} from "@/lib/pricing/window-care-pricing";
import type { PricingInput } from "@/lib/pricing/types";

export const ATLAS_ENGINE_VERSION = "atlas-window-care-v1.0";

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashSnapshotValue(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

export interface AtlasPricingSnapshotDraft {
  engineVersion: typeof ATLAS_ENGINE_VERSION;
  companySettingsVersion: string;
  companySettingsHash: string;
  normalizedInputs: PricingInput;
  lineItemOutput: ReturnType<typeof calculateWindowCarePricing>;
  authorizedChargeCents: number;
}

export function createAtlasPricingSnapshotDraft(input: {
  pricingInput: PricingInput;
  companySettings: CompanySettings;
  companySettingsVersion: string;
}): AtlasPricingSnapshotDraft {
  const settings = normalizeCompanySettings(input.companySettings);
  const normalizedInputs: PricingInput = {
    squareFeet: Math.round(input.pricingInput.squareFeet),
    frequency: input.pricingInput.frequency,
    includeInterior: Boolean(input.pricingInput.includeInterior),
    includeScreens: Boolean(input.pricingInput.includeScreens),
    twoStory: Boolean(input.pricingInput.twoStory),
  };
  const output = calculateWindowCarePricing(normalizedInputs, undefined, settings);
  const authorizedAmount = normalizedInputs.includeInterior
    ? output.interiorExteriorMemberPrice
    : output.exteriorMemberPrice;

  return {
    engineVersion: ATLAS_ENGINE_VERSION,
    companySettingsVersion: input.companySettingsVersion,
    companySettingsHash: hashSnapshotValue(settings),
    normalizedInputs,
    lineItemOutput: output,
    authorizedChargeCents: Math.round(authorizedAmount * 100),
  };
}
