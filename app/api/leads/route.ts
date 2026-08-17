import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { attachLeadToReferral } from "@/lib/referrals/repository";
import { REFERRAL_COOKIE } from "@/lib/referrals/types";
import { estimatedPriceForLead } from "@/lib/acquisition/request-params";
import { isLeadSubmissionId } from "@/lib/acquisition/lead-submission-id";
import { createLeadIntake } from "@/lib/acquisition/leads/repository";
import {
  SMS_CONSENT_DISCLOSURE_VERSION,
  smsConsentStatusForLead,
  type CreateLeadIntakeInput,
} from "@/lib/acquisition/lead-record";
import { sendLeadNotificationEmail } from "@/lib/acquisition/send-lead-notification-email";
import { runLeadAcknowledgementAutomation } from "@/lib/communications/lead-automation";
import {
  contactMethods,
  preferredStartWindows,
  serviceOptions,
  type LeadIntakeFormData,
} from "@/lib/acquisition/types";
import {
  normalizeToSqueegeeKingTier,
  type SqueegeeKingTierId,
} from "@/lib/membership/tier-config";
import { routeInboundLeadToConfiguredOwner } from "@/lib/sales/inbound-lead-routing-server";

type LeadIntakeRequestBody = Partial<LeadIntakeFormData> & {
  submissionId?: unknown;
};

function isServiceOption(value: string): value is (typeof serviceOptions)[number] {
  return (serviceOptions as readonly string[]).includes(value);
}

function isContactMethod(value: string): value is (typeof contactMethods)[number] {
  return (contactMethods as readonly string[]).includes(value);
}

function isPreferredStartWindow(
  value: string,
): value is (typeof preferredStartWindows)[number] {
  return (preferredStartWindows as readonly string[]).includes(value);
}

function parseMembershipTier(value: unknown): SqueegeeKingTierId | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return normalizeToSqueegeeKingTier(value);
}

function parseSquareFootage(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function validateLeadBody(body: Partial<LeadIntakeFormData>): string | null {
  if (!body.name?.trim()) return "Name is required.";
  if (!body.phone?.trim()) return "Phone is required.";
  if (!body.email?.trim()) return "Email is required.";
  if (!body.serviceAddress?.trim()) return "Service address is required.";
  if (!body.servicesInterested?.length) {
    return "Select at least one service.";
  }
  if (body.preferredContactMethod === "Text" && body.smsConsent !== true) {
    return "Please confirm text-message consent to choose Text.";
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LeadIntakeRequestBody;

    const validationError = validateLeadBody(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
    if (!isLeadSubmissionId(body.submissionId)) {
      return NextResponse.json(
        { error: "This request needs a valid submission ID. Please try again." },
        { status: 400 },
      );
    }

    const membershipTier = parseMembershipTier(body.membershipTier);
    const squareFootage = parseSquareFootage(body.squareFootage);
    const preferredStartWindow =
      body.preferredStartWindow &&
      isPreferredStartWindow(body.preferredStartWindow)
        ? body.preferredStartWindow
        : body.preferredStartWindow?.trim() || null;

    const servicesInterested = (body.servicesInterested ?? []).filter(isServiceOption);
    const preferredContactMethod =
      body.preferredContactMethod && isContactMethod(body.preferredContactMethod)
        ? body.preferredContactMethod
        : "Phone";
    const smsConsentStatus = smsConsentStatusForLead(
      preferredContactMethod,
      body.smsConsent === true,
    );
    const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

    const input: CreateLeadIntakeInput = {
      name: body.name!.trim(),
      phone: body.phone!.trim(),
      email: body.email!.trim(),
      serviceAddress: body.serviceAddress!.trim(),
      servicesInterested,
      preferredContactMethod,
      smsConsentStatus,
      smsConsentDisclosureVersion:
        smsConsentStatus === "opted_in"
          ? SMS_CONSENT_DISCLOSURE_VERSION
          : null,
      smsConsentSourcePath:
        smsConsentStatus === "opted_in" ? new URL(request.url).pathname : null,
      smsConsentIpAddress:
        smsConsentStatus === "opted_in" ? forwardedFor || null : null,
      smsConsentUserAgent:
        smsConsentStatus === "opted_in"
          ? request.headers.get("user-agent")?.slice(0, 1_000) || null
          : null,
      notes: body.notes?.trim() ?? "",
      membershipTier,
      squareFootage,
      estimatedVisitPrice: estimatedPriceForLead(membershipTier, squareFootage),
      preferredStartWindow,
      clientSubmissionId: body.submissionId.trim(),
    };

    const { record, storage, duplicate } = await createLeadIntake(input);

    // A browser retry resolves to the original durable lead. Do not repeat
    // referral attribution, assignment, acknowledgement, or owner alerts.
    if (duplicate) {
      return NextResponse.json({
        id: record.id,
        storage,
        duplicate: true,
        emailSent: false,
        smsSent: false,
        smsScheduled: false,
        notifySent: false,
      });
    }

    // Referral attribution: if this visitor arrived through /r/[code],
    // associate the new lead with the referring member. Never fatal.
    try {
      const cookieStore = await cookies();
      const referralCode = cookieStore.get(REFERRAL_COOKIE)?.value;
      if (referralCode) {
        await attachLeadToReferral({
          code: referralCode,
          leadId: record.id,
          leadName: record.name,
          leadEmail: record.email,
        });
      }
    } catch {
      // attribution must never block a lead
    }

    // The request is already durably saved. Provider outages must never turn a
    // successful intake into a 500 that encourages duplicate submissions.
    const [routingAttempt, automationAttempt, notifyAttempt] =
      await Promise.allSettled([
        storage === "supabase"
          ? routeInboundLeadToConfiguredOwner({ leadIntakeId: record.id })
          : Promise.resolve({ status: "not_configured" as const }),
        runLeadAcknowledgementAutomation(record),
        sendLeadNotificationEmail(record),
      ]);
    const emailResult =
      automationAttempt.status === "fulfilled"
        ? {
            sent: automationAttempt.value.emailSent,
            reason: automationAttempt.value.reason,
          }
        : { sent: false, reason: "Email provider unavailable" };
    const smsResult =
      automationAttempt.status === "fulfilled"
        ? {
            sent: automationAttempt.value.smsSent,
            scheduled: automationAttempt.value.smsScheduled,
            reason: automationAttempt.value.smsReason,
          }
        : { sent: false, scheduled: false, reason: "Text provider unavailable" };
    const notifyResult =
      notifyAttempt.status === "fulfilled"
        ? notifyAttempt.value
        : { sent: false, reason: "Email provider unavailable" };

    if (routingAttempt.status === "rejected") {
      console.warn("[leads] automatic owner routing incomplete", {
        leadId: record.id,
      });
    }

    if (!emailResult.sent || !notifyResult.sent) {
      console.warn("[leads] post-save communication incomplete", {
        leadId: record.id,
        confirmation: emailResult.reason ?? "sent",
        textConfirmation:
          smsResult.sent || smsResult.scheduled
            ? smsResult.scheduled
              ? "scheduled"
              : "sent"
            : smsResult.reason ?? "not_requested",
        founderNotification: notifyResult.reason ?? "sent",
      });
    }

    return NextResponse.json({
      id: record.id,
      storage,
      duplicate: false,
      emailSent: emailResult.sent,
      smsSent: smsResult.sent,
      smsScheduled: smsResult.scheduled,
      notifySent: notifyResult.sent,
    });
  } catch (error) {
    console.error("[leads] POST error:", error);
    return NextResponse.json(
      { error: "Failed to submit request" },
      { status: 500 },
    );
  }
}
