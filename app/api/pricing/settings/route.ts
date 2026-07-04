import { NextResponse } from "next/server";
import { fetchPricingSettingsFromSupabase } from "@/lib/pricing/pricing-settings-server";

export async function GET() {
  const result = await fetchPricingSettingsFromSupabase();

  return NextResponse.json({
    settings: result.settings,
    updatedAt: result.updatedAt,
    storage: result.updatedAt ? "supabase" : "default",
    warning: result.error,
  });
}
