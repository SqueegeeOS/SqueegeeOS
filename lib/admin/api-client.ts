import { getAdminPinForApi } from "@/lib/admin/pin";

export function getAdminRequestHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const pin = getAdminPinForApi();
  if (pin) headers["x-admin-pin"] = pin;
  return headers;
}
