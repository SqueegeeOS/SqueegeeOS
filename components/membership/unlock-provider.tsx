"use client";

import {
  createContext,
  useCallback,
  useContext,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type {
  MembershipUnlockContext,
  UnlockPlaybackOptions,
} from "@/lib/membership/unlock-sequence";
import {
  buildMemberPortalPath,
  markMemberWelcomePending,
  resolveUnlockPlayback,
} from "@/lib/membership/unlock-sequence";

export const UNLOCK_CEREMONY_REQUEST = "squeegeeking:request-unlock-ceremony";

interface MembershipUnlockContextValue {
  beginMembershipUnlock: (
    context: MembershipUnlockContext,
    options?: UnlockPlaybackOptions,
  ) => void;
}

const UnlockContext = createContext<MembershipUnlockContextValue | null>(null);

export function MembershipUnlockProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

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

      markMemberWelcomePending();
      navigateToPortal(context);

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent(UNLOCK_CEREMONY_REQUEST, {
            detail: {
              forceCeremony: playback.action === "ceremony",
            },
          }),
        );
      }
    },
    [navigateToPortal],
  );

  return (
    <UnlockContext.Provider value={{ beginMembershipUnlock }}>
      {children}
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
