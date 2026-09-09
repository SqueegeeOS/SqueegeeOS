import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import {
  createLiveDispatchJob,
} from "@/lib/field-operations/live-dispatch-server";
import {
  isTechnicianProfileId,
} from "@/lib/field-operations/technician-profile";

export const runtime = "nodejs";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ technicianId: string }> },
) {
  if (!authorizeAdminRequest(request.headers)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: PRIVATE_HEADERS },
    );
  }

  const { technicianId } = await params;
  if (!isTechnicianProfileId(technicianId)) {
    return NextResponse.json(
      { error: "Choose a valid technician." },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | {
        clientRequestId?: string;
        scheduledStart?: string;
        clientName?: string;
        serviceTitle?: string;
        propertyAddress?: string;
        soldAmountCents?: number | null;
        notes?: string;
      }
    | null;

  try {
    const job = await createLiveDispatchJob({
      clientRequestId: body?.clientRequestId ?? "",
      technicianId,
      scheduledStart: body?.scheduledStart ?? "",
      clientName: body?.clientName ?? "",
      serviceTitle: body?.serviceTitle ?? "",
      propertyAddress: body?.propertyAddress,
      soldAmountCents: body?.soldAmountCents ?? null,
      notes: body?.notes,
    });
    return NextResponse.json(
      { job },
      { status: job.replayed ? 200 : 201, headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create the live field job.";
    const invalid = /valid|must|between|limited|Choose|Enter|amount|Address|notes/i.test(
      message,
    );
    console.error("[live-dispatch] create failed", message);
    return NextResponse.json(
      { error: message },
      { status: invalid ? 400 : 503, headers: PRIVATE_HEADERS },
    );
  }
}
