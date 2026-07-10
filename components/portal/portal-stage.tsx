"use client";

import type { ReactNode } from "react";
import { AmbientStage } from "@/components/craft/ambient-stage";
import {
  AtlasThemeProvider,
  PortalThemeSelector,
} from "@/components/theme/atlas-theme";
import { AtlasMark } from "@/components/theme/atlas-mark";
import type { AtlasThemeId } from "@/lib/theme/atlas-themes";

interface PortalStageProps {
  children: ReactNode;
  founding?: boolean;
  savedTheme?: AtlasThemeId | null;
  membershipId?: string | null;
  portalToken?: string | null;
  homeownerSlug?: string | null;
  propertySlug?: string | null;
}

/** Lit-stage environment — one portal, three atmospheres (Day / Night / Lux). */
export function PortalStage({
  children,
  founding = false,
  savedTheme = null,
  membershipId = null,
  portalToken = null,
  homeownerSlug = null,
  propertySlug = null,
}: PortalStageProps) {
  return (
    <AtlasThemeProvider
      savedTheme={savedTheme}
      membershipId={membershipId}
      portalToken={portalToken}
      homeownerSlug={homeownerSlug}
      propertySlug={propertySlug}
    >
      <AmbientStage founding={founding} className="text-foreground">
        <div className="flex flex-col items-center gap-4 pt-6">
          <AtlasMark />
          <PortalThemeSelector />
        </div>
        {children}
      </AmbientStage>
    </AtlasThemeProvider>
  );
}
