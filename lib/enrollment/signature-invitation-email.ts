import type { EnrollmentDocumentSnapshot } from "./types";

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function money(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function buildSignatureInvitationEmail(input: {
  snapshot: EnrollmentDocumentSnapshot;
  enrollmentUrl: string;
}): { subject: string; text: string; html: string } {
  const firstName = (input.snapshot.signer?.name ?? input.snapshot.customer.name)
    .trim()
    .split(/\s+/)[0] || "there";
  const annualTotal = money(input.snapshot.plan.annualizedValueCents);
  const visitCount = input.snapshot.plan.visitsPerYear;
  const paymentLine =
    input.snapshot.payment?.rail === "manual_cash_check"
      ? "Your cash/check arrangement is noted. No card setup or automatic card billing is part of this step."
      : "After signing, HomeAtlas will guide you through secure Stripe card setup. No payment is collected while you sign.";
  const safeFirstName = htmlEscape(firstName);
  const safePlanName = htmlEscape(input.snapshot.plan.tierLabel);
  const safePlanSummary = htmlEscape(input.snapshot.plan.summary);
  const safeEnrollmentUrl = htmlEscape(input.enrollmentUrl);
  const safePaymentLine = htmlEscape(paymentLine);

  return {
    subject: `${firstName}, your SqueegeeKing care agreement is ready`,
    text:
      `Hi ${firstName},\n\nYour ${input.snapshot.plan.tierLabel} agreement is ready to review and sign. ` +
      `It covers ${visitCount} planned visits and a ${annualTotal} base annual plan.\n\n` +
      `Review and sign securely: ${input.enrollmentUrl}\n\n${paymentLine}\n\n` +
      "The private link opens your exact visit schedule, included services, optional choices, and payment arrangement before DocuSign asks for your signature.",
    html: `
      <div style="margin:0;background:#08100c;padding:36px 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#f6f1e7">
        <div style="max-width:620px;margin:0 auto;border:1px solid rgba(255,255,255,.12);border-radius:28px;background:#13241a;padding:34px;box-shadow:0 24px 70px rgba(0,0,0,.28)">
          <p style="margin:0 0 10px;color:#d4c29c;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase">HomeAtlas · SqueegeeKing</p>
          <h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:36px;font-weight:400;line-height:1.12;color:#f6f1e7">Your agreement is ready, ${safeFirstName}.</h1>
          <p style="margin:0 0 22px;color:rgba(255,255,255,.68);font-size:15px;line-height:1.65">Review your complete ${safePlanName} plan in one calm, private place. When everything looks right, DocuSign will guide you straight to the signature.</p>
          <div style="margin:0 0 24px;border:1px solid rgba(255,255,255,.10);border-radius:18px;background:rgba(0,0,0,.14);padding:20px">
            <p style="margin:0 0 6px;color:#d4c29c;font-family:Georgia,'Times New Roman',serif;font-size:28px">${annualTotal}</p>
            <p style="margin:0 0 12px;color:rgba(255,255,255,.45);font-size:12px">Base annual plan · ${visitCount} planned visits</p>
            <p style="margin:0;color:rgba(255,255,255,.62);font-size:13px;line-height:1.55">${safePlanSummary}</p>
          </div>
          <p style="margin:28px 0"><a href="${safeEnrollmentUrl}" style="display:inline-block;border-radius:999px;background:#d4c29c;color:#102017;text-decoration:none;font-size:14px;font-weight:800;padding:15px 24px">Review &amp; sign my agreement</a></p>
          <p style="margin:0 0 12px;color:rgba(255,255,255,.52);font-size:13px;line-height:1.6">${safePaymentLine}</p>
          <p style="margin:0;color:rgba(255,255,255,.34);font-size:11px;line-height:1.55">This private link shows your exact visits, included services, optional choices, and payment arrangement before you sign.</p>
        </div>
      </div>`,
  };
}
