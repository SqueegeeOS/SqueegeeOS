import "server-only";

import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";

export type BillingReconciliationDiscrepancy =
  | "stripe_paid_local_missing"
  | "local_paid_stripe_missing"
  | "amount_mismatch"
  | "status_mismatch"
  | "duplicate_candidate";

export async function recordBillingReconciliationCase(input: {
  billingOrderId: string;
  stripeObjectId: string | null;
  discrepancyType: BillingReconciliationDiscrepancy;
  evidence: Record<string, unknown>;
}): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  let existingQuery = supabase
    .from("payment_reconciliation_cases")
    .select("id")
    .eq("billing_order_id", input.billingOrderId)
    .eq("discrepancy_type", input.discrepancyType)
    .neq("status", "resolved");
  existingQuery = input.stripeObjectId
    ? existingQuery.eq("stripe_object_id", input.stripeObjectId)
    : existingQuery.is("stripe_object_id", null);
  const existing = await existingQuery.limit(1).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return;

  const inserted = await supabase.from("payment_reconciliation_cases").insert({
    billing_order_id: input.billingOrderId,
    stripe_object_id: input.stripeObjectId,
    discrepancy_type: input.discrepancyType,
    status: "open",
    evidence: input.evidence,
  });
  if (inserted.error && inserted.error.code !== "23505") {
    throw new Error(inserted.error.message);
  }
}
