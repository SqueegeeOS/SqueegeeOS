export const TECHNICIAN_JOB_CLOCK_ACTIONS = ["start", "finish"] as const;

export type TechnicianJobClockAction =
  (typeof TECHNICIAN_JOB_CLOCK_ACTIONS)[number];

export type TechnicianJobClockState =
  | "not_started"
  | "running"
  | "finished";

export interface TechnicianJobClockRequest {
  actionId: string;
  propertyId?: string | null;
  appointmentId?: string | null;
  fieldAssignmentId?: string | null;
  action: TechnicianJobClockAction;
}

export interface TechnicianJobClockSnapshot {
  state: TechnicianJobClockState;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  startedByDisplayName: string | null;
  finishedByDisplayName: string | null;
}

export const EMPTY_TECHNICIAN_JOB_CLOCK: TechnicianJobClockSnapshot = {
  state: "not_started",
  startedAt: null,
  endedAt: null,
  durationSeconds: null,
  startedByDisplayName: null,
  finishedByDisplayName: null,
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isTechnicianJobClockAction(
  value: unknown,
): value is TechnicianJobClockAction {
  return TECHNICIAN_JOB_CLOCK_ACTIONS.includes(
    value as TechnicianJobClockAction,
  );
}

export function validateTechnicianJobClockRequest(
  value: unknown,
): string | null {
  if (!value || typeof value !== "object") {
    return "Choose a valid job clock action.";
  }
  const input = value as Partial<TechnicianJobClockRequest>;
  if (!UUID_PATTERN.test(input.actionId ?? "")) {
    return "The job clock action needs a valid action ID.";
  }
  const hasMemberVisit = Boolean(input.propertyId && input.appointmentId);
  const hasFieldAssignment = Boolean(input.fieldAssignmentId);
  if (hasMemberVisit === hasFieldAssignment) {
    return "Choose one valid HomeAtlas job target.";
  }
  if (
    hasMemberVisit &&
    (!UUID_PATTERN.test(input.propertyId ?? "") ||
      !UUID_PATTERN.test(input.appointmentId ?? ""))
  ) {
    return "Choose a valid HomeAtlas appointment.";
  }
  if (hasFieldAssignment && !UUID_PATTERN.test(input.fieldAssignmentId ?? "")) {
    return "Choose a valid HomeAtlas field assignment.";
  }
  if (!isTechnicianJobClockAction(input.action)) {
    return "Choose start or finish for this job clock.";
  }
  return null;
}

export function technicianJobClockState(input: {
  startedAt: string | null;
  endedAt: string | null;
}): TechnicianJobClockState {
  if (input.endedAt) return "finished";
  if (input.startedAt) return "running";
  return "not_started";
}

export function technicianJobClockElapsedSeconds(
  clock: Pick<TechnicianJobClockSnapshot, "startedAt" | "endedAt">,
  now = new Date(),
): number | null {
  if (!clock.startedAt) return null;
  const startedAt = Date.parse(clock.startedAt);
  const endedAt = clock.endedAt ? Date.parse(clock.endedAt) : now.getTime();
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt)) return null;
  return Math.max(0, Math.floor((endedAt - startedAt) / 1_000));
}

export function technicianCanDocumentVisit(
  state: TechnicianJobClockState,
): boolean {
  return state === "running" || state === "finished";
}

export function technicianCanFinishJob(input: {
  state: TechnicianJobClockState;
  hasFieldRecord: boolean;
}): boolean {
  return input.state === "running" && input.hasFieldRecord;
}

export function isMissingTechnicianJobClockSchema(error: {
  message?: string;
  code?: string;
} | null): boolean {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42P01" ||
    ((message.includes("technician_job_time_entries") ||
      message.includes("record_technician_job_clock_action")) &&
      (message.includes("does not exist") ||
        message.includes("schema cache") ||
        message.includes("could not find")))
  );
}
