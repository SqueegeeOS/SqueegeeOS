import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/pin";
import {
  normalizeCompanySettings,
  validateCompanySettings,
  type CompanySettings,
} from "@/lib/pricing/company-settings";
import {
  fetchPricingSettingsFromSupabase,
  upsertPricingSettingsToSupabase,
} from "@/lib/pricing/pricing-settings-server";
import { isSupabaseConfigured } from "@/lib/persistence/supabase/client";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  const pinHeader = request.headers.get("x-admin-pin");
  if (!authorizeAdminRequest(pinHeader)) return unauthorized();

  const result = await fetchPricingSettingsFromSupabase();

  return NextResponse.json({
    settings: result.settings,
    updatedAt: result.updatedAt,
    storage: isSupabaseConfigured() && result.updatedAt ? "supabase" : "default",
    warning: result.error,
  });
}

export async function PUT(request: Request) {
  const pinHeader = request.headers.get("x-admin-pin");
  if (!authorizeAdminRequest(pinHeader)) return unauthorized();

  let body: { settings?: CompanySettings };
  try {
    body = (await request.json()) as { settings?: CompanySettings };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.settings) {
    return NextResponse.json({ error: "settings is required" }, { status: 400 });
  }

  const normalized = normalizeCompanySettings(body.settings);
  const validationError = validateCompanySettings(normalized);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      settings: normalized,
      storage: "local",
      warning: "Supabase not configured — settings apply on this device via cache only",
    });
  }

  const saved = await upsertPricingSettingsToSupabase(normalized);

  if (!saved.settings) {
    return NextResponse.json(
      {
        error: saved.error ?? "Failed to save pricing settings",
        settings: normalized,
        storage: "local",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    settings: saved.settings,
    updatedAt: saved.updatedAt,
    storage: "supabase",
  });
}
