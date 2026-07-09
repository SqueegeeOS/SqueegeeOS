export type BillingStatus =
  | "ready_to_charge"
  | "charged"
  | "failed"
  | "upcoming"
  | "inactive";

export type StripePaymentStatus =
  | "card_on_file"
  | "customer_only"
  | "payment_pending"
  | "not_configured";

export interface BillingWorkspaceOverview {
  readyToBillCount: number;
  expectedRevenueThisMonth: number;
  collectedThisMonth: number;
  upcomingChargesCount: number;
  activeMembershipCount: number;
}

export interface BillingRegisterRow {
  membershipId: string;
  homeownerId: string;
  propertyId: string;
  homeownerName: string;
  propertyLabel: string;
  tierLabel: string;
  visitPrice: number | null;
  stripePaymentStatus: StripePaymentStatus;
  cardOnFileLabel: string | null;
  stripeCustomerId: string | null;
  nextChargeDate: string | null;
  lastChargeDate: string | null;
  billingPeriod: string | null;
  periodAlreadyPaid: boolean;
  canRecordCharge: boolean;
  billingStatus: BillingStatus;
  agreementId: string | null;
  agreementPdfUrl: string | null;
  /** V2 hook — manual charge today, saved-card charge later */
  chargeAction: "manual_charge";
}

export interface BillingWorkspaceData {
  overview: BillingWorkspaceOverview;
  rows: BillingRegisterRow[];
  loadedAt: string;
  stripeDashboardLive: boolean;
}
