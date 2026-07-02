"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type {
  MembershipUnlockContext,
  UnlockPlaybackOptions,
  UnlockTimingProfile,
} from "@/lib/membership/unlock-sequence";
import {
  buildMemberPortalPath,
  markMemberWelcomePending,
  markUnlockCeremonySeen,
  resolveUnlockPlayback,
} from "@/lib/membership/unlock-sequence";
import { MembershipUnlockSequence } from "./unlock/membership-unlock-sequence";

interface ActiveUnlock {
  context: MembershipUnlockContext;
  profile: UnlockTimingProfile;
}

interface MembershipUnlockContextValue {
  beginMembershipUnlock: (
    context: MembershipUnlockContext,
    options?: UnlockPlaybackOptions,
  ) => void;
}

const UnlockContext = createContext<MembershipUnlockContextValue | null>(null);

export function MembershipUnlockProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [activeUnlock, setActiveUnlock] = useState<ActiveUnlock | null>(null);

  const navigateToPortal = useCallback(
    (context: MembershipUnlockContext) => {
      router.push(
        buildMemberPortalPath(context.homeownerSlug, context.propertySlug),
      );
    },
    [router],
  );

  const beginMembershipUnlock = useCallback(
    (context: MembershipUnlockContext, options?: UnlockPlaybackOptions) => {
      const playback = resolveUnlockPlayback(context, options);

      if (playback.action === "skip") {
        markMemberWelcomePending();
        navigateToPortal(context);
        return;
      }

      setActiveUnlock({ context, profile: playback.profile });
    },
    [navigateToPortal],
  );

  const handleComplete = useCallback(() => {
    if (!activeUnlock) return;
    markUnlockCeremonySeen(
      activeUnlock.context.homeownerSlug,
      activeUnlock.context.propertySlug,
    );
    const path = buildMemberPortalPath(
      activeUnlock.context.homeownerSlug,
      activeUnlock.context.propertySlug,
    );
    setActiveUnlock(null);
    router.push(path);
  }, [activeUnlock, router]);

  return (
    <UnlockContext.Provider value={{ beginMembershipUnlock }}>
      {children}
      {activeUnlock && (
        <MembershipUnlockSequence
          context={activeUnlock.context}
          timingProfile={activeUnlock.profile}
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
