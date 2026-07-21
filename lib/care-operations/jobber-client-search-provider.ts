import "server-only";

import {
  getJobberGraphqlVersion,
  JOBBER_GRAPHQL_URL,
} from "./jobber-oauth-config";

export const JOBBER_CLIENT_PAGE_SIZE = 100;
export const JOBBER_CLIENT_PROPERTY_PAGE_SIZE = 50;
export const JOBBER_CLIENT_PROPERTY_MAX_PAGES = 10;
export const JOBBER_MEMBER_SEARCH_TIMEOUT_MS = 15_000;
const JOBBER_CURSOR_MAX_LENGTH = 2_048;

export const JOBBER_CLIENT_SEARCH_QUERY = `
  query HomeAtlasClientSearch($after: String) {
    clients(first: 100, after: $after) {
      nodes {
        id
        name
        jobberWebUri
      }
      pageInfo { endCursor hasNextPage }
    }
  }
`;

export const JOBBER_CLIENT_PROPERTIES_QUERY = `
  query HomeAtlasClientProperties($clientId: EncodedId!, $after: String) {
    client(id: $clientId) {
      clientProperties(first: 50, after: $after) {
        nodes {
          id
          jobberWebUri
        }
        pageInfo { endCursor hasNextPage }
      }
    }
  }
`;

export type JobberClientProviderFailureCode =
  | "client_not_found"
  | "cursor_loop"
  | "graphql_partial_errors"
  | "http_429"
  | "http_error"
  | "invalid_cursor"
  | "invalid_client_id"
  | "invalid_query"
  | "malformed_response"
  | "property_coverage_incomplete"
  | "property_not_owned"
  | "timeout"
  | "version_mismatch"
  | "version_unverified"
  | "version_warning";

export class JobberClientProviderError extends Error {
  constructor(
    public readonly code: JobberClientProviderFailureCode,
    message: string,
  ) {
    super(message);
    this.name = "JobberClientProviderError";
  }
}

export interface JobberClientSearchResultItem {
  id: string;
  name: string;
  jobberWebUri: string;
}

export interface JobberClientProperty {
  id: string;
  jobberWebUri: string;
}

export interface JobberClientSearchResult {
  clients: JobberClientSearchResultItem[];
  endCursor: string | null;
  hasNextPage: boolean;
  clientsScanned: number;
  pagesScanned: number;
}

export interface JobberClientPropertiesPageResult {
  properties: JobberClientProperty[];
  endCursor: string | null;
  hasNextPage: boolean;
  propertyCoverageComplete: boolean;
  ownershipProofPageLimit: number;
  pagesScanned: 1;
  observedGraphqlVersion: string;
  observedAt: string;
}

export interface JobberClientPropertiesResult {
  properties: JobberClientProperty[];
  propertyCoverageLimitReached: boolean;
  propertyCoverageComplete: boolean;
  pagesScanned: number;
  observedGraphqlVersion: string | null;
  observedAt: string;
}

export interface JobberPropertyOwnershipEvidence {
  clientId: string;
  externalPropertyId: string;
  jobberPropertyWebUri: string;
  observedGraphqlVersion: string;
  observedAt: string;
  pagesScanned: number;
  propertyCoverageComplete: true;
}

interface PageInfo {
  endCursor: string | null;
  hasNextPage: boolean;
}

interface ProviderOptions {
  fetcher?: typeof fetch;
  timeoutMs?: number;
  expectedVersion?: string;
  now?: () => string;
}

interface PageProviderOptions extends ProviderOptions {
  after?: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidJobberApiVersionDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  let maximumDay = 31;
  if (month === 2) maximumDay = leapYear ? 29 : 28;
  else if ([4, 6, 9, 11].includes(month)) maximumDay = 30;
  return day <= maximumDay;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new JobberClientProviderError(
      "malformed_response",
      `Jobber ${field} was malformed`,
    );
  }
  return value;
}

function requiredHttpsUri(value: unknown, field: string): string {
  const uri = requiredString(value, field);
  try {
    if (new URL(uri).protocol !== "https:") throw new Error("not HTTPS");
  } catch {
    throw new JobberClientProviderError(
      "malformed_response",
      `Jobber ${field} was malformed`,
    );
  }
  return uri;
}

function parsePageInfo(value: unknown): PageInfo {
  if (!isRecord(value) || typeof value.hasNextPage !== "boolean") {
    throw new JobberClientProviderError(
      "malformed_response",
      "Jobber pagination data was malformed",
    );
  }
  if (
    value.endCursor !== null &&
    value.endCursor !== undefined &&
    (typeof value.endCursor !== "string" || value.endCursor.trim() === "")
  ) {
    throw new JobberClientProviderError(
      "malformed_response",
      "Jobber pagination cursor was malformed",
    );
  }
  if (value.hasNextPage && typeof value.endCursor !== "string") {
    throw new JobberClientProviderError(
      "malformed_response",
      "Jobber omitted the next pagination cursor",
    );
  }
  return {
    endCursor:
      typeof value.endCursor === "string" ? value.endCursor : null,
    hasNextPage: value.hasNextPage,
  };
}

function firstHeader(headers: Headers, names: readonly string[]): string | null {
  for (const name of names) {
    const value = headers.get(name);
    if (value?.trim()) return value.trim();
  }
  return null;
}

function assertPinnedVersion(
  headers: Headers,
  body: unknown,
  expectedVersion: string,
): string {
  const warning = firstHeader(headers, [
    "x-jobber-graphql-version-warning",
    "x-jobber-api-version-warning",
    "x-jobber-graphql-version-deprecation",
    "x-jobber-api-version-deprecation",
  ]);
  const standardWarning = headers.get("warning");
  if (
    warning ||
    (standardWarning && /version|graphql|deprecat/i.test(standardWarning))
  ) {
    throw new JobberClientProviderError(
      "version_warning",
      "Jobber returned an API version warning",
    );
  }
  if (!isRecord(body)) {
    throw new JobberClientProviderError(
      "malformed_response",
      "Jobber member search response was malformed",
    );
  }
  if (body.extensions === undefined || body.extensions === null) {
    throw new JobberClientProviderError(
      "version_unverified",
      "Jobber response omitted API version evidence",
    );
  }
  if (!isRecord(body.extensions)) {
    throw new JobberClientProviderError(
      "malformed_response",
      "Jobber versioning metadata was malformed",
    );
  }
  const extensions = body.extensions;
  const versioningValue = extensions.versioning;
  if (versioningValue === undefined || versioningValue === null) {
    throw new JobberClientProviderError(
      "version_unverified",
      "Jobber response omitted API version evidence",
    );
  }
  if (!isRecord(versioningValue)) {
    throw new JobberClientProviderError(
      "malformed_response",
      "Jobber versioning metadata was malformed",
    );
  }
  const nestedWarning = versioningValue.warning;
  const nestedVersion = versioningValue.version;
  if (nestedVersion === undefined || nestedVersion === null) {
    throw new JobberClientProviderError(
      "version_unverified",
      "Jobber response omitted API version evidence",
    );
  }
  if (
    typeof nestedVersion !== "string" ||
    !isValidJobberApiVersionDate(nestedVersion)
  ) {
    throw new JobberClientProviderError(
      "malformed_response",
      "Jobber versioning version was malformed",
    );
  }
  if (
    nestedWarning !== undefined &&
    nestedWarning !== null &&
    (typeof nestedWarning !== "string" || nestedWarning.trim() === "")
  ) {
    throw new JobberClientProviderError(
      "malformed_response",
      "Jobber versioning warning was malformed",
    );
  }
  const extensionWarning = Object.entries(extensions).some(
    ([key, value]) =>
      /version.*warning|warning.*version/i.test(key) &&
      value !== null &&
      value !== false &&
      value !== "",
  );
  if (typeof nestedWarning === "string" || extensionWarning) {
    throw new JobberClientProviderError(
      "version_warning",
      "Jobber returned an API version warning",
    );
  }

  const headerVersion = firstHeader(headers, [
    "x-jobber-graphql-version",
    "x-jobber-api-version",
  ]);
  const observedNestedVersion = nestedVersion;
  if (
    (headerVersion && headerVersion !== expectedVersion) ||
    observedNestedVersion !== expectedVersion ||
    (headerVersion && headerVersion !== observedNestedVersion)
  ) {
    throw new JobberClientProviderError(
      "version_mismatch",
      "Jobber responded with a different API version",
    );
  }
  return observedNestedVersion;
}

async function requestJobberGraphql(
  accessToken: string,
  query: string,
  variables: Record<string, unknown>,
  options: ProviderOptions,
): Promise<{ data: Record<string, unknown>; observedVersion: string }> {
  const expectedVersion =
    options.expectedVersion ?? getJobberGraphqlVersion();
  if (!expectedVersion.trim()) {
    throw new Error("Jobber GraphQL version must remain configured");
  }
  if (/\bmutation\b/i.test(query)) {
    throw new Error("Jobber member-search operations must remain read-only");
  }

  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(JOBBER_GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-JOBBER-GRAPHQL-VERSION":
          expectedVersion,
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
      signal: AbortSignal.timeout(
        options.timeoutMs ?? JOBBER_MEMBER_SEARCH_TIMEOUT_MS,
      ),
    });
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      throw new JobberClientProviderError(
        "timeout",
        "Jobber member search timed out",
      );
    }
    throw new JobberClientProviderError(
      "http_error",
      "Jobber member search failed before receiving a response",
    );
  }

  if (response.status === 429) {
    throw new JobberClientProviderError(
      "http_429",
      "Jobber rate-limited the member search",
    );
  }
  if (!response.ok) {
    throw new JobberClientProviderError(
      "http_error",
      "Jobber member search returned an HTTP error",
    );
  }

  let body: unknown;
  try {
    body = (await response.json()) as unknown;
  } catch {
    throw new JobberClientProviderError(
      "malformed_response",
      "Jobber member search did not return valid JSON",
    );
  }
  const observedVersion = assertPinnedVersion(
    response.headers,
    body,
    expectedVersion,
  );
  if (!isRecord(body)) {
    throw new JobberClientProviderError(
      "malformed_response",
      "Jobber member search response was malformed",
    );
  }
  if (Object.prototype.hasOwnProperty.call(body, "errors")) {
    if (!Array.isArray(body.errors)) {
      throw new JobberClientProviderError(
        "malformed_response",
        "Jobber member search errors field was malformed",
      );
    }
    if (body.errors.length > 0) {
      throw new JobberClientProviderError(
        "graphql_partial_errors",
        "Jobber member search returned GraphQL errors",
      );
    }
  }
  if (!isRecord(body.data)) {
    throw new JobberClientProviderError(
      "malformed_response",
      "Jobber member search response omitted data",
    );
  }
  return { data: body.data, observedVersion };
}

export function normalizeJobberClientSearchText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("en-US");
}

function validatedSearchQuery(query: string): string {
  const trimmed = query.trim();
  if (trimmed.length < 2 || trimmed.length > 100) {
    throw new JobberClientProviderError(
      "invalid_query",
      "Search must contain 2 to 100 characters",
    );
  }
  return normalizeJobberClientSearchText(trimmed);
}

function validatedClientId(clientId: string): string {
  const trimmed = clientId.trim();
  if (trimmed.length < 1 || trimmed.length > 512) {
    throw new JobberClientProviderError(
      "invalid_client_id",
      "Select a valid Jobber client",
    );
  }
  return trimmed;
}

function validatedAfterCursor(after: unknown): string | null {
  if (after === undefined || after === null) return null;
  if (
    typeof after !== "string" ||
    after.length === 0 ||
    after.length > JOBBER_CURSOR_MAX_LENGTH
  ) {
    throw new JobberClientProviderError(
      "invalid_cursor",
      "Select a valid Jobber pagination cursor",
    );
  }
  return after;
}

export async function searchJobberClients(
  accessToken: string,
  query: string,
  options: PageProviderOptions = {},
): Promise<JobberClientSearchResult> {
  const normalizedQuery = validatedSearchQuery(query);
  const after = validatedAfterCursor(options.after);
  const matches: JobberClientSearchResultItem[] = [];
  const seenClientIds = new Set<string>();
  const { data } = await requestJobberGraphql(
    accessToken,
    JOBBER_CLIENT_SEARCH_QUERY,
    { after },
    options,
  );
  const connection = isRecord(data.clients) ? data.clients : null;
  if (!connection || !Array.isArray(connection.nodes)) {
    throw new JobberClientProviderError(
      "malformed_response",
      "Jobber client search omitted the client connection",
    );
  }
  if (connection.nodes.length > JOBBER_CLIENT_PAGE_SIZE) {
    throw new JobberClientProviderError(
      "malformed_response",
      "Jobber client search exceeded its requested page size",
    );
  }
  const pageInfo = parsePageInfo(connection.pageInfo);
  if (pageInfo.hasNextPage && pageInfo.endCursor === after) {
    throw new JobberClientProviderError(
      "cursor_loop",
      "Jobber client pagination repeated a cursor",
    );
  }

  for (const value of connection.nodes) {
    if (!isRecord(value)) {
      throw new JobberClientProviderError(
        "malformed_response",
        "Jobber client data was malformed",
      );
    }
    const client = {
      id: requiredString(value.id, "client id"),
      name: requiredString(value.name, "client name"),
      jobberWebUri: requiredHttpsUri(value.jobberWebUri, "client web URI"),
    };
    if (seenClientIds.has(client.id)) continue;
    seenClientIds.add(client.id);
    if (normalizeJobberClientSearchText(client.name).includes(normalizedQuery)) {
      matches.push(client);
    }
  }

  return {
    clients: matches,
    endCursor: pageInfo.endCursor,
    hasNextPage: pageInfo.hasNextPage,
    clientsScanned: seenClientIds.size,
    pagesScanned: 1,
  };
}

export async function listJobberClientPropertiesPage(
  accessToken: string,
  clientId: string,
  options: PageProviderOptions = {},
): Promise<JobberClientPropertiesPageResult> {
  const validatedId = validatedClientId(clientId);
  const after = validatedAfterCursor(options.after);
  const response = await requestJobberGraphql(
    accessToken,
    JOBBER_CLIENT_PROPERTIES_QUERY,
    { clientId: validatedId, after },
    options,
  );
  const { data } = response;
  if (data.client === null) {
    throw new JobberClientProviderError(
      "client_not_found",
      "Jobber client was not found",
    );
  }
  const client = isRecord(data.client) ? data.client : null;
  const connection = client && isRecord(client.clientProperties)
    ? client.clientProperties
    : null;
  if (!connection || !Array.isArray(connection.nodes)) {
    throw new JobberClientProviderError(
      "malformed_response",
      "Jobber client properties response was malformed",
    );
  }
  if (connection.nodes.length > JOBBER_CLIENT_PROPERTY_PAGE_SIZE) {
    throw new JobberClientProviderError(
      "malformed_response",
      "Jobber client properties exceeded the requested page size",
    );
  }
  const pageInfo = parsePageInfo(connection.pageInfo);
  if (pageInfo.hasNextPage && pageInfo.endCursor === after) {
    throw new JobberClientProviderError(
      "cursor_loop",
      "Jobber client-property pagination repeated a cursor",
    );
  }
  const properties: JobberClientProperty[] = [];
  const seenPropertyIds = new Set<string>();
  for (const value of connection.nodes) {
    if (!isRecord(value)) {
      throw new JobberClientProviderError(
        "malformed_response",
        "Jobber property data was malformed",
      );
    }
    const property = {
      id: requiredString(value.id, "property id"),
      jobberWebUri: requiredHttpsUri(value.jobberWebUri, "property web URI"),
    };
    if (seenPropertyIds.has(property.id)) continue;
    seenPropertyIds.add(property.id);
    properties.push(property);
  }

  return {
    properties,
    endCursor: pageInfo.endCursor,
    hasNextPage: pageInfo.hasNextPage,
    propertyCoverageComplete: !pageInfo.hasNextPage,
    ownershipProofPageLimit: JOBBER_CLIENT_PROPERTY_MAX_PAGES,
    pagesScanned: 1,
    observedGraphqlVersion: response.observedVersion,
    observedAt: (options.now ?? (() => new Date().toISOString()))(),
  };
}

export async function listJobberClientProperties(
  accessToken: string,
  clientId: string,
  options: ProviderOptions = {},
): Promise<JobberClientPropertiesResult> {
  const validatedId = validatedClientId(clientId);
  const properties: JobberClientProperty[] = [];
  const seenPropertyIds = new Set<string>();
  const seenCursors = new Set<string>();
  let cursor: string | null = null;
  let pagesScanned = 0;
  let propertyCoverageLimitReached = false;
  let observedGraphqlVersion: string | null = null;

  for (let page = 0; page < JOBBER_CLIENT_PROPERTY_MAX_PAGES; page += 1) {
    if (cursor !== null) seenCursors.add(cursor);
    const response = await listJobberClientPropertiesPage(
      accessToken,
      validatedId,
      { ...options, after: cursor },
    );
    if (
      observedGraphqlVersion &&
      observedGraphqlVersion !== response.observedGraphqlVersion
    ) {
      throw new JobberClientProviderError(
        "version_mismatch",
        "Jobber API version changed during property pagination",
      );
    }
    observedGraphqlVersion ??= response.observedGraphqlVersion;
    pagesScanned += 1;

    for (const property of response.properties) {
      if (seenPropertyIds.has(property.id)) continue;
      seenPropertyIds.add(property.id);
      properties.push(property);
    }

    if (!response.hasNextPage) break;
    if (!response.endCursor || seenCursors.has(response.endCursor)) {
      throw new JobberClientProviderError(
        "cursor_loop",
        "Jobber client-property pagination repeated a cursor",
      );
    }
    if (page === JOBBER_CLIENT_PROPERTY_MAX_PAGES - 1) {
      propertyCoverageLimitReached = true;
      break;
    }
    cursor = response.endCursor;
  }

  return {
    properties,
    propertyCoverageLimitReached,
    propertyCoverageComplete: !propertyCoverageLimitReached,
    pagesScanned,
    observedGraphqlVersion,
    observedAt: (options.now ?? (() => new Date().toISOString()))(),
  };
}

export async function proveJobberClientPropertyOwnership(
  accessToken: string,
  clientId: string,
  externalPropertyId: string,
  options: ProviderOptions = {},
): Promise<JobberPropertyOwnershipEvidence> {
  const result = await listJobberClientProperties(
    accessToken,
    clientId,
    options,
  );
  if (!result.propertyCoverageComplete) {
    throw new JobberClientProviderError(
      "property_coverage_incomplete",
      "Jobber client-property coverage was incomplete",
    );
  }
  if (!result.observedGraphqlVersion) {
    throw new JobberClientProviderError(
      "version_unverified",
      "Jobber did not return observable API version evidence",
    );
  }
  const property = result.properties.find(
    (candidate) => candidate.id === externalPropertyId,
  );
  if (!property) {
    throw new JobberClientProviderError(
      "property_not_owned",
      "Jobber property did not belong to the selected client",
    );
  }
  return {
    clientId: clientId.trim(),
    externalPropertyId: property.id,
    jobberPropertyWebUri: property.jobberWebUri,
    observedGraphqlVersion: result.observedGraphqlVersion,
    observedAt: result.observedAt,
    pagesScanned: result.pagesScanned,
    propertyCoverageComplete: true,
  };
}
