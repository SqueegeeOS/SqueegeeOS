import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Atlas Pulse manual completion persistence", () => {
  it("keeps founder confirmation audited, private, reversible, and separate from Resend", () => {
    const sql = readFileSync(
      new URL(
        "../persistence/supabase/migrations/037_atlas_pulse_manual_completion.sql",
        import.meta.url,
      ),
      "utf8",
    );

    expect(sql).toContain("membership_activation_confirmations");
    expect(sql).toContain("membership_activation_confirmation_events");
    expect(sql).toContain("event_type in ('confirmed', 'reopened')");
    expect(sql).toContain("append-only and immutable");
    expect(sql).toContain("must be reopened, never deleted");
    expect(sql).toContain(
      "alter table public.membership_activation_confirmations enable row level security",
    );
    expect(sql).toContain("separate from provider telemetry");
    expect(sql).not.toContain("update public.membership_communications");
  });
});
