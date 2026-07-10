import type { SqueegeeKingTierId } from "@/lib/membership/tier-config";
import { normalizeToSqueegeeKingTier } from "@/lib/membership/tier-config";
import { formatServiceTypeLabel } from "@/lib/membership/service-labels";

export const MEMBERSHIP_APPOINTMENT_TYPE = "home_care_visit" as const;

export type MembershipAppointmentTypeId =
  | typeof MEMBERSHIP_APPOINTMENT_TYPE
  | "exterior_windows"
  | "pressure_wash";

export interface MembershipAppointmentTypeOption {
  id: MembershipAppointmentTypeId;
  label: string;
  description: string;
}

/** HQ scheduling options — v1 defaults to membership service visit. */
export const HQ_MEMBERSHIP_APPOINTMENT_TYPES: MembershipAppointmentTypeOption[] =
  [
    {
      id: MEMBERSHIP_APPOINTMENT_TYPE,
      label: "Membership service",
      description: "Standard plan visit — windows and included home care",
    },
    {
      id: "exterior_windows",
      label: "Exterior window care",
      description: "Focused exterior window visit",
    },
    {
      id: "pressure_wash",
      label: "Exterior pressure wash",
      description: "Pressure wash add-on visit",
    },
  ];

export function defaultAppointmentTypeForCadence(
  _cadence: SqueegeeKingTierId,
): MembershipAppointmentTypeId {
  return MEMBERSHIP_APPOINTMENT_TYPE;
}

/**
 * HomeAtlas-facing visit label for the customer portal.
 * Quarterly / Bi-Annual language — not Jobber field-service wording.
 */
export function formatMembershipCareVisitLabel(
  cadenceInput: string | null | undefined,
  serviceType: string,
): string {
  const cadence = normalizeToSqueegeeKingTier(cadenceInput ?? "quarterly");

  if (serviceType === MEMBERSHIP_APPOINTMENT_TYPE) {
    if (cadence === "biannual") {
      return "Bi-Annual Exterior Window Care";
    }
    return "Quarterly Home Care Visit";
  }

  if (serviceType === "exterior_windows") {
    return cadence === "biannual"
      ? "Bi-Annual Exterior Window Care"
      : "Quarterly Exterior Window Care";
  }

  return formatServiceTypeLabel(serviceType);
}

export function isMembershipAppointmentType(
  value: string,
): value is MembershipAppointmentTypeId {
  return HQ_MEMBERSHIP_APPOINTMENT_TYPES.some((option) => option.id === value);
}
