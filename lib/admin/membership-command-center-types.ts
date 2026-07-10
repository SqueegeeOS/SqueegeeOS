import type { StripePaymentStatus } from "@/lib/admin/billing-workspace-types";

export type MembershipHealthBadge =
  | "active"
  | "needs_card"
  | "needs_scheduling"
  | "due_this_month"
  | "past_due"
  | "attention";

export type PendingMemberReason =
  | "signed_missing_card"
  | "card_not_active"
  | "agreement_not_signed";

export interface MembershipMemberRow {
  membershipId: string | null;
  presentationId: string | null;
  homeownerId: string;
  propertyId: string | null;
  homeownerName: string;
  propertyName: string;
  propertyLabel: string;
  homeownerSlug: string | null;
  propertySlug: string | null;
  planType: "Quarterly" | "Bi-Annual" | "Unknown";
  visitPrice: number | null;
  yearlyValue: number | null;
  visitsPerYear: number | null;
  nextServiceDate: string | null;
  nextServiceLabel: string | null;
  paymentStatus: StripePaymentStatus;
  cardLabel: string | null;
  membershipStatus: string | null;
  healthBadges: MembershipHealthBadge[];
  missingFlags: string[];
  portalUrl: string | null;
  agreementId: string | null;
  agreementPdfUrl: string | null;
  foundingMember: boolean;
  isActive: boolean;
  pendingReason: PendingMemberReason | null;
}

export interface MembershipMonthDueRow {
  membershipId: string;
  homeownerName: string;
  propertyLabel: string;
  planType: "Quarterly" | "Bi-Annual" | "Unknown";
  visitPrice: number | null;
  missingFlags: string[];
}

export interface MembershipMonthView {
  referenceMonth: string;
  referenceMonthLabel: string;
  membersDueCount: number;
  expectedRevenue: number;
  visitsByPlanType: {
    quarterly: number;
    biannual: number;
    unknown: number;
  };
  dueMembers: MembershipMonthDueRow[];
  missingDataFlags: string[];
}

export interface MembershipCommandCenterSummary {
  activeCount: number;
  pendingCount: number;
  needsCardCount: number;
  dueThisMonthCount: number;
  pastDueCount: number;
  needsSchedulingCount: number;
}

export interface MembershipCommandCenterData {
  connected: boolean;
  loadedAt: string;
  summary: MembershipCommandCenterSummary;
  activeMembers: MembershipMemberRow[];
  pendingMembers: MembershipMemberRow[];
  monthView: MembershipMonthView;
}
