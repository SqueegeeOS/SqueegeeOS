import "server-only";

import { readJobberConnectionStatus } from "@/lib/care-operations/jobber-connection-store";
import { JOBBER_CONNECTION_ID } from "@/lib/care-operations/jobber-oauth-config";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { chunkItems } from "@/lib/care-operations/jobber-sync-utils";
import { getGoogleMapsApiKey } from "@/lib/reviews/config";
import {
  formatJobberServiceAddress,
  geocodeJobberServiceAddress,
  territoryAddressHash,
  type JobberServiceAddress,
} from "@/lib/sales/territory-geocoding";
import { loadHomeAtlasFieldAssignments } from "./homeatlas-field-assignment-server";
import { homeAtlasTechnicianIdentityKey } from "./homeatlas-field-assignment";
import { JobberAssignmentError } from "@/lib/care-operations/jobber-visit-assignment";
import { loadOwnerDispatchAssignableUsers } from "./owner-dispatch-assignment-server";
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
  "source_observed_at",
].join(", ");

const DISPATCH_GEOCODE_BATCH_SIZE = 24;
const DISPATCH_GEOCODE_CONCURRENCY = 6;

interface DispatchProjectionRow extends OwnerDispatchProjectionRow {
  source_observed_at: string;
}

interface CachedDispatchGeocodeRow extends OwnerDispatchGeocodeRow {
  source_address_hash: string;
}

function readDispatchAddress(value: unknown): JobberServiceAddress | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<JobberServiceAddress>;
  if (
    typeof candidate.street1 !== "string" ||
    candidate.street1.trim().length < 3 ||
    typeof candidate.city !== "string" ||
    typeof candidate.province !== "string" ||
    typeof candidate.postalCode !== "string" ||
    typeof candidate.country !== "string"
  ) {
    return null;
  }
  return {
    street1: candidate.street1,
    street2: typeof candidate.street2 === "string" ? candidate.street2 : null,
    city: candidate.city,
    province: candidate.province,
    postalCode: candidate.postalCode,
    country: candidate.country,
  };
}

async function hydrateUpcomingDispatchGeocodes(
  supabase: ReturnType<typeof createServiceRoleSupabaseClient>,
  projections: DispatchProjectionRow[],
  geocodes: CachedDispatchGeocodeRow[],
): Promise<void> {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) return;

  const geocodeByPropertyId = new Map(
    geocodes.map((row) => [row.external_property_id, row]),
  );
  const seenPropertyIds = new Set<string>();
  const candidates = projections.flatMap((projection) => {
    if (seenPropertyIds.has(projection.external_property_id)) return [];
    seenPropertyIds.add(projection.external_property_id);

    const address = readDispatchAddress(projection.property_address);
    if (!address) return [];
    const addressText = formatJobberServiceAddress(address);
    const addressHash = territoryAddressHash(addressText);
    const cached = geocodeByPropertyId.get(projection.external_property_id);
    if (
      cached?.source_address_hash === addressHash &&
      (cached.geocode_status === "resolved" || cached.geocode_status === "not_found")
    ) {
      return [];
    }
    return [{
      projection,
      address,
      addressText,
      addressHash,
    }];
  }).slice(0, DISPATCH_GEOCODE_BATCH_SIZE);

  for (const batch of chunkItems(candidates, DISPATCH_GEOCODE_CONCURRENCY)) {
    const results = await Promise.all(
      batch.map(async (candidate) => ({
        candidate,
        result: await geocodeJobberServiceAddress(candidate.address, apiKey),
      })),
    );
    const rows = results.map(({ candidate, result }) => ({
      connection_id: JOBBER_CONNECTION_ID,
      external_property_id: candidate.projection.external_property_id,
      source_address: candidate.addressText,
      source_address_hash: candidate.addressHash,
      formatted_address: result.formattedAddress,
      latitude: result.latitude,
      longitude: result.longitude,
      geocode_status: result.status,
      provider: "google_places_text_search",
      provider_place_id: result.placeId,
      source_observed_at: candidate.projection.source_observed_at,
      last_geocoded_at: new Date().toISOString(),
    }));
    const saveResult = await supabase
      .from("jobber_territory_geocodes")
      .upsert(rows, { onConflict: "connection_id,external_property_id" })
      .select(
        "external_property_id, source_address_hash, formatted_address, latitude, longitude, geocode_status",
      );
    if (saveResult.error) {
      console.warn("[owner-dispatch] geocode save failed", saveResult.error.message);
      continue;
    }
    for (const row of (saveResult.data ?? []) as CachedDispatchGeocodeRow[]) {
      geocodeByPropertyId.set(row.external_property_id, row);
      const index = geocodes.findIndex(
        (existing) => existing.external_property_id === row.external_property_id,
      );
      if (index >= 0) geocodes[index] = row;
      else geocodes.push(row);
    }
  }
}

export async function loadOwnerDispatchMonth(
  month: string,
): Promise<OwnerDispatchPayload> {
  const { startUtc, endUtc } = ownerDispatchMonthUtcBounds(month);
  const generatedAt = new Date().toISOString();
  const lowerBound = new Date(
    Math.max(startUtc.getTime(), Date.parse(generatedAt)),
  ).toISOString();
  const supabase = createServiceRoleSupabaseClient();
  const [connection, visitsResult, latestSyncResult] = await Promise.all([
    readJobberConnectionStatus(),
    supabase
      .from("jobber_visit_projections")
      .select(DISPATCH_VISIT_SELECT)
      .eq("connection_id", JOBBER_CONNECTION_ID)
      .neq("visit_status", "REMOVED")
      .eq("is_complete", false)
      .gt("scheduled_start", lowerBound)
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

  const projections = (visitsResult.data ?? []) as unknown as DispatchProjectionRow[];
  const homeAtlasAssignments = await loadHomeAtlasFieldAssignments(
    projections.map((visit) => visit.external_visit_id),
  );
  const propertyIds = [
    ...new Set(projections.map((visit) => visit.external_property_id)),
  ];
  const geocodes: CachedDispatchGeocodeRow[] = [];
  for (const propertyIdChunk of chunkItems(propertyIds)) {
    const geocodeResult = await supabase
      .from("jobber_territory_geocodes")
      .select(
        "external_property_id, source_address_hash, formatted_address, latitude, longitude, geocode_status",
      )
      .eq("connection_id", JOBBER_CONNECTION_ID)
      .in("external_property_id", propertyIdChunk);
    if (geocodeResult.error) {
      if (geocodeResult.error.message.includes("jobber_territory_geocodes")) {
        break;
      }
      throw new Error(geocodeResult.error.message);
    }
    geocodes.push(...((geocodeResult.data ?? []) as CachedDispatchGeocodeRow[]));
  }

  try {
    await hydrateUpcomingDispatchGeocodes(supabase, projections, geocodes);
  } catch (error) {
    console.warn(
      "[owner-dispatch] upcoming geocoding failed",
      error instanceof Error ? error.message : "unknown",
    );
  }

  const latestSync = latestSyncResult.data as {
    source_observed_at?: string;
  } | null;
  let assignableUsers: OwnerDispatchPayload["assignableUsers"] = [];
  let assignmentCapability: OwnerDispatchPayload["assignmentCapability"] =
    connection.connected ? "unavailable" : "permission_required";
  let assignmentMessage: string | null = connection.connected
    ? null
    : "Reconnect Jobber before assigning technicians.";
  if (connection.connected) {
    try {
      assignableUsers = (await loadOwnerDispatchAssignableUsers()).map((user) => ({
        ...user,
        source: "jobber" as const,
      }));
      assignmentCapability = "available";
      assignmentMessage = assignableUsers.length
        ? null
        : "No Jobber users are currently marked available for scheduling.";
    } catch (error) {
      if (error instanceof JobberAssignmentError) {
        assignmentCapability = error.code === "permission_required"
          ? "permission_required"
          : "unavailable";
        assignmentMessage = error.message;
      } else {
        assignmentCapability = "unavailable";
        assignmentMessage =
          "Technician assignments are temporarily unavailable. The future-job board is still current.";
      }
    }
  }
  const nativeResult = await supabase
    .from("homeatlas_technicians")
    .select("id, display_name")
    .eq("status", "active")
    .order("display_name", { ascending: true });
  if (nativeResult.error) throw new Error(nativeResult.error.message);
  assignableUsers.push(
    ...((nativeResult.data ?? []) as Array<{id:string; display_name:string}>).map(
      (technician) => ({
        id: homeAtlasTechnicianIdentityKey(technician.id),
        name: technician.display_name,
        source: "homeatlas" as const,
        availableForScheduling: true,
        isAccountOwner: false,
        isAccountAdmin: false,
      }),
    ),
  );
  if (assignableUsers.some((user) => user.source === "homeatlas")) {
    if (homeAtlasAssignments.available) {
      assignmentCapability = "available";
      assignmentMessage = null;
    } else {
      assignmentCapability = "unavailable";
      assignmentMessage =
        "HomeAtlas technician assignments are waiting on the latest database migration.";
    }
  }
  return buildOwnerDispatchPayload({
    month,
    connected: connection.connected,
    connectionStatus: connection.status,
    accountName: connection.accountName,
    lastSyncedAt: latestSync?.source_observed_at ?? null,
    projections,
    geocodes,
    homeAtlasAssignments: homeAtlasAssignments.byExternalVisitId,
    assignableUsers,
    assignmentCapability,
    assignmentMessage,
    generatedAt,
  });
}
