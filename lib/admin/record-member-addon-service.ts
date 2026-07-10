import {
  MEMBER_ADDON_REVENUE_STATUSES,
  type MemberAddonStatus,
} from "@/lib/persistence/types/member-addon";
import {
  normalizeToSqueegeeKingTier,
  SQUEEGEEKING_TIERS,
  type SqueegeeKingTierId,
} from "@/lib/membership/tier-config";
import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import { createServerSupabaseClient } from "@/lib/persistence/supabase/client";

export interface RecordMemberAddonInput {
  membershipId: string;
  serviceName: string;
  serviceDate: string;
  retailPrice: number;
  discountPercent: number;
  amountCharged: number;
  status: MemberAddonStatus;
  notes?: string;
}

export interface RecordMemberAddonResult {
  addonId: string;
  membershipId: string;
  retailPriceCents: number;
  amountChargedCents: number;
  savedCents: number;
  revenueCents: number;
  status: MemberAddonStatus;
}

const ADDON_STATUSES: MemberAddonStatus[] = [
  "quoted",
  "scheduled",
  "completed",
  "paid",
];

function dollarsToCents(value: number): number {
  return Math.round(value * 100);
}

function validateServiceDate(value: string): string | null {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return "Service date must use YYYY-MM-DD format";
  }
  const parsed = new Date(`${trimmed}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return "Service date is invalid";
  }
  return null;
}

export function defaultAddonDiscountForTier(
  tier: SqueegeeKingTierId | "unknown",
): number {
  if (tier === "unknown") return SQUEEGEEKING_TIERS.biannual.addonDiscount;
  return SQUEEGEEKING_TIERS[tier].addonDiscount;
}

export function computeMemberAddonSavingsCents(input: {
  retailPriceCents: number;
  amountChargedCents: number;
}): number {
  return Math.max(0, input.retailPriceCents - input.amountChargedCents);
}

export function validateRecordMemberAddonInput(
  input: RecordMemberAddonInput,
): string | null {
  if (!input.membershipId.trim()) {
    return "Membership ID is required";
  }
  if (!input.serviceName.trim()) {
    return "Service name is required";
  }
  const dateError = validateServiceDate(input.serviceDate);
  if (dateError) return dateError;
  if (!Number.isFinite(input.retailPrice) || input.retailPrice <= 0) {
    return "Retail price must be greater than zero";
  }
  if (
    !Number.isFinite(input.discountPercent) ||
    input.discountPercent < 0 ||
    input.discountPercent > 100
  ) {
    return "Discount percent must be between 0 and 100";
  }
  if (!Number.isFinite(input.amountCharged) || input.amountCharged < 0) {
    return "Amount charged must be zero or greater";
  }
  if (input.amountCharged > input.retailPrice + 0.01) {
    return "Amount charged cannot exceed retail price";
  }
  if (!ADDON_STATUSES.includes(input.status)) {
    return "Status is invalid";
  }
  return null;
}

async function ensureMemberProfileId(homeownerId: string): Promise<string> {
  const supabase = createServerSupabaseClient();

  const { data: existing, error: existingError } = await supabase
    .from("member_profiles")
    .select("id, total_saved_cents")
    .eq("homeowner_id", homeownerId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing?.id) {
    return existing.id as string;
  }

  const { data: created, error: createError } = await supabase
    .from("member_profiles")
    .insert({
      homeowner_id: homeownerId,
      membership_tier: "standard",
    })
    .select("id")
    .single();

  if (createError) {
    throw new Error(createError.message);
  }

  return created.id as string;
}

function addonServiceTypeKey(serviceName: string): string {
  const slug = serviceName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
  return slug ? `addon_${slug}` : "addon_service";
}

async function mirrorAddonSavings(input: {
  memberProfileId: string;
  propertyId: string;
  addonId: string;
  serviceName: string;
  retailPriceCents: number;
  amountChargedCents: number;
  savedCents: number;
  serviceDate: string;
  notes?: string;
}): Promise<void> {
  const supabase = createServerSupabaseClient();
  const occurredAt = `${input.serviceDate}T12:00:00.000Z`;

  const { error: savingsError } = await supabase
    .from("member_savings_transactions")
    .insert({
      member_profile_id: input.memberProfileId,
      property_id: input.propertyId,
      appointment_id: null,
      service_type: addonServiceTypeKey(input.serviceName),
      regular_price_cents: input.retailPriceCents,
      member_price_cents: input.amountChargedCents,
      saved_cents: input.savedCents,
      occurred_at: occurredAt,
      notes: input.notes?.trim() || input.serviceName,
    });

  if (savingsError) {
    throw new Error(savingsError.message);
  }

  const { data: profile, error: profileError } = await supabase
    .from("member_profiles")
    .select("total_saved_cents")
    .eq("id", input.memberProfileId)
    .single();

  if (profileError) {
    throw new Error(profileError.message);
  }

  const nextTotal =
    Number(profile.total_saved_cents ?? 0) + input.savedCents;

  const { error: updateError } = await supabase
    .from("member_profiles")
    .update({ total_saved_cents: nextTotal })
    .eq("id", input.memberProfileId);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

export async function recordMemberAddonService(
  input: RecordMemberAddonInput,
): Promise<RecordMemberAddonResult> {
  if (!isCloudPersistenceConnected()) {
    throw new Error("Cloud persistence is not connected");
  }

  const validationError = validateRecordMemberAddonInput(input);
  if (validationError) {
    throw new Error(validationError);
  }

  const supabase = createServerSupabaseClient();
  const membershipId = input.membershipId.trim();
  const retailPriceCents = dollarsToCents(input.retailPrice);
  const amountChargedCents = dollarsToCents(input.amountCharged);
  const savedCents = computeMemberAddonSavingsCents({
    retailPriceCents,
    amountChargedCents,
  });

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("id, homeowner_id, property_id, status, sales_tier")
    .eq("id", membershipId)
    .maybeSingle();

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (!membership) {
    throw new Error("Membership not found");
  }

  if (membership.status === "cancelled") {
    throw new Error("Cancelled memberships cannot receive add-on revenue");
  }

  const tier = normalizeToSqueegeeKingTier(
    (membership.sales_tier as string | null) ?? "quarterly",
  );

  const memberProfileId = await ensureMemberProfileId(
    membership.homeowner_id as string,
  );

  const serviceName = input.serviceName.trim();
  const serviceDate = input.serviceDate.trim();

  const { data: existingAddon, error: existingError } = await supabase
    .from("member_addon_transactions")
    .select(
      "id, retail_price_cents, amount_charged_cents, saved_cents, status",
    )
    .eq("membership_id", membershipId)
    .eq("service_name", serviceName)
    .eq("service_date", serviceDate)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existingAddon?.id) {
    const existingStatus = existingAddon.status as MemberAddonStatus;
    if (MEMBER_ADDON_REVENUE_STATUSES.includes(existingStatus)) {
      const { upsertAddonLedgerEntry } = await import(
        "@/lib/membership/member-savings-ledger-server"
      );
      await upsertAddonLedgerEntry({
        membershipId,
        memberProfileId,
        addonId: existingAddon.id as string,
        serviceName,
        savedCents: Number(existingAddon.saved_cents ?? 0),
        amountChargedCents: Number(existingAddon.amount_charged_cents ?? 0),
        serviceDate,
      });
    }

    return {
      addonId: existingAddon.id as string,
      membershipId,
      retailPriceCents: Number(existingAddon.retail_price_cents),
      amountChargedCents: Number(existingAddon.amount_charged_cents),
      savedCents: Number(existingAddon.saved_cents),
      revenueCents: Number(existingAddon.amount_charged_cents),
      status: existingStatus,
    };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("member_addon_transactions")
    .insert({
      membership_id: membershipId,
      member_profile_id: memberProfileId,
      property_id: membership.property_id,
      service_name: serviceName,
      service_date: serviceDate,
      retail_price_cents: retailPriceCents,
      discount_percent: Math.round(input.discountPercent),
      amount_charged_cents: amountChargedCents,
      saved_cents: savedCents,
      sales_tier: tier,
      status: input.status,
      notes: input.notes?.trim() || null,
    })
    .select("id, status")
    .single();

  if (insertError) {
    throw new Error(insertError.message);
  }

  if (MEMBER_ADDON_REVENUE_STATUSES.includes(input.status) && savedCents > 0) {
    await mirrorAddonSavings({
      memberProfileId,
      propertyId: membership.property_id as string,
      addonId: inserted.id as string,
      serviceName,
      retailPriceCents,
      amountChargedCents,
      savedCents,
      serviceDate: serviceDate,
      notes: input.notes,
    });

    const { upsertAddonLedgerEntry } = await import(
      "@/lib/membership/member-savings-ledger-server"
    );
    await upsertAddonLedgerEntry({
      membershipId,
      memberProfileId,
      addonId: inserted.id as string,
      serviceName,
      savedCents,
      amountChargedCents,
      serviceDate,
    });
  }

  console.info("[record-member-addon-service]", {
    membershipId,
    addonId: inserted.id,
    retailPriceCents,
    amountChargedCents,
    savedCents,
    status: input.status,
  });

  return {
    addonId: inserted.id as string,
    membershipId,
    retailPriceCents,
    amountChargedCents,
    savedCents,
    revenueCents: amountChargedCents,
    status: inserted.status as MemberAddonStatus,
  };
}
