"use client";

import type { ReactNode } from "react";
import { AmbientStage } from "@/components/craft/ambient-stage";
import { AtlasThemeProvider, AtlasThemeToggle } from "@/components/theme/atlas-theme";

interface PortalStageProps {
  children: ReactNode;
  founding?: boolean;
}

/** Lit-stage environment — one portal, three atmospheres (Day / Night / Lux). */
export function PortalStage({ children, founding = false }: PortalStageProps) {
  return (
    <AtlasThemeProvider>
      <AmbientStage founding={founding} className="text-foreground">
        <div className="flex justify-center pt-5">
          <AtlasThemeToggle />
        </div>
        {children}
      </AmbientStage>
    </AtlasThemeProvider>
  );
}
