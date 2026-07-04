"use client";

import { useEffect, useRef, type RefObject } from "react";
import {
  apolloAnimate,
  apolloDelay,
  apolloEase,
  apolloTime,
} from "@/lib/membership/unlock-apollo";
import { playLockClickSound } from "@/lib/membership/unlock-sound";
import type {
  MembershipUnlockContext,
  UnlockTimingProfile,
} from "@/lib/membership/unlock-sequence";
import type { ParticleAnimState } from "./unlock-particle-canvas";

export interface ApolloCeremonyRefs {
  keyWrapper: HTMLDivElement | null;
  lockWrapper: HTMLDivElement | null;
  bloomCore: HTMLDivElement | null;
  bloomFill: HTMLDivElement | null;
  whiteFlash: HTMLDivElement | null;
  ceremonyRoot: HTMLDivElement | null;
  rings: [HTMLDivElement | null, HTMLDivElement | null, HTMLDivElement | null];
}

interface UseApolloCeremonyOptions {
  context: MembershipUnlockContext;
  timingProfile: UnlockTimingProfile;
  animStateRef: RefObject<ParticleAnimState>;
  refs: RefObject<ApolloCeremonyRefs>;
  onWelcomeStep: (step: number) => void;
  onWelcomeVisible: (visible: boolean) => void;
  onSkipHintVisible: (visible: boolean) => void;
  onComplete: () => void;
  onReducedMotion: () => void;
}

function t(ms: number, profile: UnlockTimingProfile) {
  return apolloTime(ms, profile);
}

function fireRing(
  ringEl: HTMLDivElement,
  delayMs: number,
  maxScale: number,
  profile: UnlockTimingProfile,
): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      apolloAnimate(
        t(1200, profile),
        (progress) => {
          const s = 1 + progress * (maxScale - 1);
          ringEl.style.transform = `scale(${s})`;
          ringEl.style.opacity = (0.6 * (1 - progress)).toString();
        },
        resolve,
        apolloEase.outExpo,
      );
    }, delayMs);
  });
}

export function useApolloCeremony({
  context,
  timingProfile,
  animStateRef,
  refs,
  onWelcomeStep,
  onWelcomeVisible,
  onSkipHintVisible,
  onComplete,
  onReducedMotion,
}: UseApolloCeremonyOptions) {
  const cancelledRef = useRef(false);
  const skippableRef = useRef(false);
  const completeRef = useRef(onComplete);

  completeRef.current = onComplete;

  useEffect(() => {
    cancelledRef.current = false;
    skippableRef.current = false;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      onReducedMotion();
      return;
    }

    const state = animStateRef.current;
    if (state) {
      state.running = true;
      state.phase = "ambient";
      state.constellationProgress = 0;
      state.orbitOpacity = 0;
      state.illuminateProgress = 0;
    }

    let breathingActive = false;
    let breatheCancel: (() => void) | undefined;
    const cancelFns: Array<() => void> = [];

    const wait = (ms: number) =>
      apolloDelay(t(ms, timingProfile)).then(() => {
        if (cancelledRef.current) throw new Error("cancelled");
      });

    const completeCeremony = () => {
      if (cancelledRef.current) return;
      const root = refs.current?.ceremonyRoot;
      if (!root) {
        completeRef.current();
        return;
      }
      apolloAnimate(
        t(800, timingProfile),
        (progress) => {
          root.style.opacity = (1 - progress).toString();
        },
        () => {
          if (state) state.running = false;
          completeRef.current();
        },
        apolloEase.inOutCubic,
      );
    };

    const skipCeremony = () => {
      if (!skippableRef.current || cancelledRef.current) return;
      cancelledRef.current = true;
      breathingActive = false;
      breatheCancel?.();
      cancelFns.forEach((fn) => fn());
      if (state) state.running = false;
      completeRef.current();
    };

    const run = async () => {
      try {
        const r = refs.current;
        if (!r?.keyWrapper || !r.lockWrapper) return;

        setTimeout(() => {
          if (!cancelledRef.current) {
            skippableRef.current = true;
            onSkipHintVisible(true);
          }
        }, t(2000, timingProfile));

        await wait(600);

        if (state) state.phase = "constellation";
        cancelFns.push(
          apolloAnimate(
            t(1200, timingProfile),
            (progress) => {
              if (state) state.constellationProgress = progress;
            },
            undefined,
            apolloEase.outExpo,
          ),
        );
        await wait(900);

        r.keyWrapper.style.opacity = "0";
        r.keyWrapper.style.transform =
          "translateY(-40px) rotateX(15deg) rotateZ(-8deg)";
        cancelFns.push(
          apolloAnimate(
            t(1800, timingProfile),
            (progress, raw) => {
              const y = -40 + 40 * apolloEase.outElasticSoft(progress);
              const rotX = 15 - 15 * apolloEase.outCubic(progress);
              const rotZ =
                -8 +
                8 * apolloEase.outCubic(progress) +
                Math.sin(progress * Math.PI * 3) * (3 * (1 - progress));
              const rotY = Math.sin(progress * Math.PI * 1.5) * 25 * (1 - progress);
              const scale = 0.6 + 0.4 * apolloEase.outCubic(progress);

              r.keyWrapper!.style.opacity = Math.min(progress * 3, 1).toString();
              r.keyWrapper!.style.transform = `translateY(${y}px) rotateX(${rotX}deg) rotateY(${rotY}deg) rotateZ(${rotZ}deg) scale(${scale})`;

              if (raw > 0.5 && state) {
                state.constellationProgress = Math.max(0, 1 - (raw - 0.5) * 2);
              }
            },
            undefined,
            apolloEase.outExpo,
          ),
        );
        await wait(700);

        if (state) state.phase = "orbit";
        cancelFns.push(
          apolloAnimate(
            t(800, timingProfile),
            (progress) => {
              if (state) state.orbitOpacity = progress * 0.6;
            },
            undefined,
            apolloEase.outCubic,
          ),
        );

        breathingActive = true;
        const breatheKey = () => {
          if (!breathingActive || cancelledRef.current) return;
          breatheCancel = apolloAnimate(
            t(2000, timingProfile),
            (progress) => {
              const glow = 20 + Math.sin(progress * Math.PI) * 10;
              r.keyWrapper!.style.filter = `drop-shadow(0 0 ${glow}px rgba(200,200,220,0.3))`;
            },
            () => {
              if (breathingActive) breatheKey();
            },
            apolloEase.inOutCubic,
          );
        };
        breatheKey();

        await wait(1200);

        r.lockWrapper.style.opacity = "0";
        r.lockWrapper.style.transform = "translate(-50%, -50%) scale(0.85)";
        cancelFns.push(
          apolloAnimate(
            t(600, timingProfile),
            (progress) => {
              r.lockWrapper!.style.opacity = (progress * 0.9).toString();
              const s = 0.85 + 0.15 * apolloEase.outCubic(progress);
              r.lockWrapper!.style.transform = `translate(-50%, -50%) scale(${s})`;
            },
            undefined,
            apolloEase.outCubic,
          ),
        );

        await wait(400);
        cancelFns.push(
          apolloAnimate(
            t(900, timingProfile),
            (progress) => {
              const moveDown = progress * 40;
              const rotZ = Math.sin(progress * Math.PI * 0.5) * 3;
              r.keyWrapper!.style.transform = `translateY(${moveDown}px) rotateZ(${rotZ}deg)`;
              r.keyWrapper!.style.filter = `drop-shadow(0 0 ${20 + progress * 20}px rgba(220,220,255,${0.3 + progress * 0.3}))`;
            },
            undefined,
            apolloEase.outCubic,
          ),
        );
        await wait(900);

        breathingActive = false;
        cancelFns.push(
          apolloAnimate(
            t(700, timingProfile),
            (progress) => {
              const baseY = 40;
              const rotZ = progress * 90;
              r.keyWrapper!.style.transform = `translateY(${baseY}px) rotateZ(${rotZ}deg)`;
              r.keyWrapper!.style.filter = `drop-shadow(0 0 ${40 + progress * 60}px rgba(255,255,255,${0.4 + progress * 0.6}))`;
            },
            () => playLockClickSound(),
            apolloEase.inOutCubic,
          ),
        );
        await wait(500);

        if (r.rings[0]) void fireRing(r.rings[0], 0, 8, timingProfile);
        if (r.rings[1]) void fireRing(r.rings[1], t(200, timingProfile), 12, timingProfile);
        if (r.rings[2]) void fireRing(r.rings[2], t(400, timingProfile), 16, timingProfile);

        await wait(300);

        if (state) state.phase = "illuminate";
        cancelFns.push(
          apolloAnimate(
            t(400, timingProfile),
            (progress) => {
              if (state) state.illuminateProgress = progress;
            },
            undefined,
            apolloEase.outCubic,
          ),
        );

        if (r.bloomCore) {
          cancelFns.push(
            apolloAnimate(
              t(600, timingProfile),
              (progress) => {
                r.bloomCore!.style.opacity = (progress * 0.9).toString();
                const size = 4 + progress * 8;
                r.bloomCore!.style.width = `${size}px`;
                r.bloomCore!.style.height = `${size}px`;
              },
              undefined,
              apolloEase.outCubic,
            ),
          );
        }

        await wait(200);

        if (r.bloomFill) {
          cancelFns.push(
            apolloAnimate(
              t(800, timingProfile),
              (progress) => {
                r.bloomFill!.style.opacity = (progress * 0.8).toString();
                r.keyWrapper!.style.filter = `drop-shadow(0 0 ${60 + progress * 40}px rgba(255,255,255,${0.8 + progress * 0.2})) brightness(${1 + progress * 3})`;
                r.lockWrapper!.style.opacity = (0.9 - progress * 0.9).toString();
              },
              undefined,
              apolloEase.outExpo,
            ),
          );
        }

        await wait(400);

        if (r.whiteFlash) {
          cancelFns.push(
            apolloAnimate(
              t(400, timingProfile),
              (progress) => {
                r.whiteFlash!.style.opacity = progress.toString();
                r.keyWrapper!.style.opacity = (1 - progress).toString();
                if (r.bloomFill) r.bloomFill.style.opacity = (0.8 - progress * 0.8).toString();
                if (r.bloomCore) r.bloomCore.style.opacity = (0.9 - progress * 0.9).toString();
              },
              undefined,
              apolloEase.inQuart,
            ),
          );
        }

        await wait(400);

        if (state) state.running = false;
        onSkipHintVisible(false);
        onWelcomeVisible(true);

        if (r.whiteFlash) {
          cancelFns.push(
            apolloAnimate(
              t(1200, timingProfile),
              (progress) => {
                r.whiteFlash!.style.opacity = (1 - progress * 0.85).toString();
              },
              undefined,
              apolloEase.outExpo,
            ),
          );
        }

        await wait(400);

        const advance = async (next: number, delayMs = 0) => {
          if (delayMs) await wait(delayMs);
          onWelcomeStep(next);
        };

        await advance(1);
        await advance(2, 200);
        await advance(3, 400);
        await advance(4, 500);
        await advance(5, 400);
        await advance(6, 400);
        await advance(7, 200);

        for (let i = 0; i < 5; i++) {
          await advance(7 + i + 1, 120);
        }

        await advance(12, 400);
        await advance(13, 400);
        await wait(2200);
        completeCeremony();
      } catch {
        // cancelled
      }
    };

    void run();

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        skippableRef.current &&
        (e.key === "Escape" || e.key === " " || e.key === "Enter")
      ) {
        e.preventDefault();
        skipCeremony();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      cancelledRef.current = true;
      breathingActive = false;
      breatheCancel?.();
      cancelFns.forEach((fn) => fn());
      window.removeEventListener("keydown", onKeyDown);
      if (state) state.running = false;
    };
  }, [
    animStateRef,
    context,
    onComplete,
    onReducedMotion,
    onSkipHintVisible,
    onWelcomeStep,
    onWelcomeVisible,
    refs,
    timingProfile,
  ]);

  return { skipCeremony: () => skippableRef.current };
}
