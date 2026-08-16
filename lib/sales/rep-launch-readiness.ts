export type SalesRepPhonePassEvidence =
  | "missing"
  | "install_link_ready"
  | "installed";

export interface SalesRepLaunchCountsEvidence {
  status: "complete" | "unavailable";
  doorCount: number | null;
  leadCount: number | null;
  presentationCount: number | null;
  verifiedCloseCount: number | null;
}

export type SalesRepLaunchStepState = "complete" | "pending" | "unknown";

export interface SalesRepLaunchStep {
  id: "phone" | "door" | "homeowner" | "plan" | "close";
  label: string;
  state: SalesRepLaunchStepState;
  detail: string;
}

export type SalesRepLaunchStage =
  | "phone_pass_needed"
  | "phone_install_needed"
  | "first_door_needed"
  | "first_homeowner_needed"
  | "first_plan_needed"
  | "first_close_needed"
  | "proven"
  | "evidence_unavailable";

export interface SalesRepLaunchReadiness {
  stage: SalesRepLaunchStage;
  completedCount: number;
  totalCount: number;
  nextAction: string;
  steps: SalesRepLaunchStep[];
}

function countStep(input: {
  id: SalesRepLaunchStep["id"];
  label: string;
  count: number | null;
  evidenceStatus: SalesRepLaunchCountsEvidence["status"];
  pendingDetail: string;
}): SalesRepLaunchStep {
  if (input.evidenceStatus === "unavailable" || input.count === null) {
    return {
      id: input.id,
      label: input.label,
      state: "unknown",
      detail: "Evidence unavailable",
    };
  }
  return input.count > 0
    ? {
        id: input.id,
        label: input.label,
        state: "complete",
        detail: `${input.count} recorded`,
      }
    : {
        id: input.id,
        label: input.label,
        state: "pending",
        detail: input.pendingDetail,
      };
}

export function deriveSalesRepLaunchReadiness(input: {
  phonePass: SalesRepPhonePassEvidence;
  counts: SalesRepLaunchCountsEvidence;
}): SalesRepLaunchReadiness {
  const phoneStep: SalesRepLaunchStep =
    input.phonePass === "installed"
      ? {
          id: "phone",
          label: "Phone",
          state: "complete",
          detail: "Session active",
        }
      : {
          id: "phone",
          label: "Phone",
          state: "pending",
          detail:
            input.phonePass === "install_link_ready"
              ? "Install link ready"
              : "Pass not created",
        };

  const steps: SalesRepLaunchStep[] = [
    phoneStep,
    countStep({
      id: "door",
      label: "First door",
      count: input.counts.doorCount,
      evidenceStatus: input.counts.status,
      pendingDetail: "No saved door",
    }),
    countStep({
      id: "homeowner",
      label: "Homeowner",
      count: input.counts.leadCount,
      evidenceStatus: input.counts.status,
      pendingDetail: "No saved lead",
    }),
    countStep({
      id: "plan",
      label: "First plan",
      count: input.counts.presentationCount,
      evidenceStatus: input.counts.status,
      pendingDetail: "No linked plan",
    }),
    countStep({
      id: "close",
      label: "Signed close",
      count: input.counts.verifiedCloseCount,
      evidenceStatus: input.counts.status,
      pendingDetail: "No verified close",
    }),
  ];

  const base = {
    completedCount: steps.filter((step) => step.state === "complete").length,
    totalCount: steps.length,
    steps,
  };

  if (input.phonePass === "missing") {
    return {
      ...base,
      stage: "phone_pass_needed",
      nextAction: "Create a one-time phone pass for this rep.",
    };
  }
  if (input.phonePass === "install_link_ready") {
    return {
      ...base,
      stage: "phone_install_needed",
      nextAction:
        "Open the one-time link on the rep's phone to activate the desk.",
    };
  }
  if (input.counts.status === "unavailable") {
    return {
      ...base,
      stage: "evidence_unavailable",
      nextAction: "Refresh before relying on first-loop progress.",
    };
  }
  if ((input.counts.doorCount ?? 0) === 0) {
    return {
      ...base,
      stage: "first_door_needed",
      nextAction: "On the phone, tap +1 Door and save the real outcome.",
    };
  }
  if ((input.counts.leadCount ?? 0) === 0) {
    return {
      ...base,
      stage: "first_homeowner_needed",
      nextAction:
        "Capture the first interested homeowner and their next action.",
    };
  }
  if ((input.counts.presentationCount ?? 0) === 0) {
    return {
      ...base,
      stage: "first_plan_needed",
      nextAction: "Build the homeowner's first linked Home Care Plan.",
    };
  }
  if ((input.counts.verifiedCloseCount ?? 0) === 0) {
    return {
      ...base,
      stage: "first_close_needed",
      nextAction:
        "Complete a real agreement; the signed close will record automatically.",
    };
  }
  return {
    ...base,
    stage: "proven",
    nextAction: "The first durable field revenue loop is proven.",
  };
}
