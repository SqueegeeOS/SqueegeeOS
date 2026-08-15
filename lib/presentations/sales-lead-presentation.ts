import type { PresentationStatus } from "./types";

export interface SalesLeadPresentationCandidate {
  status: PresentationStatus;
  updatedAt: string;
}

export function selectAuthoritativeSalesLeadPresentation<
  T extends SalesLeadPresentationCandidate,
>(presentations: T[]): T | null {
  const newestFirst = [...presentations].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
  return (
    newestFirst.find((presentation) => presentation.status === "signed") ??
    newestFirst.find(
      (presentation) =>
        presentation.status === "draft" || presentation.status === "presented",
    ) ??
    null
  );
}
