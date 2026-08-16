import {
  enrollmentPacketProgress,
  type EnrollmentPacketProgressTone,
} from "@/lib/enrollment/packet-progress";
import type { EnrollmentPacketStatus } from "@/lib/enrollment/types";
import type { PresentationStatus } from "@/lib/presentations/types";
import { selectAuthoritativeSalesLeadPresentation } from "@/lib/presentations/sales-lead-presentation";

export type SalesLeadCloseJourneyStage =
  | "plan_needed"
  | "plan_draft"
  | "presented"
  | "signed"
  | EnrollmentPacketStatus;

export interface SalesLeadCloseJourney {
  stage: SalesLeadCloseJourneyStage;
  label: string;
  detail: string;
  actionLabel: string;
  tone: EnrollmentPacketProgressTone;
  presentationId: string | null;
  presentationStatus: PresentationStatus | null;
  enrollmentStatus: EnrollmentPacketStatus | null;
  updatedAt: string | null;
}

export interface SalesLeadClosePresentationSource {
  id: string;
  status: PresentationStatus;
  updatedAt: string;
}

export interface SalesLeadClosePacketSource {
  presentationId: string;
  status: EnrollmentPacketStatus;
  updatedAt: string;
}

function latestTimestamp(...values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
}

export function buildSalesLeadCloseJourney(input: {
  presentations: SalesLeadClosePresentationSource[];
  packets: SalesLeadClosePacketSource[];
}): SalesLeadCloseJourney {
  const presentation = selectAuthoritativeSalesLeadPresentation(
    input.presentations,
  );

  if (!presentation) {
    return {
      stage: "plan_needed",
      label: "Plan not started",
      detail: "Build the homeowner's scope, cadence, and rates in one place.",
      actionLabel: "Build their plan",
      tone: "neutral",
      presentationId: null,
      presentationStatus: null,
      enrollmentStatus: null,
      updatedAt: null,
    };
  }

  const packet = input.packets
    .filter((candidate) => candidate.presentationId === presentation.id)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];

  if (packet) {
    const progress = enrollmentPacketProgress(packet.status);
    return {
      stage: packet.status,
      label: progress.eyebrow,
      detail: progress.detail,
      actionLabel: progress.actionLabel,
      tone: progress.tone,
      presentationId: presentation.id,
      presentationStatus: presentation.status,
      enrollmentStatus: packet.status,
      updatedAt: latestTimestamp(presentation.updatedAt, packet.updatedAt),
    };
  }

  if (presentation.status === "signed") {
    return {
      stage: "signed",
      label: "Agreement complete",
      detail: "The signature is secured. Finish card setup and portal activation.",
      actionLabel: "Open activation",
      tone: "success",
      presentationId: presentation.id,
      presentationStatus: presentation.status,
      enrollmentStatus: null,
      updatedAt: presentation.updatedAt,
    };
  }

  if (presentation.status === "presented") {
    return {
      stage: "presented",
      label: "Ready to close",
      detail: "The plan has been presented. Continue into signature and secure card setup.",
      actionLabel: "Open close",
      tone: "accent",
      presentationId: presentation.id,
      presentationStatus: presentation.status,
      enrollmentStatus: null,
      updatedAt: presentation.updatedAt,
    };
  }

  return {
    stage: "plan_draft",
    label: "Plan in progress",
    detail: "The homeowner's draft is saved and ready to resume.",
    actionLabel: "Resume plan",
    tone: "neutral",
    presentationId: presentation.id,
    presentationStatus: presentation.status,
    enrollmentStatus: null,
    updatedAt: presentation.updatedAt,
  };
}
