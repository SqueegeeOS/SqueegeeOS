"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import {
  getRequestsInboxLastOpenedAt,
  hasUnreadRequests,
  markRequestsInboxOpened,
} from "@/lib/admin/requests-inbox-read-state";
import { ROUTES } from "@/lib/navigation/config";

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function HqFounderNav({ newCount: initialNewCount }: { newCount?: number }) {
  const pathname = usePathname();
  const [newCount, setNewCount] = useState(initialNewCount ?? 0);
  const [latestNewSubmittedAt, setLatestNewSubmittedAt] = useState<string | null>(
    null,
  );
  const [lastOpenedAt, setLastOpenedAt] = useState<string | null>(null);
  const onRequestsPage = pathname.startsWith(ROUTES.hqPendingRequests);

  const loadInboxMeta = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/lead-intakes", {
        headers: getAdminRequestHeaders(),
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = (await response.json()) as {
        newCount?: number;
        latestNewSubmittedAt?: string | null;
      };
      setNewCount(data.newCount ?? 0);
      setLatestNewSubmittedAt(data.latestNewSubmittedAt ?? null);
    } catch {
      // Keep last known values
    }
  }, []);

  useEffect(() => {
    setLastOpenedAt(getRequestsInboxLastOpenedAt());
  }, []);

  useEffect(() => {
    void loadInboxMeta();
  }, [loadInboxMeta, initialNewCount]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadInboxMeta();
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [loadInboxMeta]);

  useEffect(() => {
    if (!onRequestsPage) return;
    const openedAt = new Date().toISOString();
    markRequestsInboxOpened(openedAt);
    setLastOpenedAt(openedAt);
  }, [onRequestsPage]);

  const unread = hasUnreadRequests(
    newCount,
    latestNewSubmittedAt,
    lastOpenedAt,
  );

  return (
    <nav
      aria-label="Founder navigation"
      className="flex flex-wrap items-center gap-3"
    >
      <Link
        href={ROUTES.hqPendingRequests}
        aria-label={
          unread
            ? `Requests, ${newCount} new unread`
            : newCount > 0
              ? `Requests, ${newCount} new`
              : "Requests"
        }
        className={cn(
          "relative inline-flex min-h-[44px] items-center gap-2 rounded-full border px-5 py-2.5 text-sm transition-colors",
          onRequestsPage
            ? "border-accent/40 bg-accent/10 text-foreground"
            : unread
              ? "border-accent/50 bg-accent/10 text-foreground shadow-[0_0_0_1px_rgba(201,169,98,0.25)]"
              : "border-foreground/15 bg-foreground/[0.04] text-foreground hover:border-foreground/25 hover:bg-foreground/[0.06]",
        )}
      >
        {unread ? (
          <span
            className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent animate-pulse"
            aria-hidden
          />
        ) : null}
        <span className="font-medium tracking-[0.01em]">Requests</span>
        {newCount > 0 ? (
          <span
            className={cn(
              "inline-flex min-w-[1.35rem] items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-semibold leading-none text-background",
              unread && !onRequestsPage && "animate-pulse",
            )}
          >
            {newCount}
          </span>
        ) : null}
      </Link>
      <Link
        href={ROUTES.hqBilling}
        className={cn(
          "inline-flex min-h-[44px] items-center rounded-full px-4 py-2.5 text-sm transition-colors",
          pathname.startsWith(ROUTES.hqBilling)
            ? "border border-accent/40 bg-accent/10 text-foreground"
            : "text-muted hover:text-foreground",
        )}
      >
        Billing
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
