import type {
  WebsiteMembershipSaleActivationMode,
  WebsiteMembershipSaleTier,
} from "./website-membership-sales-types";

export function allowsMockWebsiteMembershipSales(): boolean {
  return process.env.ALLOW_MOCK_PAYMENT === "true";
}

export function qualifiesForWebsiteMembershipSale(
  activationMode: WebsiteMembershipSaleActivationMode,
): boolean {
  if (activationMode === "stripe") return true;
  return allowsMockWebsiteMembershipSales();
}

export function computeAnnualizedMembershipValue(
  visitPrice: number,
  visitsPerYear: number,
): number {
  return Math.round(visitPrice * visitsPerYear * 100) / 100;
}

export function formatPropertyAddress(parts: {
  address: string;
  city: string;
  state: string;
  zip: string;
}): string {
  const cityStateZip = [parts.city, [parts.state, parts.zip].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return [parts.address, cityStateZip].filter(Boolean).join(", ");
}

export function formatWebsiteMembershipSaleTier(
  tier: WebsiteMembershipSaleTier,
): string {
  return tier === "biannual" ? "Bi-Annual" : "Quarterly";
}

export function isWebsiteMembershipSaleTier(
  value: string | null | undefined,
): value is WebsiteMembershipSaleTier {
  return value === "biannual" || value === "quarterly";
}
