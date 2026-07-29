"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { GlassCard } from "@/components/craft/glass-card";
import { AmbientStage } from "@/components/craft/ambient-stage";
import { ADMIN_PIN_ARCHITECTURE_NOTE } from "@/lib/admin/config";
import { craftInput, craftLabel, craftPrimaryButton } from "@/lib/craft/tokens";
import { markAdminUnlocked } from "@/lib/admin/pin";
import { ROUTES } from "@/lib/navigation/config";
import { materialize } from "@/lib/motion/system";

interface AdminPinGateProps {
  onUnlock: () => void;
}

export function AdminPinGate({ onUnlock }: AdminPinGateProps) {
  const reduceMotion = useReducedMotion();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/admin/unlock", {
      method: "POST",
      cache: "no-store",
    })
      .then(async (response) => {
        if (cancelled) return;
        if (response.ok) {
          const body = (await response.json()) as { mode: "pin" | "beta" };
          markAdminUnlocked(body.mode);
          onUnlock();
        }
      })
      .catch(() => {
        // Keep the gate closed when a saved session cannot be reverified.
      });

    return () => {
      cancelled = true;
    };
  }, [onUnlock]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const trimmedPin = pin.trim();
      const response = await fetch("/api/admin/unlock", {
        method: "POST",
        headers: trimmedPin ? { "x-admin-pin": trimmedPin } : undefined,
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as {
        mode?: "pin" | "beta";
        error?: string;
      } | null;

      if (!response.ok || !body?.mode) {
        setError(
          response.status === 503
            ? "Owner access is not configured. Add ADMIN_PIN in Vercel."
            : "Access denied. Check your PIN and try again.",
        );
        return;
      }

      markAdminUnlocked(body.mode);
      onUnlock();
    } catch {
      setError("Could not verify access. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AmbientStage className="flex min-h-[100svh] items-center justify-center px-5 py-16">
      <motion.div
        initial={reduceMotion ? false : "hidden"}
        animate="visible"
        variants={materialize}
        className="relative w-full max-w-md"
      >
        <GlassCard tone="elevated" padding="lg" className="sm:!p-10">
        <p className="text-[10px] uppercase tracking-[0.3em] text-accent">
          Owner Access
        </p>
        <h1 className="mt-4 font-serif text-3xl font-light text-foreground sm:text-4xl">
          SqueegeeKing Headquarters
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Private access for Noah Thomas and Dasan Gramps.
        </p>

        <p className="mt-6 craft-glass-subtle rounded-[1.1rem] px-4 py-3 text-xs leading-relaxed text-muted">
          {ADMIN_PIN_ARCHITECTURE_NOTE}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="admin-pin" className={craftLabel}>
              Access PIN
            </label>
            <input
              id="admin-pin"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              className={craftInput}
              placeholder="Enter PIN"
              autoFocus
            />
          </div>

          {error && (
            <p className="text-sm text-red-300/90" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className={`w-full ${craftPrimaryButton}`}
          >
            {submitting ? "Verifyingâ€¦" : "Unlock headquarters"}
          </button>
        </form>

        <a
          href={ROUTES.home}
          className="relative z-10 mt-6 flex min-h-[44px] w-full items-center justify-center text-center text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-accent touch-manipulation"
        >
          Return Home
        </a>
        <p className="mt-2 text-center text-[10px] text-muted/60">
          Opens the public marketing site
        </p>
        </GlassCard>
      </motion.div>
    </AmbientStage>
  );
}
