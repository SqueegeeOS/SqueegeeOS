import { isServiceRoleConfigured } from "@/lib/persistence/supabase/client";

export interface ProtectedQueryContext {
  /** Route or module performing the read, e.g. member-portal.appointments */
  surface: string;
  table: string;
  membershipId?: string | null;
  propertyId?: string | null;
  presentationId?: string | null;
}

export interface ProtectedQueryResultMeta {
  count: number;
  error?: { message: string; code?: string } | null;
}

/** Structured server log when a protected read fails or returns zero rows unexpectedly. */
export function logProtectedQueryResult(
  context: ProtectedQueryContext,
  result: ProtectedQueryResultMeta,
): void {
  const serviceRoleConfigured = isServiceRoleConfigured();
  const payload = {
    surface: context.surface,
    table: context.table,
    membershipId: context.membershipId ?? undefined,
    propertyId: context.propertyId ?? undefined,
    presentationId: context.presentationId ?? undefined,
    serviceRoleConfigured,
    resultCount: result.count,
    errorCode: result.error?.code ?? undefined,
    errorMessage: result.error?.message ?? undefined,
  };

  if (result.error) {
    console.error("[rls-query] protected read failed", payload);
    return;
  }

  if (result.count === 0) {
    console.warn("[rls-query] protected read returned zero rows", payload);
  }
}
