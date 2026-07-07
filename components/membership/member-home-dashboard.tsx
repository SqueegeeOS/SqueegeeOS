"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { MemberHomeDashboardView } from "@/lib/membership/member-home-dashboard-data";
import { formatTierPrice } from "@/lib/membership/tier-config";
import { GlassCard } from "@/components/craft/glass-card";
import { craftEyebrow, craftHeading, craftPrimaryButton, craftSecondaryButton } from "@/lib/craft/tokens";
import { pageEnter } from "@/lib/motion/system";

function HealthBar({
  label,
  percent,
}: {
  label: string;
  percent: number;
}) {
  const filled = Math.round(percent / 10);
  const empty = 10 - filled;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="text-muted">{label}</span>
        <span className="font-medium tabular-nums text-foreground">{percent}%</span>
      </div>
      <div
        className="font-mono text-[13px] leading-none tracking-[0.08em] text-accent/90"
        aria-hidden
      >
        {"█".repeat(filled)}
        <span className="text-muted/25">{"░".repeat(empty)}</span>
      </div>
    </div>
  );
}

function DashboardPanel({
  title,
  children,
  index = 0,
}: {
  title: string;
  children: React.ReactNode;
  index?: number;
}) {
  return (
    <GlassCard as="section" tone="default" motion="rise" index={index}>
      <h2 className={craftEyebrow}>{title}</h2>
      <div className="mt-5">{children}</div>
    </GlassCard>
  );
}

export function MemberHomeDashboard({
  dashboard,
  entranceDelay = 0.2,
}: {
  dashboard: MemberHomeDashboardView;
  entranceDelay?: number;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
      variants={pageEnter}
      transition={{ delay: reduceMotion ? 0 : entranceDelay }}
      className="space-y-5"
    >
      <header>
        <h1 className={`${craftHeading} text-3xl sm:text-4xl`}>
          Welcome back, {dashboard.memberFirstName}.
        </h1>
      </header>

      {dashboard.totalSaved > 0 && (
        <DashboardPanel title="Total saved with your plan">
          <p className="font-serif text-4xl font-light text-accent sm:text-5xl">
            {formatTierPrice(dashboard.totalSaved)}
          </p>
          {dashboard.savedThisYear > 0 && (
            <p className="mt-2 text-sm text-foreground/90">
              {formatTierPrice(dashboard.savedThisYear)} saved this year
            </p>
          )}
          {dashboard.savingsLines.length > 0 && (
            <ul className="mt-4 space-y-2 border-t border-border/60 pt-4 text-sm">
              {dashboard.savingsLines.map((line) => (
                <li
                  key={line.label}
                  className="flex justify-between gap-4 text-muted"
                >
                  <span>{line.label}</span>
                  <span className="tabular-nums text-foreground">
                    {formatTierPrice(line.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">{dashboard.savingsFootnote}</p>
          {dashboard.savingsSource === "plan" && (
            <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted/80">
              Estimated
            </p>
          )}
        </DashboardPanel>
      )}

      <DashboardPanel title="Your Home">
        <p className="font-serif text-xl font-light text-foreground sm:text-2xl">
          {dashboard.propertyName}
        </p>
        <div className="mt-4 border-t border-border/60 pt-4">
          <p className="text-sm text-foreground/90">
            {dashboard.squareFootage.toLocaleString()} sqft · {dashboard.planLabel}
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Last Visit</dt>
              <dd className="text-foreground">{dashboard.lastVisitLabel}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Next Visit</dt>
              <dd className="text-foreground">{dashboard.nextVisitLabel}</dd>
            </div>
          </dl>
        </div>
      </DashboardPanel>

      <DashboardPanel title="Property Health">
        {dashboard.homeHealth?.overallScore != null && (
          <p className="mb-4 font-serif text-3xl font-light text-accent">
            {dashboard.homeHealth.overallScore}%
            <span className="ml-2 text-sm text-muted">overall care score</span>
          </p>
        )}
        {dashboard.propertyHealth.length > 0 ? (
          <div className="space-y-5">
            {dashboard.propertyHealth.map((score) => (
              <HealthBar
                key={score.label}
                label={score.label}
                percent={score.percent}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-muted">
            Your home health summary will appear here after your first visit.
          </p>
        )}
        <Link
          href={dashboard.homeHealthHref}
          className="mt-4 inline-flex text-[10px] uppercase tracking-[0.18em] text-accent hover:opacity-80"
        >
          View home health →
        </Link>
      </DashboardPanel>

      {dashboard.addOnDiscountPercent != null && (
        <DashboardPanel title="Your Discount">
          <p className="font-serif text-2xl font-light text-foreground">
            {dashboard.addOnDiscountPercent}% off all add-ons
          </p>
          <p className="mt-2 text-sm text-muted">{dashboard.discountFinePrint}</p>
        </DashboardPanel>
      )}

      <div
        className={`grid gap-3 ${dashboard.hasCompletedVisits ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
      >
        <Link
          href={dashboard.bookAddOnHref}
          className={`${craftPrimaryButton} !min-h-[48px] !text-[10px] !uppercase !tracking-[0.14em] touch-manipulation`}
        >
          Book Add-On
        </Link>
        {dashboard.hasCompletedVisits && (
          <Link
            href={dashboard.viewHistoryHref}
            className={`${craftSecondaryButton} touch-manipulation`}
          >
            View History
          </Link>
        )}
        <Link
          href={dashboard.agreementHref}
          className={`${craftSecondaryButton} touch-manipulation`}
        >
          Your Agreement
        </Link>
      </div>
    </motion.div>
  );
}
