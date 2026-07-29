"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import type { PresentationData } from "@/lib/presentations/types";
import { PresentationCard } from "./presentation-card";

async function requestPresentationList(): Promise<PresentationData[]> {
  const response = await fetch("/api/presentations", {
    headers: getAdminRequestHeaders(),
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as {
    presentations?: PresentationData[];
    error?: string;
  } | null;
  if (!response.ok) throw new Error(body?.error ?? "Could not load clients");
  return body?.presentations ?? [];
}

export function PresentationListPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [presentations, setPresentations] = useState<PresentationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPresentations(await requestPresentationList());
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load clients",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    let cancelled = false;

    requestPresentationList()
      .then((nextPresentations) => {
        if (!cancelled) setPresentations(nextPresentations);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load clients",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [unlocked]);

  if (!unlocked) {
    return <AdminPinGate onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-4 pb-20 pt-[calc(var(--site-chrome-offset)+1.5rem)] text-white">
      <div className="mx-auto max-w-lg">
        <header className="mb-8">
          <p className="text-[10px] uppercase tracking-widest text-[#777]">
            Field · Presentations
          </p>
          <h1 className="mt-1 font-serif text-3xl text-white">Your clients</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#888]">
            Review the home, confirm pricing, then open the guided presentation
            at the driveway.
          </p>
        </header>

        <Link
          href="/presentations/new"
          className="mb-8 flex min-h-[52px] items-center justify-center rounded-xl border border-dashed border-[#3a3a3a] bg-white/[0.02] text-sm text-[#aaa] transition-colors hover:border-[#c9a96e]/50 hover:text-[#c9a96e]"
        >
          + New presentation
        </Link>

        {loading ? (
          <p className="py-12 text-center text-sm text-[#777]" role="status">
            Loading clients…
          </p>
        ) : error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/5 px-6 py-8 text-center">
            <p className="text-sm text-red-200">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-5 rounded-full border border-white/20 px-5 py-2.5 text-sm text-white/80"
            >
              Try again
            </button>
          </div>
        ) : presentations.length === 0 ? (
          <div className="rounded-2xl border border-[#242424] bg-[#0d0d0d] px-6 py-12 text-center">
            <p className="text-sm text-[#888]">No presentations yet.</p>
            <p className="mt-2 text-xs text-[#666]">
              Create one before your next in-home close.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {presentations.map((presentation) => (
              <li key={presentation.id}>
                <PresentationCard presentation={presentation} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
