"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import type { PresentationData } from "@/lib/presentations/types";
import { PresentationEditor } from "./presentation-editor";

export function PresentationEditorLoader({ id }: { id: string }) {
  const [unlocked, setUnlocked] = useState(false);
  const [presentation, setPresentation] = useState<PresentationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!unlocked) return;
    let cancelled = false;

    fetch(`/api/presentations/${id}`, {
      headers: getAdminRequestHeaders(),
      cache: "no-store",
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          presentation?: PresentationData;
          error?: string;
        } | null;
        if (!response.ok || !body?.presentation) {
          throw new Error(
            response.status === 404
              ? "Presentation not found"
              : (body?.error ?? "Could not load presentation"),
          );
        }
        if (!cancelled) setPresentation(body.presentation);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load presentation",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, unlocked]);

  if (!unlocked) {
    return <AdminPinGate onUnlock={() => setUnlocked(true)} />;
  }

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-sm text-white/60"
        role="status"
      >
        Loading presentation…
      </div>
    );
  }

  if (error || !presentation) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#0a0a0a] px-6 text-center text-white">
        <p className="text-sm text-white/60">{error ?? "Presentation not found"}</p>
        <Link
          href="/presentations"
          className="rounded-full border border-white/20 px-5 py-2.5 text-sm text-white/80"
        >
          Back to clients
        </Link>
      </div>
    );
  }

  return <PresentationEditor presentation={presentation} />;
}
