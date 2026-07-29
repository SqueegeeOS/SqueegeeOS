import { getAdminRequestHeaders } from "@/lib/admin/api-client";

export function getMembershipActionHeaders(
  portalToken?: string | null,
): Headers {
  const headers = new Headers(getAdminRequestHeaders());
  if (portalToken?.trim()) {
    headers.set("x-portal-token", portalToken.trim());
  }
  return headers;
}
