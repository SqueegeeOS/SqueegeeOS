"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MEMBER_PRIVILEGES } from "@/lib/membership/member-privileges";
import {
  hasSeenUnlockCeremony,
  unlockContextFromPlanData,
  UNLOCK_WELCOME_COPY,
} from "@/lib/membership/unlock-sequence";
import type { CustomerHealthView } from "@/lib/health/types";
import type { HomeCarePlanData } from "@/lib/home-care-plan/types";
import type { MemberPortalData } from "@/lib/persistence/queries/member-portal";
import { useMembershipUnlock } from "@/components/membership/unlock-provider";
import { MemberPrivilegeCard } from "./member-privilege-card";
import { MembershipActiveBadge } from "./membership-active-badge";
import {
  MemberAddOnServices,
  MemberCareSummary,
} from "./member-care-summary";
import { MemberFieldNotes } from "./member-field-notes";
import { MemberHomeDashboard } from "./member-home-dashboard";
import { MemberPremiumCard } from "./member-premium-card";
import { MemberWalletCard } from "./member-wallet-card";
import { FoundingMemberHonor } from "./founding-member-honor";
import { resolvePortalViews } from "@/lib/membership/portal-from-supabase";
import { resolveFoundingMemberDisplay } from "@/lib/membership/founding-member";
import {
  buildMemberWalletCardData,
  isMemberMembershipActive,
} from "@/lib/membership/member-wallet-card-data";
import { buildMemberHomeDashboardView } from "@/lib/membership/member-home-dashboard-data";

const easeLuxury = [0.16, 1, 0.3, 1] as const;

/** Daedalus reveal — portal card stagger after unlock ceremony */
const REVEAL_STAGGER_S = 0.08;
const REVEAL_RISE_PX = 20;

interface MemberPortalExperienceProps {
  data: HomeCarePlanData;
  portalData?: MemberPortalData | null;
  planName?: string;
  fromUnlock?: boolean;
  homeHealth?: CustomerHealthView | null;
  homeHealthHref?: string;
}

function PortalCard({
  children,
  href,
  index,
  comingSoon,
  fromUnlock,
}: {
  children: React.ReactNode;
  href?: string;
  index: number;
  comingSoon?: boolean;
  fromUnlock?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const baseDelay = fromUnlock ? 0.05 : 0.4;
  const stagger = fromUnlock ? REVEAL_STAGGER_S : 0.14;
  const rise = fromUnlock ? REVEAL_RISE_PX : 8;
  const className = `flex min-h-[60px] items-center justify-between rounded-2xl border px-5 py-5 transition-colors ${
    comingSoon
      ? "border-border/60 bg-surface/50 opacity-60"
      : "border-border bg-surface hover:border-accent/30 active:border-accent/40"
  }`;

  const motionProps = {
    initial: reduceMotion ? false : { opacity: 0, y: rise },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: reduceMotion ? 0.15 : fromUnlock ? 0.55 : 1.1,
      delay: reduceMotion ? 0 : baseDelay + index * stagger,
      ease: easeLuxury,
    },
    style: {
      boxShadow: comingSoon ? undefined : "0 4px 20px rgba(0,0,0,0.1)",
    },
  };

  if (href && !comingSoon) {
    return (
      <motion.div {...motionProps}>
        <Link href={href} className={className}>
          {children}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div {...motionProps} className={className}>
      {children}
    </motion.div>
  );
}

export function MemberPortalExperience({
  data,
  portalData,
  planName,
  fromUnlock = false,
  homeHealth = null,
  homeHealthHref,
}: MemberPortalExperienceProps) {
  const planPath = `/homecare/${data.homeowner.slug}/${data.property.slug}/plan`;
  const reduceMotion = useReducedMotion();
  const [canReplayCeremony, setCanReplayCeremony] = useState(false);
  const { beginMembershipUnlock } = useMembershipUnlock();

  useEffect(() => {
    setCanReplayCeremony(
      hasSeenUnlockCeremony(data.homeowner.slug, data.property.slug),
    );
  }, [data.homeowner.slug, data.property.slug]);

  const entranceBase = fromUnlock ? 0.05 : 0.25;
  const { status: careStatus, membership, liveData } = resolvePortalViews(
    data,
    portalData,
    planName ? { planName } : undefined,
  );
  const displayPlanName = careStatus.planName;
  const welcomeName = portalData?.profile.firstName ?? data.homeowner.firstName;
  const membershipActive = isMemberMembershipActive(portalData);
  const walletCard = membershipActive
    ? buildMemberWalletCardData(membership, careStatus, {
        isActive: membershipActive,
      })
    : null;
  const portalPath = `/homecare/${data.homeowner.slug}/${data.property.slug}/portal`;
  const resolvedHomeHealthHref =
    homeHealthHref ?? `${portalPath}/home-health`;
  const returningMember = !fromUnlock;
  const foundingDisplay = resolveFoundingMemberDisplay(portalData);
  const isFoundingMember = Boolean(foundingDisplay);
  const homeDashboard = returningMember
    ? buildMemberHomeDashboardView(data, careStatus, membership, {
        portalData,
        planPath,
        homeHealth,
        homeHealthHref: resolvedHomeHealthHref,
      })
    : null;

  return (
    <div
      className={`min-h-[100svh] overflow-x-hidden bg-background text-foreground ${
        isFoundingMember ? "founding-portal-theme" : ""
      }`}
    >
      <div
        className={`relative overflow-hidden ${
          returningMember
            ? "min-h-[36vh] sm:min-h-[40vh]"
            : "min-h-[52vh] sm:min-h-[58vh]"
        } ${fromUnlock ? "member-portal-shimmer" : ""}`}
      >
        {isFoundingMember && (
          <div
            className="founding-hero-glow pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.12),transparent_68%)]"
            aria-hidden
          />
        )}
        <motion.div
          className="absolute inset-0"
          initial={reduceMotion ? false : { opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: reduceMotion ? 0.2 : 1.8,
            ease: easeLuxury,
          }}
        >
          <Image
            src={data.property.heroImage}
            alt={data.property.name}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/45 to-background" />
        </motion.div>

        <div
          className={`relative flex flex-col justify-end px-5 pb-10 pt-28 sm:px-10 sm:pb-12 ${
            returningMember
              ? "min-h-[36vh] sm:min-h-[40vh]"
              : "min-h-[52vh] sm:min-h-[58vh]"
          }`}
        >
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 1,
              ease: easeLuxury,
              delay: reduceMotion ? 0 : entranceBase,
            }}
            className="flex flex-wrap items-center gap-3"
          >
            <p className="text-[10px] uppercase tracking-[0.28em] text-accent">
              Member Portal
            </p>
            {foundingDisplay && (
              <FoundingMemberHonor display={foundingDisplay} variant="compact" />
            )}
            <MembershipActiveBadge variant="hero" />
            {liveData && (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-300/90">
                Live
              </span>
            )}
          </motion.div>
          <motion.h1
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 1.1,
              ease: easeLuxury,
              delay: reduceMotion ? 0 : entranceBase + 0.2,
            }}
            className="mt-4 max-w-xl font-serif text-3xl font-light leading-[1.08] tracking-tight sm:text-4xl md:text-5xl"
          >
            {fromUnlock
              ? UNLOCK_WELCOME_COPY.family
              : returningMember
                ? data.property.name
                : `Welcome home, ${welcomeName}.`}
          </motion.h1>
          {foundingDisplay && (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 1,
                ease: easeLuxury,
                delay: reduceMotion ? 0 : entranceBase + 0.35,
              }}
            >
              <FoundingMemberHonor display={foundingDisplay} variant="hero" />
            </motion.div>
          )}
          <motion.p
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 1,
              ease: easeLuxury,
              delay: reduceMotion ? 0 : entranceBase + 0.45,
            }}
            className="mt-4 max-w-lg text-sm leading-relaxed text-white/80 sm:text-base"
          >
            {fromUnlock
              ? UNLOCK_WELCOME_COPY.care
              : returningMember
                ? `${careStatus.planName} · ${careStatus.cadenceLabel} membership`
                : `${data.property.name} is under our care.`}
          </motion.p>
          {!returningMember && (
            <motion.p
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                delay: reduceMotion ? 0 : entranceBase + 0.65,
                duration: 0.9,
              }}
              className="mt-3 text-[10px] uppercase tracking-[0.22em] text-white/45"
            >
              {data.property.name} · {careStatus.planName}
            </motion.p>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-10 sm:py-14">
        {homeDashboard && (
          <MemberHomeDashboard
            dashboard={homeDashboard}
            entranceDelay={entranceBase + 0.15}
          />
        )}

        {!returningMember && (
          <motion.p
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 1,
              delay: reduceMotion ? 0 : entranceBase + 0.55,
              ease: easeLuxury,
            }}
            className="text-base leading-relaxed text-muted"
          >
            {fromUnlock
              ? "Everything here has been prepared for you. Your home is in capable hands."
              : "Your membership is active. Your care schedule and member pricing are below."}
          </motion.p>
        )}

        {walletCard && (
          <MemberWalletCard
            data={walletCard}
            portalUrl={portalPath}
            foundingDisplay={foundingDisplay}
            entranceDelay={entranceBase + (returningMember ? 0.35 : 0.28)}
          />
        )}

        <MemberPremiumCard
          membership={membership}
          foundingDisplay={foundingDisplay}
          entranceDelay={entranceBase + (returningMember ? 0.45 : 0.35)}
        />

        {!returningMember && (
          <MemberCareSummary
            status={careStatus}
            propertySlug={data.property.slug}
            entranceDelay={entranceBase + 0.35}
          />
        )}

        <MemberAddOnServices
          status={careStatus}
          propertySlug={data.property.slug}
          entranceDelay={entranceBase + 0.5}
        />

        {portalData?.observations && portalData.observations.length > 0 && (
          <MemberFieldNotes
            observations={portalData.observations}
            entranceDelay={entranceBase + 0.6}
          />
        )}

        <div className="mt-10 space-y-4">
          <PortalCard href={planPath} index={0} fromUnlock={fromUnlock}>
            <span className="font-serif text-lg font-light">
              Your Home Care Plan
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-accent">
              View
            </span>
          </PortalCard>

          <PortalCard
            href={resolvedHomeHealthHref}
            index={1}
            fromUnlock={fromUnlock}
          >
            <span className="font-serif text-lg font-light">Home Health</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-accent">
              View
            </span>
          </PortalCard>

          <PortalCard index={2} comingSoon fromUnlock={fromUnlock}>
            <span className="font-serif text-lg font-light text-muted">
              Documents & Agreements
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted">
              Coming soon
            </span>
          </PortalCard>

          {canReplayCeremony && (
            <motion.button
              type="button"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.9,
                delay: reduceMotion ? 0 : entranceBase + 0.5,
                ease: easeLuxury,
              }}
              onClick={() =>
                beginMembershipUnlock(
                  unlockContextFromPlanData(data, displayPlanName),
                  { forceReplay: true, profile: "full" },
                )
              }
              className="mt-2 w-full min-h-[48px] rounded-2xl border border-border/80 bg-transparent px-5 py-3 text-[11px] uppercase tracking-[0.2em] text-muted transition-colors hover:border-accent/30 hover:text-accent touch-manipulation"
            >
              Watch welcome ceremony again
            </motion.button>
          )}
        </div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 1.1,
            delay: reduceMotion ? 0 : entranceBase + 0.85,
            ease: easeLuxury,
          }}
          className="mt-16 sm:mt-20"
        >
          <p className="text-[10px] uppercase tracking-[0.28em] text-accent">
            Member Privileges
          </p>
          <h2 className="mt-3 font-serif text-2xl font-light text-foreground sm:text-3xl">
            Yours, by membership.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            These are not perks on a brochure. They are the standards we hold
            ourselves to — because you trusted us with your home.
          </p>

          <div className="mt-10 space-y-5">
            {MEMBER_PRIVILEGES.map((privilege, index) => (
              <MemberPrivilegeCard
                key={privilege.id}
                privilege={privilege}
                index={index}
                animate={fromUnlock || !reduceMotion}
                fromUnlock={fromUnlock}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
