import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assignJobberVisitUsers,
  fetchJobberAssignableUsers,
  JobberAssignmentError,
} from "./jobber-visit-assignment";

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Jobber visit assignments", () => {
  it("returns only schedulable users in display order", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      data: {
        users: {
          nodes: [
            {
              id: "z-tech",
              name: { full: "Zara Tech" },
              availableForScheduling: true,
              isAccountOwner: false,
              isAccountAdmin: false,
            },
            {
              id: "hidden-tech",
              name: { full: "Hidden Tech" },
              availableForScheduling: false,
              isAccountOwner: false,
              isAccountAdmin: false,
            },
            {
              id: "a-tech",
              name: { full: "Alex Tech" },
              availableForScheduling: true,
              isAccountOwner: false,
              isAccountAdmin: false,
            },
          ],
        },
      },
    })));

    await expect(fetchJobberAssignableUsers("token")).resolves.toEqual([
      expect.objectContaining({ id: "a-tech", name: "Alex Tech" }),
      expect.objectContaining({ id: "z-tech", name: "Zara Tech" }),
    ]);
  });

  it("uses the narrow visit assignment mutation and returns provider truth", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      data: {
        visitEditAssignedUsers: {
          visit: {
            id: "visit-1",
            assignedUsers: {
              nodes: [{ id: "tech-1", name: { full: "Alex Tech" } }],
            },
          },
          userErrors: [],
        },
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(assignJobberVisitUsers({
      accessToken: "token",
      visitId: "visit-1",
      assignedUserIds: ["tech-1"],
    })).resolves.toEqual({
      visitId: "visit-1",
      assignedUsers: [{ id: "tech-1", name: "Alex Tech" }],
    });

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body)) as {
      query: string;
      variables: Record<string, unknown>;
    };
    expect(body.query).toContain("visitEditAssignedUsers");
    expect(body.variables).toEqual({
      visitId: "visit-1",
      input: { assignedUserIds: ["tech-1"] },
    });
  });

  it("fails closed on Jobber mutation user errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      data: {
        visitEditAssignedUsers: {
          visit: null,
          userErrors: [{ message: "Visit cannot be reassigned" }],
        },
      },
    })));

    await expect(assignJobberVisitUsers({
      accessToken: "token",
      visitId: "visit-1",
      assignedUserIds: ["tech-1"],
    })).rejects.toMatchObject({
      code: "provider_rejected",
    } satisfies Partial<JobberAssignmentError>);
  });

  it("surfaces missing Jobber scopes as a reconnect action", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      errors: [{ message: "Access denied due to permissions" }],
    })));

    await expect(fetchJobberAssignableUsers("token")).rejects.toMatchObject({
      code: "permission_required",
    } satisfies Partial<JobberAssignmentError>);
  });
});
