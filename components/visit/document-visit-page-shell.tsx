"use client";

import { useState } from "react";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { DocumentVisitForm } from "@/components/visit/DocumentVisitForm";
import { isAdminUnlocked } from "@/lib/admin/pin";

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
    <div className="mx-auto min-h-screen max-w-lg bg-[#0a0a0a] px-4 py-10 text-white">
      <DocumentVisitForm
        propertyId={propertyId}
        propertyName={propertyName}
        propertyAddress={propertyAddress}
        cancelHref={`/hq/customers/property/${propertyId}`}
        successHref={`/hq/properties/${propertyId}/health`}
        mode="founder"
      />
    </div>
  );
}
