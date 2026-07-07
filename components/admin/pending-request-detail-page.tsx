"use client";

import { useState } from "react";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { PendingRequestDetail } from "@/components/admin/pending-request-detail";
import { isAdminUnlocked } from "@/lib/admin/pin";

export function PendingRequestDetailPage({ id }: { id: string }) {
  const [unlocked, setUnlocked] = useState(() => isAdminUnlocked());

  if (!unlocked) {
    return <AdminPinGate onUnlock={() => setUnlocked(true)} />;
  }

  return <PendingRequestDetail id={id} />;
}
