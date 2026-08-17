import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("./082_jobber_refresh_generation_lease.sql", import.meta.url),
  "utf8",
).toLowerCase();

describe("Jobber refresh generation lease migration", () => {
  it("rejects stale rotating-token workers at the database boundary", () => {
    expect(migration).toContain(
      "and token_generation = expected_token_generation",
    );
    expect(migration).toContain("and status = 'connected'");
    expect(migration).toContain("get diagnostics changed = row_count");
  });

  it("keeps the refresh lease callable only by the service role", () => {
    expect(migration).toContain(
      "from public, anon, authenticated",
    );
    expect(migration).toContain("to service_role");
  });
});
