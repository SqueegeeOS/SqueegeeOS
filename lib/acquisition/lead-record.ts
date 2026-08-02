import type { ContactMethod, ServiceOption } from "./types";
import type { SqueegeeKingTierId } from "@/lib/membership/tier-config";

export type LeadIntakeStatus = "new" | "contacted" | "scheduled" | "archived";
export type SmsConsentStatus = "unknown" | "opted_in" | "opted_out";

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
  source: "request_form";
}

export interface CreateLeadIntakeInput {
  name: string;
  phone: string;
  email: string;
  serviceAddress: string;
  servicesInterested: ServiceOption[];
  preferredContactMethod: ContactMethod;
  smsConsentStatus: SmsConsentStatus;
  notes: string;
  membershipTier: SqueegeeKingTierId | null;
  squareFootage: number | null;
  estimatedVisitPrice: number | null;
  preferredStartWindow: string | null;
}
