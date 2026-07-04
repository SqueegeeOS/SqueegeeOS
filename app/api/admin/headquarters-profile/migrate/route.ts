import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/pin";
import {
  ensureHeadquartersProfileSchema,
  HEADQUARTERS_PROFILE_MIGRATION_SQL,
  headquartersProfileTableExists,
} from "@/lib/persistence/supabase/ensure-headquarters-schema";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  const pinHeader = request.headers.get("x-admin-pin");
  if (!authorizeAdminRequest(pinHeader)) return unauthorized();

  const exists = await headquartersProfileTableExists();

  return NextResponse.json({
    schemaReady: exists,
    migrationSql: exists ? null : HEADQUARTERS_PROFILE_MIGRATION_SQL,
  });
}

export async function POST(request: Request) {
  const pinHeader = request.headers.get("x-admin-pin");
  if (!authorizeAdminRequest(pinHeader)) return unauthorized();

  const result = await ensureHeadquartersProfileSchema();

  return NextResponse.json({
    schemaReady: result.schemaReady,
    created: result.created,
    method: result.method,
    error: result.error,
    migrationSql: result.schemaReady ? null : HEADQUARTERS_PROFILE_MIGRATION_SQL,
  });
}
