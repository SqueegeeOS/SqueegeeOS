import type { TechnicianJobClockSnapshot } from "./technician-job-clock";

export interface HomeAtlasFieldAssignmentSnapshot {
  id: string;
  projectionId: string;
  externalVisitId: string;
  technicianId: string;
  technicianIdentityKey: string;
  technicianDisplayName: string;
  assignedAt: string;
}

export interface HomeAtlasFieldExecutionSnapshot {
  clock: TechnicianJobClockSnapshot;
  fieldRecordCount: number;
  latestFieldRecordAt: string | null;
  latestFieldRecordBy: string | null;
  customerVisibleRecordCount: number;
  openFollowUpCount: number;
  customerSummary: string | null;
  internalNote: string | null;
  scopeException: string | null;
  photoCount: number;
}

export function homeAtlasTechnicianIdentityKey(id: string): string {
  return `homeatlas:${id}`;
}

export function isMissingHomeAtlasFieldAssignmentSchema(error: {
  message?: string;
  code?: string;
} | null): boolean {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42P01" ||
    ((message.includes("homeatlas_technician_visit_assignments") ||
      message.includes("homeatlas_technician_job_")) &&
      (message.includes("does not exist") ||
        message.includes("schema cache") ||
        message.includes("could not find")))
  );
}
