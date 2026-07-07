"use client";

import { motion, useReducedMotion } from "framer-motion";
import { formatTierPrice } from "@/lib/membership/tier-config";
import type { MemberMembershipView } from "@/lib/membership/resolve-member-membership";
import type { ServiceScheduleStatus } from "@/lib/membership/tier-config";
import { FOUNDING_HOME_PROLOGUE } from "@/lib/membership/founding-member";
import type { FoundingMemberDisplay } from "@/lib/membership/founding-member";
import { MembershipActiveBadge } from "./membership-active-badge";

const easeLuxury = [0.16, 1, 0.3, 1] as const;

function StatusIcon({ status }: { status: ServiceScheduleStatus }) {
  if (status === "completed") {
    return (
      <span
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-accent/40 text-[10px] text-accent"
        aria-hidden
      >
        ✓
      </span>
    );
  }
  if (status === "scheduled") {
    return (
      <span
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-accent/60 bg-accent/10"
        aria-hidden
      >
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      </span>
    );
  }
  return (
    <span
      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border/80"
      aria-hidden
    >
      <span className="h-1 w-1 rounded-full bg-muted/40" />
    </span>
  );
}

function statusLabel(status: ServiceScheduleStatus): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "scheduled":
      return "Scheduled";
    default:
      return "Pending";
  }
}

export function MemberPremiumCard({
  membership,
  foundingDisplay = null,
  entranceDelay = 0.45,
}: {
  membership: MemberMembershipView;
  foundingDisplay?: FoundingMemberDisplay | null;
  entranceDelay?: number;
}) {
  const reduceMotion = useReducedMotion();
  const { schedule, value } = membership;
  const memberSinceFormatted = new Date(membership.memberSince).toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric" },
  );
  const hasVisitHistory = schedule.items.length > 0;

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 1,
        delay: reduceMotion ? 0 : entranceDelay,
        ease: easeLuxury,
      }}
      className="mt-10 overflow-hidden rounded-3xl border border-accent/20 bg-surface/50 shadow-[0_12px_48px_rgba(0,0,0,0.12)] data-[founding=true]:border-amber-500/20"
      data-founding={foundingDisplay ? "true" : undefined}
      aria-labelledby="member-premium-heading"
    >
      <div className="border-b border-border/70 bg-gradient-to-br from-accent/8 via-transparent to-transparent px-5 py-6 sm:px-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-accent">
              {membership.tierName} Member
            </p>
            <h2
              id="member-premium-heading"
              className="mt-2 font-serif text-2xl font-light text-foreground sm:text-3xl"
            >
              {membership.memberName}
            </h2>
            <p className="mt-1.5 text-xs text-muted">
              Member since {memberSinceFormatted} · {membership.memberSinceLabel}
            </p>
          </div>
          <MembershipActiveBadge variant="inline" />
        </div>
        <p className="mt-3 text-sm text-muted">{membership.tierTagline}</p>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="border-b border-border/60 px-5 py-6 sm:px-7 lg:border-b-0 lg:border-r">
          <p className="text-[10px] uppercase tracking-[0.28em] text-muted">
            Your Care Schedule
          </p>
          {hasVisitHistory ? (
            <ul className="mt-4 space-y-2.5">
              {schedule.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/30 px-4 py-3 text-sm"
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <StatusIcon status={item.status} />
                    <span className="truncate text-foreground/90">{item.label}</span>
                  </span>
                  <span className="shrink-0 text-[10px] uppercase tracking-[0.16em] text-muted">
                    {item.status === "scheduled" && item.scheduledDate
                      ? item.scheduledDate.replace(/, \d{4}$/, "")
                      : statusLabel(item.status)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-border/80 bg-background/20 px-5 py-6">
              {foundingDisplay && (
                <p className="text-[10px] uppercase tracking-[0.22em] text-amber-200/80">
                  {FOUNDING_HOME_PROLOGUE}
                </p>
              )}
              <h3
                className={`font-serif text-xl font-light text-foreground ${
                  foundingDisplay ? "mt-4" : ""
                }`}
              >
                Your care begins here
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                We&apos;re scheduling your first visit — you&apos;ll hear from us,
                nothing to do.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-0">
          {schedule.nextVisit && (
            <div className="border-b border-border/60 px-5 py-5 sm:px-7">
              <p className="text-[10px] uppercase tracking-[0.28em] text-accent">
                Next Visit
              </p>
              <p className="mt-2 font-serif text-xl font-light text-foreground">
                {schedule.nextVisit.scheduledDate}
              </p>
              <p className="mt-1 text-sm text-muted">{schedule.nextVisit.label}</p>
              {schedule.nextVisit.technician && (
                <p className="mt-2 text-xs text-muted">
                  Your dedicated tech:{" "}
                  <span className="text-foreground/80">
                    {schedule.nextVisit.technician}
                  </span>
                </p>
              )}
            </div>
          )}

          <div className="px-5 py-5 sm:px-7">
            <p className="text-[10px] uppercase tracking-[0.28em] text-muted">
              Your Membership
            </p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Monthly</dt>
                <dd className="font-serif text-lg font-light text-foreground">
                  {formatTierPrice(membership.monthlyPrice)}
                </dd>
              </div>
              {schedule.completedCount > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Services completed</dt>
                  <dd className="text-foreground">{schedule.completedCount}</dd>
                </div>
              )}
              {schedule.totalSaved != null && schedule.totalSaved > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Total saved</dt>
                  <dd className="font-serif text-lg font-light text-accent">
                    {formatTierPrice(schedule.totalSaved)}
                  </dd>
                </div>
              )}
              {schedule.ytdSavings != null && schedule.ytdSavings > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Saved this year</dt>
                  <dd className="text-accent">
                    {formatTierPrice(schedule.ytdSavings)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4 border-t border-border/50 pt-2">
                <dt className="text-muted">Home size</dt>
                <dd className="text-foreground">
                  {membership.squareFootage.toLocaleString()} sq ft
                </dd>
              </div>
            </dl>

            {value.narrative === "certainty" ? (
              <p className="mt-4 text-xs leading-relaxed text-muted/90 italic">
                {value.certaintyCopy}
              </p>
            ) : (
              <p className="mt-4 text-xs leading-relaxed text-accent/90">
                Member pricing saves{" "}
                {formatTierPrice(Math.abs(value.annualDelta))}/year vs booking
                individually.
              </p>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
