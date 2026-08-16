"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";

export function NewPresentationPage({
  createdBy = "Team",
  backHref = "/presentations",
  repSlug = null,
  salesRepLeadId = null,
  preauthorized = false,
}: {
  createdBy?: string;
  backHref?: string;
  repSlug?: string | null;
  salesRepLeadId?: string | null;
  preauthorized?: boolean;
}) {
  const router = useRouter();
  const [unlocked, setUnlocked] = useState(preauthorized);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isLeadPitch = Boolean(repSlug && salesRepLeadId);

  if (!unlocked) {
    return <AdminPinGate onUnlock={() => setUnlocked(true)} />;
  }

  const create = async () => {
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/presentations", {
        method: "POST",
        headers: getAdminRequestHeaders(),
        body: JSON.stringify({ repSlug, salesRepLeadId }),
      });
      const body = (await response.json().catch(() => null)) as {
        presentation?: { id: string; status?: string };
        resumed?: boolean;
        error?: string;
      } | null;
      if (!response.ok || !body?.presentation?.id) {
        throw new Error(body?.error ?? "Could not create presentation");
      }
      router.replace(
        body.presentation.status === "signed"
          ? `/presentations/${body.presentation.id}/present`
          : `/presentations/${body.presentation.id}/edit`,
      );
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not create presentation",
      );
      setCreating(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-5 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.03] p-7 text-center">
        <p className="text-[10px] uppercase tracking-[0.24em] text-[#c9a96e]">
          Field presentation
        </p>
        <h1 className="mt-4 font-serif text-3xl">
          {isLeadPitch ? "Open this homeowner" : "Start a new client"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/50">
          {isLeadPitch
            ? "HomeAtlas will resume this homeowner’s presentation or create it once, then open the pricing editor."
            : "This creates a private draft, then opens the details and pricing editor."}
        </p>
        {repSlug ? (
          <p className="mt-3 text-xs font-medium text-[#c9a96e]">
            Assigned to {createdBy}
          </p>
        ) : null}
        {error ? <p className="mt-5 text-sm text-red-300">{error}</p> : null}
        <button
          type="button"
          onClick={() => void create()}
          disabled={creating}
          className="mt-7 min-h-[52px] w-full rounded-full bg-[#c9a96e] px-6 text-sm font-medium text-[#090909] disabled:opacity-50"
        >
          {creating
            ? "Opening…"
            : isLeadPitch
              ? "Open homeowner presentation"
              : "Create presentation"}
        </button>
        <Link
          href={backHref}
          className="mt-4 inline-flex min-h-[44px] items-center text-xs text-white/50 hover:text-white/80"
        >
          {backHref === "/presentations" ? "Back to clients" : "Back to field desk"}
        </Link>
      </div>
    </div>
  );
}
