import { NextResponse } from "next/server";
import {
  compareProfileUpdatedAt,
  fetchHeadquartersProfileFromSupabase,
  isBlankHeadquartersProfile,
  upsertHeadquartersProfileToSupabase,
} from "@/lib/admin/headquarters-profile-server";
import {
  isHeadquartersInitialized,
  normalizeLegacyBaseline,
  type LegacyBaseline,
} from "@/lib/admin/legacy-baseline";
import { authorizeAdminRequest } from "@/lib/admin/pin";
import { isSupabaseConfigured } from "@/lib/persistence/supabase/client";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  const pinHeader = request.headers.get("x-admin-pin");
  if (!authorizeAdminRequest(pinHeader)) return unauthorized();

  const result = await fetchHeadquartersProfileFromSupabase();

  return NextResponse.json({
    profile: result.profile,
    storage: result.profile ? "supabase" : "none",
    healthy: isSupabaseConfigured() && !result.error,
    warning: result.error,
  });
}

export async function PUT(request: Request) {
  const pinHeader = request.headers.get("x-admin-pin");
  if (!authorizeAdminRequest(pinHeader)) return unauthorized();

  let body: { profile?: LegacyBaseline; expectedUpdatedAt?: string | null };
  try {
    body = (await request.json()) as {
      profile?: LegacyBaseline;
      expectedUpdatedAt?: string | null;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.profile) {
    return NextResponse.json({ error: "profile is required" }, { status: 400 });
  }

  const incoming = normalizeLegacyBaseline(body.profile);

  if (isBlankHeadquartersProfile(incoming)) {
    return NextResponse.json(
      { error: "Refusing to save an empty headquarters profile" },
      { status: 400 },
    );
  }

  const existing = await fetchHeadquartersProfileFromSupabase();
  if (existing.profile) {
    if (
      body.expectedUpdatedAt &&
      compareProfileUpdatedAt(existing.profile.updatedAt, body.expectedUpdatedAt) >
        0
    ) {
      return NextResponse.json(
        {
          error: "Cloud headquarters profile is newer than this save request",
          profile: existing.profile,
          storage: "supabase",
        },
        { status: 409 },
      );
    }

    if (
      isHeadquartersInitialized(existing.profile) &&
      isBlankHeadquartersProfile(incoming)
    ) {
      return NextResponse.json(
        {
          error: "Refusing to overwrite cloud headquarters profile with empty data",
          profile: existing.profile,
          storage: "supabase",
        },
        { status: 409 },
      );
    }
  }

  const saved = await upsertHeadquartersProfileToSupabase(incoming);
  if (!saved.profile) {
    return NextResponse.json(
      {
        error: saved.error ?? "Failed to save headquarters profile",
        storage: "local",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    profile: saved.profile,
    storage: "supabase",
    message: "Headquarters profile saved to cloud.",
  });
}
