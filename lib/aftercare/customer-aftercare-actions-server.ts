import "server-only";

import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import {
  isCustomerAftercareOutcome,
  outcomeMatchesAftercareTask,
  resolutionForAftercareOutcome,
  type CustomerAftercareOutcome,
  type CustomerAftercareResolution,
  type CustomerAftercareTaskType,
} from "./customer-aftercare";
import { loadCustomerAftercareSnapshot } from "./customer-aftercare-server";

interface ResolutionRow {
  id: string;
  task_key: string;
  task_type: CustomerAftercareTaskType;
  resolution: CustomerAftercareResolution;
  outcome: CustomerAftercareOutcome;
  note: string | null;
  recorded_by: string;
  recorded_at: string;
}

export interface CustomerAftercareResolutionRecord {
  id: string;
  taskKey: string;
  taskType: CustomerAftercareTaskType;
  resolution: CustomerAftercareResolution;
  outcome: CustomerAftercareOutcome;
  note: string | null;
  recordedBy: string;
  recordedAt: string;
}

export interface RecordCustomerAftercareOutcomeInput {
  taskKey: string;
  outcome: CustomerAftercareOutcome;
  note?: string | null;
}

export class CustomerAftercareActionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "CustomerAftercareActionError";
  }
}

function fromRow(row: ResolutionRow): CustomerAftercareResolutionRecord {
  return {
    id: row.id,
    taskKey: row.task_key,
    taskType: row.task_type,
    resolution: row.resolution,
    outcome: row.outcome,
    note: row.note,
    recordedBy: row.recorded_by,
    recordedAt: row.recorded_at,
  };
}

export async function recordCustomerAftercareOutcome(
  input: RecordCustomerAftercareOutcomeInput,
  referenceDate = new Date(),
): Promise<{ record: CustomerAftercareResolutionRecord; duplicate: boolean }> {
  const taskKey = input.taskKey?.trim();
  const note = input.note?.trim() || null;
  if (!taskKey || taskKey.length > 220) {
    throw new CustomerAftercareActionError(
      "Choose a valid aftercare task.",
      400,
      "invalid_task",
    );
  }
  if (!isCustomerAftercareOutcome(input.outcome)) {
    throw new CustomerAftercareActionError(
      "Choose a valid aftercare outcome.",
      400,
      "invalid_outcome",
    );
  }
  if (note && note.length > 1000) {
    throw new CustomerAftercareActionError(
      "Keep the aftercare note to 1,000 characters or fewer.",
      400,
      "note_too_long",
    );
  }

  const snapshot = await loadCustomerAftercareSnapshot(referenceDate);
  const task = snapshot.tasks.find((candidate) => candidate.taskKey === taskKey);
  const supabase = createServiceRoleSupabaseClient();
  if (!task) {
    const existing = await supabase
      .from("customer_aftercare_resolutions")
      .select(
        "id, task_key, task_type, resolution, outcome, note, recorded_by, recorded_at",
      )
      .eq("task_key", taskKey)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data) {
      const record = fromRow(existing.data as ResolutionRow);
      if (record.outcome !== input.outcome) {
        throw new CustomerAftercareActionError(
          "This aftercare task was already resolved differently.",
          409,
          "already_resolved",
        );
      }
      return { record, duplicate: true };
    }
    throw new CustomerAftercareActionError(
      "This aftercare task is no longer open.",
      409,
      "task_not_open",
    );
  }
  if (!outcomeMatchesAftercareTask(task.type, input.outcome)) {
    throw new CustomerAftercareActionError(
      "That outcome does not match this aftercare task.",
      400,
      "outcome_mismatch",
    );
  }

  const evidence =
    task.type === "review_opportunity"
      ? {
          dueAt: task.dueAt,
          completedAt: task.completedAt,
          serviceLabel: task.serviceLabel,
          customerSummaryVisible: task.customerSummaryVisible,
          customerPhotoVisible: task.customerPhotoVisible,
        }
      : {
          dueAt: task.dueAt,
          membershipStartedAt: task.membershipStartedAt,
          anniversaryNumber: task.anniversaryNumber,
        };
  const recordedAt = referenceDate.toISOString();
  const saved = await supabase
    .from("customer_aftercare_resolutions")
    .upsert(
      {
        task_key: task.taskKey,
        task_type: task.type,
        homeowner_id: task.homeownerId,
        property_id: task.propertyId,
        membership_id: task.membershipId,
        appointment_id: task.appointmentId,
        resolution: resolutionForAftercareOutcome(input.outcome),
        outcome: input.outcome,
        note,
        evidence,
        recorded_by: "HQ owner",
        recorded_at: recordedAt,
      },
      { onConflict: "task_key", ignoreDuplicates: true },
    )
    .select(
      "id, task_key, task_type, resolution, outcome, note, recorded_by, recorded_at",
    )
    .single();
  if (saved.error || !saved.data) {
    const raced = await supabase
      .from("customer_aftercare_resolutions")
      .select(
        "id, task_key, task_type, resolution, outcome, note, recorded_by, recorded_at",
      )
      .eq("task_key", task.taskKey)
      .maybeSingle();
    if (raced.data) {
      const record = fromRow(raced.data as ResolutionRow);
      if (record.outcome !== input.outcome) {
        throw new CustomerAftercareActionError(
          "This aftercare task was already resolved differently.",
          409,
          "already_resolved",
        );
      }
      return { record, duplicate: true };
    }
    throw new Error(saved.error?.message ?? raced.error?.message ?? "Could not record aftercare.");
  }

  return { record: fromRow(saved.data as ResolutionRow), duplicate: false };
}
