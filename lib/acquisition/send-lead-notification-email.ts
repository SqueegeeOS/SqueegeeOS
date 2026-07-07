import { CUSTOMER_BRAND } from "@/lib/brand/customer";
import type { LeadIntakeRecord } from "./lead-record";
import {
  buildSqueegeeKingTierQuote,
} from "@/lib/membership/tier-config";

function resolveLeadNotifyRecipients(): string[] {
  const raw =
    process.env.LEAD_NOTIFY_EMAIL?.trim() ??
    process.env.FOUNDER_NOTIFY_EMAIL?.trim() ??
    "";

  if (!raw) return [];

  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * Notifies founders when a public lead form is submitted.
 * Requires RESEND_API_KEY and LEAD_NOTIFY_EMAIL (comma-separated allowed).
 */
export async function sendLeadNotificationEmail(
  record: LeadIntakeRecord,
): Promise<{ sent: boolean; reason?: string }> {
  const recipients = resolveLeadNotifyRecipients();
  if (recipients.length === 0) {
    console.warn(
      "[lead-intake] LEAD_NOTIFY_EMAIL not set — founder notification skipped",
      { leadId: record.id },
    );
    return { sent: false, reason: "LEAD_NOTIFY_EMAIL not configured" };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn(
      "[lead-intake] RESEND_API_KEY not set — founder notification skipped",
      { leadId: record.id },
    );
    return { sent: false, reason: "RESEND_API_KEY not configured" };
  }

  const from =
    process.env.RESEND_LEAD_FROM?.trim() ??
    process.env.RESEND_AGREEMENT_FROM?.trim() ??
    `${CUSTOMER_BRAND.name} <onboarding@resend.dev>`;

  const tierLine = record.membershipTier
    ? buildSqueegeeKingTierQuote(
        record.membershipTier,
        record.squareFootage ?? 2500,
      )
    : null;

  const services = record.servicesInterested.join(", ");
  const notes = record.notes.trim() || "—";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject: `New Home Care request — ${record.name}`,
      html: `
        <div style="font-family: Georgia, serif; max-width: 640px; margin: 0 auto; color: #1a1a1a;">
          <h2>New request from ${escapeHtml(record.name)}</h2>
          <p style="color: #666; font-size: 13px;">Submitted ${escapeHtml(new Date(record.submittedAt).toLocaleString("en-US", { timeZone: "America/Los_Angeles" }))} · Lead ID ${escapeHtml(record.id)}</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px;">
            <tr><td style="padding: 8px 0; color: #666;">Phone</td><td style="padding: 8px 0;"><a href="tel:${escapeHtml(record.phone.replace(/\D/g, ""))}">${escapeHtml(record.phone)}</a></td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Email</td><td style="padding: 8px 0;"><a href="mailto:${escapeHtml(record.email)}">${escapeHtml(record.email)}</a></td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Address</td><td style="padding: 8px 0;">${escapeHtml(record.serviceAddress)}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Services</td><td style="padding: 8px 0;">${escapeHtml(services)}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Contact via</td><td style="padding: 8px 0;">${escapeHtml(record.preferredContactMethod)}</td></tr>
            ${
              record.preferredStartWindow
                ? `<tr><td style="padding: 8px 0; color: #666;">Start window</td><td style="padding: 8px 0;">${escapeHtml(record.preferredStartWindow)}</td></tr>`
                : ""
            }
            ${
              tierLine
                ? `<tr><td style="padding: 8px 0; color: #666;">Tier</td><td style="padding: 8px 0;">${escapeHtml(tierLine.label)} · ${escapeHtml(tierLine.periodPriceLabel)}</td></tr>`
                : ""
            }
            ${
              record.squareFootage
                ? `<tr><td style="padding: 8px 0; color: #666;">Sq ft</td><td style="padding: 8px 0;">${record.squareFootage.toLocaleString("en-US")}</td></tr>`
                : ""
            }
          </table>
          <p style="margin-top: 20px; font-size: 14px;"><strong>Notes</strong><br/>${escapeHtml(notes).replace(/\n/g, "<br/>")}</p>
          <p style="margin-top: 24px; color: #666; font-size: 12px;">
            Stored in Supabase · <code>lead_intakes</code> · status <code>new</code>
          </p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("[lead-intake] founder notification failed:", body, {
      leadId: record.id,
    });
    return { sent: false, reason: "Email delivery failed" };
  }

  return { sent: true };
}
