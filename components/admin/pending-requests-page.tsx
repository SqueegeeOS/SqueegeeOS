"use client";

import { useState } from "react";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { PendingRequestsInbox } from "@/components/admin/pending-requests-inbox";
import { isAdminUnlocked } from "@/lib/admin/pin";

export function PendingRequestsPage() {
  const [unlocked, setUnlocked] = useState(() => isAdminUnlocked());

  if (!unlocked) {
    return <AdminPinGate onUnlock={() => setUnlocked(true)} />;
  }

  return <PendingRequestsInbox />;
}
