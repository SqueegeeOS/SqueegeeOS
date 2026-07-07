"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { ROUTES } from "@/lib/navigation/config";

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function HqFounderNav({ newCount: initialNewCount }: { newCount?: number }) {
  const pathname = usePathname();
  const [newCount, setNewCount] = useState(initialNewCount ?? 0);
  const onRequestsPage = pathname.startsWith(ROUTES.hqPendingRequests);

  const loadNewCount = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/lead-intakes", {
        headers: getAdminRequestHeaders(),
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = (await response.json()) as { newCount?: number };
      setNewCount(data.newCount ?? 0);
    } catch {
      // Keep last known count
    }
  }, []);

  useEffect(() => {
    if (initialNewCount == null) {
      void loadNewCount();
    }
  }, [initialNewCount, loadNewCount]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadNewCount();
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [loadNewCount]);

  return (
    <nav
      aria-label="Founder navigation"
      className="flex flex-wrap items-center gap-3"
    >
      <Link
        href={ROUTES.hqPendingRequests}
        className={cn(
          "relative inline-flex min-h-[44px] items-center gap-2 rounded-full border px-5 py-2.5 text-sm transition-colors",
          onRequestsPage
            ? "border-accent/40 bg-accent/10 text-foreground"
            : "border-foreground/15 bg-foreground/[0.04] text-foreground hover:border-foreground/25 hover:bg-foreground/[0.06]",
        )}
      >
        <span className="font-medium tracking-[0.01em]">Requests</span>
        {newCount > 0 ? (
          <span className="inline-flex min-w-[1.35rem] items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-semibold leading-none text-background">
            {newCount}
          </span>
        ) : null}
      </Link>
      <Link
        href={ROUTES.hq}
        className={cn(
          "inline-flex min-h-[44px] items-center rounded-full px-4 py-2.5 text-sm text-muted transition-colors hover:text-foreground",
          pathname === ROUTES.hq && "text-foreground",
        )}
      >
        Overview
      </Link>
      <Link
        href={ROUTES.newPresentation}
        className="inline-flex min-h-[44px] items-center rounded-full px-4 py-2.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        New Presentation
      </Link>
    </nav>
  );
}
