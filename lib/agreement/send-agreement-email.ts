export interface SendAgreementEmailInput {
  to: string;
  name: string;
  pdfUrl: string;
  tier: string;
}

/**
 * Sends signed agreement copy to member.
 * Requires RESEND_API_KEY — logs and skips when unset (dev).
 */
export async function sendAgreementEmail(
  input: SendAgreementEmailInput,
): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info(
      "[agreement] RESEND_API_KEY not set — skipping email to",
      input.to,
    );
    return { sent: false, reason: "RESEND_API_KEY not configured" };
  }

  const from =
    process.env.RESEND_AGREEMENT_FROM ?? "HomeAtlas <onboarding@resend.dev>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: "Your HomeAtlas Membership Agreement",
      html: `
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
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("[agreement] Resend error:", body);
    return { sent: false, reason: "Email delivery failed" };
  }

  return { sent: true };
}
