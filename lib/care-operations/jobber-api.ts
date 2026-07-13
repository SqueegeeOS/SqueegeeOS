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

export interface JobberVisitSampleNode {
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

export interface JobberVisitSample {
  nodes: JobberVisitSampleNode[];
  pageInfo: { endCursor: string | null; hasNextPage: boolean };
}

export const JOBBER_VISIT_SAMPLE_QUERY = `
  query HomeAtlasVisitSample($first: Int!) {
    visits(first: $first) {
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
    throw new JobberApiError(
      `Jobber token request failed (${response.status})`,
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
): Promise<JobberOAuthTokens> {
  return postTokenRequest(
    new URLSearchParams({
      client_id: getJobberClientId(),
      client_secret: getJobberClientSecret(),
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
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

export async function fetchJobberVisitSample(
  accessToken: string,
  limit: number,
): Promise<JobberVisitSample> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) {
    throw new Error("Jobber sample limit must be between 1 and 10");
  }
  if (/\bmutation\b/i.test(JOBBER_VISIT_SAMPLE_QUERY)) {
    throw new Error("Jobber sample query must remain read-only");
  }

  const response = await fetch(JOBBER_GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-JOBBER-GRAPHQL-VERSION": getJobberGraphqlVersion(),
    },
    body: JSON.stringify({
      query: JOBBER_VISIT_SAMPLE_QUERY,
      variables: { first: limit },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new JobberApiError(
      `Jobber visit query failed (${response.status})`,
      response.status,
    );
  }
  const payload = (await response.json()) as {
    data?: { visits?: JobberVisitSample };
    errors?: Array<{ message?: string }>;
  };
  if (payload.errors?.length || !payload.data?.visits) {
    throw new Error(
      payload.errors?.[0]?.message
        ? `Jobber visit query rejected: ${payload.errors[0].message}`
        : "Jobber visit query returned no visit connection",
    );
  }
  return payload.data.visits;
}
