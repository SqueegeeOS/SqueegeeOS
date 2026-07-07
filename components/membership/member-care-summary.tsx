"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import {
  buildMemberContactHref,
  formatMemberPrice,
  type MemberPortalStatus,
} from "@/lib/membership/member-portal-status";
import { MembershipActiveBadge } from "./membership-active-badge";

const easeLuxury = [0.16, 1, 0.3, 1] as const;

function CareStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string | null;
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-surface/60 px-5 py-4">
      <p className="text-[10px] uppercase tracking-[0.24em] text-muted">{label}</p>
      <p className="mt-2 font-serif text-xl font-light text-foreground">{value}</p>
      {detail ? (
        <p className="mt-1.5 text-xs leading-relaxed text-muted">{detail}</p>
      ) : null}
    </div>
  );
}

export function MemberCareSummary({
  status,
  propertySlug,
  entranceDelay = 0.6,
}: {
  status: MemberPortalStatus;
  propertySlug: string;
  entranceDelay?: number;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 1,
        delay: reduceMotion ? 0 : entranceDelay,
        ease: easeLuxury,
      }}
      className="mt-10 overflow-hidden rounded-3xl border border-border bg-surface/40 shadow-[0_8px_40px_rgba(0,0,0,0.08)]"
    >
      <div className="border-b border-border/70 px-5 py-6 sm:px-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-accent">
              Your Active Service
            </p>
            <h2 className="mt-2 font-serif text-2xl font-light text-foreground sm:text-3xl">
              {status.planName}
            </h2>
            <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-muted">
              {status.cadenceLabel} membership
            </p>
          </div>
          <MembershipActiveBadge variant="inline" />
        </div>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">
          {status.serviceSummary}
        </p>
      </div>

      <div className="grid gap-4 px-5 py-6 sm:grid-cols-2 sm:px-7">
        <CareStat
          label="Last Visit"
          value={status.lastVisit ?? "No visits yet"}
          detail={status.lastVisitService}
        />
        {status.nextVisit ? (
          <CareStat
            label="Next Visit"
            value={status.nextVisit}
            detail="Confirmed on your calendar"
          />
        ) : (
          <div className="flex flex-col justify-between rounded-2xl border border-dashed border-border/90 bg-background/40 px-5 py-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-muted">
                Next Visit
              </p>
              <p className="mt-2 font-serif text-xl font-light text-foreground">
                Not scheduled yet
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">
                Request a time that works for your home.
              </p>
            </div>
            <Link
              href={status.scheduleVisitHref}
              className="mt-5 inline-flex min-h-[48px] items-center justify-center rounded-full border border-accent/40 bg-accent px-6 text-[11px] font-medium uppercase tracking-[0.18em] text-background transition-opacity hover:opacity-95 touch-manipulation"
            >
              Schedule a Visit
            </Link>
          </div>
        )}
      </div>
    </motion.section>
  );
}

export function MemberAddOnServices({
  status,
  propertySlug,
  entranceDelay = 0.75,
}: {
  status: MemberPortalStatus;
  propertySlug: string;
  entranceDelay?: number;
}) {
  const reduceMotion = useReducedMotion();

  if (status.cadence === "one-time") return null;

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 1,
        delay: reduceMotion ? 0 : entranceDelay,
        ease: easeLuxury,
      }}
      className="mt-10"
      id="member-addons"
    >
      <p className="text-[10px] uppercase tracking-[0.28em] text-accent">
        Member Add-Ons
      </p>
      <h2 className="mt-3 font-serif text-2xl font-light text-foreground sm:text-3xl">
        Extra care, member pricing.
      </h2>
      {status.addOnDiscountPercent != null ? (
        <p className="mt-3 text-sm leading-relaxed text-muted">
          As a {status.cadenceLabel.toLowerCase()} member, you receive{" "}
          <span className="text-foreground/90">
            {status.addOnDiscountPercent}% off
          </span>{" "}
          add-on services between scheduled visits.
        </p>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Contact your care advisor for member pricing on add-on services.
        </p>
      )}

      <ul className="mt-8 space-y-4">
        {status.addOns.map((addon, index) => (
          <motion.li
            key={addon.id}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.9,
              delay: reduceMotion ? 0 : entranceDelay + 0.08 * index,
              ease: easeLuxury,
            }}
            className="rounded-2xl border border-border bg-surface px-5 py-5 sm:flex sm:items-center sm:justify-between sm:gap-6"
          >
            <div className="min-w-0 flex-1">
              <h3 className="font-serif text-lg font-light text-foreground">
                {addon.name}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                {addon.description}
              </p>
              <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                {addon.memberPrice != null ? (
                  <>
                    <span className="font-serif text-xl font-light text-accent">
                      {formatMemberPrice(addon.memberPrice)}
                    </span>
                    <span className="text-sm text-muted line-through">
                      {formatMemberPrice(addon.listPrice)}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-emerald-400/85">
                      Member rate
                    </span>
                  </>
                ) : (
                  <span className="font-serif text-xl font-light text-foreground">
                    {formatMemberPrice(addon.listPrice)}
                  </span>
                )}
              </div>
            </div>
            <Link
              href={buildMemberContactHref("add-on", propertySlug, addon.id)}
              className="mt-4 inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full border border-border px-5 text-[10px] uppercase tracking-[0.18em] text-foreground transition-colors hover:border-accent/35 hover:text-accent sm:mt-0 touch-manipulation"
            >
              Request
            </Link>
          </motion.li>
        ))}
      </ul>
    </motion.section>
  );
}
