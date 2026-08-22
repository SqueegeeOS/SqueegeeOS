import type { ContactMethod, ServiceOption } from "./types";
import type { SqueegeeKingTierId } from "@/lib/membership/tier-config";

/**
 * `scheduled` is the persisted quote/presentation stage and `archived` is the
 * persisted lost stage. The legacy values stay stable so existing records and
 * presentation links do not need a risky data rewrite.
 */
export type LeadIntakeStatus =
  | "new"
  | "contacted"
  | "scheduled"
  | "booked"
  | "archived";
export type SmsConsentStatus = "unknown" | "opted_in" | "opted_out";
export type LeadIntakeSource = "request_form" | "facebook_lead_ad";

export const SMS_CONSENT_DISCLOSURE_VERSION =
  "request-form-transactional-v1";

export function smsConsentStatusForLead(
  preferredContactMethod: ContactMethod,
  smsConsent: boolean,
): SmsConsentStatus {
  return preferredContactMethod === "Text" && smsConsent
    ? "opted_in"
    : "unknown";
}

export interface LeadIntakeRecord {
  id: string;
  name: string;
  phone: string;
  email: string;
  serviceAddress: string;
  servicesInterested: ServiceOption[];
  preferredContactMethod: ContactMethod;
  smsConsentStatus: SmsConsentStatus;
  smsConsentRecordedAt: string | null;
  notes: string;
  membershipTier: SqueegeeKingTierId | null;
  squareFootage: number | null;
  estimatedVisitPrice: number | null;
  preferredStartWindow: string | null;
  status: LeadIntakeStatus;
  submittedAt: string;
  source: LeadIntakeSource;
  clientSubmissionId: string | null;
  externalLeadId: string | null;
  sourcePageId: string | null;
  sourceFormId: string | null;
  sourceCampaignId: string | null;
  sourceCampaignName: string | null;
  sourceAdsetId: string | null;
  sourceAdsetName: string | null;
  sourceAdId: string | null;
  sourceAdName: string | null;
}

export interface CreateLeadIntakeInput {
  name: string;
  phone: string;
  email: string;
  serviceAddress: string;
  servicesInterested: ServiceOption[];
  preferredContactMethod: ContactMethod;
  smsConsentStatus: SmsConsentStatus;
  smsConsentDisclosureVersion?: string | null;
  smsConsentSourcePath?: string | null;
  smsConsentIpAddress?: string | null;
  smsConsentUserAgent?: string | null;
  notes: string;
  membershipTier: SqueegeeKingTierId | null;
  squareFootage: number | null;
  estimatedVisitPrice: number | null;
  preferredStartWindow: string | null;
  source?: LeadIntakeSource;
  clientSubmissionId?: string | null;
  externalLeadId?: string | null;
  sourcePageId?: string | null;
  sourceFormId?: string | null;
  sourceCampaignId?: string | null;
  sourceCampaignName?: string | null;
  sourceAdsetId?: string | null;
  sourceAdsetName?: string | null;
  sourceAdId?: string | null;
  sourceAdName?: string | null;
}
