export interface JobberTodayFieldRecordRow {
  appointmentId: string | null;
  fieldRecordId: string | null;
  technicianName: string;
  createdAt: string;
}

export interface JobberTodayFieldRecordSummary {
  count: number;
  latestFieldRecordAt: string;
  latestTechnicianName: string;
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
    JobberTodayFieldRecordSummary & { fieldRecordIds: Set<string> }
  >();

  for (const row of rows) {
    if (!row.appointmentId || !row.fieldRecordId) continue;
    const existing = accumulators.get(row.appointmentId);
    if (!existing) {
      accumulators.set(row.appointmentId, {
        count: 1,
        latestFieldRecordAt: row.createdAt,
        latestTechnicianName: row.technicianName,
        fieldRecordIds: new Set([row.fieldRecordId]),
      });
      continue;
    }

    if (!existing.fieldRecordIds.has(row.fieldRecordId)) {
      existing.fieldRecordIds.add(row.fieldRecordId);
      existing.count += 1;
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
      },
    ]),
  );
}
