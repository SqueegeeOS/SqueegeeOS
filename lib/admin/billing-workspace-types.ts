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

export type BillingExecutionState =
  | "disabled"
  | "pending"
  | "processing"
  | "succeeded"
  | "failed_retryable"
  | "needs_action"
  | "permanently_failed"
  | "reconciliation_required"
  | "void";

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
  jobberScheduledAmount: number | null;
  enrollmentSavingsPerVisit: number | null;
  nextAppointmentId: string | null;
  nextAppointmentDate: string | null;
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
  chargeAction: "complete_and_charge" | "manual_charge";
  automaticBillingEnabled: boolean;
  billingAuthorizationReady: boolean;
  jobberPropertyPaired: boolean;
  verifiedServiceVisitReady: boolean;
  billingOrderId: string | null;
  billingExecutionState: BillingExecutionState | null;
  billingFailureCode: string | null;
  billingFailureMessage: string | null;
  billingAttemptCount: number;
  billingNextAttemptAt: string | null;
}

export interface BillingWorkspaceData {
  overview: BillingWorkspaceOverview;
  rows: BillingRegisterRow[];
  loadedAt: string;
  stripeDashboardLive: boolean;
}
