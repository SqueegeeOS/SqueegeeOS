import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "./20260915180316_preserve_enrollment_link_history.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("enrollment link history security", () => {
  it("keeps historical token digests private and revocable", () => {
    expect(migration).toContain(
      "alter table public.enrollment_packet_access_tokens enable row level security",
    );
    expect(migration).toContain(
      "revoke all on table public.enrollment_packet_access_tokens from anon, authenticated",
    );
    expect(migration).toContain("revoked_at timestamptz");
    expect(migration).not.toMatch(/create\s+policy/i);
  });

  it("backfills the currently valid link for every existing packet", () => {
    expect(migration).toContain("from public.enrollment_packets");
    expect(migration).toContain("public_token_sha256");
    expect(migration).toContain("public_token_expires_at");
  });
});
