import type { LeadIntakeRecord } from "@/lib/acquisition/lead-record";
import type { ClosedJob } from "@/lib/admin/closed-jobs-types";
import type { PaymentSetupEmailState } from "@/lib/membership/payment-setup-email-state";
import type { MembershipVisitPreference } from "@/lib/membership/visit-preferences";

export type CustomerWorkspaceRefType =
  | "lead"
  | "presentation"
  | "property"
  | "closed-job";

export type CustomerWorkspaceStage =
  | "request"
  | "presenting"
  | "onboarding"
  | "active"
  | "ledger"
  | "unknown";

export interface CustomerWorkspaceContact {
  name: string;
  email: string | null;
  phone: string | null;
  preferredContact: string | null;
}

export interface CustomerWorkspaceProperty {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  squareFeet: number | null;
  homeownerId: string;
  homeownerSlug: string;
  propertySlug: string;
}

export interface CustomerWorkspacePresentation {
  id: string;
  status: string;
  onboardingStatus: string | null;
  tier: string;
  editHref: string;
  presentHref: string;
}

export interface CustomerWorkspaceMembership {
  id: string;
  status: string;
  planName: string;
  salesTier: string | null;
  visitPrice: number | null;
  visitsPerYear: number | null;
  paymentSetupCompletedAt: string | null;
  paymentSetupEmailState: PaymentSetupEmailState;
  paymentSetupEmailRecipient: string | null;
  startedAt: string | null;
  foundingMember: boolean;
  visitPreferences: MembershipVisitPreference[];
}

export interface CustomerWorkspaceAgreement {
  id: string;
  planName: string;
  signedAt: string;
  pdfUrl: string | null;
}

export interface CustomerWorkspaceWorkItem {
  id: string;
  label: string;
  date: string;
  status: string;
  kind: "obligation" | "appointment";
}

export interface CustomerWorkspaceTimelineEntry {
  id: string;
  date: string;
  title: string;
  detail: string | null;
}

export interface CustomerWorkspaceAction {
  id: string;
  label: string;
  href: string;
  primary?: boolean;
}

export interface CustomerWorkspace {
  ref: { type: CustomerWorkspaceRefType; id: string };
  canonical: { type: CustomerWorkspaceRefType; id: string } | null;
  stage: CustomerWorkspaceStage;
  stageLabel: string;
  headline: string;
  subheadline: string | null;
  contact: CustomerWorkspaceContact;
  property: CustomerWorkspaceProperty | null;
  lead: LeadIntakeRecord | null;
  presentation: CustomerWorkspacePresentation | null;
  membership: CustomerWorkspaceMembership | null;
  agreement: CustomerWorkspaceAgreement | null;
  portalUrl: string | null;
  paymentHeadline: string | null;
  paymentDetail: string | null;
  notes: string;
  upcomingWork: CustomerWorkspaceWorkItem[];
  completedWork: CustomerWorkspaceWorkItem[];
  timeline: CustomerWorkspaceTimelineEntry[];
  closedJobs: ClosedJob[];
  actions: CustomerWorkspaceAction[];
}
