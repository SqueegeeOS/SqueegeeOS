import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { syncAllJobberData } from "@/lib/care-operations/jobber-full-sync";
import {
  geocodeTerritoryBacklog,
  loadTerritoryMap,
  TerritoryMapUnavailableError,
} from "@/lib/sales/territory-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function territoryError(error: unknown) {
  if (error instanceof TerritoryMapUnavailableError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  console.error("[territory-map] unexpected error", error);
  return NextResponse.json(
    { error: "The private customer proof map could not be loaded." },
    { status: 500 },
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ repSlug: string }> },
) {
  if (!authorizeAdminRequest(request.headers)) return unauthorized();
  const { repSlug } = await params;

  try {
    return NextResponse.json(await loadTerritoryMap(repSlug), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return territoryError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ repSlug: string }> },
) {
  if (!authorizeAdminRequest(request.headers)) return unauthorized();
  const { repSlug } = await params;
  const body = (await request.json().catch(() => null)) as {
    syncJobber?: boolean;
  } | null;

  try {
    const sync = body?.syncJobber
      ? await syncAllJobberData()
      : null;
    const geocode = await geocodeTerritoryBacklog(repSlug, {
      maxBatches: 20,
      stopAtMs: Date.now() + 250_000,
    });
    const map = await loadTerritoryMap(repSlug);
    return NextResponse.json({
      ...map,
      refresh: {
        jobberClientsObserved: sync?.clients.observed ?? 0,
        jobberVisitsObserved: sync?.visits.observed ?? 0,
        geocoded: geocode.geocoded,
        unresolved: geocode.unresolved,
        failed: geocode.failed,
        remaining: geocode.remaining,
      },
    });
  } catch (error) {
    return territoryError(error);
  }
}
