import type { LeadIntakeRecord } from "@/lib/acquisition/lead-record";

export type TechnicianReferralCredit =
  | { status: "unavailable" }
  | {
      status: "recorded";
      technicianName: string;
      leadId: string;
      submittedAt: string;
      presentationId: string | null;
    };

export function technicianReferralCredit(
  lead: LeadIntakeRecord,
  presentationId: string | null = null,
): TechnicianReferralCredit | null {
  if (lead.source !== "technician_referral") return null;
  const technicianName = lead.referredByTechnicianName?.trim();
  if (!technicianName || !lead.referredByTechnicianKey?.trim()) {
    return { status: "unavailable" };
  }
  return {
    status: "recorded",
    technicianName,
    leadId: lead.id,
    submittedAt: lead.submittedAt,
    presentationId,
  };
}
