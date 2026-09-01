import "server-only";

import {
  getJobberGraphqlVersion,
  JOBBER_GRAPHQL_URL,
} from "./jobber-oauth-config";

export interface JobberAssignableUser {
  id: string;
  name: string;
  availableForScheduling: boolean;
  isAccountOwner: boolean;
  isAccountAdmin: boolean;
}

export interface JobberConfirmedAssignment {
  visitId: string;
  assignedUsers: Array<{ id: string; name: string }>;
}

interface JobberGraphqlError {
  message?: string;
  extensions?: { code?: string };
}

interface JobberGraphqlEnvelope<T> {
  data?: T;
  errors?: JobberGraphqlError[];
}

interface JobberUserError {
  message?: string;
  path?: string[];
}

export class JobberAssignmentError extends Error {
  constructor(
    message: string,
    readonly code:
      | "permission_required"
      | "provider_rejected"
      | "provider_unavailable"
      | "verification_failed",
  ) {
    super(message);
    this.name = "JobberAssignmentError";
  }
}

const ASSIGNABLE_USERS_QUERY = `
  query HomeAtlasAssignableUsers($first: Int!) {
    users(first: $first) {
      nodes {
        id
        name { full }
        availableForScheduling
        isAccountOwner
        isAccountAdmin
      }
    }
  }
`;

const VISIT_ASSIGNMENT_QUERY = `
  query HomeAtlasVisitAssignment($visitId: EncodedId!) {
    visit(id: $visitId) {
      id
      assignedUsers(first: 25) { nodes { id name { full } } }
    }
  }
`;

const VISIT_ASSIGNMENT_MUTATION = `
  mutation HomeAtlasAssignVisit($visitId: EncodedId!, $input: VisitEditAssignedUsersInput!) {
    visitEditAssignedUsers(visitId: $visitId, input: $input) {
      visit {
        id
        assignedUsers(first: 25) { nodes { id name { full } } }
      }
      userErrors { message path }
    }
  }
`;

function permissionFailure(message: string): boolean {
  return /permission|scope|not authorized|hidden due to permissions|access denied/i.test(
    message,
  );
}

async function requestJobber<T>(input: {
  accessToken: string;
  query: string;
  variables: Record<string, unknown>;
  operation: string;
}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(JOBBER_GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
        "X-JOBBER-GRAPHQL-VERSION": getJobberGraphqlVersion(),
      },
      body: JSON.stringify({ query: input.query, variables: input.variables }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new JobberAssignmentError(
      `Jobber ${input.operation} did not respond. No HomeAtlas assignment was recorded.`,
      "provider_unavailable",
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | JobberGraphqlEnvelope<T>
    | null;
  const providerMessage = payload?.errors?.[0]?.message?.trim() ?? "";
  if (!response.ok || payload?.errors?.length || !payload?.data) {
    if (permissionFailure(providerMessage)) {
      throw new JobberAssignmentError(
        "Jobber needs scheduling write access for HomeAtlas. Reauthorize Jobber after enabling the required job/visit scope.",
        "permission_required",
      );
    }
    throw new JobberAssignmentError(
      providerMessage
        ? `Jobber rejected the ${input.operation}: ${providerMessage}`
        : `Jobber ${input.operation} failed (${response.status}).`,
      response.status >= 500 ? "provider_unavailable" : "provider_rejected",
    );
  }
  return payload.data;
}

function normalizedUsers(
  nodes: Array<{ id?: string; name?: { full?: string } | null }> | null | undefined,
): Array<{ id: string; name: string }> {
  return (nodes ?? []).flatMap((node) => {
    const id = node.id?.trim();
    const name = node.name?.full?.trim();
    return id && name ? [{ id, name }] : [];
  });
}

export async function fetchJobberAssignableUsers(
  accessToken: string,
): Promise<JobberAssignableUser[]> {
  const data = await requestJobber<{
    users?: {
      nodes?: Array<{
        id?: string;
        name?: { full?: string } | null;
        availableForScheduling?: boolean;
        isAccountOwner?: boolean;
        isAccountAdmin?: boolean;
      }>;
    };
  }>({
    accessToken,
    query: ASSIGNABLE_USERS_QUERY,
    variables: { first: 100 },
    operation: "team lookup",
  });
  return (data.users?.nodes ?? [])
    .flatMap((node) => {
      const id = node.id?.trim();
      const name = node.name?.full?.trim();
      if (!id || !name || node.availableForScheduling !== true) return [];
      return [{
        id,
        name,
        availableForScheduling: true,
        isAccountOwner: node.isAccountOwner === true,
        isAccountAdmin: node.isAccountAdmin === true,
      }];
    })
    .sort((left, right) => left.name.localeCompare(right.name, "en-US"));
}

export async function fetchJobberVisitAssignment(
  accessToken: string,
  visitId: string,
): Promise<JobberConfirmedAssignment> {
  const data = await requestJobber<{
    visit?: {
      id?: string;
      assignedUsers?: {
        nodes?: Array<{ id?: string; name?: { full?: string } | null }>;
      } | null;
    } | null;
  }>({
    accessToken,
    query: VISIT_ASSIGNMENT_QUERY,
    variables: { visitId },
    operation: "assignment verification",
  });
  if (!data.visit?.id) {
    throw new JobberAssignmentError(
      "Jobber could not verify that visit.",
      "verification_failed",
    );
  }
  return {
    visitId: data.visit.id,
    assignedUsers: normalizedUsers(data.visit.assignedUsers?.nodes),
  };
}

export async function assignJobberVisitUsers(input: {
  accessToken: string;
  visitId: string;
  assignedUserIds: string[];
}): Promise<JobberConfirmedAssignment> {
  const data = await requestJobber<{
    visitEditAssignedUsers?: {
      visit?: {
        id?: string;
        assignedUsers?: {
          nodes?: Array<{ id?: string; name?: { full?: string } | null }>;
        } | null;
      } | null;
      userErrors?: JobberUserError[];
    } | null;
  }>({
    accessToken: input.accessToken,
    query: VISIT_ASSIGNMENT_MUTATION,
    variables: {
      visitId: input.visitId,
      input: { assignedUserIds: input.assignedUserIds },
    },
    operation: "visit assignment",
  });
  const result = data.visitEditAssignedUsers;
  const userError = result?.userErrors?.[0]?.message?.trim();
  if (userError) {
    throw new JobberAssignmentError(
      permissionFailure(userError)
        ? "Jobber needs scheduling write access for HomeAtlas. Reauthorize Jobber after enabling the required job/visit scope."
        : `Jobber did not accept that technician assignment: ${userError}`,
      permissionFailure(userError) ? "permission_required" : "provider_rejected",
    );
  }
  if (!result?.visit?.id) {
    throw new JobberAssignmentError(
      "Jobber returned no visit after the assignment, so HomeAtlas did not mark it complete.",
      "verification_failed",
    );
  }
  return {
    visitId: result.visit.id,
    assignedUsers: normalizedUsers(result.visit.assignedUsers?.nodes),
  };
}
