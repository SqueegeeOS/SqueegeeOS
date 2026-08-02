import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SMS_CONSENT_DISCLOSURE_VERSION } from "./lead-record";

const route = readFileSync(
  new URL("../../app/api/leads/route.ts", import.meta.url),
  "utf8",
);
const repository = readFileSync(
  new URL("./leads/repository.ts", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL(
    "../persistence/supabase/migrations/044_sms_consent_evidence.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("SMS consent evidence", () => {
  it("uses a named disclosure version and captures request context only for opt-in", () => {
    expect(SMS_CONSENT_DISCLOSURE_VERSION).toBe(
      "request-form-transactional-v1",
    );
    expect(route).toContain("smsConsentDisclosureVersion");
    expect(route).toContain('smsConsentStatus === "opted_in"');
    expect(route).toContain('request.headers.get("user-agent")');
    expect(route).toContain('request.headers.get("x-forwarded-for")');
  });

  it("persists the evidence with the durable lead and keeps legacy rows explicit", () => {
    for (const column of [
      "sms_consent_disclosure_version",
      "sms_consent_source_path",
      "sms_consent_ip_address",
      "sms_consent_user_agent",
    ]) {
      expect(repository).toContain(column);
      expect(migration).toContain(column);
    }
    expect(migration).toContain("nullable rather than backfilled by guesswork");
  });
});
