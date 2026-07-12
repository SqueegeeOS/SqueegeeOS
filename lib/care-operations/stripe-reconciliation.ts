export interface StripeLedgerEvent {
  id: string;
  type: string;
  objectId: string | null;
  payloadHash: string;
}

export function deduplicateStripeEvents(events: StripeLedgerEvent[]): StripeLedgerEvent[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
}

export type ReconciliationDiscrepancy =
  | "stripe_paid_local_missing"
  | "local_paid_stripe_missing"
  | null;

export function reconcilePaymentTruth(input: {
  stripePaid: boolean;
  localPaid: boolean;
}): ReconciliationDiscrepancy {
  if (input.stripePaid && !input.localPaid) return "stripe_paid_local_missing";
  if (!input.stripePaid && input.localPaid) return "local_paid_stripe_missing";
  return null;
}
