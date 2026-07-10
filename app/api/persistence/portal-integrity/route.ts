import { NextResponse } from "next/server";
import {
  createPrivilegedServerSupabaseClient,
  isServiceRoleConfigured,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import { isMissingColumnError } from "@/lib/persistence/queries/load-membership-portal-row";

/**
 * Aggregate portal-table readability check — no customer identifiers or row payloads.
 * Pair with /api/persistence/health for infrastructure status.
 */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Supabase environment variables are not configured." },
      { status: 503 },
    );
  }

  const serviceRoleConfigured = isServiceRoleConfigured();

  try {
    const supabase = createPrivilegedServerSupabaseClient();

    const [
      memberships,
      appointments,
      addons,
      themeProbe,
    ] = await Promise.all([
      supabase.from("memberships").select("*", { count: "exact", head: true }),
      supabase
        .from("member_appointments")
        .select("*", { count: "exact", head: true }),
      supabase
        .from("member_addon_transactions")
        .select("*", { count: "exact", head: true }),
      supabase.from("memberships").select("portal_theme").limit(1),
    ]);

    const portalThemeColumnPresent = themeProbe.error
      ? !isMissingColumnError(themeProbe.error.message, "portal_theme")
      : true;

    const checks = {
      memberships: {
        readable: !memberships.error,
        count: memberships.count ?? 0,
        error: memberships.error?.message ?? null,
      },
      member_appointments: {
        readable: !appointments.error,
        count: appointments.count ?? 0,
        error: appointments.error?.message ?? null,
      },
      member_addon_transactions: {
        readable: !addons.error,
        count: addons.count ?? 0,
        error: addons.error?.message ?? null,
      },
      portal_theme: {
        readable: portalThemeColumnPresent && !themeProbe.error,
        columnPresent: portalThemeColumnPresent,
        migration029Applied: portalThemeColumnPresent,
        error: themeProbe.error?.message ?? null,
      },
    };

    const ok =
      checks.memberships.readable &&
      checks.member_appointments.readable &&
      checks.member_addon_transactions.readable;

    return NextResponse.json({
      ok,
      persistenceActive: isCloudPersistenceConnected(),
      serviceRoleConfigured,
      checks,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        serviceRoleConfigured,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
