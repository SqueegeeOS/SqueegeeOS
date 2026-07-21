export function memberPropertyFilterChange(nextFilter: string) {
  return {
    memberFilter: nextFilter,
    selectedMembershipId: "",
    samePropertyConfirmed: false,
  } as const;
}

export function createJobberRequestGenerationGuard() {
  let generation = 0;
  return {
    begin(): number {
      generation += 1;
      return generation;
    },
    invalidate(): void {
      generation += 1;
    },
    isCurrent(requestGeneration: number): boolean {
      return requestGeneration === generation;
    },
  };
}

const JOBBER_CURSOR_MAX_LENGTH = 2_048;

export class JobberPaginationCursorError extends Error {
  constructor() {
    super("Jobber pagination repeated or omitted its continuation cursor.");
    this.name = "JobberPaginationCursorError";
  }
}

export function appendUniqueJobberRecords<T extends { id: string }>(
  existing: readonly T[],
  incoming: readonly T[],
): T[] {
  const seenIds = new Set(existing.map((record) => record.id));
  return [
    ...existing,
    ...incoming.filter((record) => {
      if (seenIds.has(record.id)) return false;
      seenIds.add(record.id);
      return true;
    }),
  ];
}

export function advanceJobberPaginationCursor(input: {
  requestedAfter: string | null;
  endCursor: unknown;
  hasNextPage: unknown;
  seenCursors: readonly string[];
}) {
  if (typeof input.hasNextPage !== "boolean") {
    throw new JobberPaginationCursorError();
  }
  if (!input.hasNextPage) {
    return {
      after: null,
      hasNextPage: false,
      seenCursors: [...input.seenCursors],
    } as const;
  }
  if (
    typeof input.endCursor !== "string" ||
    input.endCursor.length === 0 ||
    input.endCursor.length > JOBBER_CURSOR_MAX_LENGTH ||
    input.endCursor === input.requestedAfter ||
    input.seenCursors.includes(input.endCursor)
  ) {
    throw new JobberPaginationCursorError();
  }
  return {
    after: input.endCursor,
    hasNextPage: true,
    seenCursors: [...input.seenCursors, input.endCursor],
  } as const;
}

export function hasCompleteJobberPropertyOwnershipEvidence(input: {
  pagesLoaded: number;
  hasNextPage: boolean;
  ownershipProofPageLimit: number;
}): boolean {
  return (
    input.pagesLoaded > 0 &&
    !input.hasNextPage &&
    input.pagesLoaded <= input.ownershipProofPageLimit
  );
}
