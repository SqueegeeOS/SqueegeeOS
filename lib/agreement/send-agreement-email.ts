import type { AgreementEmailResult } from "./agreement-email-types";
import { normalizeEmail } from "./resolve-member-email";

export interface SendAgreementEmailInput {
  to: string;
  name: string;
  pdfUrl: string;
  tier: string;
  /** Raw PDF bytes — used as Resend attachment when pdfUrl is not email-safe */
  pdfBytes?: Uint8Array;
  fileName?: string;
}

function pdfBytesFromDataUrl(dataUrl: string): Uint8Array | null {
  const match = dataUrl.match(/^data:application\/pdf;base64,(.+)$/i);
  if (!match?.[1]) return null;
  return Uint8Array.from(Buffer.from(match[1], "base64"));
}

function isHttpsPdfUrl(url: string): boolean {
  return url.startsWith("https://");
}

/**
 * Sends signed agreement copy to member via Resend.
 * Requires RESEND_API_KEY in production (Vercel env).
 */
export async function sendAgreementEmail(
  input: SendAgreementEmailInput,
): Promise<AgreementEmailResult> {
  const recipient = normalizeEmail(input.to);
  if (!recipient) {
    console.warn("[agreement-email] skipped — no valid recipient email", {
      raw: input.to || "(empty)",
    });
    return {
      status: "skipped",
      reason: "no_valid_recipient_email",
      recipient: input.to?.trim() || null,
    };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn(
      "[agreement-email] skipped — RESEND_API_KEY not set (add in Vercel env)",
      { recipient },
    );
    return {
      status: "skipped",
      reason: "RESEND_API_KEY not configured",
      recipient,
    };
  }

  const from =
    process.env.RESEND_AGREEMENT_FROM?.trim() ??
    "HomeAtlas <onboarding@resend.dev>";

  if (!process.env.RESEND_AGREEMENT_FROM?.trim()) {
    console.warn(
      "[agreement-email] RESEND_AGREEMENT_FROM not set — using Resend sandbox sender",
    );
  }

  const attachmentBytes =
    input.pdfBytes ??
    (!isHttpsPdfUrl(input.pdfUrl)
      ? pdfBytesFromDataUrl(input.pdfUrl)
      : null);

  const useAttachment = !isHttpsPdfUrl(input.pdfUrl);
  if (useAttachment && !attachmentBytes) {
    console.error(
      "[agreement-email] failed — PDF is not an HTTPS URL and no bytes available for attachment",
      { pdfUrlPrefix: input.pdfUrl.slice(0, 40) },
    );
    return {
      status: "failed",
      reason: "pdf_not_email_safe",
      recipient,
    };
  }

  const payload: Record<string, unknown> = {
    from,
    to: recipient,
    subject: "Your HomeAtlas Membership Agreement",
    html: useAttachment
      ? `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
          <h2>Welcome to HomeAtlas, ${input.name}.</h2>
          <p>Your ${input.tier} membership agreement has been signed.</p>
          <p>Your signed agreement is attached to this email for your records.</p>
          <p style="color: #666; font-size: 13px;">
            HomeAtlas · Premium Home Services<br/>
            Questions? Reply to this email.
          </p>
        </div>
      `
      : `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
          <h2>Welcome to HomeAtlas, ${input.name}.</h2>
          <p>Your ${input.tier} membership agreement has been signed.</p>
          <p>Keep this link for your records:</p>
          <p><a href="${input.pdfUrl}">Download your signed agreement</a></p>
          <p style="color: #666; font-size: 13px;">
            HomeAtlas · Premium Home Services<br/>
            Questions? Reply to this email.
          </p>
        </div>
      `,
  };

  if (useAttachment && attachmentBytes) {
    payload.attachments = [
      {
        filename: input.fileName ?? "membership-agreement.pdf",
        content: Buffer.from(attachmentBytes).toString("base64"),
      },
    ];
  }

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
    console.error("[agreement-email] failed — Resend API error:", body, {
      recipient,
      from,
    });
    return {
      status: "failed",
      reason: `resend_error: ${body.slice(0, 200)}`,
      recipient,
    };
  }

  const json = (await response.json().catch(() => null)) as { id?: string } | null;
  console.info("[agreement-email] sent", {
    recipient,
    deliveryMode: useAttachment ? "attachment" : "link",
    resendId: json?.id,
  });

  return {
    status: "sent",
    recipient,
    deliveryMode: useAttachment ? "attachment" : "link",
    resendId: json?.id,
  };
}
