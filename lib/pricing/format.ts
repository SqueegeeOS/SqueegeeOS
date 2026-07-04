/**
 * Atlas Pricing Engine — quote copy helpers.
 */
import type { CareFrequency, ExteriorAddOnQuote, PricingOutput } from "./types";

export function formatDollars(amount: number): string {
  const cents = Math.round(amount * 100) % 100;
  const hasCents = amount % 1 !== 0 || (cents !== 0 && amount < 1000);
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  })}`;
}

function frequencyPlanLabel(frequency: CareFrequency): string {
  return frequency === "quarterly" ? "Quarterly" : "Bi-Annual";
}

/** Sales line — "You save $122.50 as a Quarterly member." */
export function memberSavingsQuoteLine(
  frequency: CareFrequency,
  savings: number,
): string | null {
  if (savings <= 0) return null;
  return `You save ${formatDollars(savings)} as a ${frequencyPlanLabel(frequency)} member.`;
}

function addOnCopyLabel(item: ExteriorAddOnQuote["lineItems"][number]): string {
  if (item.id === "moss_removal" || item.id === "pressure_wash_concrete") {
    const match = item.detail.match(/^([\d,]+)\s*sq\s*ft/);
    if (match) return `${item.label} (${match[1]} sq ft)`;
  }
  return item.label;
}

export interface StructuredQuoteInput {
  sqft: number;
  frequency: CareFrequency;
  windowCareVisitPrice: number;
  frequencyLabel: string;
  addOns?: ExteriorAddOnQuote | null;
}

export function buildStructuredQuoteSummary(input: StructuredQuoteInput): string {
  const lines: string[] = [
    `Home Care Plan — ${frequencyPlanLabel(input.frequency)}`,
    `Property: ${input.sqft.toLocaleString()} sq ft`,
    "──────────────────────────",
    `Window Care (${input.frequencyLabel.toLowerCase()})`.padEnd(28) +
      formatDollars(input.windowCareVisitPrice),
  ];

  const addOns = input.addOns;
  if (addOns && addOns.lineItems.length > 0) {
    for (const item of addOns.lineItems) {
      lines.push(addOnCopyLabel(item).padEnd(28) + formatDollars(item.listAmount));
    }

    lines.push("──────────────────────────");
    lines.push(
      "Add-On Subtotal".padEnd(28) + formatDollars(addOns.listSubtotal),
    );

    if (addOns.memberDiscountPercent != null && addOns.memberSavings > 0) {
      const savingsLine = memberSavingsQuoteLine(
        input.frequency,
        addOns.memberSavings,
      );
      lines.push("");
      if (savingsLine) lines.push(savingsLine);
      lines.push(
        `${frequencyPlanLabel(input.frequency)} member discount (${addOns.memberDiscountPercent}% off add-ons)`,
      );
      for (const item of addOns.lineItems) {
        if (item.listAmount !== item.amount) {
          const savings = item.listAmount - item.amount;
          lines.push(
            `${item.label}`.padEnd(28) + `−${formatDollars(savings)}`,
          );
        }
      }
      lines.push("──────────────────────────");
      lines.push(
        "Your Member Price".padEnd(28) + formatDollars(addOns.subtotal),
      );
      lines.push("");
      lines.push(
        "*Discount applies while membership payments are current.",
      );
    }

    lines.push("──────────────────────────");
    lines.push(
      "Total Estimate".padEnd(28) +
        formatDollars(input.windowCareVisitPrice + addOns.subtotal),
    );
  } else {
    lines.push("──────────────────────────");
    lines.push(
      "Total Estimate".padEnd(28) + formatDollars(input.windowCareVisitPrice),
    );
  }

  return lines.join("\n");
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
  addOns?: ExteriorAddOnQuote | null,
  options?: {
    frequency?: CareFrequency;
    windowCareVisitPrice?: number;
  },
): string {
  const windowCareVisitPrice =
    options?.windowCareVisitPrice ?? output.exteriorMemberPrice;

  if (options?.frequency) {
    return buildStructuredQuoteSummary({
      sqft,
      frequency: options.frequency,
      windowCareVisitPrice,
      frequencyLabel: output.frequencyLabel,
      addOns,
    });
  }

  const lines = [
    `For a ${sqft.toLocaleString()} sq ft home, ` +
      `standard recurring exterior glass care is $${output.exteriorMemberPrice} ` +
      `per visit ${output.frequencyLabel.toLowerCase()}. ` +
      `Interior + exterior glass is $${output.interiorExteriorMemberPrice} per visit. ` +
      `One-time exterior glass is $${output.exteriorOneTimePrice}.`,
  ];

  if (addOns && addOns.lineItems.length > 0) {
    lines.push("");
    if (addOns.memberDiscountPercent != null) {
      lines.push(
        `Member add-on discount: ${addOns.memberDiscountPercent}% off (active membership).`,
      );
    }
    lines.push("Exterior add-ons:");
    for (const item of addOns.lineItems) {
      if (item.listAmount !== item.amount) {
        lines.push(
          `· ${item.label}: ${formatDollars(item.amount)} member (${formatDollars(item.listAmount)} list) — ${item.detail}`,
        );
      } else {
        lines.push(`· ${item.label}: ${formatDollars(item.amount)} (${item.detail})`);
      }
    }
    if (addOns.memberSavings > 0) {
      lines.push(`List subtotal: ${formatDollars(addOns.listSubtotal)}`);
      lines.push(`Member subtotal: ${formatDollars(addOns.subtotal)}`);
      lines.push(`You save: ${formatDollars(addOns.memberSavings)}`);
    } else {
      lines.push(`Add-on subtotal: ${formatDollars(addOns.subtotal)}`);
    }
  }

  return lines.join("\n");
}
