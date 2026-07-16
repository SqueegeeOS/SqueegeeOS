import "server-only";

import { createHash } from "node:crypto";
import {
  getJobberGraphqlVersion,
  JOBBER_GRAPHQL_URL,
} from "./jobber-oauth-config";
import { JobberApiError, type JobberVisitSampleNode } from "./jobber-api";

export const JOBBER_COVERAGE_PAGE_SIZE = 50;
export const JOBBER_COVERAGE_REQUEST_TIMEOUT_MS = 15_000;

export interface JobberCoverageWindow {
  startAt: string;
  endAt: string;
}

export interface JobberCoveragePage {
  nodes: JobberVisitSampleNode[];
  hasNextPage: boolean;
}

export const JOBBER_VISIT_COVERAGE_QUERY = `
  query HomeAtlasVisitCoverage($filter: VisitFilterAttributes!) {
    visits(first: 50, filter: $filter) {
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
      pageInfo { hasNextPage }
    }
  }
`;

export class JobberCoverageError extends Error {
  constructor(
    public readonly code:
      | "graphql_partial_errors"
      | "http_429"
      | "http_error"
      | "malformed_response"
      | "malformed_timestamp"
      | "timeout"
      | "version_mismatch"
      | "version_warning",
    message: string,
  ) {
    super(message);
    this.name = "JobberCoverageError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(
  value: unknown,
  field: string,
  allowEmpty = false,
): string {
  if (typeof value !== "string" || (!allowEmpty && value.trim() === "")) {
    throw new JobberCoverageError(
      "malformed_response",
      `Jobber visit field ${field} was malformed`,
    );
  }
  return value;
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null) return null;
  return requiredString(value, field, true);
}

const RFC3339_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/;

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function timestamp(value: unknown, field: string, nullable: boolean): string | null {
  if (value === null && nullable) return null;
  if (typeof value !== "string") {
    throw new JobberCoverageError(
      "malformed_timestamp",
      `Jobber visit timestamp ${field} was missing or malformed`,
    );
  }
  const match = RFC3339_TIMESTAMP.exec(value);
  if (!match) {
    throw new JobberCoverageError(
      "malformed_timestamp",
      `Jobber visit timestamp ${field} was missing or malformed`,
    );
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText,
    zone, , offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHour = zone === "Z" ? 0 : Number(offsetHourText);
  const offsetMinute = zone === "Z" ? 0 : Number(offsetMinuteText);
  if (
    month < 1 || month > 12 ||
    day < 1 || day > daysInMonth(year, month) ||
    hour > 23 || minute > 59 || second > 59 ||
    offsetHour > 23 || offsetMinute > 59
  ) {
    throw new JobberCoverageError(
      "malformed_timestamp",
      `Jobber visit timestamp ${field} was not a real calendar timestamp`,
    );
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    throw new JobberCoverageError(
      "malformed_timestamp",
      `Jobber visit timestamp ${field} was malformed`,
    );
  }
  return new Date(milliseconds).toISOString();
}

export function parseJobberCoverageVisit(value: unknown): JobberVisitSampleNode {
  if (!isRecord(value) || !isRecord(value.client) || !isRecord(value.property) || !isRecord(value.job)) {
    throw new JobberCoverageError(
      "malformed_response",
      "Jobber visit data was incomplete",
    );
  }
  if (typeof value.isComplete !== "boolean") {
    throw new JobberCoverageError(
      "malformed_response",
      "Jobber visit completion state was malformed",
    );
  }
  if (!Number.isInteger(value.job.jobNumber)) {
    throw new JobberCoverageError(
      "malformed_response",
      "Jobber visit job number was malformed",
    );
  }

  return {
    id: requiredString(value.id, "id"),
    title: nullableString(value.title, "title"),
    // The provider enum is intentionally not modeled. Preserve the opaque
    // string exactly and make no workflow decision from it.
    visitStatus: requiredString(value.visitStatus, "visitStatus"),
    isComplete: value.isComplete,
    startAt: timestamp(value.startAt, "startAt", false),
    endAt: timestamp(value.endAt, "endAt", true),
    completedAt: timestamp(value.completedAt, "completedAt", true),
    client: {
      id: requiredString(value.client.id, "client.id"),
      name: requiredString(value.client.name, "client.name", true),
    },
    property: {
      id: requiredString(value.property.id, "property.id"),
      jobberWebUri: requiredString(
        value.property.jobberWebUri,
        "property.jobberWebUri",
      ),
    },
    job: {
      id: requiredString(value.job.id, "job.id"),
      jobNumber: value.job.jobNumber as number,
      title: nullableString(value.job.title, "job.title"),
      jobStatus: requiredString(value.job.jobStatus, "job.jobStatus"),
    },
  };
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashCanonicalJobberVisit(visit: JobberVisitSampleNode): string {
  return createHash("sha256").update(canonicalize(visit)).digest("hex");
}

function firstHeader(headers: Headers, names: readonly string[]): string | null {
  for (const name of names) {
    const value = headers.get(name);
    if (value?.trim()) return value.trim();
  }
  return null;
}

export function assertJobberCoverageVersion(
  headers: Headers,
  body: unknown,
  expectedVersion = getJobberGraphqlVersion(),
): void {
  const warning = firstHeader(headers, [
    "x-jobber-graphql-version-warning",
    "x-jobber-api-version-warning",
    "x-jobber-graphql-version-deprecation",
    "x-jobber-api-version-deprecation",
  ]);
  const standardWarning = headers.get("warning");
  const extensions = isRecord(body) && isRecord(body.extensions)
    ? body.extensions
    : null;
  const extensionWarning = extensions
    ? Object.entries(extensions).find(
        ([key, value]) =>
          /version.*warning|warning.*version/i.test(key) &&
          value !== null &&
          value !== false &&
          value !== "",
      )
    : undefined;
  if (
    warning ||
    extensionWarning ||
    (standardWarning && /version|graphql|deprecat/i.test(standardWarning))
  ) {
    throw new JobberCoverageError(
      "version_warning",
      "Jobber returned an API version warning",
    );
  }

  const observedVersion = firstHeader(headers, [
    "x-jobber-graphql-version",
    "x-jobber-api-version",
  ]);
  if (observedVersion && observedVersion !== expectedVersion) {
    throw new JobberCoverageError(
      "version_mismatch",
      "Jobber responded with a different API version",
    );
  }
}

export async function fetchJobberCoverageWindow(
  accessToken: string,
  window: JobberCoverageWindow,
  options: {
    fetcher?: typeof fetch;
    expectedVersion?: string;
    timeoutMs?: number;
  } = {},
): Promise<JobberCoveragePage> {
  const start = Date.parse(window.startAt);
  const end = Date.parse(window.endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    throw new Error("Jobber coverage window must be a valid half-open interval");
  }
  if (/\bmutation\b/i.test(JOBBER_VISIT_COVERAGE_QUERY)) {
    throw new Error("Jobber coverage query must remain read-only");
  }

  const expectedVersion = options.expectedVersion ?? getJobberGraphqlVersion();
  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(JOBBER_GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-JOBBER-GRAPHQL-VERSION": expectedVersion,
      },
      body: JSON.stringify({
        query: JOBBER_VISIT_COVERAGE_QUERY,
        variables: {
          filter: {
            startAt: {
              min: new Date(start).toISOString(),
              before: new Date(end).toISOString(),
            },
          },
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(
        options.timeoutMs ?? JOBBER_COVERAGE_REQUEST_TIMEOUT_MS,
      ),
    });
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      throw new JobberCoverageError("timeout", "Jobber coverage query timed out");
    }
    throw new JobberCoverageError(
      "http_error",
      "Jobber coverage request failed before a response was received",
    );
  }

  if (response.status === 429) {
    throw new JobberCoverageError(
      "http_429",
      "Jobber rate-limited the coverage query",
    );
  }
  if (!response.ok) {
    throw new JobberApiError(
      `Jobber coverage query failed (${response.status})`,
      response.status,
    );
  }

  let body: unknown;
  try {
    body = (await response.json()) as unknown;
  } catch {
    throw new JobberCoverageError(
      "malformed_response",
      "Jobber coverage response was not valid JSON",
    );
  }
  assertJobberCoverageVersion(response.headers, body, expectedVersion);
  if (!isRecord(body)) {
    throw new JobberCoverageError(
      "malformed_response",
      "Jobber coverage response was malformed",
    );
  }
  if (Object.prototype.hasOwnProperty.call(body, "errors")) {
    if (!Array.isArray(body.errors)) {
      throw new JobberCoverageError(
        "malformed_response",
        "Jobber coverage response errors field was malformed",
      );
    }
    if (body.errors.length > 0) {
      throw new JobberCoverageError(
        "graphql_partial_errors",
        "Jobber coverage query returned GraphQL errors",
      );
    }
  }
  const data = isRecord(body.data) ? body.data : null;
  const visits = data && isRecord(data.visits) ? data.visits : null;
  const pageInfo = visits && isRecord(visits.pageInfo) ? visits.pageInfo : null;
  if (
    !visits ||
    !Array.isArray(visits.nodes) ||
    !pageInfo ||
    typeof pageInfo.hasNextPage !== "boolean"
  ) {
    throw new JobberCoverageError(
      "malformed_response",
      "Jobber coverage response did not contain a visit connection",
    );
  }
  if (visits.nodes.length > JOBBER_COVERAGE_PAGE_SIZE) {
    throw new JobberCoverageError(
      "malformed_response",
      "Jobber coverage response exceeded the requested page size",
    );
  }
  return {
    nodes: visits.nodes.map(parseJobberCoverageVisit),
    hasNextPage: pageInfo.hasNextPage,
  };
}
