import "server-only";

import { createPrivilegedServerSupabaseClient } from "@/lib/persistence/supabase/client";
import { getGoogleMapsApiKey } from "@/lib/reviews/config";
import { JOBBER_CONNECTION_ID } from "@/lib/care-operations/jobber-oauth-config";
import { loadActiveSalesRepIdentity } from "./workspace-server";
import {
  formatJobberServiceAddress,
  geocodeJobberServiceAddress,
  territoryAddressHash,
  type JobberServiceAddress,
} from "./territory-geocoding";
import type {
  TerritoryCustomerPin,
  TerritoryMapPayload,
} from "./territory-types";

const PAGE_SIZE = 500;
const GEOCODE_BATCH_SIZE = 24;

interface CompletedVisitRow {
  external_client_id: string;
  external_property_id: string;
  jobber_property_web_uri: string | null;
  property_name: string | null;
  property_address: JobberServiceAddress | null;
  client_name: string;
  title: string | null;
  job_number: number | null;
  completed_at: string | null;
  scheduled_start: string | null;
  source_observed_at: string;
}

interface TerritoryGeocodeRow {
  external_property_id: string;
  source_address_hash: string;
  formatted_address: string | null;
  latitude: number | null;
  longitude: number | null;
  geocode_status: "pending" | "resolved" | "not_found" | "error";
}

interface CompletedPropertySource {
  propertyId: string;
  clientId: string;
  customerName: string;
  address: JobberServiceAddress;
  addressText: string;
  addressHash: string;
  jobberWebUri: string;
  sourceObservedAt: string;
  visits: CompletedVisitRow[];
}

export class TerritoryMapUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TerritoryMapUnavailableError";
  }
}

function validAddress(value: unknown): value is JobberServiceAddress {
  if (!value || typeof value !== "object") return false;
  const address = value as Partial<JobberServiceAddress>;
  return (
    typeof address.street1 === "string" &&
    address.street1.trim().length >= 3 &&
    typeof address.city === "string" &&
    typeof address.province === "string" &&
    typeof address.postalCode === "string" &&
    typeof address.country === "string"
  );
}

function visitMoment(visit: CompletedVisitRow): number {
  const value = visit.completed_at ?? visit.scheduled_start;
  return value ? Date.parse(value) || 0 : 0;
}

async function loadCompletedVisits(): Promise<CompletedVisitRow[]> {
  const supabase = createPrivilegedServerSupabaseClient();
  const rows: CompletedVisitRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const result = await supabase
      .from("jobber_visit_projections")
      .select(
        "external_client_id, external_property_id, jobber_property_web_uri, property_name, property_address, client_name, title, job_number, completed_at, scheduled_start, source_observed_at",
      )
      .eq("connection_id", JOBBER_CONNECTION_ID)
      .eq("is_complete", true)
      .neq("visit_status", "REMOVED")
      .order("completed_at", { ascending: false, nullsFirst: false })
      .range(from, from + PAGE_SIZE - 1);
    if (result.error) {
      if (
        result.error.message.includes("property_address") ||
        result.error.message.includes("jobber_territory_geocodes")
      ) {
        throw new TerritoryMapUnavailableError(
          "The territory map database upgrade has not been applied yet.",
        );
      }
      throw new TerritoryMapUnavailableError(
        "Completed Jobber work could not be loaded for the map.",
      );
    }
    const page = (result.data ?? []) as CompletedVisitRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function loadCompletedPropertySources(): Promise<{
  sources: CompletedPropertySource[];
  completedProperties: number;
  unmappableProperties: number;
}> {
  const visits = await loadCompletedVisits();
  const groups = new Map<string, CompletedVisitRow[]>();

  for (const visit of visits) {
    if (!visit.external_property_id) continue;
    const group = groups.get(visit.external_property_id) ?? [];
    group.push(visit);
    groups.set(visit.external_property_id, group);
  }

  let unmappableProperties = 0;
  const sources = [...groups.entries()].flatMap(
    ([propertyId, propertyVisits]) => {
      const sorted = [...propertyVisits].sort(
        (left, right) => visitMoment(right) - visitMoment(left),
      );
      const latest = sorted[0]!;
      if (!validAddress(latest.property_address)) {
        unmappableProperties += 1;
        return [];
      }
      const address = latest.property_address;
      const addressText = formatJobberServiceAddress(address);
      return [{
        propertyId,
        clientId: latest.external_client_id,
        customerName: latest.client_name,
        address,
        addressText,
        addressHash: territoryAddressHash(addressText),
        jobberWebUri:
          latest.jobber_property_web_uri ?? "https://secure.getjobber.com/",
        sourceObservedAt: latest.source_observed_at,
        visits: sorted,
      }];
    },
  );

  return {
    sources,
    completedProperties: groups.size,
    unmappableProperties,
  };
}

async function loadGeocodeRows(
  propertyIds: string[],
): Promise<Map<string, TerritoryGeocodeRow>> {
  if (propertyIds.length === 0) return new Map();
  const supabase = createPrivilegedServerSupabaseClient();
  const rows: TerritoryGeocodeRow[] = [];

  for (let offset = 0; offset < propertyIds.length; offset += 100) {
    const result = await supabase
      .from("jobber_territory_geocodes")
      .select(
        "external_property_id, source_address_hash, formatted_address, latitude, longitude, geocode_status",
      )
      .eq("connection_id", JOBBER_CONNECTION_ID)
      .in("external_property_id", propertyIds.slice(offset, offset + 100));
    if (result.error) {
      throw new TerritoryMapUnavailableError(
        result.error.message.includes("jobber_territory_geocodes")
          ? "The territory map database upgrade has not been applied yet."
          : "Saved map coordinates could not be loaded.",
      );
    }
    rows.push(...((result.data ?? []) as TerritoryGeocodeRow[]));
  }

  return new Map(rows.map((row) => [row.external_property_id, row]));
}

function toPin(
  source: CompletedPropertySource,
  geocode: TerritoryGeocodeRow,
): TerritoryCustomerPin | null {
  if (
    geocode.geocode_status !== "resolved" ||
    geocode.source_address_hash !== source.addressHash ||
    typeof geocode.latitude !== "number" ||
    typeof geocode.longitude !== "number"
  ) {
    return null;
  }

  return {
    propertyId: source.propertyId,
    clientId: source.clientId,
    customerName: source.customerName,
    address: source.addressText,
    jobberWebUri: source.jobberWebUri,
    location: {
      latitude: geocode.latitude,
      longitude: geocode.longitude,
    },
    completedVisitCount: source.visits.length,
    lastCompletedAt:
      source.visits[0]?.completed_at ?? source.visits[0]?.scheduled_start ?? null,
    services: source.visits.slice(0, 8).map((visit) => ({
      label: visit.title?.trim() || "Completed service",
      completedAt: visit.completed_at ?? visit.scheduled_start,
      jobNumber: visit.job_number,
    })),
  };
}

export async function geocodeTerritoryBatch(
  repSlug: string,
  limit = GEOCODE_BATCH_SIZE,
): Promise<{
  geocoded: number;
  unresolved: number;
  failed: number;
  remaining: number;
}> {
  await loadActiveSalesRepIdentity(repSlug);
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    throw new TerritoryMapUnavailableError(
      "Google address resolution is not configured.",
    );
  }

  const { sources } = await loadCompletedPropertySources();
  const geocodes = await loadGeocodeRows(
    sources.map((source) => source.propertyId),
  );
  const pending = sources.filter((source) => {
    const cached = geocodes.get(source.propertyId);
    return (
      !cached ||
      cached.source_address_hash !== source.addressHash ||
      cached.geocode_status === "pending" ||
      cached.geocode_status === "error"
    );
  });
  const batch = pending.slice(0, Math.max(1, Math.min(50, limit)));
  const supabase = createPrivilegedServerSupabaseClient();
  let geocoded = 0;
  let unresolved = 0;
  let failed = 0;

  for (const source of batch) {
    const result = await geocodeJobberServiceAddress(source.address, apiKey);
    if (result.status === "resolved") geocoded += 1;
    else if (result.status === "not_found") unresolved += 1;
    else failed += 1;

    const { error } = await supabase.from("jobber_territory_geocodes").upsert(
      {
        connection_id: JOBBER_CONNECTION_ID,
        external_property_id: source.propertyId,
        source_address: source.addressText,
        source_address_hash: source.addressHash,
        formatted_address: result.formattedAddress,
        latitude: result.latitude,
        longitude: result.longitude,
        geocode_status: result.status,
        provider: "google_places_text_search",
        provider_place_id: result.placeId,
        source_observed_at: source.sourceObservedAt,
        last_geocoded_at: new Date().toISOString(),
      },
      { onConflict: "connection_id,external_property_id" },
    );
    if (error) {
      throw new TerritoryMapUnavailableError(
        "A resolved Jobber address could not be saved to the private map.",
      );
    }
  }

  return {
    geocoded,
    unresolved,
    failed,
    remaining:
      failed > 0
        ? pending.length
        : Math.max(0, pending.length - batch.length),
  };
}

export async function geocodeTerritoryBacklog(
  repSlug: string,
  options: { maxBatches?: number; stopAtMs?: number } = {},
): Promise<{
  geocoded: number;
  unresolved: number;
  failed: number;
  remaining: number;
}> {
  const maxBatches = Math.max(1, Math.min(20, options.maxBatches ?? 20));
  let geocoded = 0;
  let unresolved = 0;
  let failed = 0;
  let remaining = 0;

  for (let batch = 0; batch < maxBatches; batch += 1) {
    if (options.stopAtMs && Date.now() >= options.stopAtMs) break;
    const result = await geocodeTerritoryBatch(repSlug);
    geocoded += result.geocoded;
    unresolved += result.unresolved;
    failed += result.failed;
    remaining = result.remaining;
    if (result.failed > 0 || result.remaining === 0) break;
  }

  return { geocoded, unresolved, failed, remaining };
}

export async function loadTerritoryMap(
  repSlug: string,
): Promise<TerritoryMapPayload> {
  const rep = await loadActiveSalesRepIdentity(repSlug);
  const {
    sources,
    completedProperties,
    unmappableProperties,
  } = await loadCompletedPropertySources();
  const geocodes = await loadGeocodeRows(
    sources.map((source) => source.propertyId),
  );
  const pins = sources
    .map((source) => {
      const geocode = geocodes.get(source.propertyId);
      return geocode ? toPin(source, geocode) : null;
    })
    .filter((pin): pin is TerritoryCustomerPin => Boolean(pin))
    .sort((left, right) => {
      const rightTime = right.lastCompletedAt
        ? Date.parse(right.lastCompletedAt) || 0
        : 0;
      const leftTime = left.lastCompletedAt
        ? Date.parse(left.lastCompletedAt) || 0
        : 0;
      return rightTime - leftTime;
    });
  const unmatchedAddresses = sources.filter((source) => {
    const row = geocodes.get(source.propertyId);
    return (
      row?.source_address_hash === source.addressHash &&
      row.geocode_status === "not_found"
    );
  }).length;

  return {
    executionMode: "private_jobber_proof_map",
    source: "jobber_completed_visits",
    repSlug: rep.slug,
    generatedAt: new Date().toISOString(),
    lastJobberObservedAt:
      sources.reduce<string | null>((latest, source) => {
        if (!latest || source.sourceObservedAt > latest) {
          return source.sourceObservedAt;
        }
        return latest;
      }, null),
    coverage: {
      completedProperties,
      mappedProperties: pins.length,
      pendingProperties: Math.max(
        0,
        sources.length - pins.length - unmatchedAddresses,
      ),
      unmatchedAddresses,
      unmappableProperties,
    },
    pins,
  };
}
