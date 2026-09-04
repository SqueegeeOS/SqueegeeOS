import { NextResponse } from "next/server";
import { isLeadSubmissionId } from "@/lib/acquisition/lead-submission-id";
import { createLeadIntake } from "@/lib/acquisition/leads/repository";
import { sendLeadNotificationEmail } from "@/lib/acquisition/send-lead-notification-email";
import { serviceOptions, type ServiceOption } from "@/lib/acquisition/types";
import { authorizeFieldRequest } from "@/lib/field-operations/field-access";
import { routeInboundLeadToConfiguredOwner } from "@/lib/sales/inbound-lead-routing-server";

export const runtime = "nodejs";

interface TechnicianReferralBody {
  submissionId?: unknown;
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  serviceAddress?: unknown;
  servicesInterested?: unknown;
  notes?: unknown;
  permissionConfirmed?: unknown;
}

function text(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isServiceOption(value: string): value is ServiceOption {
  return (serviceOptions as readonly string[]).includes(value);
}

function validPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

export async function POST(request: Request) {
  const actor = await authorizeFieldRequest(request.headers);
  if (!actor || actor.kind !== "technician") {
    return NextResponse.json(
      { error: "Active Technician Access required." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  try {
    const body = (await request.json()) as TechnicianReferralBody;
    const submissionId = text(body.submissionId, 80);
    const name = text(body.name, 120);
    const phone = text(body.phone, 40);
    const email = text(body.email, 254);
    const serviceAddress = text(body.serviceAddress, 300);
    const notes = text(body.notes, 2_000);
    const servicesInterested = Array.isArray(body.servicesInterested)
      ? body.servicesInterested
          .filter((value): value is string => typeof value === "string")
          .filter(isServiceOption)
      : [];

    if (!isLeadSubmissionId(submissionId)) {
      return NextResponse.json({ error: "Refresh and try that referral again." }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "Customer name is required." }, { status: 400 });
    }
    if (!validPhone(phone)) {
      return NextResponse.json({ error: "Enter a valid customer phone number." }, { status: 400 });
    }
    if (servicesInterested.length === 0) {
      return NextResponse.json({ error: "Choose at least one service." }, { status: 400 });
    }
    if (body.permissionConfirmed !== true) {
      return NextResponse.json(
        { error: "Confirm that this person asked Squeegee King to contact them." },
        { status: 400 },
      );
    }

    const permissionConfirmedAt = new Date().toISOString();
    const { record, storage, duplicate } = await createLeadIntake({
      name,
      phone,
      email,
      serviceAddress,
      servicesInterested,
      preferredContactMethod: "Phone",
      smsConsentStatus: "unknown",
      notes,
      membershipTier: null,
      squareFootage: null,
      estimatedVisitPrice: null,
      preferredStartWindow: null,
      source: "technician_referral",
      clientSubmissionId: submissionId,
      referredByTechnicianKey: actor.jobberUserId,
      referredByTechnicianName: actor.displayName,
      referralPermissionConfirmedAt: permissionConfirmedAt,
    });

    if (!duplicate) {
      const [routing, notification] = await Promise.allSettled([
        storage === "supabase"
          ? routeInboundLeadToConfiguredOwner({ leadIntakeId: record.id })
          : Promise.resolve({ status: "not_configured" as const }),
        sendLeadNotificationEmail(record),
      ]);
      if (routing.status === "rejected") {
        console.warn("[technician-referral] owner routing incomplete", {
          leadId: record.id,
        });
      }
      if (notification.status === "rejected" || !notification.value.sent) {
        console.warn("[technician-referral] owner alert incomplete", {
          leadId: record.id,
        });
      }
    }

    return NextResponse.json(
      {
        id: record.id,
        duplicate,
        creditedTo: actor.displayName,
        customerMessageSent: false,
      },
      { status: duplicate ? 200 : 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[technician-referral] submission failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "HomeAtlas could not save that referral. Nothing was sent." },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
