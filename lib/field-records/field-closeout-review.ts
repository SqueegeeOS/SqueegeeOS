export interface FieldCloseoutReview {
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
