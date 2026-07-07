import type { SupabaseClient } from "@supabase/supabase-js";

export interface MembershipRowForPayment {
  id: string;
  homeowner_id: string;
  property_id: string;
  presentation_id: string | null;
  status: string;
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
  payment_setup_completed_at: string | null;
  started_at: string | null;
}

export async function loadMembershipForPayment(
  supabase: SupabaseClient,
  input: { presentationId?: string | null; membershipId?: string | null },
): Promise<MembershipRowForPayment | null> {
  let query = supabase.from("memberships").select(
    "id, homeowner_id, property_id, presentation_id, status, stripe_customer_id, stripe_payment_method_id, payment_setup_completed_at, started_at",
  );

  if (input.membershipId) {
    query = query.eq("id", input.membershipId);
  } else if (input.presentationId) {
    query = query.eq("presentation_id", input.presentationId);
  } else {
    return null;
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data as MembershipRowForPayment | null;
}
