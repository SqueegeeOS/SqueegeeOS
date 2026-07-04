/**
 * Atlas Pricing Engine — quote copy helpers.
 */
import type { PricingOutput } from "./types";

export function formatDollars(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}

export function buildCopyQuote(
  sqft: number,
  output: Pick<
    PricingOutput,
    | "frequencyLabel"
    | "exteriorMemberPrice"
    | "interiorExteriorMemberPrice"
    | "exteriorOneTimePrice"
  >,
): string {
  return (
    `For a ${sqft.toLocaleString()} sq ft home, ` +
    `standard recurring exterior glass care is $${output.exteriorMemberPrice} ` +
    `per visit ${output.frequencyLabel.toLowerCase()}. ` +
    `Interior + exterior glass is $${output.interiorExteriorMemberPrice} per visit. ` +
    `One-time exterior glass is $${output.exteriorOneTimePrice}.`
  );
}
