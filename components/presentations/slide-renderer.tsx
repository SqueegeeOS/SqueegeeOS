"use client";

import type { PresentationData, SlideType } from "@/lib/presentations/types";
import type { SlideOverride } from "@/lib/presentations/types";
import { SLIDE_COMPONENTS } from "./slides";

interface SlideRendererProps {
  slideType: SlideType;
  presentation: PresentationData;
  overrides?: SlideOverride;
  onSign?: (tier: PresentationData["tier"]) => void;
}

export function SlideRenderer({
  slideType,
  presentation,
  overrides,
  onSign,
}: SlideRendererProps) {
  const Component = SLIDE_COMPONENTS[slideType];
  return (
    <Component
      presentation={presentation}
      overrides={overrides}
      onSign={onSign}
    />
  );
}
