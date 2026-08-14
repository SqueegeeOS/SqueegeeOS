"use client";

import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { PendingRequestDetail } from "@/components/admin/pending-request-detail";
import { useAdminUnlockedState } from "@/lib/admin/use-admin-unlocked-state";

export function PendingRequestDetailPage({ id }: { id: string }) {
  const [unlocked, setUnlocked] = useAdminUnlockedState();

  if (!unlocked) {
    return <AdminPinGate onUnlock={() => setUnlocked(true)} />;
  }

  return <PendingRequestDetail id={id} />;
}
