import { NextResponse } from "next/server";
import { createServerSupabaseClient, isSupabaseConfigured } from "@/lib/persistence/supabase/client";
import { isCloudPersistenceConnected } from "@/lib/persistence/config";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Supabase environment variables are not configured.",
      },
      { status: 503 },
    );
  }

  try {
    const supabase = createServerSupabaseClient();

    const { error: homeownersError } = await supabase
      .from("homeowners")
      .select("id")
      .limit(1);

    if (homeownersError) {
      return NextResponse.json(
        {
          ok: false,
          connected: false,
          persistenceActive: isCloudPersistenceConnected(),
          error: homeownersError.message,
          hint:
            homeownersError.message.includes("does not exist") ||
            homeownersError.code === "PGRST205"
              ? "Run lib/persistence/supabase/schema.sql in the Supabase SQL Editor."
              : "Check RLS policies and API keys.",
        },
        { status: 502 },
      );
    }

    const { count, error: plansError } = await supabase
      .from("home_care_plans")
      .select("*", { count: "exact", head: true });

    if (plansError) {
      return NextResponse.json(
        {
          ok: false,
          connected: true,
          persistenceActive: isCloudPersistenceConnected(),
          error: plansError.message,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      connected: true,
      persistenceActive: isCloudPersistenceConnected(),
      projectUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      homeCarePlanCount: count ?? 0,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
