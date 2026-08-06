import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import { createServerSupabaseClient } from "@/lib/persistence/supabase/client";
import { withComputedRates, normalizeVisitRateOverrides } from "./calculations";
import type { PresentationQuoteSnapshot } from "./quote-snapshot";
import { isCarePlanQuoteSnapshot } from "./quote-snapshot";
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
import {
  createPresentationDraftPayload,
  restorePresentationDraftPayload,
} from "./draft-persistence";

interface PresentationRow {
  id: string;
  created_by: string | null;
  sales_rep_id?: string | null;
  sales_rep_lead_id?: string | null;
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
  draft_payload?: unknown;
  created_at: string;
  updated_at: string;
}

function normalizePresentation(data: PresentationData): PresentationData {
  const twoStory = data.twoStory ?? data.quoteSnapshot?.twoStory ?? false;
  const includeScreens =
    data.includeScreens ?? data.quoteSnapshot?.includeScreens ?? false;
  const includeInterior =
    data.includeInterior ?? data.quoteSnapshot?.includeInterior ?? false;
  const computed = withComputedRates({
    tier: data.tier,
    homeSqft: data.homeSqft,
    monthlyRate: data.monthlyRate,
    overrideTier: data.overrideTier,
    visitRateOverrides: data.visitRateOverrides,
    retailValue: data.retailValue,
    twoStory,
    includeScreens,
    includeInterior,
  });

  return {
    ...data,
    salesRepId: data.salesRepId ?? null,
    salesRepLeadId: data.salesRepLeadId ?? null,
    twoStory,
    includeScreens,
    includeInterior,
    ...computed,
    quoteSnapshot: isCarePlanQuoteSnapshot(data.quoteSnapshot)
      ? data.quoteSnapshot
      : null,
  };
}

function readPricingFlags(
  snapshot: PresentationQuoteSnapshot | null,
): Pick<PresentationData, "twoStory" | "includeScreens" | "includeInterior"> {
  return {
    twoStory: snapshot?.twoStory ?? false,
    includeScreens: snapshot?.includeScreens ?? false,
    includeInterior: snapshot?.includeInterior ?? false,
  };
}

function writeQuoteSnapshot(data: PresentationData): PresentationQuoteSnapshot | null {
  const flags = {
    twoStory: data.twoStory,
    includeScreens: data.includeScreens,
    includeInterior: data.includeInterior,
  };

  if (isCarePlanQuoteSnapshot(data.quoteSnapshot)) {
    return { ...data.quoteSnapshot, ...flags };
  }

  if (flags.twoStory || flags.includeScreens || flags.includeInterior) {
    return {
      sqft: data.homeSqft,
      frequency: data.tier === "quarterly" ? "quarterly" : "bi_annual",
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
  const base: PresentationData = {
    id: row.id,
    createdBy: row.created_by ?? "Team",
    salesRepId: row.sales_rep_id ?? null,
    salesRepLeadId: row.sales_rep_lead_id ?? null,
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  return normalizePresentation(
    restorePresentationDraftPayload(base, row.draft_payload),
  );
}

function presentationToRow(data: PresentationData): Record<string, unknown> {
  return {
    created_by: data.createdBy,
    sales_rep_id: data.salesRepId,
    sales_rep_lead_id: data.salesRepLeadId,
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
    draft_payload: createPresentationDraftPayload(data),
    slide_overrides: data.slideOverrides,
    status: data.status,
    signed_at: data.signedAt,
    agreement_id: data.agreementId,
    homeowner_id: data.homeownerId,
    property_id: data.propertyId,
    membership_id: data.membershipId,
    onboarding_status: data.onboardingStatus,
  };
}

function newPresentationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `pres_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function logCloudFallback(operation: string, error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error);
  console.warn(
    `[presentations] Supabase ${operation} failed — using local store: ${detail}`,
    error,
  );
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
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("presentations")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as PresentationRow[]).map(rowToPresentation);
}

async function getFromSupabase(id: string): Promise<PresentationData | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("presentations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? rowToPresentation(data as PresentationRow) : null;
}

async function saveToSupabase(data: PresentationData): Promise<PresentationData> {
  const supabase = createServerSupabaseClient();
  const row: Record<string, unknown> = {
    id: data.id,
    ...presentationToRow(data),
  };

  // Keep deploys safe while a newly added optional column is rolling out. The
  // relational columns still receive the draft; once the migration lands the
  // full editor snapshot becomes the authoritative recovery copy as well.
  for (let attemptIndex = 0; attemptIndex < 3; attemptIndex += 1) {
    const attempt = await supabase
      .from("presentations")
      .upsert(row, { onConflict: "id" })
      .select("*")
      .single();

    if (!attempt.error) {
      return rowToPresentation(attempt.data as PresentationRow);
    }

    const missingOptionalColumn = ["draft_payload", "enrollment_savings"].find(
      (column) =>
        column in row && isMissingColumnError(attempt.error.message, column),
    );
    if (!missingOptionalColumn) throw new Error(attempt.error.message);
    delete row[missingOptionalColumn];
  }

  throw new Error("Presentation could not be saved after schema fallback.");
}

function isMissingColumnError(message: string, column: string): boolean {
  return message.includes(column) && message.includes("does not exist");
}

export function createDefaultPresentation(input?: {
  clientName?: string;
  clientAddress?: string;
  clientEmail?: string;
  createdBy?: string;
  salesRepId?: string | null;
  salesRepLeadId?: string | null;
  tier?: PresentationTier;
  homeSqft?: number;
  quoteSnapshot?: PresentationQuoteSnapshot | null;
}): PresentationData {
  const tier = normalizePresentationTier(input?.tier ?? "quarterly");
  const homeSqft = input?.homeSqft ?? input?.quoteSnapshot?.sqft ?? 2500;
  const rates = withComputedRates({ tier, homeSqft });
  const now = new Date().toISOString();

  return {
    id: newPresentationId(),
    createdBy: input?.createdBy ?? "Team",
    salesRepId: input?.salesRepId ?? null,
    salesRepLeadId: input?.salesRepLeadId ?? null,
    clientName: input?.clientName ?? "New Client",
    clientAddress: input?.clientAddress ?? "",
    clientEmail: input?.clientEmail ?? "",
    homeSqft,
    twoStory: input?.quoteSnapshot?.twoStory ?? false,
    includeScreens: input?.quoteSnapshot?.includeScreens ?? false,
    includeInterior: input?.quoteSnapshot?.includeInterior ?? false,
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
    createdAt: now,
    updatedAt: now,
  };
}

export async function listPresentations(): Promise<PresentationData[]> {
  if (isCloudPersistenceConnected()) {
    try {
      return await listFromSupabase();
    } catch (error) {
      logCloudFallback("list", error);
    }
  }

  return listLocalPresentations();
}

export async function getPresentation(
  id: string,
): Promise<PresentationData | null> {
  let data: PresentationData | null = null;

  if (isCloudPersistenceConnected()) {
    try {
      data = await getFromSupabase(id);
    } catch (error) {
      logCloudFallback("get", error);
    }
  }

  if (!data) {
    data = await getLocalPresentation(id);
  }

  return data ? normalizePresentation(data) : null;
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
    try {
      return normalizePresentation(await saveToSupabase(merged));
    } catch (error) {
      // Never report a production draft as saved when it only reached this
      // server instance's temporary local store. The editor must surface the
      // failure and retain its recovery copy until Supabase accepts the save.
      throw error;
    }
  }

  return normalizePresentation(await saveLocalPresentation(merged));
}

export async function createPresentation(input?: {
  clientName?: string;
  clientAddress?: string;
  clientEmail?: string;
  createdBy?: string;
  salesRepId?: string | null;
  salesRepLeadId?: string | null;
  tier?: PresentationTier;
  homeSqft?: number;
  quoteSnapshot?: PresentationQuoteSnapshot | null;
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
      salesRepId: patch.salesRepId ?? null,
      salesRepLeadId: patch.salesRepLeadId ?? null,
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
