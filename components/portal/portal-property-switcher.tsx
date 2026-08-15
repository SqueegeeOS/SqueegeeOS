"use client";

import Link from "next/link";
import type { PortalHouseholdSnapshot } from "@/lib/membership/portal-household";

function statusLabel(status: string): string {
  if (status === "pending_checkout" || status === "pending_payment") {
    return "Setup in progress";
  }
  if (status === "paused") return "Care paused";
  return "Active care";
}

export function PortalPropertySwitcher({
  household,
}: {
  household: PortalHouseholdSnapshot;
}) {
  if (household.properties.length <= 1) return null;

  return (
    <nav
      aria-label="Your HomeAtlas properties"
      className="mt-8 rounded-[var(--radius-card-lg)] border border-accent/15 bg-background/35 p-3 shadow-[var(--shadow-ambient)] backdrop-blur-xl sm:p-4"
    >
      <div className="flex items-center justify-between gap-3 px-1 pb-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent/70">
            Your homes
          </p>
          <p className="mt-1 text-xs text-foreground/50">
            {household.properties.length} properties · one care record each
          </p>
        </div>
        <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-muted">
          Switch
        </span>
      </div>

      <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {household.properties.map((property) => (
          <Link
            key={property.membershipId}
            href={property.href}
            aria-current={property.current ? "page" : undefined}
            className={`min-w-[78%] snap-start rounded-2xl border px-4 py-3 transition-colors sm:min-w-[46%] ${
              property.current
                ? "border-accent/35 bg-accent/[0.09]"
                : "border-white/10 bg-white/[0.025] hover:border-accent/25 hover:bg-accent/[0.05]"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-medium text-foreground/90">
                {property.name}
              </p>
              {property.current ? (
                <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-accent">
                  Here
                </span>
              ) : (
                <span className="shrink-0 text-sm text-accent" aria-hidden>
                  →
                </span>
              )}
            </div>
            <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-foreground/50">
              {property.address}
            </p>
            <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
              {statusLabel(property.status)} · {property.planName}
            </p>
          </Link>
        ))}
      </div>

      {household.truncated ? (
        <p className="mt-3 px-1 text-xs leading-5 text-muted">
          More properties are connected. Contact the team if the home you need
          is not shown here.
        </p>
      ) : null}
    </nav>
  );
}
