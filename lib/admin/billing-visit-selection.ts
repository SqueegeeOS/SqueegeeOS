import { automaticBillingServiceMonth } from "@/lib/billing/automatic-billing-rules";

export interface BillingVisitCandidate {
  id: string;
  scheduledAt: string;
  status: string;
}

export interface CompletedVisitBillingEvidence {
  hasFieldRecord: boolean;
  hasCustomerVisibleUpdate: boolean;
  hasOpenFollowUp: boolean;
}

export function selectBillingWorkspaceVisit(input: {
  candidates: BillingVisitCandidate[];
  completedEvidenceByAppointmentId: Map<
    string,
    CompletedVisitBillingEvidence
  >;
  currentServiceMonth: string;
}): BillingVisitCandidate | null {
  const ordered = [...input.candidates].sort((left, right) =>
    left.scheduledAt.localeCompare(right.scheduledAt),
  );

  const completed = ordered.find((appointment) => {
    if (
      appointment.status !== "completed" ||
      automaticBillingServiceMonth(appointment.scheduledAt) !==
        input.currentServiceMonth
    ) {
      return false;
    }
    const evidence = input.completedEvidenceByAppointmentId.get(
      appointment.id,
    );
    return Boolean(
      evidence?.hasFieldRecord &&
        evidence.hasCustomerVisibleUpdate &&
        !evidence.hasOpenFollowUp,
    );
  });
  if (completed) return completed;

  return (
    ordered.find((appointment) => appointment.status === "scheduled") ?? null
  );
}
