import type { EnrollmentPacketStatus } from "./types";

export type EnrollmentPacketProgressTone =
  | "neutral"
  | "accent"
  | "warning"
  | "success";

export interface EnrollmentPacketProgress {
  status: EnrollmentPacketStatus;
  eyebrow: string;
  title: string;
  detail: string;
  actionLabel: string;
  tone: EnrollmentPacketProgressTone;
  blocksNewSend: boolean;
}

const ENROLLMENT_PACKET_STATUSES = new Set<EnrollmentPacketStatus>([
  "draft",
  "signature_sent",
  "signature_complete",
  "payment_ready",
  "payment_sent",
  "payment_complete",
  "portal_ready",
  "needs_attention",
  "voided",
]);

const PROGRESS: Record<EnrollmentPacketStatus, EnrollmentPacketProgress> = {
  draft: {
    status: "draft",
    eyebrow: "Secure handoff prepared",
    title: "Finish sending the agreement.",
    detail:
      "HomeAtlas saved the packet, but it has not been proven delivered yet.",
    actionLabel: "Resume handoff",
    tone: "warning",
    blocksNewSend: false,
  },
  signature_sent: {
    status: "signature_sent",
    eyebrow: "Agreement sent",
    title: "Waiting on their signature.",
    detail:
      "DocuSign has the next move. Stripe stays separate until the agreement is complete.",
    actionLabel: "Check signature",
    tone: "accent",
    blocksNewSend: true,
  },
  signature_complete: {
    status: "signature_complete",
    eyebrow: "Agreement complete",
    title: "Signature secured. Card setup is next.",
    detail:
      "The signed agreement is recorded and HomeAtlas is preparing the separate Stripe step.",
    actionLabel: "Resume activation",
    tone: "success",
    blocksNewSend: true,
  },
  payment_ready: {
    status: "payment_ready",
    eyebrow: "Stripe handoff ready",
    title: "The secure card step is ready.",
    detail:
      "The agreement is complete and the Stripe-hosted setup can move forward.",
    actionLabel: "Resume activation",
    tone: "success",
    blocksNewSend: true,
  },
  payment_sent: {
    status: "payment_sent",
    eyebrow: "Stripe link sent",
    title: "Waiting on their card setup.",
    detail:
      "The Stripe-hosted link was sent. HomeAtlas never receives their card details.",
    actionLabel: "Check card setup",
    tone: "accent",
    blocksNewSend: true,
  },
  payment_complete: {
    status: "payment_complete",
    eyebrow: "Card secured",
    title: "Stripe has the payment method.",
    detail:
      "Card setup is complete. The customer record and portal are being finalized.",
    actionLabel: "Open activation",
    tone: "success",
    blocksNewSend: true,
  },
  portal_ready: {
    status: "portal_ready",
    eyebrow: "Enrollment complete",
    title: "Their HomeAtlas is ready.",
    detail:
      "Agreement, secure card setup, customer record, and portal are all connected.",
    actionLabel: "View customer setup",
    tone: "success",
    blocksNewSend: true,
  },
  needs_attention: {
    status: "needs_attention",
    eyebrow: "Handoff needs attention",
    title: "Repair this close before moving on.",
    detail:
      "HomeAtlas preserved the progress and stopped safely so the owner can resolve the provider step.",
    actionLabel: "Fix handoff",
    tone: "warning",
    blocksNewSend: false,
  },
  voided: {
    status: "voided",
    eyebrow: "Handoff voided",
    title: "A replacement packet is required.",
    detail:
      "The old packet cannot be reused. Review it in the Enrollment Desk before restarting.",
    actionLabel: "Review voided packet",
    tone: "warning",
    blocksNewSend: true,
  },
};

export function isEnrollmentPacketStatus(
  value: unknown,
): value is EnrollmentPacketStatus {
  return typeof value === "string" && ENROLLMENT_PACKET_STATUSES.has(
    value as EnrollmentPacketStatus,
  );
}

export function enrollmentPacketProgress(
  status: EnrollmentPacketStatus,
): EnrollmentPacketProgress {
  return PROGRESS[status];
}
