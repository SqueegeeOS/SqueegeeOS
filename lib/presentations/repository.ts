import "server-only";

import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { withComputedRates, normalizeVisitRateOverrides } from "./calculations";
import type { PresentationQuoteSnapshot } from "./quote-snapshot";
import {
  isAuthoritativePresentationQuoteSnapshot,
  isCarePlanQuoteSnapshot,
} from "./quote-snapshot";
import {
  getLocalPresentation,
  listLocalPresentations,
  saveLocalPresentation,
} from "./local-store";
import type {
  PresentationData,
  PresentationOnboardingStatus,
  PresentationStatus,
  PresentationTier,
  SlideOverride,
  SlideType,
} from "./types";
import { resolveEnrollmentSavings } from "@/lib/membership/enrollment-savings";
import { normalizePresentationTier, type VisitRateOverrides } from "./types";
import { calculateAnnualFromVisits } from "@/lib/membership/tier-config";

interface PresentationRow {
  id: string;
  created_by: string | null;
  client_name: string;
  client_address: string | null;
  client_email: string | null;
  home_sqft: number;
  tier: PresentationTier;
  monthly_rate: number;
  override_tier: string | null;
  visit_rate_overrides: VisitRateOverrides | null;
  annual_rate: number;
  retail_value: number;
  enrollment_savings: number | null;
  custom_notes: string | null;
  slide_overrides: Partial<Record<SlideType, SlideOverride>> | null;
  status: PresentationStatus;
  signed_at: string | null;
  agreement_id: string | null;
  homeowner_id: string | null;
  property_id: string | null;
  membership_id: string | null;
  onboarding_status: string | null;
  quote_snapshot: PresentationQuoteSnapshot | null;
  authority_sha256: string | null;
  created_at: string;
  updated_at: string;
}

function normalizePresentation(data: PresentationData): PresentationData {
  const twoStory = data.twoStory ?? data.quoteSnapshot?.twoStory ?? false;
  const includeScreens =
    data.includeScreens ?? data.quoteSnapshot?.includeScreens ?? false;
  const computed = withComputedRates({
    tier: data.tier,
    homeSqft: data.homeSqft,
    monthlyRate: data.monthlyRate,
    overrideTier: data.overrideTier,
    visitRateOverrides: data.visitRateOverrides,
    retailValue: data.retailValue,
    twoStory,
    includeScreens,
  });

  const normalized = {
    ...data,
    twoStory,
    includeScreens,
    ...computed,
    quoteSnapshot: isCarePlanQuoteSnapshot(data.quoteSnapshot)
      ? data.quoteSnapshot
      : null,
  };
  if (isAuthoritativePresentationQuoteSnapshot(normalized.quoteSnapshot)) {
    const tier = normalizePresentationTier(normalized.tier);
    return {
      ...normalized,
      tier,
      monthlyRate: 0,
      overrideTier: null,
      visitRateOverrides: {},
      annualRate: calculateAnnualFromVisits(
        tier,
        normalized.quoteSnapshot.tierVisitPrices[tier],
      ),
      enrollmentSavings:
        normalized.quoteSnapshot.tierEnrollmentSavings[tier],
    };
  }
  return normalized;
}

function readPricingFlags(
  snapshot: PresentationQuoteSnapshot | null,
): Pick<PresentationData, "twoStory" | "includeScreens"> {
  return {
    twoStory: snapshot?.twoStory ?? false,
    includeScreens: snapshot?.includeScreens ?? false,
  };
}

function writeQuoteSnapshot(data: PresentationData): PresentationQuoteSnapshot | null {
  const flags = {
    twoStory: data.twoStory,
    includeScreens: data.includeScreens,
  };

  if (isCarePlanQuoteSnapshot(data.quoteSnapshot)) {
    return { ...data.quoteSnapshot, ...flags };
  }

  if (flags.twoStory || flags.includeScreens) {
    return {
      sqft: data.homeSqft,
      frequency: data.tier === "quarterly" ? "quarterly" : "bi_annual",
      includeInterior: false,
      ...flags,
      windowCareVisitPrice: 0,
      frequencyLabel: "",
      exteriorAddOnQuote: {
        lineItems: [],
        subtotal: 0,
        listSubtotal: 0,
        memberDiscountPercent: null,
        memberSavings: 0,
      },
      totalEstimate: 0,
    };
  }

  return null;
}

function rowToPresentation(row: PresentationRow): PresentationData {
  const rawSnapshot = row.quote_snapshot;
  const pricingFlags = readPricingFlags(rawSnapshot);
  return normalizePresentation({
    id: row.id,
    createdBy: row.created_by ?? "Team",
    clientName: row.client_name,
    clientAddress: row.client_address ?? "",
    clientEmail: row.client_email ?? "",
    homeSqft: row.home_sqft,
    ...pricingFlags,
    tier: normalizePresentationTier(row.tier),
    monthlyRate: Number(row.monthly_rate),
    overrideTier: row.override_tier
      ? normalizePresentationTier(row.override_tier)
      : null,
    visitRateOverrides: (row.visit_rate_overrides ?? {}) as VisitRateOverrides,
    annualRate: Number(row.annual_rate),
    retailValue: Number(row.retail_value),
    enrollmentSavings: resolveEnrollmentSavings(
      row.enrollment_savings != null ? Number(row.enrollment_savings) : null,
      normalizePresentationTier(row.tier),
    ),
    customNotes: row.custom_notes ?? "",
    quoteSnapshot: isCarePlanQuoteSnapshot(rawSnapshot) ? rawSnapshot : null,
    slideOverrides: row.slide_overrides ?? {},
    status: row.status,
    signedAt: row.signed_at,
    agreementId: row.agreement_id,
    homeownerId: row.homeowner_id,
    propertyId: row.property_id,
    membershipId: row.membership_id,
    onboardingStatus: row.onboarding_status as PresentationOnboardingStatus | null,
    authoritySha256: row.authority_sha256,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function presentationToRow(data: PresentationData): Record<string, unknown> {
  return {
    created_by: data.createdBy,
    client_name: data.clientName,
    client_address: data.clientAddress,
    client_email: data.clientEmail || null,
    home_sqft: data.homeSqft,
    tier: data.tier,
    monthly_rate: data.monthlyRate,
    override_tier: data.overrideTier ?? null,
    visit_rate_overrides: normalizeVisitRateOverrides(data),
    annual_rate: data.annualRate,
    retail_value: data.retailValue,
    enrollment_savings: data.enrollmentSavings,
    custom_notes: data.customNotes || null,
    quote_snapshot: writeQuoteSnapshot(data),
    slide_overrides: data.slideOverrides,
    status: data.status,
    signed_at: data.signedAt,
    agreement_id: data.agreementId,
    homeowner_id: data.homeownerId,
    property_id: data.propertyId,
    membership_id: data.membershipId,
    onboarding_status: data.onboardingStatus,
    authority_sha256: data.authoritySha256 ?? null,
  };
}

function newPresentationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `pres_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const PRESENTATION_CAPABILITY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPresentationCapability(id: string): boolean {
  return PRESENTATION_CAPABILITY_PATTERN.test(id);
}

function isFullPresentationPayload(
  patch: Partial<PresentationData>,
): patch is PresentationData {
  return (
    typeof patch.clientName === "string" &&
    typeof patch.tier === "string" &&
    typeof patch.homeSqft === "number" &&
    typeof patch.createdAt === "string"
  );
}

async function listFromSupabase(): Promise<PresentationData[]> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("presentations")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as PresentationRow[]).map(rowToPresentation);
}

async function getFromSupabase(id: string): Promise<PresentationData | null> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("presentations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? rowToPresentation(data as PresentationRow) : null;
}

async function saveToSupabase(data: PresentationData): Promise<PresentationData> {
  const supabase = createServiceRoleSupabaseClient();
  const row = {
    id: data.id,
    ...presentationToRow(data),
  };

  const attempt = await supabase
    .from("presentations")
    .upsert(row, { onConflict: "id" })
    .select("*")
    .single();

  if (!attempt.error) {
    return rowToPresentation(attempt.data as PresentationRow);
  }

  if (
    isMissingColumnError(attempt.error.message, "enrollment_savings") &&
    "enrollment_savings" in row
  ) {
    const { enrollment_savings: _removed, ...rowWithoutEnrollment } = row;
    const retry = await supabase
      .from("presentations")
      .upsert(rowWithoutEnrollment, { onConflict: "id" })
      .select("*")
      .single();
    if (retry.error) throw new Error(retry.error.message);
    return rowToPresentation(retry.data as PresentationRow);
  }

  throw new Error(attempt.error.message);
}

function isMissingColumnError(message: string, column: string): boolean {
  return message.includes(column) && message.includes("does not exist");
}

export function createDefaultPresentation(input?: {
  clientName?: string;
  createdBy?: string;
  tier?: PresentationTier;
  homeSqft?: number;
  quoteSnapshot?: PresentationQuoteSnapshot | null;
  authoritySha256?: string | null;
}): PresentationData {
  const tier = normalizePresentationTier(input?.tier ?? "quarterly");
  const homeSqft = input?.homeSqft ?? input?.quoteSnapshot?.sqft ?? 0;
  const rates = withComputedRates({ tier, homeSqft });
  const now = new Date().toISOString();

  return {
    id: newPresentationId(),
    createdBy: input?.createdBy ?? "Team",
    clientName: input?.clientName ?? "New Client",
    clientAddress: "",
    clientEmail: "",
    homeSqft,
    twoStory: input?.quoteSnapshot?.twoStory ?? false,
    includeScreens: input?.quoteSnapshot?.includeScreens ?? false,
    tier,
    ...rates,
    visitRateOverrides: {},
    customNotes: "",
    quoteSnapshot: input?.quoteSnapshot ?? null,
    slideOverrides: {},
    status: "draft",
    signedAt: null,
    agreementId: null,
    homeownerId: null,
    propertyId: null,
    membershipId: null,
    onboardingStatus: null,
    authoritySha256: input?.authoritySha256 ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function listPresentations(): Promise<PresentationData[]> {
  if (isCloudPersistenceConnected()) {
    return listFromSupabase();
  }

  return listLocalPresentations();
}

export async function getPresentation(
  id: string,
): Promise<PresentationData | null> {
  let data: PresentationData | null = null;

  if (isCloudPersistenceConnected()) {
    data = await getFromSupabase(id);
  } else {
    data = await getLocalPresentation(id);
  }

  return data ? normalizePresentation(data) : null;
}

/** Privileged portal read bound to the immutable token-resolved identity. */
export async function getPresentationForPortalAccess(
  id: string,
  identity: {
    membershipId: string;
    homeownerId: string;
    propertyId: string;
  },
): Promise<PresentationData | null> {
  if (!isCloudPersistenceConnected()) return null;

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("presentations")
    .select("*")
    .eq("id", id)
    .eq("membership_id", identity.membershipId)
    .eq("homeowner_id", identity.homeownerId)
    .eq("property_id", identity.propertyId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const presentation = rowToPresentation(data as PresentationRow);
  if (
    presentation.membershipId !== identity.membershipId ||
    presentation.homeownerId !== identity.homeownerId ||
    presentation.propertyId !== identity.propertyId
  ) {
    return null;
  }
  return presentation;
}

/**
 * Resolve the opaque public presentation capability without local or anon
 * fallback. Public mutation routes must fail closed when privileged persistence
 * is unavailable instead of accepting an unbound browser payload.
 */
export async function getPresentationByCapability(
  id: string,
): Promise<PresentationData | null> {
  if (!isPresentationCapability(id) || !isCloudPersistenceConnected()) {
    return null;
  }
  return getFromSupabase(id);
}

/**
 * The only public presentation mutation: an existing UUID capability may move
 * its own draft to presented. It cannot create a record, edit content, or
 * rewrite a signed presentation, and it never falls back to browser storage.
 */
export async function markPresentationPresentedByCapability(
  id: string,
): Promise<PresentationData | null> {
  const existing = await getPresentationByCapability(id);
  if (!existing || existing.status !== "draft") return existing;

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("presentations")
    .update({ status: "presented" })
    .eq("id", id)
    .eq("status", "draft")
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? rowToPresentation(data as PresentationRow) : getFromSupabase(id);
}

export async function savePresentation(
  data: PresentationData,
): Promise<PresentationData> {
  const rates = withComputedRates(data);
  const merged: PresentationData = normalizePresentation({
    ...data,
    ...rates,
    updatedAt: new Date().toISOString(),
  });

  if (isCloudPersistenceConnected()) {
    return normalizePresentation(await saveToSupabase(merged));
  }

  return normalizePresentation(await saveLocalPresentation(merged));
}

export async function createPresentation(input?: {
  clientName?: string;
  createdBy?: string;
  tier?: PresentationTier;
  homeSqft?: number;
  quoteSnapshot?: PresentationQuoteSnapshot | null;
  authoritySha256?: string | null;
}): Promise<PresentationData> {
  const record = createDefaultPresentation(input);
  return savePresentation(record);
}

export async function patchPresentation(
  id: string,
  patch: Partial<PresentationData>,
): Promise<PresentationData | null> {
  const existing = await getPresentation(id);

  if (!existing && !isFullPresentationPayload(patch)) {
    return null;
  }

  const base =
    existing ??
    createDefaultPresentation({
      createdBy: patch.createdBy ?? "Team",
      clientName: patch.clientName,
      tier: patch.tier,
      homeSqft: patch.homeSqft,
      quoteSnapshot: patch.quoteSnapshot ?? null,
    });

  const merged: PresentationData = normalizePresentation({
    ...base,
    ...patch,
    id,
    createdAt: existing?.createdAt ?? patch.createdAt ?? base.createdAt,
  });

  return savePresentation(merged);
}
