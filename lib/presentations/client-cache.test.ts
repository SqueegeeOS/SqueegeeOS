import { describe, expect, it } from "vitest";
import { createDefaultPresentation } from "./repository";
import { freshestPresentation } from "./client-cache";

describe("presentation client cache recovery", () => {
  it("restores a newer in-tab draft", () => {
    const server = {
      ...createDefaultPresentation({ clientName: "Server copy" }),
      status: "signed" as const,
      agreementId: "server-agreement",
      updatedAt: "2026-08-06T16:00:00.000Z",
    };
    const cached = {
      ...server,
      clientAddress: "123 Recovered Draft Way",
      includeInterior: true,
      status: "draft" as const,
      agreementId: null,
      updatedAt: "2026-08-06T16:01:00.000Z",
    };

    expect(freshestPresentation(server, cached)).toMatchObject({
      clientAddress: "123 Recovered Draft Way",
      includeInterior: true,
      status: "signed",
      agreementId: "server-agreement",
      updatedAt: "2026-08-06T16:01:00.000Z",
    });
  });

  it("keeps a newer server copy", () => {
    const server = {
      ...createDefaultPresentation({ clientName: "Updated elsewhere" }),
      updatedAt: "2026-08-06T16:02:00.000Z",
    };
    const cached = {
      ...server,
      clientName: "Stale browser copy",
      updatedAt: "2026-08-06T16:01:00.000Z",
    };

    expect(freshestPresentation(server, cached)).toBe(server);
  });

  it("never restores a cache entry for a different presentation", () => {
    const server = createDefaultPresentation({ clientName: "Correct" });
    const cached = {
      ...server,
      id: "different-id",
      clientName: "Wrong customer",
      updatedAt: "2099-01-01T00:00:00.000Z",
    };

    expect(freshestPresentation(server, cached)).toBe(server);
  });
});
