"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AtlasMark } from "@/components/theme/atlas-mark";
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

const FOUNDER_NAV_ITEMS = [
  { label: "Today", href: ROUTES.hqToday },
  { label: "Pulse", href: ROUTES.hqActivation, accent: true },
  { label: "Requests", href: ROUTES.hqPendingRequests, requests: true },
  { label: "Sales", href: ROUTES.hqSales },
  { label: "Enroll", href: ROUTES.hqEnrollment },
  { label: "Inbox", href: ROUTES.hqCommunications },
  { label: "Members", href: ROUTES.hqMembership },
  { label: "Jobber", href: ROUTES.hqJobber },
  { label: "Team", href: ROUTES.hqTechnicians },
  { label: "Care", href: ROUTES.hqAftercare },
  { label: "Billing", href: ROUTES.hqBilling },
  { label: "Growth", href: ROUTES.hqGrowth },
  { label: "Health", href: ROUTES.hqProductionHealth },
  { label: "Overview", href: ROUTES.hq, exact: true },
] as const;

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
      // Keep the last known values when the inbox is temporarily unavailable.
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
    <div className="hq-command-shell sticky top-[max(0.65rem,var(--safe-area-top))] z-50">
      <nav
        aria-label="Founder navigation"
        className="hq-command-bar flex min-h-[4rem] items-center gap-1.5 overflow-hidden rounded-[1.35rem] border border-white/[0.09] bg-[#0b0a09]/[0.88] p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,248,235,0.055)] backdrop-blur-2xl"
      >
        <Link
          href={ROUTES.hqToday}
          aria-label="HomeAtlas headquarters"
          className="group flex min-h-[3rem] shrink-0 items-center gap-2 rounded-[1rem] border border-accent/15 bg-accent/[0.055] px-3 text-accent transition-[border-color,background-color,transform] duration-300 hover:border-accent/30 hover:bg-accent/[0.09] active:scale-[0.98]"
        >
          <span className="relative flex h-7 w-7 items-center justify-center rounded-full border border-accent/20 bg-black/20">
            <AtlasMark size={17} />
            <span
              className="hq-command-live absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-[#0b0a09]"
              aria-hidden
            />
          </span>
          <span className="hidden text-[9px] font-semibold uppercase tracking-[0.24em] sm:block">
            HQ
          </span>
        </Link>

        <div className="hq-nav-scroll flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto overscroll-x-contain px-0.5">
          {FOUNDER_NAV_ITEMS.map((item) => {
            const active = "exact" in item && item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            const isRequests = "requests" in item && item.requests;
            const isAccent = "accent" in item && item.accent;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={
                  isRequests && newCount > 0
                    ? `${item.label}, ${newCount} new${unread ? " unread" : ""}`
                    : item.label
                }
                className={cn(
                  "group relative inline-flex min-h-[3rem] shrink-0 items-center gap-2 rounded-[0.95rem] px-3 text-[11px] font-medium tracking-[0.01em] transition-[color,background-color,transform] duration-300 active:scale-[0.98] sm:px-3.5",
                  active
                    ? "bg-white/[0.075] text-foreground"
                    : isAccent
                      ? "text-accent/88 hover:bg-accent/[0.055] hover:text-accent"
                      : "text-muted hover:bg-white/[0.035] hover:text-foreground",
                )}
              >
                {active ? (
                  <span
                    className="absolute inset-x-3 bottom-1 h-px bg-gradient-to-r from-transparent via-accent/80 to-transparent shadow-[0_0_10px_rgba(201,184,150,0.45)]"
                    aria-hidden
                  />
                ) : null}
                <span>{item.label}</span>
                {isRequests && newCount > 0 ? (
                  <span
                    className={cn(
                      "inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-none",
                      unread
                        ? "bg-accent text-background shadow-[0_0_14px_rgba(201,184,150,0.32)]"
                        : "bg-white/[0.08] text-foreground/70",
                    )}
                  >
                    {newCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>

        <Link
          href={ROUTES.newPresentation}
          aria-label="Create a new presentation"
          className="group inline-flex min-h-[3rem] shrink-0 items-center justify-center gap-2 rounded-[1rem] border border-accent/25 bg-accent px-3.5 text-[11px] font-semibold text-background shadow-[0_10px_28px_rgba(0,0,0,0.3)] transition-[transform,box-shadow,opacity] duration-300 hover:opacity-95 hover:shadow-[0_14px_34px_rgba(0,0,0,0.36)] active:scale-[0.98] sm:px-4"
        >
          <span className="text-base font-light leading-none" aria-hidden>
            +
          </span>
          <span className="hidden md:inline">Presentation</span>
        </Link>
      </nav>
    </div>
  );
}
