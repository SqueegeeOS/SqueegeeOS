"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  ADMIN_PIN_ARCHITECTURE_NOTE,
  isAdminPrivateBeta,
} from "@/lib/admin/config";
import {
  clearAdminSession,
  isAdminUnlocked,
  markAdminUnlocked,
  verifyAdminPin,
} from "@/lib/admin/pin";

const easeLuxury = [0.22, 1, 0.36, 1] as const;

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
    <div className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-background px-5 py-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,184,150,0.08),transparent_55%)]" />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: easeLuxury }}
        className="relative w-full max-w-md rounded-[2rem] border border-border bg-surface/80 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-10"
      >
        <p className="text-[10px] uppercase tracking-[0.3em] text-accent">
          Owner Access
        </p>
        <h1 className="mt-4 font-serif text-3xl font-light text-foreground sm:text-4xl">
          SqueegeeKing Headquarters
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Private access for Noah Thomas and Dasan Gramps.
        </p>

        <p className="mt-6 rounded-2xl border border-accent/20 bg-accent/[0.05] px-4 py-3 text-xs leading-relaxed text-muted">
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
                className="w-full rounded-2xl border border-border bg-background px-4 py-3.5 text-base text-foreground placeholder:text-muted/50 focus:border-accent/40 focus:outline-none focus:ring-1 focus:ring-accent/20"
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
            className="flex min-h-[52px] w-full items-center justify-center rounded-full border border-accent/30 bg-accent px-6 text-sm font-medium tracking-[0.12em] text-background transition-opacity hover:opacity-95 disabled:opacity-50"
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
      </motion.div>
    </div>
  );
}
