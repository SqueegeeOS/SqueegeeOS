import "server-only";

import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import { authorizeSalesRequest } from "@/lib/sales/sales-access";
import { resolvePortalAccessByToken } from "@/lib/persistence/queries/portal-access";

export async function authorizeMembershipAction(
  request: Request,
  membershipId: string,
): Promise<boolean> {
  const salesActor = await authorizeSalesRequest(request.headers);
  if (salesActor?.kind === "admin") return true;
  if (salesActor?.kind === "sales_rep") {
    try {
      const supabase = createServiceRoleSupabaseClient();
      const result = await supabase
        .from("presentations")
        .select("id")
        .eq("membership_id", membershipId)
        .eq("sales_rep_id", salesActor.repId)
        .maybeSingle();
      if (!result.error && result.data) return true;
    } catch {
      // A stale or unavailable sales session must not disable the customer's
      // separately scoped portal-token path below.
    }
  }

  const portalToken = request.headers.get("x-portal-token")?.trim();
  if (!portalToken) return false;

  const access = await resolvePortalAccessByToken(portalToken);
  return access?.membershipId === membershipId;
}
