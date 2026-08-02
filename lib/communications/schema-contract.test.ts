import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../persistence/supabase/migrations/041_customer_communications.sql",
    import.meta.url,
  ),
  "utf8",
).replace(/\s+/g, " ");

describe("customer communications migration contract", () => {
  it("adds backward-compatible lead SMS consent fields", () => {
    expect(migration).toContain(
      "add column if not exists sms_consent_status text not null default 'unknown'",
    );
    expect(migration).toContain(
      "add column if not exists email_delivery_status text not null default 'active'",
    );
    expect(migration).toContain(
      "add column if not exists sms_consent_recorded_at timestamptz",
    );
    expect(migration).toContain(
      "sms_consent_status in ('unknown', 'opted_in', 'opted_out')",
    );
  });

  it("creates the provider-neutral communication authority tables", () => {
    for (const table of [
      "customer_contact_points",
      "customer_communication_automation_rules",
      "customer_conversations",
      "customer_messages",
      "customer_communication_webhook_events",
    ]) {
      expect(migration).toContain(`create table if not exists public.${table}`);
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(migration).toContain(
        `revoke all privileges on table public.${table} from public, anon, authenticated`,
      );
      expect(migration).toContain(
        `grant select, insert, update, delete on table public.${table} to service_role`,
      );
    }
  });

  it("keeps homeowner identity canonical and validates property and membership context", () => {
    expect(migration).toContain(
      "check (homeowner_id is not null or lead_intake_id is not null)",
    );
    expect(migration).toContain(
      "Property and membership context require a resolved homeowner identity",
    );
    expect(migration).toContain(
      "Resolved homeowner identity cannot be reassigned",
    );
    expect(migration).toContain(
      "Property context belongs to another homeowner",
    );
    expect(migration).toContain(
      "Membership context belongs to another homeowner",
    );
    expect(migration).toContain(
      "Membership context belongs to another property",
    );
    expect(migration).toContain(
      "create trigger customer_conversations_validate_context before insert or update of homeowner_id, property_id, membership_id",
    );
    expect(migration).toContain("Make pre-existing website requests visible");
    expect(migration).toContain(
      "where conversation.lead_intake_id = lead.id",
    );
  });

  it("prevents a message from using another homeowner's contact point", () => {
    expect(migration).toContain("validate_customer_message_contact_point");
    expect(migration).toContain("Contact point belongs to another homeowner");
    expect(migration).toContain(
      "Contact point channel does not match message channel",
    );
  });

  it("makes messages idempotent, schedulable, and provider-event deduplicated", () => {
    expect(migration).toContain("idempotency_key text not null unique");
    expect(migration).toContain("scheduled_for timestamptz");
    expect(migration).toContain(
      "check (delivery_status <> 'scheduled' or scheduled_for is not null)",
    );
    expect(migration).toContain(
      "primary key (provider, provider_event_id)",
    );
    expect(migration).toContain(
      "create unique index if not exists customer_messages_provider_message_uidx",
    );
  });

  it("seeds only the approved automation defaults", () => {
    expect(migration).toMatch(
      /'lead_acknowledgement_email', 'lead_acknowledgement', 'email', true, false, false, 0,/,
    );
    expect(migration).toMatch(
      /'lead_acknowledgement_sms', 'lead_acknowledgement', 'sms', false, true, false, 0,/,
    );
    expect(migration).toMatch(
      /'visit_reminder_24h_email', 'visit_reminder_24h', 'email', false, false, false, -1440,/,
    );
    expect(migration).toMatch(
      /'visit_reminder_24h_sms', 'visit_reminder_24h', 'sms', false, true, true, -1440,/,
    );
  });
});
