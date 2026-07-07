import type { AgreementEmailResult } from "./agreement-email-types";
import { normalizeEmail } from "./resolve-member-email";
import { CUSTOMER_BRAND } from "@/lib/brand/customer";
import { PLATFORM_BRAND } from "@/lib/brand/platform";

export interface SendWelcomeEmailInput {
  to: string;
  name: string;
  portalUrl: string;
}

function checklistItem(label: string): string {
  return `
    <li style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; font-size: 15px; line-height: 1.5;">
      <span style="color: #c9b896; font-size: 16px; line-height: 1.4;">✓</span>
      <span>${label}</span>
    </li>
  `;
}

/**
 * Post-onboarding welcome — sent after payment setup completes.
 * Portal link is the primary destination; no passwords required.
 */
export async function sendWelcomeEmail(
  input: SendWelcomeEmailInput,
): Promise<AgreementEmailResult> {
  const recipient = normalizeEmail(input.to);
  if (!recipient) {
    return {
      status: "skipped",
      reason: "no_valid_recipient_email",
      recipient: input.to?.trim() || null,
    };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[welcome-email] skipped — RESEND_API_KEY not set", {
      recipient,
    });
    return {
      status: "skipped",
      reason: "RESEND_API_KEY not configured",
      recipient,
    };
  }

  const from =
    process.env.RESEND_AGREEMENT_FROM?.trim() ??
    `${CUSTOMER_BRAND.name} <onboarding@resend.dev>`;

  const firstName = input.name.trim().split(/\s+/)[0] || input.name;

  const payload = {
    from,
    to: recipient,
    subject: `Your home is now under care`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
        <p style="font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: #8a8680; margin: 0 0 8px;">
          ${CUSTOMER_BRAND.name}
        </p>
        <h2 style="font-weight: 400; font-size: 28px; margin: 0 0 12px; line-height: 1.25;">
          Your home is now under care.
        </h2>
        <p style="font-size: 16px; line-height: 1.6; color: #444; margin: 0 0 28px;">
          ${firstName}, welcome home. Everything you need lives in your private portal.
        </p>

        <ul style="list-style: none; padding: 0; margin: 0 0 32px;">
          ${checklistItem("Agreement Complete")}
          ${checklistItem("Membership Active")}
          ${checklistItem("Card On File")}
        </ul>

        <p style="margin: 0 0 28px;">
          <a href="${input.portalUrl}" style="display: inline-block; padding: 16px 28px; background: #1a1a1a; color: #f5f2eb; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 500;">
            Open Your Home
          </a>
        </p>

        <p style="color: #666; font-size: 13px; line-height: 1.6; margin: 0;">
          Save this link — it is your private access to your home&apos;s care record.
          Add ${PLATFORM_BRAND.name} to your Home Screen for the best experience.
        </p>

        <p style="color: #666; font-size: 13px; margin-top: 28px;">
          ${CUSTOMER_BRAND.name} · ${CUSTOMER_BRAND.location}<br/>
          Powered by ${PLATFORM_BRAND.name}<br/>
          Questions? Reply to this email.
        </p>
      </div>
    `,
  };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("[welcome-email] failed — Resend API error:", body, {
      recipient,
    });
    return {
      status: "failed",
      reason: `resend_error: ${body.slice(0, 200)}`,
      recipient,
    };
  }

  const json = (await response.json().catch(() => null)) as { id?: string } | null;
  console.info("[welcome-email] sent", { recipient, resendId: json?.id });

  return {
    status: "sent",
    recipient,
    deliveryMode: "link",
    resendId: json?.id,
  };
}
