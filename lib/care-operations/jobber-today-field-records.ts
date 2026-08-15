export interface JobberTodayFieldRecordRow {
  appointmentId: string | null;
  fieldRecordId: string | null;
  technicianName: string;
  createdAt: string;
  customerVisible: boolean;
  followUpOpen: boolean;
}

export interface JobberTodayFieldRecordSummary {
  count: number;
  latestFieldRecordAt: string;
  latestTechnicianName: string;
  customerVisibleCount: number;
  openFollowUpCount: number;
}

function timestamp(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

export function isMissingVisitFieldRecordSchema(error: {
  code?: string | null;
  message?: string | null;
}): boolean {
  const message = error.message?.toLocaleLowerCase("en-US") ?? "";
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    (message.includes("field_record_id") &&
      (message.includes("does not exist") || message.includes("schema cache")))
  );
}

export function summarizeJobberTodayFieldRecords(
  rows: JobberTodayFieldRecordRow[],
): Map<string, JobberTodayFieldRecordSummary> {
  const accumulators = new Map<
    string,
    JobberTodayFieldRecordSummary & {
      fieldRecordIds: Set<string>;
      customerVisibleFieldRecordIds: Set<string>;
      openFollowUpFieldRecordIds: Set<string>;
    }
  >();

  for (const row of rows) {
    if (!row.appointmentId || !row.fieldRecordId) continue;
    const existing = accumulators.get(row.appointmentId);
    if (!existing) {
      accumulators.set(row.appointmentId, {
        count: 1,
        latestFieldRecordAt: row.createdAt,
        latestTechnicianName: row.technicianName,
        customerVisibleCount: row.customerVisible ? 1 : 0,
        openFollowUpCount: row.followUpOpen ? 1 : 0,
        fieldRecordIds: new Set([row.fieldRecordId]),
        customerVisibleFieldRecordIds: new Set(
          row.customerVisible ? [row.fieldRecordId] : [],
        ),
        openFollowUpFieldRecordIds: new Set(
          row.followUpOpen ? [row.fieldRecordId] : [],
        ),
      });
      continue;
    }

    if (!existing.fieldRecordIds.has(row.fieldRecordId)) {
      existing.fieldRecordIds.add(row.fieldRecordId);
      existing.count += 1;
    }
    if (
      row.customerVisible &&
      !existing.customerVisibleFieldRecordIds.has(row.fieldRecordId)
    ) {
      existing.customerVisibleFieldRecordIds.add(row.fieldRecordId);
      existing.customerVisibleCount += 1;
    }
    if (
      row.followUpOpen &&
      !existing.openFollowUpFieldRecordIds.has(row.fieldRecordId)
    ) {
      existing.openFollowUpFieldRecordIds.add(row.fieldRecordId);
      existing.openFollowUpCount += 1;
    }
    if (timestamp(row.createdAt) > timestamp(existing.latestFieldRecordAt)) {
      existing.latestFieldRecordAt = row.createdAt;
      existing.latestTechnicianName = row.technicianName;
    }
  }

  return new Map(
    [...accumulators.entries()].map(([appointmentId, summary]) => [
      appointmentId,
      {
        count: summary.count,
        latestFieldRecordAt: summary.latestFieldRecordAt,
        latestTechnicianName: summary.latestTechnicianName,
        customerVisibleCount: summary.customerVisibleCount,
        openFollowUpCount: summary.openFollowUpCount,
      },
    ]),
  );
}
