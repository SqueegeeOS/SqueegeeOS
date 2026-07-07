"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PLATFORM_BRAND } from "@/lib/brand/platform";
import { buildPortalAccessPath } from "@/lib/membership/portal-access";
import { readStoredPortalToken } from "@/lib/pwa/portal-session";

/**
 * PWA start_url — resolves stored portal token to the member's private portal.
 * Future auth layers can replace storage lookup without changing this URL.
 */
export default function PortalEntryPage() {
  const router = useRouter();
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    const token = readStoredPortalToken();
    if (token) {
      router.replace(buildPortalAccessPath(token));
    } else {
      setResolved(true);
    }
  }, [router]);

  if (!resolved) {
    return (
      <div className="portal-safe-area flex min-h-[100svh] items-center justify-center bg-background px-6">
        <p className="text-sm text-muted">Opening your home…</p>
      </div>
    );
  }

  return (
    <div className="portal-safe-area flex min-h-[100svh] flex-col items-center justify-center bg-background px-6 text-center">
      <p className="text-[10px] uppercase tracking-[0.28em] text-accent">
        {PLATFORM_BRAND.name}
      </p>
      <h1 className="mt-4 font-serif text-2xl font-light text-foreground sm:text-3xl">
        Open your portal link
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
        Use the link from your welcome email to access your home&apos;s care
        record. Once opened, you can add {PLATFORM_BRAND.name} to your Home
        Screen.
      </p>
    </div>
  );
}
