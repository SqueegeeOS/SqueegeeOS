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
import {
  loadStrictExactCustomerLinkDecisions,
  type StrictAutoLinkDecision,
} from "./jobber-customer-auto-linking";

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
  source_payload_hash: string;
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
  "id, external_client_id, name, company_name, email, phone, jobber_web_uri, is_archived, properties, property_count, properties_complete, source_payload_hash";

export type JobberCustomerQueue = "review" | "unpaired" | "paired" | "all";

export interface JobberCustomerQueueCounts {
  review: number;
  unpaired: number;
  paired: number;
  all: number;
}

export function jobberCustomerQueueIncludesDecision(
  queue: JobberCustomerQueue,
  item: Pick<StrictAutoLinkDecision, "outcome">,
): boolean {
  if (queue === "review") {
    return item.outcome === "manual_review" || item.outcome === "conflict";
  }
  if (queue === "unpaired") {
    return !["already_linked", "archived"].includes(item.outcome);
  }
  if (queue === "paired") return item.outcome === "already_linked";
  return true;
}

export function summarizeJobberCustomerQueues(
  decisions: Array<Pick<StrictAutoLinkDecision, "outcome">>,
): JobberCustomerQueueCounts {
  return {
    review: decisions.filter((item) =>
      jobberCustomerQueueIncludesDecision("review", item),
    ).length,
    unpaired: decisions.filter((item) =>
      jobberCustomerQueueIncludesDecision("unpaired", item),
    ).length,
    paired: decisions.filter((item) =>
      jobberCustomerQueueIncludesDecision("paired", item),
    ).length,
    all: decisions.length,
  };
}

export interface JobberClientPropertyPreview {
  id: string;
  name: string | null;
  jobberWebUri: string;
  address: Record<string, string | null> | null;
}

export interface HomeAtlasCustomerCandidate {
  homeownerId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  properties: Array<{
    propertyId: string;
    label: string;
    address: string;
    city: string;
    state: string;
    zip: string;
  }>;
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
  sourcePayloadHash: string;
  reviewOutcome: StrictAutoLinkDecision["outcome"];
  reviewReason: string;
  suggestedCustomer: HomeAtlasCustomerCandidate | null;
  customerLink: JobberCustomerLinkPreview | null;
}

export interface JobberCustomerMatchingWorkspace {
  executionMode: "supervised_customer_pairing";
  automaticMatching: "strict_exact_only";
  billingEnabled: false;
  clients: JobberClientPreview[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  search: string;
  queue: JobberCustomerQueue;
  queueCounts: JobberCustomerQueueCounts;
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
  addressReadState: "available" | "unavailable";
  addressFields: string[];
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
    address: property.address ?? null,
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
      ...properties.flatMap((property) =>
        Object.values(property.address ?? {}).filter(
          (value): value is string => typeof value === "string",
        ),
      ),
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
    addressReadState: source.addressReadState,
    addressFields: source.addressFields,
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
        address: property.address,
        city: property.city,
        state: property.state,
        zip: property.zip,
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
  queue?: JobberCustomerQueue;
} = {}): Promise<JobberCustomerMatchingWorkspace> {
  const search = options.search?.trim().slice(0, 120) ?? "";
  const page = toBoundedInteger(options.page, 1, 1, 100_000);
  const pageSize = toBoundedInteger(options.pageSize, 20, 1, 50);
  const queue: JobberCustomerQueue = ["review", "unpaired", "paired", "all"].includes(
    options.queue ?? "",
  )
    ? options.queue!
    : "all";
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const supabase = createServiceRoleSupabaseClient();
  const decisions = await loadStrictExactCustomerLinkDecisions();
  const decisionByClientId = new Map(
    decisions.map((item) => [item.externalClientId, item]),
  );
  const eligibleIds = decisions
    .filter((item) => jobberCustomerQueueIncludesDecision(queue, item))
    .map((item) => item.externalClientId);
  const queueCounts = summarizeJobberCustomerQueues(decisions);
  if (eligibleIds.length === 0) {
    return {
      executionMode: "supervised_customer_pairing",
      automaticMatching: "strict_exact_only",
      billingEnabled: false,
      clients: [],
      total: 0,
      page: 1,
      pageSize,
      totalPages: 0,
      search,
      queue,
      queueCounts,
    };
  }
  let query = supabase
    .from("jobber_client_projections")
    .select(CLIENT_PREVIEW_SELECT, { count: "exact" })
    .eq("connection_id", JOBBER_CONNECTION_ID)
    .in("external_client_id", eligibleIds);
  if (search) {
    query = query.ilike("search_text", `%${escapeLikePattern(search)}%`);
  }
  const clientResult = await query
    .order("name", { ascending: true })
    .range(from, to);
  if (clientResult.error) throw clientResult.error;
  if (
    (clientResult.count ?? 0) > 0 &&
    from >= (clientResult.count ?? 0)
  ) {
    return loadJobberCustomerMatchingWorkspace({
      search,
      page: Math.ceil((clientResult.count ?? 0) / pageSize),
      pageSize,
      queue,
    });
  }
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
  const suggestedHomeownerIds = [
    ...new Set(
      clientRows
        .map((row) => decisionByClientId.get(row.external_client_id)?.homeownerId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const homeownerIds = [
    ...new Set([...linkedHomeownerIds, ...suggestedHomeownerIds]),
  ];
  const linkedHomeownersResult = homeownerIds.length
    ? await supabase
        .from("homeowners")
        .select("id, full_name, email, phone")
        .in("id", homeownerIds)
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
  const suggestedCustomers = await addPropertiesToHomeowners(
    ((linkedHomeownersResult.data ?? []) as HomeownerRow[]).filter((homeowner) =>
      suggestedHomeownerIds.includes(homeowner.id),
    ),
  );
  const suggestedCustomerById = new Map(
    suggestedCustomers.map((customer) => [customer.homeownerId, customer]),
  );

  return {
    executionMode: "supervised_customer_pairing",
    automaticMatching: "strict_exact_only",
    billingEnabled: false,
    clients: clientRows.map((row) => {
      const link = linkByClientId.get(row.external_client_id) ?? null;
      const homeowner = link ? homeownerById.get(link.homeowner_id) : null;
      const review = decisionByClientId.get(row.external_client_id);
      if (!review) {
        throw new Error("Strict Jobber review decision is missing");
      }
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
        sourcePayloadHash: row.source_payload_hash,
        reviewOutcome: review.outcome,
        reviewReason: review.reason,
        suggestedCustomer: review.homeownerId
          ? suggestedCustomerById.get(review.homeownerId) ?? null
          : null,
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
    queue,
    queueCounts,
  };
}

async function readCurrentClient(input: {
  externalClientId: string;
  expectedSourcePayloadHash: string;
}): Promise<{ isArchived: boolean }> {
  const { externalClientId, expectedSourcePayloadHash } = input;
  if (!externalClientId.trim()) {
    throw new JobberCustomerMatchError("Select a Jobber customer.", 400);
  }
  const supabase = createServiceRoleSupabaseClient();
  const result = await supabase
    .from("jobber_client_projections")
    .select("id, source_payload_hash, is_archived")
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
  if (result.data.source_payload_hash !== expectedSourcePayloadHash) {
    throw new JobberCustomerMatchError(
      "Jobber changed while you were reviewing this customer. Refresh the evidence before pairing.",
      409,
    );
  }
  if (result.data.is_archived) {
    throw new JobberCustomerMatchError(
      "Archived Jobber customers cannot be paired.",
      409,
    );
  }
  return { isArchived: result.data.is_archived };
}

async function assertSynchronizedClientExists(
  externalClientId: string,
): Promise<void> {
  if (!externalClientId.trim()) {
    throw new JobberCustomerMatchError("Select a Jobber customer.", 400);
  }
  const result = await createServiceRoleSupabaseClient()
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
  expectedSourcePayloadHash: string;
  expectedLinkUpdatedAt?: string | null;
}): Promise<JobberCustomerLinkResult> {
  if (input.sameCustomerConfirmed !== true) {
    throw new JobberCustomerMatchError(
      "Confirm that Jobber and HomeAtlas identify the same customer.",
      400,
    );
  }
  await Promise.all([
    readCurrentClient({
      externalClientId: input.externalClientId,
      expectedSourcePayloadHash: input.expectedSourcePayloadHash,
    }),
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
  await assertSynchronizedClientExists(input.externalClientId);
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
