"use client";

import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { PendingRequestsInbox } from "@/components/admin/pending-requests-inbox";
import { useAdminUnlockedState } from "@/lib/admin/use-admin-unlocked-state";

export function PendingRequestsPage() {
  const [unlocked, setUnlocked] = useAdminUnlockedState();

  if (!unlocked) {
    return <AdminPinGate onUnlock={() => setUnlocked(true)} />;
  }

  return <PendingRequestsInbox />;
}
