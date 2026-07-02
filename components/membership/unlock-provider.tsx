"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { MembershipUnlockContext } from "@/lib/membership/unlock-sequence";
import { buildMemberPortalPath } from "@/lib/membership/unlock-sequence";
import { MembershipUnlockSequence } from "./unlock/membership-unlock-sequence";

interface MembershipUnlockContextValue {
  beginMembershipUnlock: (context: MembershipUnlockContext) => void;
}

const UnlockContext = createContext<MembershipUnlockContextValue | null>(null);

export function MembershipUnlockProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [unlockContext, setUnlockContext] =
    useState<MembershipUnlockContext | null>(null);

  const beginMembershipUnlock = useCallback(
    (context: MembershipUnlockContext) => {
      setUnlockContext(context);
    },
    [],
  );

  const handleComplete = useCallback(() => {
    if (!unlockContext) return;
    const path = buildMemberPortalPath(
      unlockContext.homeownerSlug,
      unlockContext.propertySlug,
    );
    setUnlockContext(null);
    router.push(path);
  }, [router, unlockContext]);

  return (
    <UnlockContext.Provider value={{ beginMembershipUnlock }}>
      {children}
      {unlockContext && (
        <MembershipUnlockSequence
          context={unlockContext}
          onComplete={handleComplete}
        />
      )}
    </UnlockContext.Provider>
  );
}

export function useMembershipUnlock() {
  const ctx = useContext(UnlockContext);
  if (!ctx) {
    throw new Error(
      "useMembershipUnlock must be used within MembershipUnlockProvider",
    );
  }
  return ctx;
}
