import "server-only";

import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import { resolvePortalAccessByToken } from "@/lib/persistence/queries/portal-access";

export async function authorizeMembershipAction(
  request: Request,
  membershipId: string,
): Promise<boolean> {
  if (authorizeAdminRequest(request.headers)) {
    return true;
  }

  const portalToken = request.headers.get("x-portal-token")?.trim();
  if (!portalToken) return false;

  const access = await resolvePortalAccessByToken(portalToken);
  return access?.membershipId === membershipId;
}
