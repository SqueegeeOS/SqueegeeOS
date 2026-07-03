import type { ClosedJob, ClosedJobInput, ClosedJobRow } from "@/lib/admin/closed-jobs-types";
import {
  closedJobFromRow,
  closedJobInputToRow,
} from "@/lib/admin/closed-jobs-store";
import { createServerSupabaseClient, isSupabaseConfigured } from "@/lib/persistence/supabase/client";

export async function listClosedJobsFromSupabase(): Promise<{
  jobs: ClosedJob[];
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { jobs: [], error: "Supabase not configured" };
  }

  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("closed_jobs")
      .select("*")
      .order("closed_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      if (
        error.message.includes("does not exist") ||
        error.code === "PGRST205"
      ) {
        return {
          jobs: [],
          error: "closed_jobs table missing — run migrations/002_closed_jobs.sql",
        };
      }
      return { jobs: [], error: error.message };
    }

    return {
      jobs: (data as ClosedJobRow[]).map(closedJobFromRow),
    };
  } catch (error) {
    return {
      jobs: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function insertClosedJobToSupabase(
  input: ClosedJobInput,
): Promise<{ job: ClosedJob | null; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { job: null, error: "Supabase not configured" };
  }

  const id = crypto.randomUUID();
  const row = closedJobInputToRow(input, id);

  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("closed_jobs")
      .insert(row)
      .select("*")
      .single();

    if (error) {
      return { job: null, error: error.message };
    }

    return { job: closedJobFromRow(data as ClosedJobRow) };
  } catch (error) {
    return {
      job: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
