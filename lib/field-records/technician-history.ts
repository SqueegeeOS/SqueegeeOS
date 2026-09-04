import type { TechnicianJobClockSnapshot } from "@/lib/field-operations/technician-job-clock";
import { FIELD_RECORD_UUID } from "./field-closeout-review";

export const HISTORY_PAGE_SIZE = 25;
export interface TechnicianHistoryItem {
  assignmentId: string;
  clientName: string;
  service: string;
  technicianName: string;
  clock: TechnicianJobClockSnapshot;
  hasCloseout: boolean;
  openFollowUp: boolean;
  photoCount: number;
  jobberComplete: boolean | null;
  jobberStatus: string | null;
  invoiceStatus: string | null;
  sourceObservedAt: string | null;
}
export interface TechnicianHistoryPage {
  month: string;
  items: TechnicianHistoryItem[];
  nextCursor: string | null;
}

export function parseHistoryCursor(value: string | null): { startedAt: string; id: string } | null {
  if (!value) return null;
  const [startedAt, id, extra] = value.split("|");
  if (extra !== undefined || !FIELD_RECORD_UUID.test(id ?? "") ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(startedAt ?? "") ||
      !Number.isFinite(Date.parse(startedAt))) throw new Error("Invalid history cursor");
  // Keep database microseconds intact: truncating to JS milliseconds can skip
  // other clocks that started in the same millisecond during keyset pagination.
  return { startedAt, id };
}

export function historyNextAction(item: TechnicianHistoryItem): string {
  if (item.clock.state === "running") return "Still clocked in";
  if (!item.hasCloseout) return "Closeout missing";
  if (item.openFollowUp) return "Owner follow-up needed";
  if (item.jobberComplete === false) return "Review completion in Jobber";
  if (item.jobberComplete === null) return "Jobber status unavailable";
  return "Work record saved";
}
