import type { SalesRepProfile } from "./rep-config";

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

export interface SalesRepLead {
  id: string;
  fullName: string;
  propertyAddress: string;
  phone: string | null;
  email: string | null;
  status: SalesLeadStatus;
  estimatedArrCents: number;
  nextFollowUpAt: string | null;
  notes: string;
  smsConsentStatus: ContactConsentStatus;
  emailConsentStatus: ContactConsentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SalesWorkspaceMetrics {
  doorsToday: number;
  conversationsToday: number;
  presentationsToday: number;
  leadsToday: number;
  signedToday: number;
  openPipelineCount: number;
  pipelineArrCents: number;
  qualifiedRetainedMembers: number;
}

export interface SalesWorkspacePayload {
  profile: SalesRepProfile;
  metrics: SalesWorkspaceMetrics;
  leads: SalesRepLead[];
  generatedAt: string;
}

export interface CreateSalesLeadInput {
  fullName: string;
  propertyAddress: string;
  phone?: string | null;
  email?: string | null;
  estimatedArrDollars?: number;
  nextFollowUpAt?: string | null;
  notes?: string | null;
  smsConsentAttested?: boolean;
  emailConsentAttested?: boolean;
}

export interface CreateSalesActivityInput {
  activityType: SalesActivityType;
  quantity?: number;
  leadId?: string | null;
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
  | { kind: "activity"; activity: CreateSalesActivityInput }
  | { kind: "undo_activity"; activityId: string };
