import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ");
}

const migration = read("./074_relocate_pg_trgm_extension.sql");
const audit = read("../../../../scripts/audit-migrations.mjs");

describe("pg_trgm extension security", () => {
  it("relocates pg_trgm only when it is still in the public schema", () => {
    expect(migration).toContain("create schema if not exists extensions");
    expect(migration).toContain("extension_record.extname = 'pg_trgm'");
    expect(migration).toContain("extension_schema.nspname = 'public'");
    expect(migration).toContain("alter extension pg_trgm set schema extensions");
  });

  it("keeps the production ledger responsible for the extension and Jobber indexes", () => {
    expect(audit).toContain('["074", "private pg_trgm extension schema"');
    expect(audit).toContain('pgTrgmSchema === "extensions"');
    expect(audit).toContain('"jobber_visit_projections_search_idx"');
    expect(audit).toContain('"jobber_client_projections_search_idx"');
  });
});

