export type MembershipPlanId = "one-time" | "preferred" | "estate";

export type SignatureMethod = "typed" | "drawn";

/** Captured at signing — passed through checkout and stored with agreement */
export interface MembershipSignature {
  method: SignatureMethod;
  signerName: string;
  /** Typed name text, or PNG data URL when method is "drawn" */
  signatureValue: string;
  signedAt: string;
  agreedToTerms: true;
  propertySlug: string;
  propertyName: string;
  planId: MembershipPlanId;
  planName: string;
}

export interface MembershipCheckoutPayload {
  planId: MembershipPlanId;
  signature: MembershipSignature;
  propertySlug: string;
  propertyName: string;
  homeownerSlug: string;
  homeownerName: string;
}

/** Result from creating a Stripe Checkout session */
export interface StripeCheckoutSession {
  sessionId: string;
  /** Stripe-hosted Checkout URL — redirect the customer here */
  checkoutUrl: string | null;
  mode: "mock" | "live";
}

export type CheckoutPhase = "steps" | "redirecting";

export const STRIPE_CHECKOUT_ENABLED = false;

/**
 * Stripe Checkout will handle:
 * - Card on file setup (Payment Method saved to Customer)
 * - Initial membership payment (if applicable for plan)
 * - Recurring subscription billing (for monthly plans)
 */
export const stripeCheckoutCapabilities = [
  {
    title: "Card on file",
    description: "Securely save your payment method for future visits.",
  },
  {
    title: "Initial payment",
    description: "First membership charge collected at checkout when required.",
  },
  {
    title: "Recurring billing",
    description: "Monthly plans renew automatically — cancel anytime.",
  },
] as const;

/** Placeholder metadata — populated in production at sign time */
export interface AgreementCaptureMetadata {
  signedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  clientSessionId: string | null;
}

/** Full agreement record — mock now, persisted in production */
export interface MembershipAgreementRecord {
  id: string;
  propertySlug: string;
  propertyName: string;
  homeownerSlug: string;
  homeownerName: string;
  planId: MembershipPlanId;
  planName: string;
  signature: {
    method: SignatureMethod;
    signerName: string;
    /** Storage URL in production; data URL in mock */
    signatureImageUrl: string | null;
    typedText: string | null;
  };
  metadata: AgreementCaptureMetadata;
  /** Future: generated PDF in property documents */
  agreementPdfUrl: string | null;
  status: "mock" | "pending" | "complete";
}
