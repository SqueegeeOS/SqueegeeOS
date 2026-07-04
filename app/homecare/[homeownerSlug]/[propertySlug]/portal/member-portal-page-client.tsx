"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import UnlockCeremony from "@/components/UnlockCeremony";
import { MemberPortalExperience } from "@/components/membership/member-portal-experience";
import {
  MembershipUnlockProvider,
  UNLOCK_CEREMONY_REQUEST,
} from "@/components/membership/unlock-provider";
import type { CustomerHealthView } from "@/lib/health/types";
import type { HomeCarePlanData } from "@/lib/home-care-plan/types";
import type { MemberPortalData } from "@/lib/persistence/queries/member-portal";
import {
  consumeMemberWelcomePending,
  hasSeenUnlockCeremony,
  markUnlockCeremonySeen,
} from "@/lib/membership/unlock-sequence";

interface MemberPortalPageClientProps {
  planData: HomeCarePlanData;
  portalData: MemberPortalData | null;
  homeownerSlug: string;
  propertySlug: string;
  homeHealth?: CustomerHealthView | null;
  homeHealthHref?: string;
}

export function MemberPortalPageClient({
  planData,
  portalData,
  homeownerSlug,
  propertySlug,
  homeHealth = null,
  homeHealthHref,
}: MemberPortalPageClientProps) {
  return (
    <MembershipUnlockProvider>
      <MemberPortalWithCeremony
        planData={planData}
        portalData={portalData}
        homeownerSlug={homeownerSlug}
        propertySlug={propertySlug}
        homeHealth={homeHealth}
        homeHealthHref={homeHealthHref}
      />
    </MembershipUnlockProvider>
  );
}

function MemberPortalWithCeremony({
  planData,
  portalData,
  homeownerSlug,
  propertySlug,
  homeHealth = null,
  homeHealthHref,
}: MemberPortalPageClientProps) {
  const [fromUnlock, setFromUnlock] = useState(false);
  const [showCeremony, setShowCeremony] = useState(false);

  useEffect(() => {
    function applyWelcomePending(forceCeremony: boolean) {
      const pending = consumeMemberWelcomePending();
      if (pending) setFromUnlock(true);
      if (
        forceCeremony ||
        (pending && !hasSeenUnlockCeremony(homeownerSlug, propertySlug))
      ) {
        setShowCeremony(true);
      }
    }

    applyWelcomePending(false);

    const handleRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ forceCeremony?: boolean }>).detail;
      applyWelcomePending(Boolean(detail?.forceCeremony));
    };

    window.addEventListener(UNLOCK_CEREMONY_REQUEST, handleRequest);
    return () => {
      window.removeEventListener(UNLOCK_CEREMONY_REQUEST, handleRequest);
    };
  }, [homeownerSlug, propertySlug]);

  return (
    <>
      {showCeremony && (
        <UnlockCeremony
          onComplete={() => {
            markUnlockCeremonySeen(homeownerSlug, propertySlug);
            setShowCeremony(false);
          }}
        />
      )}
      <MemberPortalExperience
        data={planData}
        portalData={portalData}
        fromUnlock={fromUnlock}
        homeHealth={homeHealth}
        homeHealthHref={homeHealthHref}
      />
    </>
  );
}

export function MemberPortalNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <p className="font-serif text-3xl font-light text-foreground">
        Portal not found
      </p>
      <p className="mt-4 max-w-md text-sm text-muted">
        We could not find a membership portal for this property.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex min-h-[52px] items-center justify-center rounded-full bg-accent px-8 text-sm font-medium tracking-[0.12em] text-background"
      >
        Return home
      </Link>
    </div>
  );
}
