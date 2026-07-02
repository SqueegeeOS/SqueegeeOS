"use client";

import { useEffect } from "react";
import { BecomeAMember } from "./sections/become-a-member";
import { Hero } from "./sections/hero";
import { HomeCareScore } from "./sections/home-care-score";
import { InspectionGallery } from "./sections/inspection-gallery";
import { MeetYourTeam } from "./sections/meet-your-team";
import { MembershipBenefits } from "./sections/membership-benefits";
import { MembershipComparison } from "./sections/membership-comparison";
import { PropertyOverview } from "./sections/property-overview";
import { Recommendations } from "./sections/recommendations";
import { Reviews } from "./sections/reviews";
import { Divider } from "./ui/section";

export function LarryBuckleyExperience() {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = "smooth";
    return () => {
      root.style.scrollBehavior = previous;
    };
  }, []);

  return (
    <div className="homecare-experience bg-background text-foreground">
      <Hero />
      <Divider />
      <PropertyOverview />
      <Divider />
      <HomeCareScore />
      <Divider />
      <InspectionGallery />
      <Divider />
      <Recommendations />
      <Divider />
      <MembershipComparison />
      <Divider />
      <MembershipBenefits />
      <Divider />
      <Reviews />
      <Divider />
      <MeetYourTeam />
      <BecomeAMember />
    </div>
  );
}
