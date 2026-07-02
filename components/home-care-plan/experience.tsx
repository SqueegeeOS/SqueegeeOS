"use client";

import { useEffect } from "react";
import { MembershipCheckoutModal } from "@/components/membership/membership-checkout-modal";
import { MembershipCheckoutProvider } from "@/components/membership/checkout-context";
import { MembershipUnlockProvider } from "@/components/membership/unlock-provider";
import { canyonOaksHomeCarePlan } from "@/lib/home-care-plan/canyon-oaks";
import type { HomeCarePlanData } from "@/lib/home-care-plan/types";
import { MobileCtaBar } from "./mobile-cta-bar";
import { BecomeAMember } from "./sections/become-a-member";
import { PlanHero } from "./sections/hero";
import { HomeCareJourney } from "./sections/home-care-journey";
import { MeetYourTeam } from "./sections/meet-your-team";
import { MembershipBenefits } from "./sections/membership-benefits";
import { MembershipComparison } from "./sections/membership-comparison";
import { OurRecommendation } from "./sections/our-recommendation";
import { PersonalNote } from "./sections/personal-note";
import { PropertySnapshot } from "./sections/property-snapshot";
import { Reviews } from "./sections/reviews";
import { WhatWeFound } from "./sections/what-we-found";
import { Divider } from "./ui/primitives";

function HomeCarePlanContent({ data }: { data: HomeCarePlanData }) {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = "smooth";
    return () => {
      root.style.scrollBehavior = previous;
    };
  }, []);

  return (
    <div className="plan-experience overflow-x-hidden bg-background pb-28 text-foreground md:pb-0">
      <PlanHero data={data} />
      <Divider />
      <PropertySnapshot data={data} />
      <Divider />
      <WhatWeFound data={data} />
      <Divider />
      <OurRecommendation data={data} />
      <Divider />
      <PersonalNote data={data} />
      <Divider />
      <MembershipComparison data={data} />
      <HomeCareJourney data={data} />
      <Divider />
      <MembershipBenefits data={data} />
      <Divider />
      <MeetYourTeam data={data} />
      <Divider />
      <Reviews data={data} />
      <BecomeAMember data={data} />
      <MobileCtaBar phone={data.closing.phone} label={data.closing.cta} />
      <MembershipCheckoutModal />
    </div>
  );
}

export function HomeCarePlanExperience({
  data = canyonOaksHomeCarePlan,
}: {
  data?: HomeCarePlanData;
}) {
  return (
    <MembershipCheckoutProvider planData={data}>
      <MembershipUnlockProvider>
        <HomeCarePlanContent data={data} />
      </MembershipUnlockProvider>
    </MembershipCheckoutProvider>
  );
}
