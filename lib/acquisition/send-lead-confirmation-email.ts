import { CUSTOMER_BRAND } from "@/lib/brand/customer";
import {
  buildSqueegeeKingTierQuote,
  type SqueegeeKingTierId,
} from "@/lib/membership/tier-config";

export interface SendLeadConfirmationEmailInput {
  to: string;
  name: string;
  membershipTier: SqueegeeKingTierId | null;
  squareFootage: number | null;
  estimatedVisitPrice: number | null;
}

/**
 * Sends request confirmation to the homeowner.
 * Requires RESEND_API_KEY — logs and skips when unset (dev).
 */
export async function sendLeadConfirmationEmail(
  input: SendLeadConfirmationEmailInput,
): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info(
      "[lead-intake] RESEND_API_KEY not set — skipping confirmation to",
      input.to,
    );
    return { sent: false, reason: "RESEND_API_KEY not configured" };
  }

  const firstName = input.name.split(" ")[0] || "there";
  const tierLine = input.membershipTier
    ? buildSqueegeeKingTierQuote(
        input.membershipTier,
        input.squareFootage ?? 2500,
      )
    : null;

  const from =
    process.env.RESEND_LEAD_FROM ??
    process.env.RESEND_AGREEMENT_FROM ??
    `${CUSTOMER_BRAND.name} <onboarding@resend.dev>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: `We received your ${CUSTOMER_BRAND.name} request`,
      html: `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
          <h2>Thank you, ${firstName}.</h2>
          <p>We received your Home Care Plan request and will reach out shortly to schedule your property inspection.</p>
          ${
            tierLine
              ? `<p>You selected <strong>${tierLine.label}</strong> at an estimated <strong>${tierLine.periodPriceLabel}</strong>.</p>`
              : ""
          }
          <p style="color: #666; font-size: 13px;">
            ${CUSTOMER_BRAND.name} · ${CUSTOMER_BRAND.location}<br/>
            Questions? Reply to this email.
          </p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("[lead-intake] Resend error:", body);
    return { sent: false, reason: "Email delivery failed" };
  }

  return { sent: true };
}
