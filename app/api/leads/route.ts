import { NextResponse } from "next/server";
import { estimatedPriceForLead } from "@/lib/acquisition/request-params";
import { createLeadIntake } from "@/lib/acquisition/leads/repository";
import type { CreateLeadIntakeInput } from "@/lib/acquisition/lead-record";
import { sendLeadConfirmationEmail } from "@/lib/acquisition/send-lead-confirmation-email";
import { sendLeadNotificationEmail } from "@/lib/acquisition/send-lead-notification-email";
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
  return null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<LeadIntakeFormData>;

    const validationError = validateLeadBody(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
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

    const input: CreateLeadIntakeInput = {
      name: body.name!.trim(),
      phone: body.phone!.trim(),
      email: body.email!.trim(),
      serviceAddress: body.serviceAddress!.trim(),
      servicesInterested,
      preferredContactMethod,
      notes: body.notes?.trim() ?? "",
      membershipTier,
      squareFootage,
      estimatedVisitPrice: estimatedPriceForLead(membershipTier, squareFootage),
      preferredStartWindow,
    };

    const { record, storage } = await createLeadIntake(input);

    const emailResult = await sendLeadConfirmationEmail({
      to: record.email,
      name: record.name,
      membershipTier: record.membershipTier,
      squareFootage: record.squareFootage,
      estimatedVisitPrice: record.estimatedVisitPrice,
    });

    const notifyResult = await sendLeadNotificationEmail(record);
    if (!notifyResult.sent) {
      console.warn("[leads] founder notification not sent", {
        leadId: record.id,
        reason: notifyResult.reason,
      });
    }

    return NextResponse.json({
      id: record.id,
      storage,
      emailSent: emailResult.sent,
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
