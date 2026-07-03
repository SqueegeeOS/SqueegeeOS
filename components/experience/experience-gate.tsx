"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { isAdminUnlocked } from "@/lib/admin/pin";

export function ExperienceGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [ready, setReady] = useState(false);

  const handleUnlock = useCallback(() => setUnlocked(true), []);

  useEffect(() => {
    setUnlocked(isAdminUnlocked());
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-background text-muted">
        Opening Experience Lab…
      </div>
    );
  }

  if (!unlocked) {
    return <AdminPinGate onUnlock={handleUnlock} />;
  }

  return <>{children}</>;
}
