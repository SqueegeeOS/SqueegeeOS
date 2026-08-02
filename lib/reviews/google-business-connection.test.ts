import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptGoogleToken, encryptGoogleToken } from "./google-token-crypto";

const migration = readFileSync(
  new URL(
    "../persistence/supabase/migrations/042_google_business_full_reviews.sql",
    import.meta.url,
  ),
  "utf8",
).replace(/\s+/g, " ");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Google Business full-review connection", () => {
  it("keeps encrypted OAuth state service-role only", () => {
    expect(migration).toContain(
      "create table if not exists public.google_business_connections",
    );
    expect(migration).toContain(
      "alter table public.google_business_connections enable row level security",
    );
    expect(migration).toContain(
      "revoke all privileges on table public.google_business_connections from public, anon, authenticated",
    );
    expect(migration).toContain(
      "grant select, insert, update, delete on table public.google_business_connections to service_role",
    );
    expect(migration).toContain(
      "('google_business_connections')",
    );
    expect(migration).toContain(
      "revoke all on function public.homeatlas_security_posture() from public, anon, authenticated",
    );
  });

  it("stores the provider identifiers required for paginated review access", () => {
    for (const column of [
      "account_name text not null",
      "location_name text not null",
      "location_title text not null",
      "place_id text",
      "oauth_email text",
      "refresh_token_ciphertext text not null",
      "connection_revision uuid not null default gen_random_uuid()",
      "last_full_review_count integer",
    ]) {
      expect(migration).toContain(column);
    }

    expect(migration).not.toContain("place_id text not null");
    expect(migration).toContain("alter column place_id drop not null");
  });

  it("round-trips tokens through authenticated AES-256-GCM encryption", () => {
    vi.stubEnv(
      "GOOGLE_TOKEN_ENCRYPTION_KEY",
      Buffer.alloc(32, 19).toString("base64"),
    );
    const encrypted = encryptGoogleToken("google-refresh-token");

    expect(encrypted).not.toContain("google-refresh-token");
    expect(decryptGoogleToken(encrypted)).toBe("google-refresh-token");
  });

  it("can reuse the existing server token-encryption key", () => {
    vi.stubEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", "");
    vi.stubEnv(
      "JOBBER_TOKEN_ENCRYPTION_KEY",
      Buffer.alloc(32, 23).toString("base64"),
    );

    expect(decryptGoogleToken(encryptGoogleToken("shared-key-token"))).toBe(
      "shared-key-token",
    );
  });

  it("rejects tampered ciphertext", () => {
    vi.stubEnv(
      "GOOGLE_TOKEN_ENCRYPTION_KEY",
      Buffer.alloc(32, 29).toString("base64"),
    );
    const encrypted = encryptGoogleToken("access-token");
    const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith("A") ? "B" : "A"}`;

    expect(() => decryptGoogleToken(tampered)).toThrow();
  });
});
