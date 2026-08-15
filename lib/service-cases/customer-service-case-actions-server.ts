import "server-only";

import type { PortalAccessContext } from "@/lib/persistence/queries/portal-access";
import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import {
  isCustomerServiceCaseAction,
  isCustomerServiceCaseCategory,
  isUuid,
  type CustomerServiceCaseAction,
  type CustomerServiceCaseAdminView,
  type CustomerServiceCaseCategory,
  type CustomerServiceCasePortalView,
  type CustomerServiceCaseStatus,
} from "./customer-service-case";

const PORTAL_CASE_LIMIT = 12;
const MAX_OPEN_PORTAL_CASES = 5;

interface PortalServiceCaseRow {
  id: string;
  appointment_id: string | null;
  category: CustomerServiceCaseCategory;
  details: string;
  status: CustomerServiceCaseStatus;
  created_at: string;
  updated_at: string;
}

interface ServiceCaseRow extends PortalServiceCaseRow {
  membership_id: string;
  homeowner_id: string;
  property_id: string;
  client_request_id: string;
  owner_note: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
}

const PORTAL_SELECT =
  "id, appointment_id, category, details, status, created_at, updated_at";
const ADMIN_SELECT =
  "id, membership_id, homeowner_id, property_id, appointment_id, client_request_id, category, details, status, owner_note, acknowledged_at, resolved_at, created_at, updated_at";

export class CustomerServiceCaseActionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "CustomerServiceCaseActionError";
  }
}

function toPortalView(
  row: PortalServiceCaseRow,
): CustomerServiceCasePortalView {
  return {
    id: row.id,
    category: row.category,
    details: row.details,
    status: row.status,
    appointmentId: row.appointment_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listPortalServiceCases(
  access: PortalAccessContext,
): Promise<CustomerServiceCasePortalView[]> {
  const supabase = createServiceRoleSupabaseClient();
  const result = await supabase
    .from("customer_service_cases")
    .select(PORTAL_SELECT)
    .eq("membership_id", access.membershipId)
    .eq("homeowner_id", access.homeownerId)
    .eq("property_id", access.propertyId)
    .order("created_at", { ascending: false })
    .limit(PORTAL_CASE_LIMIT);
  if (result.error) throw new Error(result.error.message);
  return ((result.data ?? []) as PortalServiceCaseRow[]).map(toPortalView);
}

export async function createPortalServiceCase(input: {
  access: PortalAccessContext;
  clientRequestId: string;
  category: CustomerServiceCaseCategory;
  appointmentId?: string | null;
  details: string;
}): Promise<{ serviceCase: CustomerServiceCasePortalView; duplicate: boolean }> {
  const clientRequestId = input.clientRequestId?.trim().toLowerCase();
  const appointmentId = input.appointmentId?.trim().toLowerCase() || null;
  const details = input.details?.trim();
  if (!isUuid(clientRequestId)) {
    throw new CustomerServiceCaseActionError(
      "Please refresh and try again.",
      400,
      "invalid_request_id",
    );
  }
  if (!isCustomerServiceCaseCategory(input.category)) {
    throw new CustomerServiceCaseActionError(
      "Choose what you need help with.",
      400,
      "invalid_category",
    );
  }
  if (!details || details.length < 10 || details.length > 2000) {
    throw new CustomerServiceCaseActionError(
      "Tell us what happened in 10 to 2,000 characters.",
      400,
      "invalid_details",
    );
  }
  if (appointmentId && !isUuid(appointmentId)) {
    throw new CustomerServiceCaseActionError(
      "Choose a valid visit.",
      400,
      "invalid_appointment",
    );
  }

  const supabase = createServiceRoleSupabaseClient();
  const priorRequest = await supabase
    .from("customer_service_cases")
    .select(PORTAL_SELECT)
    .eq("membership_id", input.access.membershipId)
    .eq("client_request_id", clientRequestId)
    .maybeSingle();
  if (priorRequest.error) throw new Error(priorRequest.error.message);
  if (priorRequest.data) {
    return {
      serviceCase: toPortalView(
        priorRequest.data as PortalServiceCaseRow,
      ),
      duplicate: true,
    };
  }

  const capacity = await supabase
    .from("customer_service_cases")
    .select("id")
    .eq("membership_id", input.access.membershipId)
    .in("status", ["open", "acknowledged"])
    .limit(MAX_OPEN_PORTAL_CASES);
  if (capacity.error) throw new Error(capacity.error.message);
  if ((capacity.data ?? []).length >= MAX_OPEN_PORTAL_CASES) {
    throw new CustomerServiceCaseActionError(
      "You already have several open care requests. Our team needs to finish those before another is added.",
      429,
      "open_case_limit",
    );
  }

  if (appointmentId) {
    const appointment = await supabase
      .from("member_appointments")
      .select("id")
      .eq("id", appointmentId)
      .eq("property_id", input.access.propertyId)
      .maybeSingle();
    if (appointment.error) throw new Error(appointment.error.message);
    if (!appointment.data) {
      throw new CustomerServiceCaseActionError(
        "That visit is not part of this home’s care record.",
        400,
        "appointment_not_available",
      );
    }
  }

  const payload = {
    membership_id: input.access.membershipId,
    homeowner_id: input.access.homeownerId,
    property_id: input.access.propertyId,
    appointment_id: appointmentId,
    client_request_id: clientRequestId,
    category: input.category,
    details,
    status: "open" as const,
    source: "member_portal" as const,
  };
  const saved = await supabase
    .from("customer_service_cases")
    .upsert(payload, {
      onConflict: "membership_id,client_request_id",
      ignoreDuplicates: true,
    })
    .select(PORTAL_SELECT)
    .maybeSingle();
  if (saved.error) throw new Error(saved.error.message);
  if (saved.data) {
    return {
      serviceCase: toPortalView(saved.data as PortalServiceCaseRow),
      duplicate: false,
    };
  }

  const existing = await supabase
    .from("customer_service_cases")
    .select(PORTAL_SELECT)
    .eq("membership_id", input.access.membershipId)
    .eq("client_request_id", clientRequestId)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (!existing.data) throw new Error("The service request could not be saved.");
  return {
    serviceCase: toPortalView(existing.data as PortalServiceCaseRow),
    duplicate: true,
  };
}

function desiredStatus(action: CustomerServiceCaseAction): CustomerServiceCaseStatus {
  if (action === "acknowledge") return "acknowledged";
  return action === "resolve" ? "resolved" : "dismissed";
}

function toAdminRecord(row: ServiceCaseRow): CustomerServiceCaseAdminView {
  return {
    ...toPortalView(row),
    membershipId: row.membership_id,
    homeownerId: row.homeowner_id,
    propertyId: row.property_id,
    homeownerName: "HomeAtlas member",
    propertyLabel: "HomeAtlas property",
    ownerNote: row.owner_note,
    acknowledgedAt: row.acknowledged_at,
    resolvedAt: row.resolved_at,
  };
}

export async function recordCustomerServiceCaseAction(input: {
  caseId: string;
  action: CustomerServiceCaseAction;
  note?: string | null;
}, referenceDate = new Date()): Promise<{
  serviceCase: CustomerServiceCaseAdminView;
  duplicate: boolean;
}> {
  const caseId = input.caseId?.trim().toLowerCase();
  const note = input.note?.trim() || null;
  if (!isUuid(caseId)) {
    throw new CustomerServiceCaseActionError(
      "Choose a valid service case.",
      400,
      "invalid_case",
    );
  }
  if (!isCustomerServiceCaseAction(input.action)) {
    throw new CustomerServiceCaseActionError(
      "Choose a valid case action.",
      400,
      "invalid_action",
    );
  }
  if (note && note.length > 1000) {
    throw new CustomerServiceCaseActionError(
      "Keep the private case note to 1,000 characters or fewer.",
      400,
      "note_too_long",
    );
  }
  if (input.action === "dismiss" && !note) {
    throw new CustomerServiceCaseActionError(
      "Add a private note before closing this without resolution.",
      400,
      "dismissal_note_required",
    );
  }

  const supabase = createServiceRoleSupabaseClient();
  const currentResult = await supabase
    .from("customer_service_cases")
    .select(ADMIN_SELECT)
    .eq("id", caseId)
    .maybeSingle();
  if (currentResult.error) throw new Error(currentResult.error.message);
  if (!currentResult.data) {
    throw new CustomerServiceCaseActionError(
      "This service case no longer exists.",
      404,
      "case_not_found",
    );
  }
  const current = currentResult.data as ServiceCaseRow;
  const nextStatus = desiredStatus(input.action);
  if (current.status === nextStatus) {
    return { serviceCase: toAdminRecord(current), duplicate: true };
  }
  if (current.status === "resolved" || current.status === "dismissed") {
    throw new CustomerServiceCaseActionError(
      "This service case is already closed.",
      409,
      "case_already_closed",
    );
  }

  const now = referenceDate.toISOString();
  const final = nextStatus === "resolved" || nextStatus === "dismissed";
  const updated = await supabase
    .from("customer_service_cases")
    .update({
      status: nextStatus,
      owner_note: note ?? current.owner_note,
      handled_by: "HQ owner",
      acknowledged_at: current.acknowledged_at ?? now,
      resolved_at: final ? now : null,
    })
    .eq("id", caseId)
    .eq("status", current.status)
    .select(ADMIN_SELECT)
    .maybeSingle();
  if (updated.error) throw new Error(updated.error.message);
  if (!updated.data) {
    throw new CustomerServiceCaseActionError(
      "This service case changed while you were working. Refresh and try again.",
      409,
      "case_changed",
    );
  }
  return {
    serviceCase: toAdminRecord(updated.data as ServiceCaseRow),
    duplicate: false,
  };
}
