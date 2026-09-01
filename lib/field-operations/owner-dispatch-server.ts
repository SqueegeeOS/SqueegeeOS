import "server-only";

import { readJobberConnectionStatus } from "@/lib/care-operations/jobber-connection-store";
import { JOBBER_CONNECTION_ID } from "@/lib/care-operations/jobber-oauth-config";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { chunkItems } from "@/lib/care-operations/jobber-sync-utils";
import {
  buildOwnerDispatchPayload,
  ownerDispatchMonthUtcBounds,
  type OwnerDispatchGeocodeRow,
  type OwnerDispatchPayload,
  type OwnerDispatchProjectionRow,
} from "./owner-dispatch";

const DISPATCH_VISIT_SELECT = [
  "id",
  "external_visit_id",
  "external_property_id",
  "jobber_property_web_uri",
  "property_name",
  "property_address",
  "job_number",
  "title",
  "client_name",
  "visit_status",
  "job_status",
  "scheduled_start",
  "scheduled_end",
  "is_complete",
  "raw_payload",
].join(", ");

export async function loadOwnerDispatchMonth(
  month: string,
): Promise<OwnerDispatchPayload> {
  const { startUtc, endUtc } = ownerDispatchMonthUtcBounds(month);
  const supabase = createServiceRoleSupabaseClient();
  const [connection, visitsResult, latestSyncResult] = await Promise.all([
    readJobberConnectionStatus(),
    supabase
      .from("jobber_visit_projections")
      .select(DISPATCH_VISIT_SELECT)
      .eq("connection_id", JOBBER_CONNECTION_ID)
      .neq("visit_status", "REMOVED")
      .gte("scheduled_start", startUtc.toISOString())
      .lt("scheduled_start", endUtc.toISOString())
      .order("scheduled_start", { ascending: true })
      .limit(1_500),
    supabase
      .from("jobber_visit_projections")
      .select("source_observed_at")
      .eq("connection_id", JOBBER_CONNECTION_ID)
      .order("source_observed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (visitsResult.error) throw new Error(visitsResult.error.message);
  if (latestSyncResult.error) throw new Error(latestSyncResult.error.message);

  const projections = (visitsResult.data ?? []) as unknown as OwnerDispatchProjectionRow[];
  const propertyIds = [
    ...new Set(projections.map((visit) => visit.external_property_id)),
  ];
  const geocodes: OwnerDispatchGeocodeRow[] = [];
  for (const propertyIdChunk of chunkItems(propertyIds)) {
    const geocodeResult = await supabase
      .from("jobber_territory_geocodes")
      .select(
        "external_property_id, formatted_address, latitude, longitude, geocode_status",
      )
      .eq("connection_id", JOBBER_CONNECTION_ID)
      .in("external_property_id", propertyIdChunk);
    if (geocodeResult.error) {
      if (geocodeResult.error.message.includes("jobber_territory_geocodes")) {
        break;
      }
      throw new Error(geocodeResult.error.message);
    }
    geocodes.push(...((geocodeResult.data ?? []) as OwnerDispatchGeocodeRow[]));
  }

  const latestSync = latestSyncResult.data as {
    source_observed_at?: string;
  } | null;
  return buildOwnerDispatchPayload({
    month,
    connected: connection.connected,
    connectionStatus: connection.status,
    accountName: connection.accountName,
    lastSyncedAt: latestSync?.source_observed_at ?? null,
    projections,
    geocodes,
  });
}
