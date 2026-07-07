"use client";

import { CursorSpotlightPage } from "@/components/motion/cursor-spotlight";
import { CloseSection } from "./sections/close-section";
import { HeroSection } from "./sections/hero-section";
import { MembershipSection } from "./sections/membership-section";
import { ReflectionSection } from "./sections/reflection-section";
import { ServicesSection } from "./sections/services-section";
import { TestimonialsSection } from "./sections/testimonials-section";

export function ScrollCinemaLanding() {
  return (
    <CursorSpotlightPage intensity="whisper">
      <HeroSection />
      <ReflectionSection />
      <ServicesSection />
      <MembershipSection />
      <TestimonialsSection />
      <CloseSection />
    </CursorSpotlightPage>
  );
}
