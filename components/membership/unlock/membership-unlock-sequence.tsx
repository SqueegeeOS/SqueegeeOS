"use client";

import { useCallback, useRef, useState } from "react";
import {
  APOLLO_COLORS,
  buildApolloWelcomeContent,
  getApolloCeremonyEstimateMs,
} from "@/lib/membership/unlock-apollo";
import {
  markMemberWelcomePending,
  type MembershipUnlockContext,
  type UnlockTimingProfile,
} from "@/lib/membership/unlock-sequence";
import { ApolloKeySvg, ApolloLockSvg } from "./apollo-svg";
import { ApolloWelcome } from "./apollo-welcome";
import {
  UnlockParticleCanvas,
  type ParticleAnimState,
} from "./unlock-particle-canvas";
import {
  useApolloCeremony,
  type ApolloCeremonyRefs,
} from "./use-apollo-ceremony";

interface MembershipUnlockSequenceProps {
  context: MembershipUnlockContext;
  timingProfile: UnlockTimingProfile;
  onComplete: () => void;
  previewMode?: boolean;
}

export function MembershipUnlockSequence({
  context,
  timingProfile,
  onComplete,
  previewMode = false,
}: MembershipUnlockSequenceProps) {
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const [welcomeStep, setWelcomeStep] = useState(0);
  const [skipHintVisible, setSkipHintVisible] = useState(false);
  const completedRef = useRef(false);

  const animStateRef = useRef<ParticleAnimState>({
    phase: "ambient",
    constellationProgress: 0,
    orbitOpacity: 0,
    illuminateProgress: 0,
    running: true,
  });

  const ceremonyRefs = useRef<ApolloCeremonyRefs>({
    keyWrapper: null,
    lockWrapper: null,
    bloomCore: null,
    bloomFill: null,
    whiteFlash: null,
    ceremonyRoot: null,
    rings: [null, null, null],
  });

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (!previewMode) {
      markMemberWelcomePending();
    }
    onComplete();
  }, [onComplete, previewMode]);

  const handleReducedMotion = useCallback(() => {
    if (!previewMode) {
      markMemberWelcomePending();
    }
    finish();
  }, [finish, previewMode]);

  const handleSkip = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    animStateRef.current.running = false;
    if (!previewMode) {
      markMemberWelcomePending();
    }
    onComplete();
  }, [onComplete, previewMode]);

  useApolloCeremony({
    context,
    timingProfile,
    animStateRef,
    refs: ceremonyRefs,
    onWelcomeStep: setWelcomeStep,
    onWelcomeVisible: setWelcomeVisible,
    onSkipHintVisible: setSkipHintVisible,
    onComplete: finish,
    onReducedMotion: handleReducedMotion,
  });

  const welcomeContent = buildApolloWelcomeContent(context);

  return (
    <div
      ref={(el) => {
        ceremonyRefs.current.ceremonyRoot = el;
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Membership welcome ceremony"
      aria-live="polite"
      className="fixed inset-0 z-[250] flex cursor-pointer items-center justify-center overflow-hidden"
      style={{ background: APOLLO_COLORS.darker }}
      onClick={() => {
        if (skipHintVisible) handleSkip();
      }}
    >
      {/* Vignette */}
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.7) 100%)",
        }}
        aria-hidden
      />

      <UnlockParticleCanvas animStateRef={animStateRef} />

      {/* Key stage */}
      <div
        className="absolute inset-0 z-[3] flex items-center justify-center"
        style={{ perspective: "1200px" }}
      >
        <div
          ref={(el) => {
            ceremonyRefs.current.keyWrapper = el;
          }}
          className="relative h-[280px] w-[120px] opacity-0 will-change-[transform,opacity,filter]"
          style={{
            transformStyle: "preserve-3d",
            filter: "drop-shadow(0 0 20px rgba(200,200,220,0.3))",
          }}
        >
          <ApolloKeySvg className="h-full w-full" />
        </div>

        <div
          ref={(el) => {
            ceremonyRefs.current.lockWrapper = el;
          }}
          className="absolute left-1/2 top-[calc(50%+60px)] h-20 w-20 -translate-x-1/2 -translate-y-1/2 opacity-0 will-change-[transform,opacity]"
        >
          <ApolloLockSvg className="h-full w-full" />
        </div>
      </div>

      {/* Bloom layers */}
      <div
        ref={(el) => {
          ceremonyRefs.current.bloomCore = el;
        }}
        className="pointer-events-none absolute left-1/2 top-1/2 z-[5] h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0"
        style={{
          boxShadow:
            "0 0 20px 10px rgba(255,255,255,0.8), 0 0 60px 30px rgba(255,255,255,0.4), 0 0 120px 60px rgba(255,255,255,0.2), 0 0 200px 100px rgba(255,255,255,0.1)",
        }}
        aria-hidden
      />

      <div
        ref={(el) => {
          ceremonyRefs.current.bloomFill = el;
        }}
        className="pointer-events-none absolute inset-0 z-[6] opacity-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255,255,255,1) 0%, rgba(253,252,250,0.95) 20%, rgba(255,255,255,0.6) 50%, transparent 80%)",
        }}
        aria-hidden
      />

      <div
        ref={(el) => {
          ceremonyRefs.current.whiteFlash = el;
        }}
        className="pointer-events-none absolute inset-0 z-[7] opacity-0"
        style={{ background: APOLLO_COLORS.warmWhite }}
        aria-hidden
      />

      {/* Light rings */}
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          ref={(el) => {
            ceremonyRefs.current.rings[index] = el;
          }}
          className="pointer-events-none absolute left-1/2 top-1/2 z-[4] h-[100px] w-[100px] -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full border border-white/60 opacity-0"
          aria-hidden
        />
      ))}

      <ApolloWelcome
        content={welcomeContent}
        visible={welcomeVisible}
        step={welcomeStep}
      />

      <p
        className="pointer-events-none absolute bottom-8 left-1/2 z-10 -translate-x-1/2 font-sans text-[10px] font-extralight uppercase tracking-[0.3em] text-white/20 transition-opacity duration-300"
        style={{ opacity: skipHintVisible && !welcomeVisible ? 1 : 0 }}
      >
        Tap anywhere to continue
      </p>

      <span className="sr-only">
        Membership unlock ceremony for {context.propertyName}. Portal loading.
      </span>
    </div>
  );
}

export function getCeremonyDurationMs(profile: UnlockTimingProfile): number {
  return getApolloCeremonyEstimateMs(profile);
}
