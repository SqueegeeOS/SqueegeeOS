import "server-only";

import { createHash } from "crypto";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import {
  fetchAllJobberClients,
  type JobberClientNode,
} from "./jobber-api";
import { getFreshJobberAccessToken } from "./jobber-connection-store";
import { JOBBER_CONNECTION_ID } from "./jobber-oauth-config";
import {
  reconcilePairedCustomerPortalVisit,
  type JobberPortalProjectionResult,
} from "./jobber-portal-appointments";
import {
  buildSearchText,
  chunkItems,
  escapeLikePattern,
  summarizeProjectionChanges,
  toBoundedInteger,
} from "./jobber-sync-utils";

const DEFAULT_HOMEATLAS_SEARCH_LIMIT = 30;
const MAX_HOMEATLAS_SEARCH_LIMIT = 50;
const LINK_ACTOR = "hq_admin";
const LINK_REASON =
  "Headquarters confirmed the same customer in Jobber and HomeAtlas";
const REVOKE_REASON = "Headquarters revoked the Jobber customer pairing";

interface ExistingProjection {
  external_client_id: string;
  source_payload_hash: string;
}

interface StoredClientProjectionRow {
  id: string;
  external_client_id: string;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  jobber_web_uri: string;
  is_archived: boolean;
  properties: JobberClientPropertyPreview[];
  property_count: number;
  properties_complete: boolean;
}

interface CustomerLinkRow {
  id: string;
  external_client_id: string;
  homeowner_id: string;
  link_state: "active" | "revoked";
  updated_at: string;
}

interface HomeownerRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
}

interface PropertyRow {
  id: string;
  homeowner_id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

const CLIENT_PREVIEW_SELECT =
  "id, external_client_id, name, company_name, email, phone, jobber_web_uri, is_archived, properties, property_count, properties_complete";

export interface JobberClientPropertyPreview {
  id: string;
  name: string | null;
  jobberWebUri: string;
}

export interface HomeAtlasCustomerCandidate {
  homeownerId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  properties: Array<{ propertyId: string; label: string }>;
}

export interface JobberCustomerLinkPreview {
  linkId: string;
  homeownerId: string;
  homeownerName: string;
  linkState: "active" | "revoked";
  updatedAt: string;
}

export interface JobberClientPreview {
  projectionId: string;
  externalClientId: string;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  jobberWebUri: string;
  isArchived: boolean;
  properties: JobberClientPropertyPreview[];
  propertyCount: number;
  propertiesComplete: boolean;
  customerLink: JobberCustomerLinkPreview | null;
}

export interface JobberCustomerMatchingWorkspace {
  executionMode: "supervised_customer_pairing";
  automaticMatching: false;
  billingEnabled: false;
  clients: JobberClientPreview[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  search: string;
}

export interface HomeAtlasCustomerSearchResult {
  customers: HomeAtlasCustomerCandidate[];
  search: string;
  limitReached: boolean;
}

export interface JobberClientSyncResult {
  observed: number;
  pagesRead: number;
  inserted: number;
  changed: number;
  unchanged: number;
}

export interface JobberCustomerLinkResult {
  outcome: "linked" | "already_linked";
  portalAppointment: JobberPortalProjectionResult;
}

export class JobberCustomerMatchError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "JobberCustomerMatchError";
  }
}

async function finishCustomerLink(input: {
  outcome: JobberCustomerLinkResult["outcome"];
  externalClientId: string;
  homeownerId: string;
}): Promise<JobberCustomerLinkResult> {
  try {
    return {
      outcome: input.outcome,
      portalAppointment: await reconcilePairedCustomerPortalVisit({
        externalClientId: input.externalClientId,
        homeownerId: input.homeownerId,
      }),
    };
  } catch (error) {
    console.error("[jobber-customer-pairing] portal projection failed", {
      externalClientId: input.externalClientId,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return {
      outcome: input.outcome,
      portalAppointment: {
        status: "error",
        appointmentId: null,
        externalVisitId: null,
        scheduledAt: null,
        propertyLinkCreated: false,
        message:
          "Customer paired, but the portal visit needs a retry from Jobber sync.",
      },
    };
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function formatPropertyLabel(property: PropertyRow): string {
  return [
    property.name,
    property.address,
    property.city,
    property.state,
    property.zip,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function hashJobberClientPayload(client: JobberClientNode): string {
  return createHash("sha256").update(JSON.stringify(client)).digest("hex");
}

export function toJobberClientProjectionRow(
  client: JobberClientNode,
  observedAt: string,
) {
  const properties = client.clientProperties.nodes.map((property) => ({
    id: property.id,
    name: property.name,
    jobberWebUri: property.jobberWebUri,
  }));
  return {
    connection_id: JOBBER_CONNECTION_ID,
    provider: "jobber",
    external_client_id: client.id,
    name: client.name,
    first_name: client.firstName || null,
    last_name: client.lastName || null,
    company_name: client.companyName,
    email: client.email,
    phone: client.phone,
    jobber_web_uri: client.jobberWebUri,
    is_archived: client.isArchived,
    properties,
    property_count: client.clientProperties.totalCount ?? properties.length,
    properties_complete: !client.clientProperties.pageInfo.hasNextPage,
    search_text: buildSearchText([
      client.name,
      client.firstName,
      client.lastName,
      client.companyName,
      client.email,
      client.phone,
      ...properties.map((property) => property.name),
    ]),
    raw_payload: client,
    source_payload_hash: hashJobberClientPayload(client),
    source_observed_at: observedAt,
    last_seen_at: observedAt,
  };
}

export async function syncAllJobberClients(
  providedAccessToken?: string,
): Promise<JobberClientSyncResult> {
  const accessToken = providedAccessToken ?? (await getFreshJobberAccessToken());
  const source = await fetchAllJobberClients(accessToken);
  const observedAt = new Date().toISOString();
  const rows = source.nodes.map((client) =>
    toJobberClientProjectionRow(client, observedAt),
  );
  const supabase = createServiceRoleSupabaseClient();
  const existing = new Map<string, string>();

  for (const externalIds of chunkItems(
    rows.map((row) => row.external_client_id),
  )) {
    const result = await supabase
      .from("jobber_client_projections")
      .select("external_client_id, source_payload_hash")
      .eq("connection_id", JOBBER_CONNECTION_ID)
      .in("external_client_id", externalIds);
    if (result.error) throw new Error(result.error.message);
    for (const row of (result.data ?? []) as ExistingProjection[]) {
      existing.set(row.external_client_id, row.source_payload_hash);
    }
  }

  for (const batch of chunkItems(rows)) {
    const { error } = await supabase
      .from("jobber_client_projections")
      .upsert(batch, { onConflict: "connection_id,external_client_id" });
    if (error) throw new Error(error.message);
  }

  const changes = summarizeProjectionChanges(
    rows.map((row) => ({
      externalId: row.external_client_id,
      payloadHash: row.source_payload_hash,
    })),
    existing,
  );
  return {
    observed: rows.length,
    pagesRead: source.pageCount,
    ...changes,
  };
}

async function addPropertiesToHomeowners(
  homeowners: HomeownerRow[],
): Promise<HomeAtlasCustomerCandidate[]> {
  if (homeowners.length === 0) return [];
  const supabase = createServiceRoleSupabaseClient();
  const homeownerIds = homeowners.map((homeowner) => homeowner.id);
  const propertyResult = await supabase
    .from("properties")
    .select("id, homeowner_id, name, address, city, state, zip")
    .in("homeowner_id", homeownerIds);
  if (propertyResult.error) throw propertyResult.error;
  const propertiesByHomeowner = new Map<string, PropertyRow[]>();
  for (const property of (propertyResult.data ?? []) as PropertyRow[]) {
    const group = propertiesByHomeowner.get(property.homeowner_id) ?? [];
    group.push(property);
    propertiesByHomeowner.set(property.homeowner_id, group);
  }

  return homeowners.map((homeowner) => ({
    homeownerId: homeowner.id,
    fullName: homeowner.full_name,
    email: homeowner.email,
    phone: homeowner.phone,
    properties: (propertiesByHomeowner.get(homeowner.id) ?? []).map(
      (property) => ({
        propertyId: property.id,
        label: formatPropertyLabel(property),
      }),
    ),
  }));
}

export async function searchHomeAtlasCustomers(options: {
  search?: string;
  limit?: number;
} = {}): Promise<HomeAtlasCustomerSearchResult> {
  const search = options.search?.trim().slice(0, 120) ?? "";
  const limit = toBoundedInteger(
    options.limit,
    DEFAULT_HOMEATLAS_SEARCH_LIMIT,
    1,
    MAX_HOMEATLAS_SEARCH_LIMIT,
  );
  const supabase = createServiceRoleSupabaseClient();

  if (!search) {
    const result = await supabase
      .from("homeowners")
      .select("id, full_name, email, phone")
      .order("full_name", { ascending: true })
      .limit(limit + 1);
    if (result.error) throw result.error;
    const rows = (result.data ?? []) as HomeownerRow[];
    return {
      customers: await addPropertiesToHomeowners(rows.slice(0, limit)),
      search,
      limitReached: rows.length > limit,
    };
  }

  const pattern = `%${escapeLikePattern(search)}%`;
  const homeownerColumns = ["full_name", "email", "phone"] as const;
  const propertyColumns = ["name", "address", "city", "state", "zip"] as const;
  const [homeownerResults, propertyResults] = await Promise.all([
    Promise.all(
      homeownerColumns.map((column) =>
        supabase
          .from("homeowners")
          .select("id, full_name, email, phone")
          .ilike(column, pattern)
          .limit(limit + 1),
      ),
    ),
    Promise.all(
      propertyColumns.map((column) =>
        supabase
          .from("properties")
          .select("homeowner_id")
          .ilike(column, pattern)
          .limit(limit + 1),
      ),
    ),
  ]);
  for (const result of [...homeownerResults, ...propertyResults]) {
    if (result.error) throw result.error;
  }

  const homeownerById = new Map<string, HomeownerRow>();
  for (const result of homeownerResults) {
    for (const row of (result.data ?? []) as HomeownerRow[]) {
      homeownerById.set(row.id, row);
    }
  }
  const propertyHomeownerIds = new Set<string>();
  for (const result of propertyResults) {
    for (const row of (result.data ?? []) as Array<{ homeowner_id: string }>) {
      propertyHomeownerIds.add(row.homeowner_id);
    }
  }
  const missingHomeownerIds = [...propertyHomeownerIds].filter(
    (id) => !homeownerById.has(id),
  );
  if (missingHomeownerIds.length) {
    const result = await supabase
      .from("homeowners")
      .select("id, full_name, email, phone")
      .in("id", missingHomeownerIds.slice(0, limit + 1));
    if (result.error) throw result.error;
    for (const row of (result.data ?? []) as HomeownerRow[]) {
      homeownerById.set(row.id, row);
    }
  }

  const rows = [...homeownerById.values()].sort((a, b) =>
    a.full_name.localeCompare(b.full_name),
  );
  const anySourceWasTruncated = [
    ...homeownerResults,
    ...propertyResults,
  ].some((result) => (result.data?.length ?? 0) > limit);
  return {
    customers: await addPropertiesToHomeowners(rows.slice(0, limit)),
    search,
    limitReached: rows.length > limit || anySourceWasTruncated,
  };
}

export async function loadJobberCustomerMatchingWorkspace(options: {
  search?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<JobberCustomerMatchingWorkspace> {
  const search = options.search?.trim().slice(0, 120) ?? "";
  const page = toBoundedInteger(options.page, 1, 1, 100_000);
  const pageSize = toBoundedInteger(options.pageSize, 20, 1, 50);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const supabase = createServiceRoleSupabaseClient();
  let query = supabase
    .from("jobber_client_projections")
    .select(CLIENT_PREVIEW_SELECT, { count: "exact" })
    .eq("connection_id", JOBBER_CONNECTION_ID);
  if (search) {
    query = query.ilike("search_text", `%${escapeLikePattern(search)}%`);
  }
  const clientResult = await query
    .order("name", { ascending: true })
    .range(from, to);
  if (clientResult.error) throw clientResult.error;
  const clientRows = (clientResult.data ?? []) as StoredClientProjectionRow[];
  const externalClientIds = clientRows.map((row) => row.external_client_id);
  const linksResult = externalClientIds.length
    ? await supabase
        .from("jobber_customer_links")
        .select("id, external_client_id, homeowner_id, link_state, updated_at")
        .eq("connection_id", JOBBER_CONNECTION_ID)
        .in("external_client_id", externalClientIds)
    : { data: [], error: null };
  if (linksResult.error) throw linksResult.error;
  const links = (linksResult.data ?? []) as CustomerLinkRow[];
  const linkedHomeownerIds = [
    ...new Set(links.map((link) => link.homeowner_id)),
  ];
  const linkedHomeownersResult = linkedHomeownerIds.length
    ? await supabase
        .from("homeowners")
        .select("id, full_name, email, phone")
        .in("id", linkedHomeownerIds)
    : { data: [], error: null };
  if (linkedHomeownersResult.error) throw linkedHomeownersResult.error;
  const homeownerById = new Map(
    ((linkedHomeownersResult.data ?? []) as HomeownerRow[]).map((homeowner) => [
      homeowner.id,
      homeowner,
    ]),
  );
  const linkByClientId = new Map(
    links.map((link) => [link.external_client_id, link]),
  );
  const total = clientResult.count ?? 0;

  return {
    executionMode: "supervised_customer_pairing",
    automaticMatching: false,
    billingEnabled: false,
    clients: clientRows.map((row) => {
      const link = linkByClientId.get(row.external_client_id) ?? null;
      const homeowner = link ? homeownerById.get(link.homeowner_id) : null;
      return {
        projectionId: row.id,
        externalClientId: row.external_client_id,
        name: row.name,
        companyName: row.company_name,
        email: row.email,
        phone: row.phone,
        jobberWebUri: row.jobber_web_uri,
        isArchived: row.is_archived,
        properties: row.properties ?? [],
        propertyCount: row.property_count,
        propertiesComplete: row.properties_complete,
        customerLink:
          link && homeowner
            ? {
                linkId: link.id,
                homeownerId: homeowner.id,
                homeownerName: homeowner.full_name,
                linkState: link.link_state,
                updatedAt: link.updated_at,
              }
            : null,
      };
    }),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    search,
  };
}

async function assertClientExists(externalClientId: string): Promise<void> {
  if (!externalClientId.trim()) {
    throw new JobberCustomerMatchError("Select a Jobber customer.", 400);
  }
  const supabase = createServiceRoleSupabaseClient();
  const result = await supabase
    .from("jobber_client_projections")
    .select("id")
    .eq("connection_id", JOBBER_CONNECTION_ID)
    .eq("external_client_id", externalClientId)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) {
    throw new JobberCustomerMatchError(
      "The Jobber customer is not in the latest synchronization.",
      404,
    );
  }
}

async function assertHomeownerExists(homeownerId: string): Promise<void> {
  if (!isUuid(homeownerId)) {
    throw new JobberCustomerMatchError("Select a HomeAtlas customer.", 400);
  }
  const supabase = createServiceRoleSupabaseClient();
  const result = await supabase
    .from("homeowners")
    .select("id")
    .eq("id", homeownerId)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) {
    throw new JobberCustomerMatchError("HomeAtlas customer not found.", 404);
  }
}

export async function linkJobberCustomer(input: {
  externalClientId: string;
  homeownerId: string;
  sameCustomerConfirmed: boolean;
  expectedLinkUpdatedAt?: string | null;
}): Promise<JobberCustomerLinkResult> {
  if (input.sameCustomerConfirmed !== true) {
    throw new JobberCustomerMatchError(
      "Confirm that Jobber and HomeAtlas identify the same customer.",
      400,
    );
  }
  await Promise.all([
    assertClientExists(input.externalClientId),
    assertHomeownerExists(input.homeownerId),
  ]);
  const supabase = createServiceRoleSupabaseClient();
  const existingResult = await supabase
    .from("jobber_customer_links")
    .select("id, external_client_id, homeowner_id, link_state, updated_at")
    .eq("connection_id", JOBBER_CONNECTION_ID)
    .eq("external_client_id", input.externalClientId)
    .maybeSingle();
  if (existingResult.error) throw existingResult.error;
  const existing = (existingResult.data as CustomerLinkRow | null) ?? null;

  if (existing?.link_state === "active") {
    if (existing.homeowner_id === input.homeownerId) {
      return finishCustomerLink({
        outcome: "already_linked",
        externalClientId: input.externalClientId,
        homeownerId: input.homeownerId,
      });
    }
    throw new JobberCustomerMatchError(
      "This Jobber customer is already paired. Revoke that pairing before choosing another HomeAtlas customer.",
      409,
    );
  }

  const conflict = await supabase
    .from("jobber_customer_links")
    .select("id")
    .eq("connection_id", JOBBER_CONNECTION_ID)
    .eq("homeowner_id", input.homeownerId)
    .eq("link_state", "active")
    .maybeSingle();
  if (conflict.error) throw conflict.error;
  if (conflict.data) {
    throw new JobberCustomerMatchError(
      "That HomeAtlas customer is already paired to a different Jobber customer.",
      409,
    );
  }

  const now = new Date().toISOString();
  if (!existing) {
    const { error } = await supabase.from("jobber_customer_links").insert({
      connection_id: JOBBER_CONNECTION_ID,
      external_client_id: input.externalClientId,
      homeowner_id: input.homeownerId,
      link_state: "active",
      linked_by: LINK_ACTOR,
      link_reason: LINK_REASON,
      linked_at: now,
    });
    if (error) throw error;
    return finishCustomerLink({
      outcome: "linked",
      externalClientId: input.externalClientId,
      homeownerId: input.homeownerId,
    });
  }

  if (
    !input.expectedLinkUpdatedAt ||
    input.expectedLinkUpdatedAt !== existing.updated_at
  ) {
    throw new JobberCustomerMatchError(
      "The customer pairing changed while you were reviewing it. Refresh and try again.",
      409,
    );
  }
  const update = await supabase
    .from("jobber_customer_links")
    .update({
      homeowner_id: input.homeownerId,
      link_state: "active",
      linked_by: LINK_ACTOR,
      link_reason: LINK_REASON,
      linked_at: now,
      revoked_by: null,
      revoke_reason: null,
      revoked_at: null,
    })
    .eq("id", existing.id)
    .eq("updated_at", input.expectedLinkUpdatedAt)
    .select("id")
    .maybeSingle();
  if (update.error) throw update.error;
  if (!update.data) {
    throw new JobberCustomerMatchError(
      "The customer pairing changed while you were reviewing it. Refresh and try again.",
      409,
    );
  }
  return finishCustomerLink({
    outcome: "linked",
    externalClientId: input.externalClientId,
    homeownerId: input.homeownerId,
  });
}

export async function revokeJobberCustomerLink(input: {
  externalClientId: string;
  expectedLinkUpdatedAt: string;
}): Promise<"revoked" | "already_unpaired"> {
  await assertClientExists(input.externalClientId);
  const supabase = createServiceRoleSupabaseClient();
  const existingResult = await supabase
    .from("jobber_customer_links")
    .select("id, external_client_id, homeowner_id, link_state, updated_at")
    .eq("connection_id", JOBBER_CONNECTION_ID)
    .eq("external_client_id", input.externalClientId)
    .maybeSingle();
  if (existingResult.error) throw existingResult.error;
  const existing = (existingResult.data as CustomerLinkRow | null) ?? null;
  if (!existing || existing.link_state === "revoked") return "already_unpaired";
  if (
    !input.expectedLinkUpdatedAt ||
    input.expectedLinkUpdatedAt !== existing.updated_at
  ) {
    throw new JobberCustomerMatchError(
      "The customer pairing changed while you were reviewing it. Refresh and try again.",
      409,
    );
  }
  const update = await supabase
    .from("jobber_customer_links")
    .update({
      link_state: "revoked",
      revoked_by: LINK_ACTOR,
      revoke_reason: REVOKE_REASON,
      revoked_at: new Date().toISOString(),
    })
    .eq("id", existing.id)
    .eq("updated_at", input.expectedLinkUpdatedAt)
    .select("id")
    .maybeSingle();
  if (update.error) throw update.error;
  if (!update.data) {
    throw new JobberCustomerMatchError(
      "The customer pairing changed while you were reviewing it. Refresh and try again.",
      409,
    );
  }
  return "revoked";
}
