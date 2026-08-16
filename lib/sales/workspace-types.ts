import type { SalesRepProfile } from "./rep-config";
import type { SalesRepLaunchCountsEvidence } from "./rep-launch-readiness";
import type { SalesProductionHandoffRecord } from "./production-handoff";
import type { SalesDoorDisposition } from "./door-memory";
import type { SalesLeadCloseJourney } from "./lead-close-journey";
import type { SalesServiceInterest } from "./service-interests";

export const SALES_ACTIVITY_TYPES = [
  "door_knock",
  "conversation",
  "presentation_started",
  "follow_up_scheduled",
  "lead_captured",
  "membership_signed",
] as const;

export type SalesActivityType = (typeof SALES_ACTIVITY_TYPES)[number];

export const SALES_LEAD_STATUSES = [
  "new",
  "follow_up",
  "presentation",
  "considering",
  "signed",
  "won",
  "lost",
] as const;

export type SalesLeadStatus = (typeof SALES_LEAD_STATUSES)[number];
export type ContactConsentStatus = "unknown" | "opted_in" | "opted_out";

export const SALES_LEAD_INTERACTION_CHANNELS = [
  "call",
  "email",
  "sms",
  "in_person",
] as const;

export type SalesLeadInteractionChannel =
  (typeof SALES_LEAD_INTERACTION_CHANNELS)[number];

export const SALES_LEAD_INTERACTION_OUTCOMES = [
  "no_answer",
  "spoke_follow_up",
  "presentation_scheduled",
  "not_interested",
] as const;

export type SalesLeadInteractionOutcome =
  (typeof SALES_LEAD_INTERACTION_OUTCOMES)[number];

export interface SalesLeadInteraction {
  id: string;
  leadId: string;
  recordedBy: "owner" | "sales_rep";
  channel: SalesLeadInteractionChannel;
  outcome: SalesLeadInteractionOutcome;
  note: string;
  previousStatus: Extract<
    SalesLeadStatus,
    "new" | "follow_up" | "presentation" | "considering"
  >;
  resultingStatus: Extract<
    SalesLeadStatus,
    "follow_up" | "presentation" | "considering" | "lost"
  >;
  previousNextFollowUpAt: string | null;
  nextFollowUpAt: string | null;
  occurredAt: string;
}
export type SalesLeadSource =
  | "door_to_door"
  | "referral"
  | "event"
  | "manual"
  | "request_form"
  | "facebook_lead_ad";

export interface SalesRepLead {
  id: string;
  leadIntakeId: string | null;
  fullName: string;
  propertyAddress: string;
  phone: string | null;
  email: string | null;
  status: SalesLeadStatus;
  source: SalesLeadSource;
  /** Services discussed, not quoted or contractually included. */
  serviceInterests: SalesServiceInterest[];
  estimatedArrCents: number;
  nextFollowUpAt: string | null;
  notes: string;
  smsConsentStatus: ContactConsentStatus;
  emailConsentStatus: ContactConsentStatus;
  closeJourney: SalesLeadCloseJourney | null;
  recentInteractions: SalesLeadInteraction[];
  createdAt: string;
  updatedAt: string;
}

export interface SalesWorkspaceMetrics {
  doorsToday: number;
  conversationsToday: number;
  presentationsToday: number;
  leadsToday: number;
  signedToday: number;
  closedArrTodayCents: number;
  closedArrCents: number;
  openPipelineCount: number;
  pipelineArrCents: number;
  qualifiedRetainedMembers: number;
}

export interface SalesRepRecentWin {
  id: string;
  presentationId: string | null;
  fullName: string;
  propertyAddress: string;
  attributedArrCents: number;
  status: "pending" | "active" | "qualified";
  attributedAt: string;
  productionHandoff: SalesProductionHandoffRecord | null;
}

export interface SalesDoorMemory {
  id: string;
  leadId: string | null;
  propertyAddress: string;
  disposition: SalesDoorDisposition;
  notes: string;
  occurredAt: string;
}

export interface SalesWorkspacePayload {
  profile: SalesRepProfile;
  launchEvidence: SalesRepLaunchCountsEvidence;
  metrics: SalesWorkspaceMetrics;
  leads: SalesRepLead[];
  recentDoorMemories: SalesDoorMemory[];
  recentDoorMemoriesStatus: "complete" | "unavailable";
  recentWins: SalesRepRecentWin[];
  recentWinsStatus: "complete" | "unavailable";
  productionHandoffStatus: "complete" | "unavailable";
  closeLedgerStatus: "complete" | "needs_attention";
  generatedAt: string;
}

export interface SalesLeadAttentionSnapshot {
  profile: SalesRepProfile;
  leads: SalesRepLead[];
  generatedAt: string;
}

export interface CreateSalesLeadInput {
  /** Device-generated UUID. Retrying this capture must resolve to one lead. */
  clientEventId: string;
  fullName: string;
  propertyAddress: string;
  phone?: string | null;
  email?: string | null;
  serviceInterests?: SalesServiceInterest[];
  estimatedArrDollars?: number;
  nextFollowUpAt?: string | null;
  notes?: string | null;
  smsConsentAttested?: boolean;
  emailConsentAttested?: boolean;
  /** Optional saved door-memory UUID carried into the new homeowner record. */
  doorMemoryClientEventId?: string | null;
}

export interface SalesLeadCaptureReceipt {
  lead: SalesRepLead;
  status: "created" | "already_saved";
}

export interface UpdateSalesLeadInput {
  leadId: string;
  status: Extract<
    SalesLeadStatus,
    "new" | "follow_up" | "presentation" | "considering" | "lost"
  >;
  estimatedArrDollars: number;
  serviceInterests?: SalesServiceInterest[];
  nextFollowUpAt?: string | null;
  notes?: string | null;
}

export interface RecordSalesLeadInteractionInput {
  leadId: string;
  clientEventId: string;
  channel: SalesLeadInteractionChannel;
  outcome: SalesLeadInteractionOutcome;
  note?: string | null;
  nextFollowUpAt?: string | null;
  expectedLeadUpdatedAt: string;
}

export interface SalesLeadInteractionReceipt {
  interaction: SalesLeadInteraction;
  lead: SalesRepLead;
}

export interface CreateSalesActivityInput {
  activityType: SalesActivityType;
  quantity?: number;
  leadId?: string | null;
  /** Device-generated UUID used to make weak-network retries idempotent. */
  clientEventId?: string | null;
  /** Device event time; accepted only inside the bounded field queue window. */
  occurredAt?: string | null;
}

export interface CreateSalesDoorMemoryInput {
  /** Client UUID of the door_knock activity this outcome describes. */
  doorActivityClientEventId: string;
  /** Separate device UUID used to make this outcome retry idempotent. */
  clientEventId: string;
  propertyAddress: string;
  disposition: SalesDoorDisposition;
  notes?: string | null;
  leadId?: string | null;
}

export interface SalesDoorMemoryReceipt extends SalesDoorMemory {
  doorActivityId: string;
}

export interface SalesActivityReceipt {
  id: string;
  activityType: SalesActivityType;
  quantity: number;
  occurredAt: string;
  undoExpiresAt: string | null;
}

export interface SalesActivityReversalReceipt {
  id: string;
  activityType: SalesActivityType;
  quantity: number;
  occurredAt: string;
  reversedAt: string;
}

export type SalesWorkspaceCommand =
  | { kind: "lead"; lead: CreateSalesLeadInput }
  | { kind: "update_lead"; lead: UpdateSalesLeadInput }
  | { kind: "lead_interaction"; interaction: RecordSalesLeadInteractionInput }
  | { kind: "activity"; activity: CreateSalesActivityInput }
  | { kind: "door_memory"; memory: CreateSalesDoorMemoryInput }
  | { kind: "undo_activity"; activityId: string };
