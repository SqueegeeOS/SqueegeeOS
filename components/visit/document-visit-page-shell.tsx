"use client";

import { GlassCard } from "@/components/craft/glass-card";
import { AmbientStage } from "@/components/craft/ambient-stage";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { DocumentVisitForm } from "@/components/visit/DocumentVisitForm";
import { isAdminUnlocked } from "@/lib/admin/pin";
import { useState } from "react";

export function DocumentVisitPageShell({
  propertyId,
  propertyName,
  propertyAddress,
}: {
  propertyId: string;
  propertyName: string;
  propertyAddress?: string;
}) {
  const [unlocked, setUnlocked] = useState(() => isAdminUnlocked());

  if (!unlocked) {
    return <AdminPinGate onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <AmbientStage className="text-white">
      <div className="mx-auto max-w-lg px-4 py-12 sm:py-14">
        <GlassCard tone="elevated" motion="materialize" padding="lg">
          <DocumentVisitForm
            propertyId={propertyId}
            propertyName={propertyName}
            propertyAddress={propertyAddress}
            cancelHref={`/hq/customers/property/${propertyId}`}
            successHref={`/hq/properties/${propertyId}/health`}
            mode="founder"
          />
        </GlassCard>
      </div>
    </AmbientStage>
  );
}
