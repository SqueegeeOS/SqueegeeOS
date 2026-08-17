import "server-only";

import { normalizeEnrollmentEmail } from "./document-snapshot";

export type EnrollmentReleaseMode = "rehearsal" | "live";

export interface EnrollmentReleaseControlState {
  mode: EnrollmentReleaseMode;
  ready: boolean;
  rehearsalRecipientConfigured: boolean;
  rehearsalRecipientHint: string | null;
  rehearsalConfirmed: boolean;
  detail: string;
  missing: string[];
}

export interface EnrollmentRecipientGate {
  allowed: boolean;
  mode: EnrollmentReleaseMode;
  detail: string;
}

interface EnrollmentReleaseControlConfig {
  releaseMode: string;
  rehearsalEmail: string;
  rehearsalConfirmed: string;
}

const RELEASE_MODE_ENV = "HOMEATLAS_ENROLLMENT_RELEASE_MODE";
const REHEARSAL_EMAIL_ENV = "HOMEATLAS_ENROLLMENT_REHEARSAL_EMAIL";
const REHEARSAL_CONFIRMED_ENV = "HOMEATLAS_ENROLLMENT_REHEARSAL_CONFIRMED";

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function resolveConfig(
  overrides: Partial<EnrollmentReleaseControlConfig> = {},
): EnrollmentReleaseControlConfig {
  return {
    releaseMode:
      overrides.releaseMode === undefined
        ? env(RELEASE_MODE_ENV)
        : overrides.releaseMode.trim(),
    rehearsalEmail:
      overrides.rehearsalEmail === undefined
        ? env(REHEARSAL_EMAIL_ENV)
        : overrides.rehearsalEmail.trim(),
    rehearsalConfirmed:
      overrides.rehearsalConfirmed === undefined
        ? env(REHEARSAL_CONFIRMED_ENV)
        : overrides.rehearsalConfirmed.trim(),
  };
}

function recipientHint(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${local.length > visible.length ? "***" : ""}@${domain}`;
}

export function getEnrollmentReleaseControlState(
  overrides: Partial<EnrollmentReleaseControlConfig> = {},
): EnrollmentReleaseControlState {
  const config = resolveConfig(overrides);
  const rawMode = config.releaseMode.toLowerCase();
  const validMode = rawMode === "" || rawMode === "rehearsal" || rawMode === "live";
  const mode: EnrollmentReleaseMode = rawMode === "live" ? "live" : "rehearsal";
  const rehearsalEmail = normalizeEnrollmentEmail(config.rehearsalEmail);
  const rehearsalConfirmed = config.rehearsalConfirmed.toLowerCase() === "true";
  const missing = [
    ...(!validMode ? [RELEASE_MODE_ENV] : []),
    ...(!rehearsalEmail ? [REHEARSAL_EMAIL_ENV] : []),
    ...(mode === "live" && !rehearsalConfirmed
      ? [REHEARSAL_CONFIRMED_ENV]
      : []),
  ];
  const ready = validMode && Boolean(rehearsalEmail) &&
    (mode === "rehearsal" || rehearsalConfirmed);

  return {
    mode,
    ready,
    rehearsalRecipientConfigured: Boolean(rehearsalEmail),
    rehearsalRecipientHint: rehearsalEmail ? recipientHint(rehearsalEmail) : null,
    rehearsalConfirmed,
    detail: !validMode
      ? "The enrollment release mode is invalid, so customer sends remain blocked."
      : mode === "rehearsal"
        ? rehearsalEmail
          ? `Rehearsal mode is locked to ${recipientHint(rehearsalEmail)}; every other recipient is blocked before any packet write or provider call.`
          : "Rehearsal mode is active. Add one business-controlled email before any envelope can be created."
        : rehearsalConfirmed && rehearsalEmail
          ? "Live mode is explicitly confirmed after a business-owned rehearsal. Recipient-specific safeguards remain active."
          : "Live mode remains blocked until a business-owned rehearsal address is recorded and the rehearsal is explicitly confirmed.",
    missing,
  };
}

export function getEnrollmentRecipientGate(
  recipientEmail: string,
  overrides: Partial<EnrollmentReleaseControlConfig> = {},
): EnrollmentRecipientGate {
  const state = getEnrollmentReleaseControlState(overrides);
  const recipient = normalizeEnrollmentEmail(recipientEmail);
  const config = resolveConfig(overrides);
  const rehearsalRecipient = normalizeEnrollmentEmail(config.rehearsalEmail);

  if (!recipient) {
    return {
      allowed: false,
      mode: state.mode,
      detail: "A valid customer email is required before the enrollment handoff can run.",
    };
  }
  if (!state.ready) {
    return {
      allowed: false,
      mode: state.mode,
      detail: state.detail,
    };
  }
  if (state.mode === "rehearsal" && recipient !== rehearsalRecipient) {
    return {
      allowed: false,
      mode: state.mode,
      detail:
        "Rehearsal mode blocks this recipient. Use only the configured business-controlled rehearsal address.",
    };
  }
  return {
    allowed: true,
    mode: state.mode,
    detail:
      state.mode === "rehearsal"
        ? "This recipient matches the configured business-controlled rehearsal address."
        : "Live enrollment sending is explicitly enabled after the recorded rehearsal.",
  };
}
