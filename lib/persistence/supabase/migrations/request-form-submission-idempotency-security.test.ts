import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("./081_request_form_submission_idempotency.sql", import.meta.url),
  "utf8",
).replace(/\r\n/g, "\n");
const audit = readFileSync(
  new URL("../../../../scripts/audit-migrations.mjs", import.meta.url),
  "utf8",
).replace(/\r\n/g, "\n");

describe("public request submission idempotency migration", () => {
  it("adds a nullable UUID so legacy requests remain valid", () => {
    expect(migration).toContain(
      "add column if not exists client_submission_id uuid",
    );
    expect(migration).not.toMatch(/client_submission_id uuid\s+not null/i);
  });

  it("uniquely protects request-form retries without changing table grants", () => {
    expect(migration).toContain("lead_intakes_request_submission_uidx");
    expect(migration).toContain("source = 'request_form'");
    expect(migration).toContain("client_submission_id is not null");
    expect(migration.toLowerCase()).not.toContain("grant ");
    expect(migration.toLowerCase()).not.toContain("create policy");
  });

  it("is represented in the read-only production migration ledger", () => {
    expect(audit).toContain(
      '["081", "idempotent public request submissions"',
    );
    expect(audit).toContain("lead_intakes_request_submission_uidx");
  });
});
