export const ADMIN_UNLOCK_MAX_FAILURES = 5;
export const ADMIN_UNLOCK_WINDOW_MS = 15 * 60 * 1000;
export const ADMIN_UNLOCK_LOCK_MS = 15 * 60 * 1000;

export interface AdminUnlockRateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

interface AttemptState {
  failedAttempts: number;
  windowStartedAt: number;
  lockedUntil: number | null;
}

export class InMemoryAdminUnlockRateLimiter {
  private readonly attempts = new Map<string, AttemptState>();

  check(identityHash: string, now = Date.now()): AdminUnlockRateLimitResult {
    const state = this.attempts.get(identityHash);
    if (!state?.lockedUntil || state.lockedUntil <= now) {
      return { allowed: true, retryAfterSeconds: 0 };
    }

    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((state.lockedUntil - now) / 1000),
      ),
    };
  }

  record(
    identityHash: string,
    succeeded: boolean,
    now = Date.now(),
  ): AdminUnlockRateLimitResult {
    if (succeeded) {
      this.attempts.delete(identityHash);
      return { allowed: true, retryAfterSeconds: 0 };
    }

    const existing = this.attempts.get(identityHash);
    if (existing?.lockedUntil && existing.lockedUntil > now) {
      return this.check(identityHash, now);
    }

    const windowExpired =
      !existing || now - existing.windowStartedAt >= ADMIN_UNLOCK_WINDOW_MS;
    const failedAttempts = windowExpired ? 1 : existing.failedAttempts + 1;
    const lockedUntil =
      failedAttempts >= ADMIN_UNLOCK_MAX_FAILURES
        ? now + ADMIN_UNLOCK_LOCK_MS
        : null;

    this.attempts.set(identityHash, {
      failedAttempts,
      windowStartedAt: windowExpired ? now : existing.windowStartedAt,
      lockedUntil,
    });

    return lockedUntil
      ? {
          allowed: false,
          retryAfterSeconds: Math.ceil(ADMIN_UNLOCK_LOCK_MS / 1000),
        }
      : { allowed: true, retryAfterSeconds: 0 };
  }

  reset(): void {
    this.attempts.clear();
  }
}
