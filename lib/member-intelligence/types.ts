import type { FieldInputs } from "@/lib/persistence/types/ai-quote";
import type { PropertyDetailsRecord } from "@/lib/persistence/types/property-intelligence";
import type { MembershipTier } from "@/lib/persistence/types/member-profile";

export type {
  FieldInputs,
  FieldObservationFlags,
  HomeCondition,
  HomeownerVibe,
  AIQuoteResult,
} from "@/lib/persistence/types/ai-quote";
export type {
  PropertyDetailsRecord,
  PropertyPhotoRecord,
  PropertyPhotoSource,
} from "@/lib/persistence/types/property-intelligence";
export type { MembershipTier } from "@/lib/persistence/types/member-profile";

/** Portal-facing member view — assembled from homeowners + member_profiles + memberships */
export interface MemberProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  memberSince: string | null;
  membershipTier: MembershipTier;
  membershipStatus: "active" | "paused" | "cancelled" | "inactive";
  totalSaved: number;
  savingsHistory: MemberSavingsEntry[];
  nextAppointment: MemberAppointmentSummary | null;
  appointmentHistory: MemberAppointmentSummary[];
  propertyId: string;
}

export interface MemberSavingsEntry {
  date: string;
  serviceType: string;
  regularPrice: number;
  memberPrice: number;
  saved: number;
}

export interface MemberAppointmentSummary {
  id: string;
  date: string;
  serviceType: string;
  technician?: string | null;
  notes?: string | null;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
}

/** Property intelligence view — assembled from properties + photos */
export interface PropertyRecord {
  id: string;
  memberId: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  zillowUrl?: string | null;
  photos: PropertyPhotoView[];
  details: PropertyDetailsRecord;
  serviceNotes: string[];
  preferredProducts: string[];
  accessInstructions?: string | null;
}

export interface PropertyPhotoView {
  source: "zillow" | "our_team" | "member_uploaded" | "internal";
  url: string;
  caption?: string | null;
  isPrimary: boolean;
  uploadedAt: string;
}

export interface QuoteGenerationContext {
  fieldInputs: FieldInputs;
  property: PropertyRecord;
  member?: Pick<
    MemberProfile,
    "memberSince" | "totalSaved" | "membershipTier"
  > & { preferredServices?: string[] };
}
