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
  liveApproved: string;
  releaseMode: string;
  rehearsalEmail: string;
  rehearsalConfirmed: string;
}

const RELEASE_MODE_ENV = "HOMEATLAS_ENROLLMENT_RELEASE_MODE";
const REHEARSAL_EMAIL_ENV = "HOMEATLAS_ENROLLMENT_REHEARSAL_EMAIL";
const REHEARSAL_CONFIRMED_ENV = "HOMEATLAS_ENROLLMENT_REHEARSAL_CONFIRMED";
const LIVE_APPROVED_ENV = "HOMEATLAS_ENROLLMENT_LIVE_APPROVED";

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function resolveConfig(
  overrides: Partial<EnrollmentReleaseControlConfig> = {},
): EnrollmentReleaseControlConfig {
  return {
    liveApproved: overrides.liveApproved === undefined
      ? env(LIVE_APPROVED_ENV) : overrides.liveApproved.trim(),
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
  const liveApproved = config.liveApproved.toLowerCase() === "true";
  const liveReady = liveApproved || (rehearsalConfirmed && Boolean(rehearsalEmail));
  const missing = [
    ...(!validMode ? [RELEASE_MODE_ENV] : []),
    ...(!rehearsalEmail && !(mode === "live" && liveApproved) ? [REHEARSAL_EMAIL_ENV] : []),
    ...(mode === "live" && !liveApproved && !rehearsalConfirmed
      ? [REHEARSAL_CONFIRMED_ENV]
      : []),
  ];
  const ready = validMode && (mode === "live" ? liveReady : Boolean(rehearsalEmail));

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
        : liveApproved
          ? "Live enrollment is explicitly approved by the owner. Rehearsal completion is not claimed; signing, card setup, and billing controls remain separate."
        : rehearsalConfirmed && rehearsalEmail
          ? "Live mode is explicitly confirmed after a business-owned rehearsal. Recipient-specific safeguards remain active."
          : "Live mode remains blocked until a business-owned rehearsal is confirmed or the owner explicitly approves live enrollment.",
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
        : "Live enrollment sending is explicitly enabled. Signing, card setup, and billing controls remain separate.",
  };
}
