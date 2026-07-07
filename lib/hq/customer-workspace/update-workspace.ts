import type { LeadIntakeRecord } from "@/lib/acquisition/lead-record";
import { updateLeadIntakeStatus } from "@/lib/acquisition/leads/repository";
import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import { createServerSupabaseClient } from "@/lib/persistence/supabase/client";
import { patchPresentation } from "@/lib/presentations/repository";

export async function updateLeadIntakeFields(
  id: string,
  fields: Partial<
    Pick<
      LeadIntakeRecord,
      | "name"
      | "phone"
      | "email"
      | "serviceAddress"
      | "notes"
      | "status"
    >
  >,
): Promise<LeadIntakeRecord | null> {
  if (fields.status) {
    return updateLeadIntakeStatus(id, fields.status);
  }

  if (!isCloudPersistenceConnected()) return null;
  const supabase = createServerSupabaseClient();

  const row: Record<string, unknown> = {};
  if (fields.name !== undefined) row.name = fields.name.trim();
  if (fields.phone !== undefined) row.phone = fields.phone.trim();
  if (fields.email !== undefined) row.email = fields.email.trim();
  if (fields.serviceAddress !== undefined) {
    row.service_address = fields.serviceAddress.trim();
  }
  if (fields.notes !== undefined) row.notes = fields.notes.trim();

  if (Object.keys(row).length === 0) {
    return null;
  }

  const { data, error } = await supabase
    .from("lead_intakes")
    .update(row)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: data.id as string,
    name: data.name as string,
    phone: data.phone as string,
    email: data.email as string,
    serviceAddress: data.service_address as string,
    servicesInterested:
      data.services_interested as LeadIntakeRecord["servicesInterested"],
    preferredContactMethod:
      data.preferred_contact_method as LeadIntakeRecord["preferredContactMethod"],
    notes: data.notes as string,
    membershipTier: data.membership_tier as LeadIntakeRecord["membershipTier"],
    squareFootage: data.square_footage as number | null,
    estimatedVisitPrice: data.estimated_visit_price as number | null,
    preferredStartWindow: data.preferred_start_window as string | null,
    status: data.status as LeadIntakeRecord["status"],
    submittedAt: data.submitted_at as string,
    source: "request_form",
  };
}

export async function updateHomeownerFields(
  homeownerId: string,
  fields: {
    fullName?: string;
    email?: string | null;
    phone?: string | null;
  },
): Promise<void> {
  if (!isCloudPersistenceConnected()) return;
  const supabase = createServerSupabaseClient();
  const row: Record<string, unknown> = {};
  if (fields.fullName !== undefined) {
    row.full_name = fields.fullName.trim();
    row.first_name = fields.fullName.trim().split(/\s+/)[0] ?? fields.fullName;
  }
  if (fields.email !== undefined) row.email = fields.email?.trim() || null;
  if (fields.phone !== undefined) row.phone = fields.phone?.trim() || null;

  if (Object.keys(row).length === 0) return;

  const { error } = await supabase
    .from("homeowners")
    .update(row)
    .eq("id", homeownerId);
  if (error) throw new Error(error.message);
}

export async function updatePropertyFields(
  propertyId: string,
  fields: {
    name?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    squareFeet?: number | null;
  },
): Promise<void> {
  if (!isCloudPersistenceConnected()) return;
  const supabase = createServerSupabaseClient();
  const row: Record<string, unknown> = {};
  if (fields.name !== undefined) row.name = fields.name.trim();
  if (fields.address !== undefined) row.address = fields.address.trim();
  if (fields.city !== undefined) row.city = fields.city.trim();
  if (fields.state !== undefined) row.state = fields.state.trim();
  if (fields.zip !== undefined) row.zip = fields.zip.trim();
  if (fields.squareFeet !== undefined) row.square_feet = fields.squareFeet;

  if (Object.keys(row).length === 0) return;

  const { error } = await supabase.from("properties").update(row).eq("id", propertyId);
  if (error) throw new Error(error.message);
}

export async function updatePresentationNotes(
  presentationId: string,
  customNotes: string,
): Promise<void> {
  await patchPresentation(presentationId, { customNotes });
}
