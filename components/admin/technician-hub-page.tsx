"use client";

import Link from "next/link";
import { TechnicianAccessPage } from "@/components/admin/technician-access-page";
import { useAdminUnlockedState } from "@/lib/admin/use-admin-unlocked-state";
import { TYLER_GERMANY_TECHNICIAN_ID } from "@/lib/field-operations/technician-profile";

export function TechnicianHubPage() {
  const [unlocked] = useAdminUnlockedState();

  return (
    <>
      <TechnicianAccessPage />
      {unlocked ? (
        <Link
          href={`/hq/technicians/${TYLER_GERMANY_TECHNICIAN_ID}`}
          className="fixed bottom-[max(1rem,var(--safe-area-bottom))] right-4 z-[70] inline-flex min-h-12 items-center rounded-full border border-accent/25 bg-[#0b0a09]/95 px-5 text-xs font-semibold text-accent shadow-[0_18px_60px_rgba(0,0,0,.45)] backdrop-blur-xl transition active:scale-[0.98] sm:right-6"
        >
          Tyler · backend →
        </Link>
      ) : null}
    </>
  );
}
