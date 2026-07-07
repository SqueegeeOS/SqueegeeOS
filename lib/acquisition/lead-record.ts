import type { ContactMethod, ServiceOption } from "./types";
import type { SqueegeeKingTierId } from "@/lib/membership/tier-config";

export type LeadIntakeStatus = "new" | "contacted" | "scheduled" | "archived";

export interface LeadIntakeRecord {
  id: string;
  name: string;
  phone: string;
  email: string;
  serviceAddress: string;
  servicesInterested: ServiceOption[];
  preferredContactMethod: ContactMethod;
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
  notes: string;
  membershipTier: SqueegeeKingTierId | null;
  squareFootage: number | null;
  estimatedVisitPrice: number | null;
  preferredStartWindow: string | null;
}
