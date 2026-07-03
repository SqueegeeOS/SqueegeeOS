import { NextResponse } from "next/server";
import { MOCK_CLOSED_JOBS } from "@/lib/admin/mock-closed-jobs";
import {
  createLocalClosedJob,
  validateClosedJobInput,
} from "@/lib/admin/closed-jobs-store";
import type { ClosedJobInput } from "@/lib/admin/closed-jobs-types";
import {
  insertClosedJobToSupabase,
  listClosedJobsFromSupabase,
} from "@/lib/admin/closed-jobs-server";
import { authorizeAdminRequest } from "@/lib/admin/pin";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  const pinHeader = request.headers.get("x-admin-pin");
  if (!authorizeAdminRequest(pinHeader)) return unauthorized();

  const supabaseResult = await listClosedJobsFromSupabase();

  if (supabaseResult.jobs.length > 0) {
    return NextResponse.json({
      jobs: supabaseResult.jobs,
      storage: "supabase",
      warning: supabaseResult.error,
    });
  }

  if (supabaseResult.error) {
    return NextResponse.json({
      jobs: MOCK_CLOSED_JOBS,
      storage: "local",
      warning: supabaseResult.error,
    });
  }

  return NextResponse.json({
    jobs: MOCK_CLOSED_JOBS,
    storage: "local",
  });
}

export async function POST(request: Request) {
  const pinHeader = request.headers.get("x-admin-pin");
  if (!authorizeAdminRequest(pinHeader)) return unauthorized();

  let body: ClosedJobInput;
  try {
    body = (await request.json()) as ClosedJobInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validationError = validateClosedJobInput(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const supabaseResult = await insertClosedJobToSupabase(body);
  if (supabaseResult.job) {
    return NextResponse.json({
      job: supabaseResult.job,
      storage: "supabase",
      message: "Closed job logged.",
    });
  }

  const localJob = createLocalClosedJob(body);
  return NextResponse.json({
    job: localJob,
    storage: "local",
    message: "Closed job logged.",
    warning:
      supabaseResult.error ??
      "Saved locally in this browser. Run migrations/002_closed_jobs.sql for cloud sync.",
  });
}
