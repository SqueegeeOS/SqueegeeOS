import "server-only";

import type { MemberAppointmentSummary } from "@/lib/member-intelligence/types";
import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import { createPrivilegedServerSupabaseClient } from "@/lib/persistence/supabase/client";
import {
  buildMemberSavingsLedgerView,
  type MemberSavingsLedgerView,
  type SavingsLedgerLine,
} from "./member-savings-ledger";
import type { MemberCareAddonRecord } from "./portal-care-addons";
import type { SqueegeeKingTierId } from "./tier-config";

interface LedgerRow {
  id: string;
  entry_type: "membership_visit" | "addon_service";
  source_id: string;
  label: string;
  amount_cents: number;
  occurred_at: string;
  metadata: Record<string, unknown> | null;
}

function isMissingTableError(message: string, table: string): boolean {
  return message.includes("does not exist") && message.includes(table);
}

function mapLedgerRow(row: LedgerRow): SavingsLedgerLine {
  return {
    id: row.source_id,
    entryType: row.entry_type,
    label: row.label,
    amount: Number(row.amount_cents) / 100,
    occurredAt: row.occurred_at,
    detail:
      typeof row.metadata?.detail === "string" ? row.metadata.detail : null,
  };
}

export async function upsertAddonLedgerEntry(input: {
  membershipId: string;
  memberProfileId: string;
  addonId: string;
  serviceName: string;
  savedCents: number;
  amountChargedCents: number;
  serviceDate: string;
}): Promise<void> {
  if (!isCloudPersistenceConnected() || input.savedCents <= 0) return;

  const supabase = createPrivilegedServerSupabaseClient();
  const occurredAt = `${input.serviceDate}T12:00:00.000Z`;
  const { error } = await supabase.from("member_savings_ledger_entries").upsert(
    {
      membership_id: input.membershipId,
      member_profile_id: input.memberProfileId,
      entry_type: "addon_service",
      source_id: input.addonId,
      label: input.serviceName,
      amount_cents: input.savedCents,
      occurred_at: occurredAt,
      metadata: {
        detail: `Member price $${(input.amountChargedCents / 100).toFixed(0)}`,
      },
    },
    { onConflict: "entry_type,source_id" },
  );

  if (error && !isMissingTableError(error.message, "member_savings_ledger_entries")) {
    throw new Error(error.message);
  }
}

export async function upsertMembershipVisitLedgerEntry(input: {
  membershipId: string;
  memberProfileId: string;
  appointmentId: string;
  serviceName: string;
  savedCents: number;
  amountChargedCents: number;
  serviceDate: string;
}): Promise<void> {
  if (!isCloudPersistenceConnected() || input.savedCents <= 0) return;

  const supabase = createPrivilegedServerSupabaseClient();
  const { error } = await supabase.from("member_savings_ledger_entries").upsert(
    {
      membership_id: input.membershipId,
      member_profile_id: input.memberProfileId,
      entry_type: "membership_visit",
      source_id: input.appointmentId,
      label: input.serviceName,
      amount_cents: input.savedCents,
      occurred_at: `${input.serviceDate}T12:00:00.000Z`,
      metadata: {
        detail: `Member price $${(input.amountChargedCents / 100).toFixed(0)}`,
      },
    },
    { onConflict: "entry_type,source_id" },
  );

  if (error && !isMissingTableError(error.message, "member_savings_ledger_entries")) {
    throw new Error(error.message);
  }
}

export async function loadMemberSavingsLedgerView(input: {
  membershipId: string | null;
  memberProfileId: string | null;
  tierId: SqueegeeKingTierId;
  addonDiscountPercent: number;
  enrollmentSavingsPerVisit: number | null;
  appointments: MemberAppointmentSummary[];
  careAddons: MemberCareAddonRecord[];
}): Promise<MemberSavingsLedgerView> {
  let persistedLines: SavingsLedgerLine[] | undefined;
  if (input.membershipId && isCloudPersistenceConnected()) {
    const supabase = createPrivilegedServerSupabaseClient();
    const { data, error } = await supabase
      .from("member_savings_ledger_entries")
      .select(
        "id, entry_type, source_id, label, amount_cents, occurred_at, metadata",
      )
      .eq("membership_id", input.membershipId)
      .order("occurred_at", { ascending: false });

    if (!error) {
      persistedLines = ((data ?? []) as LedgerRow[]).map(mapLedgerRow);
    }
  }

  return buildMemberSavingsLedgerView({
    tierId: input.tierId,
    addonDiscountPercent: input.addonDiscountPercent,
    enrollmentSavingsPerVisit: input.enrollmentSavingsPerVisit,
    appointments: input.appointments,
    careAddons: input.careAddons,
    persistedLines,
  });
}
