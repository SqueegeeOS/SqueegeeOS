"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { GlassCard } from "@/components/craft/glass-card";
import { AmbientStage } from "@/components/craft/ambient-stage";
import {
  ADMIN_PIN_ARCHITECTURE_NOTE,
  isAdminPrivateBeta,
} from "@/lib/admin/config";
import { craftInput, craftPrimaryButton } from "@/lib/craft/tokens";
import {
  clearAdminSession,
  isAdminUnlocked,
  markAdminUnlocked,
  verifyAdminPin,
} from "@/lib/admin/pin";
import { materialize } from "@/lib/motion/system";

interface AdminPinGateProps {
  onUnlock: () => void;
}

export function AdminPinGate({ onUnlock }: AdminPinGateProps) {
  const reduceMotion = useReducedMotion();
  const privateBeta = isAdminPrivateBeta();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAdminUnlocked()) {
      onUnlock();
    }
  }, [onUnlock]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    if (privateBeta) {
      markAdminUnlocked("beta");
      onUnlock();
      setSubmitting(false);
      return;
    }

    if (!verifyAdminPin(pin.trim())) {
      setError("Access denied. Check your PIN and try again.");
      setSubmitting(false);
      return;
    }

    markAdminUnlocked("pin", pin.trim());
    onUnlock();
    setSubmitting(false);
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
          {!privateBeta ? (
            <div>
              <label
                htmlFor="admin-pin"
                className="mb-2 block text-[10px] uppercase tracking-[0.26em] text-muted"
              >
                Access PIN
              </label>
              <input
                id="admin-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                className={craftInput}
                placeholder="Enter PIN"
              />
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-muted/90">
              Private beta mode is active. Configure{" "}
              <code className="rounded bg-background px-1.5 py-0.5 text-[11px] text-accent">
                NEXT_PUBLIC_ADMIN_PIN
              </code>{" "}
              before exposing real customer data.
            </p>
          )}

          {error && (
            <p className="text-sm text-red-300/90" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || (!privateBeta && pin.trim().length === 0)}
            className={`w-full ${craftPrimaryButton}`}
          >
            {privateBeta ? "Enter headquarters" : "Unlock headquarters"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            clearAdminSession();
            window.location.href = "/";
          }}
          className="mt-6 w-full text-center text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-accent"
        >
          Return Home
        </button>
        </GlassCard>
      </motion.div>
    </AmbientStage>
  );
}
