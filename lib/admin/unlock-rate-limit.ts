import "server-only";

import { createHash } from "node:crypto";
import {
  ADMIN_UNLOCK_LOCK_MS,
  ADMIN_UNLOCK_MAX_FAILURES,
  ADMIN_UNLOCK_WINDOW_MS,
  InMemoryAdminUnlockRateLimiter,
  type AdminUnlockRateLimitResult,
} from "@/lib/admin/unlock-rate-limit-core";
import {
  createServiceRoleSupabaseClient,
  isServiceRoleConfigured,
  isSupabaseConfigured,
} from "@/lib/persistence/supabase/client";

const fallbackLimiter = new InMemoryAdminUnlockRateLimiter();

function clientAddress(headers: Headers): string {
  return (
    headers.get("x-vercel-forwarded-for") ??
    headers.get("x-forwarded-for") ??
    headers.get("x-real-ip") ??
    "local-or-unknown"
  )
    .split(",")[0]
    .trim()
    .slice(0, 128);
}

export function adminUnlockIdentityHash(headers: Headers): string {
  return createHash("sha256").update(clientAddress(headers)).digest("hex");
}

function parseRpcResult(data: unknown): AdminUnlockRateLimitResult | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;

  const allowed = (row as { allowed?: unknown }).allowed;
  const retryAfter = (row as { retry_after_seconds?: unknown })
    .retry_after_seconds;
  if (typeof allowed !== "boolean") return null;

  return {
    allowed,
    retryAfterSeconds:
      typeof retryAfter === "number" && Number.isFinite(retryAfter)
        ? Math.max(0, Math.ceil(retryAfter))
        : 0,
  };
}

function canUseDurableRateLimit(): boolean {
  return isSupabaseConfigured() && isServiceRoleConfigured();
}

export async function checkAdminUnlockRateLimit(
  headers: Headers,
): Promise<AdminUnlockRateLimitResult> {
  const identityHash = adminUnlockIdentityHash(headers);

  if (canUseDurableRateLimit()) {
    try {
      const { data, error } = await createServiceRoleSupabaseClient().rpc(
        "check_admin_unlock_rate_limit",
        { p_identity_hash: identityHash },
      );
      if (!error) {
        const parsed = parseRpcResult(data);
        if (parsed) return parsed;
      } else {
        console.warn("[admin-unlock] durable rate-limit check unavailable", {
          code: error.code ?? "unknown",
        });
      }
    } catch {
      console.warn("[admin-unlock] durable rate-limit check failed");
    }
  }

  return fallbackLimiter.check(identityHash);
}

export async function recordAdminUnlockAttempt(
  headers: Headers,
  succeeded: boolean,
): Promise<AdminUnlockRateLimitResult> {
  const identityHash = adminUnlockIdentityHash(headers);

  if (succeeded) {
    fallbackLimiter.record(identityHash, true);
  }

  if (canUseDurableRateLimit()) {
    try {
      const { data, error } = await createServiceRoleSupabaseClient().rpc(
        "record_admin_unlock_attempt",
        {
          p_identity_hash: identityHash,
          p_succeeded: succeeded,
          p_max_failures: ADMIN_UNLOCK_MAX_FAILURES,
          p_window_seconds: Math.ceil(ADMIN_UNLOCK_WINDOW_MS / 1000),
          p_lock_seconds: Math.ceil(ADMIN_UNLOCK_LOCK_MS / 1000),
        },
      );
      if (!error) {
        const parsed = parseRpcResult(data);
        if (parsed) return parsed;
      } else {
        console.warn("[admin-unlock] durable rate-limit write unavailable", {
          code: error.code ?? "unknown",
        });
      }
    } catch {
      console.warn("[admin-unlock] durable rate-limit write failed");
    }
  }

  return fallbackLimiter.record(identityHash, succeeded);
}
