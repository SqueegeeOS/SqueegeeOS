"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readCachedPresentation } from "@/lib/presentations/client-cache";
import type { PresentationData } from "@/lib/presentations/types";
import { PresentationViewer } from "./presentation-viewer";

export function PresentationPresentLoader({
  id,
  initial,
}: {
  id: string;
  initial: PresentationData | null;
}) {
  const [presentation, setPresentation] = useState<PresentationData | null>(
    initial,
  );
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (presentation) return;

    let cancelled = false;

    async function resolve() {
      try {
        const res = await fetch(`/api/presentations/${id}`);
        if (res.ok) {
          const json = (await res.json()) as { presentation: PresentationData };
          if (!cancelled) {
            setPresentation(json.presentation);
            setLoading(false);
          }
          return;
        }

        const cached = readCachedPresentation(id);
        if (cached) {
          if (!cancelled) {
            setPresentation(cached);
            setLoading(false);
          }
          return;
        }

        if (!cancelled) {
          setError(
            "Could not load this presentation. Return to the editor and tap Start Presentation again.",
          );
          setLoading(false);
        }
      } catch {
        const cached = readCachedPresentation(id);
        if (cached && !cancelled) {
          setPresentation(cached);
          setLoading(false);
          return;
        }
        if (!cancelled) {
          setError("Connection error. Check your network and try again.");
          setLoading(false);
        }
      }
    }

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [id, presentation]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#060606] text-[#f5f2eb]">
        <p className="text-sm text-white/50">Opening presentation…</p>
      </div>
    );
  }

  if (error || !presentation) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 bg-[#060606] px-6 text-center text-[#f5f2eb]">
        <p className="max-w-sm text-sm text-white/60">
          {error ?? "Presentation not found."}
        </p>
        <Link
          href={`/presentations/${id}/edit`}
          className="rounded-lg border border-white/20 px-5 py-2.5 text-sm text-white/80 transition hover:border-white/40"
        >
          Back to editor
        </Link>
      </div>
    );
  }

  return <PresentationViewer presentation={presentation} />;
}
