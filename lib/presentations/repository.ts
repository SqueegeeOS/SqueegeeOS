import {
  createServerSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";
import { withComputedRates } from "./calculations";
import { normalizePresentationTier } from "./types";
import type {
  PresentationData,
  PresentationInput,
  PresentationStatus,
  PresentationTier,
  SlideOverride,
  SlideType,
} from "./types";

interface PresentationRow {
  id: string;
  created_by: string | null;
  client_name: string;
  client_address: string | null;
  client_email: string | null;
  home_sqft: number;
  tier: PresentationTier;
  monthly_rate: number;
  annual_rate: number;
  retail_value: number;
  custom_notes: string | null;
  slide_overrides: Partial<Record<SlideType, SlideOverride>> | null;
  status: PresentationStatus;
  signed_at: string | null;
  agreement_id: string | null;
  created_at: string;
  updated_at: string;
}

const memoryStore = new Map<string, PresentationData>();

function rowToPresentation(row: PresentationRow): PresentationData {
  return {
    id: row.id,
    createdBy: row.created_by ?? "Team",
    clientName: row.client_name,
    clientAddress: row.client_address ?? "",
    clientEmail: row.client_email ?? "",
    homeSqft: row.home_sqft,
    tier: normalizePresentationTier(row.tier),
    monthlyRate: Number(row.monthly_rate),
    annualRate: Number(row.annual_rate),
    retailValue: Number(row.retail_value),
    customNotes: row.custom_notes ?? "",
    slideOverrides: row.slide_overrides ?? {},
    status: row.status,
    signedAt: row.signed_at,
    agreementId: row.agreement_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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
    annual_rate: data.annualRate,
    retail_value: data.retailValue,
    custom_notes: data.customNotes || null,
    slide_overrides: data.slideOverrides,
    status: data.status,
    signed_at: data.signedAt,
    agreement_id: data.agreementId,
  };
}

function newPresentationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `pres_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createDefaultPresentation(input?: {
  clientName?: string;
  createdBy?: string;
  tier?: PresentationTier;
}): PresentationData {
  const tier = normalizePresentationTier(input?.tier ?? "quarterly");
  const homeSqft = 2500;
  const rates = withComputedRates({ tier, homeSqft });
  const now = new Date().toISOString();

  return {
    id: newPresentationId(),
    createdBy: input?.createdBy ?? "Team",
    clientName: input?.clientName ?? "New Client",
    clientAddress: "",
    clientEmail: "",
    homeSqft,
    tier,
    ...rates,
    customNotes: "",
    slideOverrides: {},
    status: "draft",
    signedAt: null,
    agreementId: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function listPresentations(): Promise<PresentationData[]> {
  if (isSupabaseConfigured()) {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("presentations")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) throw new Error(error.message);
    return ((data ?? []) as PresentationRow[]).map(rowToPresentation);
  }

  return Array.from(memoryStore.values()).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

export async function getPresentation(
  id: string,
): Promise<PresentationData | null> {
  if (isSupabaseConfigured()) {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("presentations")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? rowToPresentation(data as PresentationRow) : null;
  }

  return memoryStore.get(id) ?? null;
}

export async function savePresentation(
  data: PresentationData,
): Promise<PresentationData> {
  const rates = withComputedRates(data);
  const merged: PresentationData = {
    ...data,
    ...rates,
    updatedAt: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    const supabase = createServerSupabaseClient();
    const { data: row, error } = await supabase
      .from("presentations")
      .upsert(
        {
          id: merged.id,
          ...presentationToRow(merged),
        },
        { onConflict: "id" },
      )
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return rowToPresentation(row as PresentationRow);
  }

  memoryStore.set(merged.id, merged);
  return merged;
}

export async function createPresentation(input?: {
  clientName?: string;
  createdBy?: string;
}): Promise<PresentationData> {
  const record = createDefaultPresentation(input);
  return savePresentation(record);
}

export async function patchPresentation(
  id: string,
  patch: Partial<PresentationData>,
): Promise<PresentationData | null> {
  const existing = await getPresentation(id);
  if (!existing) return null;

  const merged: PresentationData = {
    ...existing,
    ...patch,
    id: existing.id,
    updatedAt: new Date().toISOString(),
  };

  return savePresentation(merged);
}
