"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ProductionCheckResult } from "@/lib/system/production-check";

function StatusRow({
  label,
  ok,
  hint,
}: {
  label: string;
  ok: boolean;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface/60 px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="text-xl" aria-hidden>
          {ok ? "🟢" : "🔴"}
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          {hint ? (
            <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function ProductionCheckPage() {
  const [result, setResult] = useState<ProductionCheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const runCheck = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/system/production-check", {
        cache: "no-store",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string };
        throw new Error(body?.error ?? "Check failed");
      }
      setResult((await res.json()) as ProductionCheckResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void runCheck();
  }, [runCheck]);

  const modeLabel =
    result?.mode === "production"
      ? "Production Mode"
      : result?.mode === "degraded"
        ? "Degraded — fix items below before field use"
        : "Development Mode";

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto max-w-lg">
        <Link
          href="/hq"
          className="text-[10px] uppercase tracking-widest text-muted transition hover:text-foreground"
        >
          ← Headquarters
        </Link>

        <header className="mt-6 mb-8">
          <p className="text-[10px] uppercase tracking-[0.2em] text-accent">
            Field readiness
          </p>
          <h1 className="mt-2 font-serif text-3xl font-light">Production Check</h1>
          <p className="mt-2 text-sm text-muted">
            Run this before a customer presentation. All green means agreement
            email, PDF storage, and Stripe card-on-file will work in the field.
          </p>
        </header>

        <button
          type="button"
          onClick={() => void runCheck()}
          disabled={loading}
          className="mb-6 w-full rounded-full bg-accent py-3.5 text-sm font-medium text-background disabled:opacity-50"
        >
          {loading ? "Checking…" : "Run check again"}
        </button>

        {error ? <p className="mb-4 text-sm text-red-500">{error}</p> : null}

        {result ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-accent/25 bg-accent/5 px-5 py-4 text-center">
              <p className="text-[10px] uppercase tracking-[0.18em] text-accent">
                {result.mode === "production" ? "🟢" : "🟡"} {modeLabel}
              </p>
              <p className="mt-1 text-xs text-muted">
                Last checked {new Date(result.checkedAt).toLocaleString()}
              </p>
            </div>

            <StatusRow
              label="Supabase Connected"
              ok={result.supabase}
              hint={result.details.supabase.message}
            />
            <StatusRow
              label="Storage Ready (signed-agreements)"
              ok={result.storage}
              hint={result.details.storage.message}
            />
            <StatusRow
              label="Email Ready (Resend)"
              ok={result.resend}
              hint={
                result.details.resend.message ??
                (result.details.resend.from
                  ? `From: ${result.details.resend.from}`
                  : undefined)
              }
            />
            <StatusRow
              label="Stripe Ready"
              ok={result.stripe}
              hint={result.details.stripe.message}
            />
            <StatusRow
              label={`Persistence (${result.details.persistence.backend})`}
              ok={result.persistence}
              hint={
                result.persistence
                  ? "Cloud persistence enabled"
                  : "Set NEXT_PUBLIC_SUPABASE_ENABLED=true"
              }
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
