import {
  defaultAppointmentTypeForCadence,
  isMembershipAppointmentType,
  MEMBERSHIP_APPOINTMENT_TYPE,
  type MembershipAppointmentTypeId,
} from "@/lib/membership/membership-appointment-types";
import { normalizeToSqueegeeKingTier } from "@/lib/membership/tier-config";
import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import { createServerSupabaseClient } from "@/lib/persistence/supabase/client";
import { canScheduleMembership, isMembershipCancelled } from "@/lib/membership/membership-status";

export interface ScheduleMembershipServiceInput {
  membershipId: string;
  serviceDate: string;
  timeWindow?: string;
  note?: string;
  appointmentType?: MembershipAppointmentTypeId;
}

export interface ScheduleMembershipServiceResult {
  membershipId: string;
  appointmentId: string;
  scheduledAt: string;
  serviceMonth: string;
  timeWindow: string | null;
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

export function validateScheduleMembershipServiceInput(
  input: ScheduleMembershipServiceInput,
): string | null {
  if (!input.membershipId.trim()) {
    return "Membership ID is required";
  }
  const dateError = validateServiceDate(input.serviceDate);
  if (dateError) return dateError;
  if (
    input.appointmentType &&
    !isMembershipAppointmentType(input.appointmentType)
  ) {
    return "Appointment type is invalid";
  }
  return null;
}

function buildAppointmentNotes(
  note: string | undefined,
  timeWindow: string | undefined,
): string | null {
  const parts: string[] = [];
  const trimmedNote = note?.trim();
  const trimmedWindow = timeWindow?.trim();
  if (trimmedNote) parts.push(trimmedNote);
  if (trimmedWindow) parts.push(`Time window: ${trimmedWindow}`);
  return parts.length > 0 ? parts.join("\n") : null;
}

function serviceMonthFromDate(serviceDate: string): string {
  return `${serviceDate.slice(0, 7)}-01`;
}

function scheduledAtFromDate(serviceDate: string): string {
  return `${serviceDate}T09:00:00.000Z`;
}

export function parseTimeWindowFromNotes(notes: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/^Time window:\s*(.+)$/m);
  return match?.[1]?.trim() ?? null;
}

export function parseInternalNoteFromNotes(notes: string | null): string | null {
  if (!notes) return null;
  const lines = notes
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("Time window:"));
  return lines.length > 0 ? lines.join("\n") : null;
}

async function ensureMemberProfileId(
  homeownerId: string,
): Promise<string> {
  const supabase = createServerSupabaseClient();

  const { data: existing, error: existingError } = await supabase
    .from("member_profiles")
    .select("id")
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

export async function scheduleMembershipService(
  input: ScheduleMembershipServiceInput,
): Promise<ScheduleMembershipServiceResult> {
  if (!isCloudPersistenceConnected()) {
    throw new Error("Cloud persistence is not connected");
  }

  const validationError = validateScheduleMembershipServiceInput(input);
  if (validationError) {
    throw new Error(validationError);
  }

  const supabase = createServerSupabaseClient();
  const membershipId = input.membershipId.trim();
  const serviceDate = input.serviceDate.trim();
  const scheduledAt = scheduledAtFromDate(serviceDate);
  const serviceMonth = serviceMonthFromDate(serviceDate);
  const notes = buildAppointmentNotes(input.note, input.timeWindow);

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select(
      "id, homeowner_id, property_id, status, sales_tier, payment_setup_completed_at, stripe_payment_method_id",
    )
    .eq("id", membershipId)
    .maybeSingle();

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (!membership) {
    throw new Error("Membership not found");
  }

  if (isMembershipCancelled({ status: membership.status as string })) {
    throw new Error("Cancelled memberships cannot be scheduled");
  }

  const paymentOnFile = canScheduleMembership({
    status: membership.status as string,
    payment_setup_completed_at:
      (membership.payment_setup_completed_at as string | null) ?? null,
    stripe_payment_method_id:
      (membership.stripe_payment_method_id as string | null) ?? null,
  });

  if (!paymentOnFile) {
    throw new Error("Only active members with a card on file can be scheduled");
  }

  const memberProfileId = await ensureMemberProfileId(
    membership.homeowner_id as string,
  );

  const cadence = normalizeToSqueegeeKingTier(
    (membership.sales_tier as string | null) ?? "quarterly",
  );
  const serviceType =
    input.appointmentType ??
    defaultAppointmentTypeForCadence(cadence) ??
    MEMBERSHIP_APPOINTMENT_TYPE;

  const { data: existingAppointment, error: existingAppointmentError } =
    await supabase
      .from("member_appointments")
      .select("id")
      .eq("property_id", membership.property_id)
      .eq("status", "scheduled")
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(1)
      .maybeSingle();

  if (existingAppointmentError) {
    throw new Error(existingAppointmentError.message);
  }

  let appointmentId: string;

  if (existingAppointment?.id) {
    const { data: updated, error: updateError } = await supabase
      .from("member_appointments")
      .update({
        scheduled_at: scheduledAt,
        notes,
        service_type: serviceType,
      })
      .eq("id", existingAppointment.id)
      .select("id, scheduled_at")
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    appointmentId = updated.id as string;
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("member_appointments")
      .insert({
        member_profile_id: memberProfileId,
        property_id: membership.property_id,
        service_type: serviceType,
        scheduled_at: scheduledAt,
        status: "scheduled",
        notes,
      })
      .select("id, scheduled_at")
      .single();

    if (insertError) {
      throw new Error(insertError.message);
    }

    appointmentId = inserted.id as string;
  }

  const { error: membershipUpdateError } = await supabase
    .from("memberships")
    .update({ next_billing_date: serviceMonth })
    .eq("id", membershipId);

  if (membershipUpdateError) {
    if (!membershipUpdateError.message.includes("does not exist")) {
      throw new Error(membershipUpdateError.message);
    }
  }

  console.info("[schedule-membership-service]", {
    membershipId,
    appointmentId,
    scheduledAt,
    serviceMonth,
    propertyId: membership.property_id,
    homeownerId: membership.homeowner_id,
  });

  return {
    membershipId,
    appointmentId,
    scheduledAt,
    serviceMonth,
    timeWindow: input.timeWindow?.trim() || null,
  };
}
