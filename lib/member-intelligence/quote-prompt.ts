import type { QuoteGenerationContext } from "./types";
import {
  calculateMembershipPrice,
  inferMembershipTierId,
  summarizeMembershipValue,
} from "@/lib/membership/tier-config";

export const AI_QUOTE_PROMPT_VERSION = "v1";

const OBSERVATION_FLAG_LABELS: Record<string, string> = {
  heavyPollen: "Heavy pollen/debris",
  windowOxidation: "Oxidation on windows",
  guttersFull: "Gutters full",
  roofAlgae: "Roof algae visible",
  drivewayStaining: "Driveway staining",
  softMoss: "Soft moss on surfaces",
};

function formatObservationFlags(
  flags: QuoteGenerationContext["fieldInputs"]["observationFlags"],
): string[] {
  return Object.entries(flags)
    .filter(([, enabled]) => enabled)
    .map(([key]) => OBSERVATION_FLAG_LABELS[key] ?? key);
}

function formatHomeownerVibe(vibe: string | null): string {
  switch (vibe) {
    case "proud":
      return "Very proud of their home";
    case "practical":
      return "Practical / value-focused";
    case "busy":
      return "Busy — wants it handled";
    case "skeptical":
      return "Skeptical — needs convincing";
    default:
      return "Not specified";
  }
}

/**
 * Builds the GPT prompt for personalized field quotes.
 * Server-only — call from an API route with OPENAI_API_KEY.
 */
export function buildAIQuotePrompt(context: QuoteGenerationContext): string {
  const { fieldInputs, property, member } = context;
  const { details } = property;
  const sqft = details.squareFootage ?? 2500;
  const tier = inferMembershipTierId(member?.membershipTier ?? "premium");
  const monthlyPrice = calculateMembershipPrice(tier, sqft);
  const value = summarizeMembershipValue(tier, sqft);
  const flagLabels = formatObservationFlags(fieldInputs.observationFlags);
  const observations = [
    ...fieldInputs.observations,
    ...flagLabels,
  ].filter(Boolean);

  const memberBlock = member
    ? `
EXISTING MEMBER CONTEXT:
- Member since: ${member.memberSince ?? "unknown"}
- Tier: ${member.membershipTier ?? tier}
- Monthly membership: $${monthlyPrice}/mo ($${monthlyPrice * 12}/yr)
- Total saved to date: $${member.totalSaved.toFixed(0)}
- Services they love: ${(member.preferredServices ?? []).join(", ") || "not recorded yet"}
- Pitch angle: ${value.narrative === "certainty" ? value.certaintyCopy : `Highlight ~$${Math.max(0, value.annualDelta)}/yr savings vs retail.`}
`
    : `
PROSPECT QUOTE CONTEXT:
- Recommended tier at ${sqft} sq ft: ${tier} at $${monthlyPrice}/mo
- Retail value of included services: ~$${value.retailAnnual}/yr
- Member price: $${value.memberAnnual}/yr
- Pitch angle: ${value.narrative === "certainty" ? value.certaintyCopy : `Show savings of ~$${Math.max(0, value.annualDelta)}/yr vs booking individually.`}
`;

  return `
You are a premium home services consultant writing a personalized proposal
for a homeowner. Your tone is warm, expert, and specific to THEIR home.
Never sound like a template. Make them feel seen.

PROPERTY DETAILS:
- Address: ${property.address}, ${property.city}, ${property.state} ${property.zip}
- Home built: ${details.yearBuilt ?? "unknown"}
- Size: ${details.squareFootage ?? "unknown"} sq ft
- Exterior: ${details.exteriorMaterial ?? "unknown"}
- Windows: approximately ${details.windowCount ?? "unknown"}
- Has pool: ${details.hasPool ? "yes" : "no"}

WHAT THE TECHNICIAN OBSERVED TODAY:
${observations.length ? observations.join(", ") : "General exterior assessment"}
Home condition rating: ${fieldInputs.homeCondition ?? "not rated"}

HOMEOWNER PERSONALITY:
${formatHomeownerVibe(fieldInputs.homeownerVibe)}

TECHNICIAN NOTES:
${fieldInputs.notes.trim() || "None"}

${memberBlock}

Write a personalized quote proposal that:
1. Opens by acknowledging something SPECIFIC about their home
2. Explains what you noticed and why it matters to THEIR property
3. Recommends 2-3 services with clear reasoning
4. If prospect: introduces the membership as the smart choice,
   showing exactly how much they'd save on today's services alone
5. Closes warmly — not salesy, like a trusted advisor

Format: 3-4 paragraphs. Conversational but premium.
No bullet points. No generic language.
`.trim();
}
