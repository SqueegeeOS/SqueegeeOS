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

export interface JobberAssignedUserNode {
  id: string;
  name: string;
}

export interface JobberServiceScopeItemNode {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  category: string | null;
  totalPrice: number;
}

export interface JobberVisitNode {
  id: string;
  title: string | null;
  visitStatus: string;
  isComplete: boolean;
  clientConfirmed: boolean;
  isLastScheduledVisit: boolean;
  startAt: string | null;
  endAt: string | null;
  completedAt: string | null;
  invoice: { id: string; invoiceStatus: string } | null;
  invoiceReadState: "available" | "permission_hidden";
  assignedUsers: JobberAssignedUserNode[];
  assignmentReadState: "available" | "permission_hidden";
  scopeItems: JobberServiceScopeItemNode[];
  scopeReadState: "available" | "partial" | "permission_hidden";
  client: { id: string; name: string };
  property: { id: string; jobberWebUri: string };
  job: {
    id: string;
    jobNumber: number;
    title: string | null;
    jobStatus: string;
    jobType: string;
    billingType: string;
    total: number;
    willClientBeAutomaticallyCharged: boolean | null;
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

// Rich visit pages include nested crew and line-item connections. At 50 visits,
// the requested GraphQL cost can exceed Jobber's fixed 10,000-point ceiling and
// can never succeed, regardless of retry time. Ten keeps the worst-case request
// bounded while cursor pagination still retrieves the complete visit history.
export const JOBBER_PAGE_SIZE = 10;
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

function buildJobberVisitsQuery(options: {
  operationName: string;
  includeInvoice: boolean;
  includeAssignments: boolean;
  includeScope: boolean;
}): string {
  return `
    query ${options.operationName}($first: Int!, $after: String) {
      visits(first: $first, after: $after) {
        nodes {
          id
          title
          visitStatus
          isComplete
          clientConfirmed
          isLastScheduledVisit
          startAt
          endAt
          completedAt
          ${options.includeInvoice ? "invoice { id invoiceStatus }" : ""}
          ${
            options.includeAssignments
              ? "assignedUsers(first: 25) { nodes { id name { full } } }"
              : ""
          }
          ${
            options.includeScope
              ? `lineItems(first: 50) {
                  nodes { id name description quantity category totalPrice }
                  pageInfo { hasNextPage }
                }`
              : ""
          }
          client { id name }
          property { id jobberWebUri }
          job {
            id
            jobNumber
            title
            jobStatus
            jobType
            billingType
            total
            willClientBeAutomaticallyCharged
          }
        }
        pageInfo { endCursor hasNextPage }
      }
    }
  `;
}

export const JOBBER_VISITS_QUERY = buildJobberVisitsQuery({
  operationName: "HomeAtlasVisits",
  includeInvoice: true,
  includeAssignments: true,
  includeScope: true,
});

export const JOBBER_VISITS_WITHOUT_INVOICE_QUERY = buildJobberVisitsQuery({
  operationName: "HomeAtlasVisitsWithoutInvoice",
  includeInvoice: false,
  includeAssignments: true,
  includeScope: true,
});

export const JOBBER_VISITS_WITHOUT_ASSIGNMENTS_QUERY =
  buildJobberVisitsQuery({
    operationName: "HomeAtlasVisitsWithoutAssignments",
    includeInvoice: true,
    includeAssignments: false,
    includeScope: true,
  });

export const JOBBER_VISITS_WITHOUT_SCOPE_QUERY = buildJobberVisitsQuery({
  operationName: "HomeAtlasVisitsWithoutScope",
  includeInvoice: true,
  includeAssignments: true,
  includeScope: false,
});

const JOBBER_VISITS_WITH_SCOPE_ONLY_QUERY = buildJobberVisitsQuery({
  operationName: "HomeAtlasVisitsWithScopeOnly",
  includeInvoice: false,
  includeAssignments: false,
  includeScope: true,
});

const JOBBER_VISITS_WITH_ASSIGNMENTS_ONLY_QUERY = buildJobberVisitsQuery({
  operationName: "HomeAtlasVisitsWithAssignmentsOnly",
  includeInvoice: false,
  includeAssignments: true,
  includeScope: false,
});

const JOBBER_VISITS_WITH_INVOICE_ONLY_QUERY = buildJobberVisitsQuery({
  operationName: "HomeAtlasVisitsWithInvoiceOnly",
  includeInvoice: true,
  includeAssignments: false,
  includeScope: false,
});

export const JOBBER_VISITS_SCHEDULING_ONLY_QUERY = buildJobberVisitsQuery({
  operationName: "HomeAtlasVisitsSchedulingOnly",
  includeInvoice: false,
  includeAssignments: false,
  includeScope: false,
});

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
  const variables = { first, after: options.after ?? null };
  type VisitTransport = Omit<
    JobberVisitNode,
    | "assignedUsers"
    | "assignmentReadState"
    | "invoice"
    | "invoiceReadState"
    | "scopeItems"
    | "scopeReadState"
  > & {
    invoice?: { id: string; invoiceStatus: string } | null;
    assignedUsers?: {
      nodes: Array<{ id: string; name: { full: string } }>;
    } | null;
    lineItems?: {
      nodes: Array<{
        id: string;
        name: string;
        description: string | null;
        quantity: number;
        category: string | null;
        totalPrice: number;
      }>;
      pageInfo: { hasNextPage: boolean };
    } | null;
  };
  type VisitPage = Omit<JobberVisitPage, "nodes"> & {
    nodes: VisitTransport[];
  };
  type QueryVariant = {
    query: string;
    operationLabel: string;
    includeInvoice: boolean;
    includeAssignments: boolean;
    includeScope: boolean;
  };

  const variants: QueryVariant[] = [
    {
      query: JOBBER_VISITS_QUERY,
      operationLabel: "visit",
      includeInvoice: true,
      includeAssignments: true,
      includeScope: true,
    },
    {
      query: JOBBER_VISITS_WITHOUT_INVOICE_QUERY,
      operationLabel: "visit without invoice visibility",
      includeInvoice: false,
      includeAssignments: true,
      includeScope: true,
    },
    {
      query: JOBBER_VISITS_WITHOUT_ASSIGNMENTS_QUERY,
      operationLabel: "visit without crew visibility",
      includeInvoice: true,
      includeAssignments: false,
      includeScope: true,
    },
    {
      query: JOBBER_VISITS_WITHOUT_SCOPE_QUERY,
      operationLabel: "visit without service scope visibility",
      includeInvoice: true,
      includeAssignments: true,
      includeScope: false,
    },
    {
      query: JOBBER_VISITS_WITH_SCOPE_ONLY_QUERY,
      operationLabel: "visit with service scope only",
      includeInvoice: false,
      includeAssignments: false,
      includeScope: true,
    },
    {
      query: JOBBER_VISITS_WITH_ASSIGNMENTS_ONLY_QUERY,
      operationLabel: "visit with crew visibility only",
      includeInvoice: false,
      includeAssignments: true,
      includeScope: false,
    },
    {
      query: JOBBER_VISITS_WITH_INVOICE_ONLY_QUERY,
      operationLabel: "visit with invoice visibility only",
      includeInvoice: true,
      includeAssignments: false,
      includeScope: false,
    },
    {
      query: JOBBER_VISITS_SCHEDULING_ONLY_QUERY,
      operationLabel: "visit scheduling truth only",
      includeInvoice: false,
      includeAssignments: false,
      includeScope: false,
    },
  ];
  let variant = variants[0];
  const attempted = new Set<string>();

  while (variant && !attempted.has(variant.query)) {
    attempted.add(variant.query);
    try {
      const data = await fetchJobberGraphql<{ visits?: VisitPage }>(
        accessToken,
        variant.query,
        variables,
        variant.operationLabel,
      );
      if (!data.visits) {
        throw new Error("Jobber visit query returned no visit connection");
      }
      return {
        ...data.visits,
        nodes: data.visits.nodes.map((visit) => {
          const {
            assignedUsers: assignedUsersConnection,
            lineItems: lineItemsConnection,
            ...visitFields
          } = visit;
          const assignmentsAvailable = Boolean(
            variant.includeAssignments &&
              assignedUsersConnection &&
              Array.isArray(assignedUsersConnection.nodes),
          );
          const scopeAvailable = Boolean(
            variant.includeScope &&
              lineItemsConnection &&
              Array.isArray(lineItemsConnection.nodes),
          );
          return {
            ...visitFields,
            invoice: variant.includeInvoice ? (visit.invoice ?? null) : null,
            invoiceReadState: variant.includeInvoice
              ? ("available" as const)
              : ("permission_hidden" as const),
            assignedUsers: assignmentsAvailable
              ? assignedUsersConnection!.nodes.map((user) => ({
                  id: user.id,
                  name: user.name.full,
                }))
              : [],
            assignmentReadState: assignmentsAvailable
              ? ("available" as const)
              : ("permission_hidden" as const),
            scopeItems: scopeAvailable
              ? lineItemsConnection!.nodes.map((item) => ({
                  id: item.id,
                  name: item.name,
                  description: item.description ?? null,
                  quantity: item.quantity,
                  category: item.category ?? null,
                  totalPrice: item.totalPrice,
                }))
              : [],
            scopeReadState: scopeAvailable
              ? lineItemsConnection!.pageInfo?.hasNextPage
                ? ("partial" as const)
                : ("available" as const)
              : ("permission_hidden" as const),
          };
        }),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const invoiceHidden =
        variant.includeInvoice &&
        /(?:object of type invoice|invoice).*hidden due to permissions/i.test(
          message,
        );
      const assignmentsHidden =
        variant.includeAssignments &&
        /(?:object of type user|assignedusers).*hidden due to permissions/i.test(
          message,
        );
      const scopeHidden =
        variant.includeScope &&
        /(?:object of type joblineitem|lineitems).*hidden due to permissions/i.test(
          message,
        );
      if (!invoiceHidden && !assignmentsHidden && !scopeHidden) throw error;

      const nextInvoiceVisibility = variant.includeInvoice && !invoiceHidden;
      const nextAssignmentVisibility =
        variant.includeAssignments && !assignmentsHidden;
      const nextScopeVisibility = variant.includeScope && !scopeHidden;
      const nextVariant = variants.find(
        (candidate) =>
          candidate.includeInvoice === nextInvoiceVisibility &&
          candidate.includeAssignments === nextAssignmentVisibility &&
          candidate.includeScope === nextScopeVisibility,
      );
      if (!nextVariant) throw error;
      variant = nextVariant;
    }
  }

  throw new Error("Jobber visit permission fallback could not be resolved");
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
