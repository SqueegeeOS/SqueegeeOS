export const AUTHORITATIVE_APPOINTMENT_PROVIDER = "jobber" as const;
export const AUTHORITATIVE_APPOINTMENT_PROVENANCE_STATES = [
  "provider_imported",
  "manually_verified",
] as const;
export const AUTHORITATIVE_APPOINTMENT_VERIFICATION_STATE = "verified" as const;
export const AUTHORITATIVE_APPOINTMENT_MATCH_STATE = "matched" as const;
export const HOMEATLAS_NATIVE_SCHEDULING_ENABLED = false as const;

export interface AppointmentProvenance {
  provider: string | null;
  externalId: string | null;
  provenanceState:
    | "homeatlas_legacy_unverified"
    | "provider_imported"
    | "manually_verified";
  verificationState: "unverified" | "pending_review" | "verified" | "rejected";
  matchState: "manual_review" | "unmatched" | "matched" | "ignored";
}

export function isAuthoritativeProviderAppointment(
  appointment: AppointmentProvenance,
): boolean {
  const hasAuthoritativeProvenance =
    appointment.provenanceState === "provider_imported" ||
    appointment.provenanceState === "manually_verified";

  return Boolean(
    hasAuthoritativeProvenance &&
      appointment.verificationState ===
        AUTHORITATIVE_APPOINTMENT_VERIFICATION_STATE &&
      appointment.matchState === AUTHORITATIVE_APPOINTMENT_MATCH_STATE &&
      appointment.provider?.trim().toLowerCase() ===
        AUTHORITATIVE_APPOINTMENT_PROVIDER &&
      appointment.externalId?.trim(),
  );
}

export function canAppearAsProviderConfirmed(
  appointment: AppointmentProvenance,
): boolean {
  return isAuthoritativeProviderAppointment(appointment);
}

export function classifyExistingAppointment(): AppointmentProvenance {
  return {
    provider: null,
    externalId: null,
    provenanceState: "homeatlas_legacy_unverified",
    verificationState: "unverified",
    matchState: "manual_review",
  };
}
