import "server-only";

import {
  getJobberClientId,
  getJobberClientSecret,
  getJobberGraphqlVersion,
  JOBBER_GRAPHQL_URL,
  JOBBER_TOKEN_URL,
} from "./jobber-oauth-config";

export interface JobberOAuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
}

export interface JobberAccountIdentity {
  id: string;
  name: string;
}

export interface JobberVisitNode {
  id: string;
  title: string | null;
  visitStatus: string;
  isComplete: boolean;
  startAt: string | null;
  endAt: string | null;
  completedAt: string | null;
  client: { id: string; name: string };
  property: { id: string; jobberWebUri: string };
  job: {
    id: string;
    jobNumber: number;
    title: string | null;
    jobStatus: string;
  };
}

export interface JobberVisitPage {
  nodes: JobberVisitNode[];
  pageInfo: { endCursor: string | null; hasNextPage: boolean };
}

export interface JobberClientPropertyNode {
  id: string;
  name: string | null;
  jobberWebUri: string;
}

export interface JobberClientNode {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  jobberWebUri: string;
  isArchived: boolean;
  clientProperties: {
    nodes: JobberClientPropertyNode[];
    pageInfo: { endCursor: string | null; hasNextPage: boolean };
    totalCount?: number;
  };
}

export interface JobberClientPage {
  nodes: JobberClientNode[];
  pageInfo: { endCursor: string | null; hasNextPage: boolean };
  totalCount?: number;
}

export interface JobberPaginatedResult<T> {
  nodes: T[];
  pageCount: number;
}

export const JOBBER_PAGE_SIZE = 50;
export const JOBBER_CLIENT_PAGE_SIZE = 25;
export const JOBBER_MAX_PAGES = 200;

const JOBBER_GRAPHQL_MAX_ATTEMPTS = 6;
const JOBBER_THROTTLE_MIN_DELAY_MS = 500;
const JOBBER_THROTTLE_MAX_DELAY_MS = 20_000;
const JOBBER_THROTTLE_BUFFER_MS = 250;

interface JobberGraphqlErrorPayload {
  message?: string;
  extensions?: { code?: string };
}

interface JobberGraphqlCostPayload {
  requestedQueryCost?: number;
  actualQueryCost?: number;
  throttleStatus?: {
    maximumAvailable?: number;
    currentlyAvailable?: number;
    restoreRate?: number;
  };
}

interface JobberGraphqlPayload<T> {
  data?: T;
  errors?: JobberGraphqlErrorPayload[];
  extensions?: { cost?: JobberGraphqlCostPayload };
}

export const JOBBER_VISITS_QUERY = `
  query HomeAtlasVisits($first: Int!, $after: String) {
    visits(first: $first, after: $after) {
      nodes {
        id
        title
        visitStatus
        isComplete
        startAt
        endAt
        completedAt
        client { id name }
        property { id jobberWebUri }
        job { id jobNumber title jobStatus }
      }
      pageInfo { endCursor hasNextPage }
    }
  }
`;

export const JOBBER_CLIENTS_QUERY = `
  query HomeAtlasClients($first: Int!, $after: String) {
    clients(first: $first, after: $after) {
      nodes {
        id
        name
        firstName
        lastName
        companyName
        email
        phone
        jobberWebUri
        isArchived
        clientProperties(first: 25) {
          nodes { id name jobberWebUri }
          pageInfo { endCursor hasNextPage }
          totalCount
        }
      }
      pageInfo { endCursor hasNextPage }
      totalCount
    }
  }
`;

export class JobberApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "JobberApiError";
  }
}

function accessTokenExpiry(accessToken: string): string {
  try {
    const payload = accessToken.split(".")[1];
    if (payload) {
      const decoded = JSON.parse(
        Buffer.from(payload, "base64url").toString("utf8"),
      ) as { exp?: number };
      if (Number.isFinite(decoded.exp)) {
        return new Date(decoded.exp! * 1000).toISOString();
      }
    }
  } catch {
    // Jobber documents JWT access tokens, but expiry parsing is advisory only.
  }
  return new Date(Date.now() + 55 * 60 * 1000).toISOString();
}

async function postTokenRequest(body: URLSearchParams): Promise<JobberOAuthTokens> {
  const response = await fetch(JOBBER_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const providerError = await response
      .json()
      .then((payload: unknown) => {
        if (!payload || typeof payload !== "object" || !("error" in payload)) {
          return null;
        }
        const code = (payload as { error?: unknown }).error;
        return typeof code === "string" && /^[a-z0-9_.-]{1,64}$/i.test(code)
          ? code
          : null;
      })
      .catch(() => null);
    throw new JobberApiError(
      `Jobber token request failed (${response.status}${providerError ? `: ${providerError}` : ""})`,
      response.status,
    );
  }
  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
  };
  if (!payload.access_token || !payload.refresh_token) {
    throw new Error("Jobber token response was incomplete");
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    accessTokenExpiresAt: accessTokenExpiry(payload.access_token),
  };
}

export function exchangeJobberAuthorizationCode(
  code: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<JobberOAuthTokens> {
  return postTokenRequest(
    new URLSearchParams({
      client_id: getJobberClientId(),
      client_secret: getJobberClientSecret(),
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  );
}

export function refreshJobberTokens(
  refreshToken: string,
): Promise<JobberOAuthTokens> {
  return postTokenRequest(
    new URLSearchParams({
      client_id: getJobberClientId(),
      client_secret: getJobberClientSecret(),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  );
}

export async function fetchJobberAccountIdentity(
  accessToken: string,
): Promise<JobberAccountIdentity> {
  const response = await fetch(JOBBER_GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-JOBBER-GRAPHQL-VERSION": getJobberGraphqlVersion(),
    },
    body: JSON.stringify({
      query: "query HomeAtlasAccountIdentity { account { id name } }",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new JobberApiError(
      `Jobber account verification failed (${response.status})`,
      response.status,
    );
  }
  const payload = (await response.json()) as {
    data?: { account?: { id?: string; name?: string } };
    errors?: Array<{ message?: string }>;
  };
  const account = payload.data?.account;
  if (!account?.id || !account.name || payload.errors?.length) {
    throw new Error("Jobber account verification returned incomplete data");
  }
  return { id: account.id, name: account.name };
}

async function fetchJobberGraphql<T>(
  accessToken: string,
  query: string,
  variables: Record<string, unknown>,
  operationLabel: string,
): Promise<T> {
  if (/\bmutation\b/i.test(query)) {
    throw new Error(`Jobber ${operationLabel} query must remain read-only`);
  }

  for (let attempt = 0; attempt < JOBBER_GRAPHQL_MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(JOBBER_GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-JOBBER-GRAPHQL-VERSION": getJobberGraphqlVersion(),
      },
      body: JSON.stringify({
        query,
        variables,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    let payload: JobberGraphqlPayload<T> | null = null;
    try {
      payload = (await response.json()) as JobberGraphqlPayload<T>;
    } catch {
      // Preserve the HTTP status below when Jobber returns a non-JSON failure.
    }

    const throttled =
      response.status === 429 ||
      payload?.errors?.some(
        (error) =>
          error.extensions?.code === "THROTTLED" ||
          error.message?.trim().toLowerCase() === "throttled",
      ) === true;
    if (throttled) {
      if (attempt === JOBBER_GRAPHQL_MAX_ATTEMPTS - 1) {
        throw new JobberApiError(
          `Jobber ${operationLabel} query remained throttled after ${JOBBER_GRAPHQL_MAX_ATTEMPTS} attempts`,
          429,
        );
      }
      await waitForJobberCapacity(
        calculateJobberThrottleDelayMs(
          payload?.extensions?.cost,
          response.headers.get("Retry-After"),
          attempt,
        ),
      );
      continue;
    }
    if (!response.ok) {
      throw new JobberApiError(
        `Jobber ${operationLabel} query failed (${response.status})`,
        response.status,
      );
    }
    if (payload?.errors?.length || !payload?.data) {
      throw new Error(
        payload?.errors?.[0]?.message
          ? `Jobber ${operationLabel} query rejected: ${payload.errors[0].message}`
          : `Jobber ${operationLabel} query returned no data`,
      );
    }
    return payload.data;
  }

  throw new Error(`Jobber ${operationLabel} query retry guard failed`);
}

function clampJobberThrottleDelay(delayMs: number): number {
  return Math.min(
    JOBBER_THROTTLE_MAX_DELAY_MS,
    Math.max(JOBBER_THROTTLE_MIN_DELAY_MS, Math.ceil(delayMs)),
  );
}

function retryAfterDelayMs(retryAfter: string | null): number | null {
  if (!retryAfter) return null;
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const retryAt = Date.parse(retryAfter);
  return Number.isFinite(retryAt) ? Math.max(0, retryAt - Date.now()) : null;
}

function calculateJobberThrottleDelayMs(
  cost: JobberGraphqlCostPayload | undefined,
  retryAfter: string | null,
  attempt: number,
): number {
  const headerDelay = retryAfterDelayMs(retryAfter);
  if (headerDelay !== null) {
    return clampJobberThrottleDelay(headerDelay + JOBBER_THROTTLE_BUFFER_MS);
  }

  const requested = cost?.requestedQueryCost;
  const available = cost?.throttleStatus?.currentlyAvailable;
  const restoreRate = cost?.throttleStatus?.restoreRate;
  if (
    typeof requested === "number" &&
    Number.isFinite(requested) &&
    typeof available === "number" &&
    Number.isFinite(available) &&
    typeof restoreRate === "number" &&
    Number.isFinite(restoreRate) &&
    restoreRate > 0
  ) {
    const deficit = Math.max(0, requested - available);
    return clampJobberThrottleDelay(
      (deficit / restoreRate) * 1000 + JOBBER_THROTTLE_BUFFER_MS,
    );
  }

  return clampJobberThrottleDelay(1000 * 2 ** attempt);
}

function waitForJobberCapacity(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function validatePageSize(first: number): void {
  if (!Number.isInteger(first) || first < 1 || first > 100) {
    throw new Error("Jobber page size must be between 1 and 100");
  }
}

export async function fetchJobberVisitPage(
  accessToken: string,
  options: { first?: number; after?: string | null } = {},
): Promise<JobberVisitPage> {
  const first = options.first ?? JOBBER_PAGE_SIZE;
  validatePageSize(first);
  const data = await fetchJobberGraphql<{ visits?: JobberVisitPage }>(
    accessToken,
    JOBBER_VISITS_QUERY,
    { first, after: options.after ?? null },
    "visit",
  );
  if (!data.visits) {
    throw new Error("Jobber visit query returned no visit connection");
  }
  return data.visits;
}

export async function fetchJobberClientPage(
  accessToken: string,
  options: { first?: number; after?: string | null } = {},
): Promise<JobberClientPage> {
  const first = options.first ?? JOBBER_CLIENT_PAGE_SIZE;
  validatePageSize(first);
  const data = await fetchJobberGraphql<{ clients?: JobberClientPage }>(
    accessToken,
    JOBBER_CLIENTS_QUERY,
    { first, after: options.after ?? null },
    "client",
  );
  if (!data.clients) {
    throw new Error("Jobber client query returned no client connection");
  }
  return data.clients;
}

async function fetchAllJobberPages<T>(
  fetchPage: (after: string | null) => Promise<{
    nodes: T[];
    pageInfo: { endCursor: string | null; hasNextPage: boolean };
  }>,
  maxPages = JOBBER_MAX_PAGES,
): Promise<JobberPaginatedResult<T>> {
  const nodes: T[] = [];
  let after: string | null = null;
  let pageCount = 0;

  while (pageCount < maxPages) {
    const page = await fetchPage(after);
    nodes.push(...page.nodes);
    pageCount += 1;

    if (!page.pageInfo.hasNextPage) {
      return { nodes, pageCount };
    }
    const nextCursor = page.pageInfo.endCursor;
    if (!nextCursor || nextCursor === after) {
      throw new Error("Jobber pagination returned an invalid cursor");
    }
    after = nextCursor;
  }

  throw new Error(
    `Jobber data exceeded the ${maxPages}-page synchronization guard`,
  );
}

export function fetchAllJobberVisits(
  accessToken: string,
): Promise<JobberPaginatedResult<JobberVisitNode>> {
  return fetchAllJobberPages((after) =>
    fetchJobberVisitPage(accessToken, { after }),
  );
}

export function fetchAllJobberClients(
  accessToken: string,
): Promise<JobberPaginatedResult<JobberClientNode>> {
  return fetchAllJobberPages((after) =>
    fetchJobberClientPage(accessToken, { after }),
  );
}
