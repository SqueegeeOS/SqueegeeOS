export interface FieldCloseoutReview {
  fieldRecordId: string;
  resolution: FieldIssueResolution | null;
  technicianName: string;
  visitDate: string;
  savedAt: string;
  customerSummary: string;
  internalNote: string;
  scopeException: string;
  followUpNeeded: boolean;
  photos: Array<{
    id: string;
    captureType: string;
    mimeType: string;
    url: string | null;
  }>;
}

export interface FieldIssueResolution {
  note: string;
  resolvedBy: string;
  resolvedAt: string;
}

export interface FieldIssue {
  assignmentId: string;
  fieldRecordId: string;
  clientName: string;
  technicianName: string;
  visitDate: string;
  scopeException: string;
}

export const FIELD_RECORD_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function hasUnresolvedFieldIssue(followUp: boolean, exception: string | null | undefined, resolved: boolean): boolean {
  return !resolved && (followUp || Boolean(exception?.trim()));
}
