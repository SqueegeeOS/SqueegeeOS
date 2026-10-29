"use client";

import type { ReactNode } from "react";
import { AmbientStage } from "@/components/craft/ambient-stage";
import {
  AtlasThemeProvider,
  PortalThemeSelector,
} from "@/components/theme/atlas-theme";
import { AtlasMark } from "@/components/theme/atlas-mark";
import type { AtlasThemeId } from "@/lib/theme/atlas-themes";
import { CUSTOMER_BRAND } from "@/lib/brand/customer";
import { PLATFORM_BRAND } from "@/lib/brand/platform";

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
        <div className="mx-auto flex max-w-2xl items-center gap-3 border-b border-border px-5 py-5 sm:px-10">
          <AtlasMark size={40} />
          <div>
            <p className="font-serif text-xl leading-tight text-foreground">
              {PLATFORM_BRAND.name}
            </p>
            <p className="mt-1 text-xs text-muted">
              Home care by {CUSTOMER_BRAND.name}
            </p>
          </div>
        </div>
        {children}
        <div className="mx-auto max-w-2xl px-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-10">
          <details className="group rounded-[var(--radius-card)] border border-border bg-surface px-5 shadow-[var(--shadow-ambient)]">
            <summary className="min-h-12 cursor-pointer py-4 text-sm font-medium text-foreground marker:text-accent focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              Portal appearance
            </summary>
            <div className="border-t border-border pb-5 pt-4">
              <p className="mb-4 text-sm leading-relaxed text-muted">
                The same care record, in the light that suits you.
              </p>
              <PortalThemeSelector />
            </div>
          </details>
        </div>
      </AmbientStage>
    </AtlasThemeProvider>
  );
}
