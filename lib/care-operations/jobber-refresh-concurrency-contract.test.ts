import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./jobber-connection-store.ts", import.meta.url),
  "utf8",
);

describe("Jobber rotating refresh-token concurrency", () => {
  it("reloads durable tokens while waiting and leases the exact generation", () => {
    expect(source).toContain("for (let attempt = 0;");
    expect(source).toContain('"acquire_jobber_refresh_lease_v2"');
    expect(source).toContain(
      "expected_token_generation: row.token_generation",
    );
    expect(source).toContain("await waitForRefreshLease()");
  });
});
