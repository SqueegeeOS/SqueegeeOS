import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import {
  JobberCustomerMatchError,
  linkJobberCustomer,
  loadJobberCustomerMatchingWorkspace,
  revokeJobberCustomerLink,
  type JobberCustomerQueue,
} from "@/lib/care-operations/jobber-customer-matching";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function listOptions(url: URL): {
  search: string;
  page: number;
  pageSize: number;
  queue: JobberCustomerQueue;
} {
  const queue = url.searchParams.get("queue");
  return {
    search: url.searchParams.get("search") ?? "",
    page: Number.parseInt(url.searchParams.get("page") ?? "1", 10),
    pageSize: Number.parseInt(url.searchParams.get("pageSize") ?? "20", 10),
    queue:
      queue === "review" ||
      queue === "unpaired" ||
      queue === "paired" ||
      queue === "all"
        ? queue
        : "all",
  };
}

export async function GET(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return unauthorized();
  }
  try {
    return NextResponse.json(
      await loadJobberCustomerMatchingWorkspace(listOptions(new URL(request.url))),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Customer workspace failed";
    console.error("[jobber-customers] load failed:", message);
    return NextResponse.json(
      { error: "Could not load the Jobber customer workspace." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  if (!authorizeAdminRequest(request.headers)) {
    return unauthorized();
  }
  let body: {
    action?: "link" | "revoke";
    externalClientId?: string;
    homeownerId?: string;
    sameCustomerConfirmed?: boolean;
    expectedSourcePayloadHash?: string;
    expectedLinkUpdatedAt?: string | null;
    search?: string;
    page?: number;
    queue?: "review" | "unpaired" | "paired" | "all";
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    if (body.action === "link") {
      if (
        !body.externalClientId ||
        !body.homeownerId ||
        !body.expectedSourcePayloadHash
      ) {
        throw new JobberCustomerMatchError(
          "Select both customers and refresh the Jobber evidence before pairing.",
          400,
        );
      }
      const result = await linkJobberCustomer({
        externalClientId: body.externalClientId,
        homeownerId: body.homeownerId,
        sameCustomerConfirmed: body.sameCustomerConfirmed === true,
        expectedSourcePayloadHash: body.expectedSourcePayloadHash,
        expectedLinkUpdatedAt: body.expectedLinkUpdatedAt,
      });
      return NextResponse.json({
        outcome: result.outcome,
        portalAppointment: result.portalAppointment,
        workspace: await loadJobberCustomerMatchingWorkspace({
          search: body.search,
          page: body.page,
          queue: body.queue,
        }),
      });
    }

    if (body.action === "revoke") {
      if (!body.externalClientId || !body.expectedLinkUpdatedAt) {
        throw new JobberCustomerMatchError(
          "Refresh the customer pairing before revoking it.",
          400,
        );
      }
      const outcome = await revokeJobberCustomerLink({
        externalClientId: body.externalClientId,
        expectedLinkUpdatedAt: body.expectedLinkUpdatedAt,
      });
      return NextResponse.json({
        outcome,
        workspace: await loadJobberCustomerMatchingWorkspace({
          search: body.search,
          page: body.page,
          queue: body.queue,
        }),
      });
    }

    return NextResponse.json(
      { error: "Choose link or revoke." },
      { status: 400 },
    );
  } catch (error) {
    if (error instanceof JobberCustomerMatchError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    const message = error instanceof Error ? error.message : "Pairing failed";
    console.error("[jobber-customers] pairing failed:", message);
    return NextResponse.json(
      {
        error:
          "The customer pairing was not changed. Refresh and verify both records before trying again.",
      },
      { status: 503 },
    );
  }
}
