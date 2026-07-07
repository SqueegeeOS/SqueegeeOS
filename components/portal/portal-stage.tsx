"use client";

import type { ReactNode } from "react";
import { AmbientStage } from "@/components/craft/ambient-stage";

interface PortalStageProps {
  children: ReactNode;
  founding?: boolean;
}

/** Lit-stage environment — presentation continuity for the member portal. */
export function PortalStage({ children, founding = false }: PortalStageProps) {
  return (
    <AmbientStage founding={founding} className="text-[#f5f2eb]">
      {children}
    </AmbientStage>
  );
}
