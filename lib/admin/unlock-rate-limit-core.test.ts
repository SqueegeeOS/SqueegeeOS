import { describe, expect, it } from "vitest";
import {
  ADMIN_UNLOCK_LOCK_MS,
  ADMIN_UNLOCK_MAX_FAILURES,
  ADMIN_UNLOCK_WINDOW_MS,
  InMemoryAdminUnlockRateLimiter,
} from "@/lib/admin/unlock-rate-limit-core";

describe("admin unlock rate limiter", () => {
  it("locks an identity after the configured number of failed attempts", () => {
    const limiter = new InMemoryAdminUnlockRateLimiter();
    const now = 1_800_000_000_000;

    for (let attempt = 1; attempt < ADMIN_UNLOCK_MAX_FAILURES; attempt += 1) {
      expect(limiter.record("identity", false, now + attempt).allowed).toBe(
        true,
      );
    }

    const locked = limiter.record(
      "identity",
      false,
      now + ADMIN_UNLOCK_MAX_FAILURES,
    );
    expect(locked.allowed).toBe(false);
    expect(locked.retryAfterSeconds).toBe(ADMIN_UNLOCK_LOCK_MS / 1000);
  });

  it("clears failed attempts after a successful unlock", () => {
    const limiter = new InMemoryAdminUnlockRateLimiter();
    const now = 1_800_000_000_000;

    limiter.record("identity", false, now);
    limiter.record("identity", false, now + 1);
    expect(limiter.record("identity", true, now + 2).allowed).toBe(true);
    expect(limiter.check("identity", now + 3).allowed).toBe(true);
  });

  it("starts a fresh attempt window after the previous one expires", () => {
    const limiter = new InMemoryAdminUnlockRateLimiter();
    const now = 1_800_000_000_000;

    for (let attempt = 0; attempt < ADMIN_UNLOCK_MAX_FAILURES - 1; attempt += 1) {
      limiter.record("identity", false, now + attempt);
    }

    const nextWindow = limiter.record(
      "identity",
      false,
      now + ADMIN_UNLOCK_WINDOW_MS,
    );
    expect(nextWindow.allowed).toBe(true);
  });
});
