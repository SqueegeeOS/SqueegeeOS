import type { CustomerWorkspaceRefType } from "./types";

export function customerWorkspaceHref(
  type: CustomerWorkspaceRefType,
  id: string,
): string {
  return `/hq/customers/${type}/${encodeURIComponent(id)}`;
}
