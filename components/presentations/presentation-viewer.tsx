"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { easeEngineered, spring } from "@/lib/motion/system";
import { SlideRenderer } from "./slide-renderer";
import { PresentationOnboarding } from "./presentation-onboarding";
import {
  readOnboardingStep,
  shouldResumeOnboarding,
} from "@/lib/presentations/onboarding-session";
import { getPresentationSlides, type PresentationData } from "@/lib/presentations/types";

const easeEngineeredTuple = [...easeEngineered] as [number, number, number, number];

/** Keynote slide choreography — incoming rises into focus, outgoing softens. */
const slideVariants: Variants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction * 14,
    scale: 0.995,
    filter: "blur(6px)",
  }),
  center: {
    opacity: 1,
    x: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: spring.glass,
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -10,
    filter: "blur(4px)",
    transition: { duration: 0.22, ease: easeEngineeredTuple },
  }),
};

const slideVariantsReduced: Variants = {
  enter: () => ({ opacity: 0 }),
  center: { opacity: 1, transition: { duration: 0.12 } },
  exit: () => ({ opacity: 0, transition: { duration: 0.1 } }),
};

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {direction === "left" ? (
        <path d="M9.5 3.5 5 8l4.5 4.5" />
      ) : (
        <path d="M6.5 3.5 11 8l-4.5 4.5" />
      )}
    </svg>
  );
}

export function PresentationViewer({
  presentation,
  onPresentationChange,
}: {
  presentation: PresentationData;
  onPresentationChange?: (next: PresentationData) => void;
}) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [slidePosition, setSlidePosition] = useState({ index: 0, direction: 1 });
  const currentIndex = slidePosition.index;
  const stageRef = useRef<HTMLDivElement>(null);
  const [signing, setSigning] = useState(() => {
    if (presentation.onboardingStatus === "pending_payment") return true;
    if (presentation.onboardingStatus === "complete") return false;
    return shouldResumeOnboarding(presentation.id, presentation.onboardingStatus);
  });
  const [signingTier, setSigningTier] = useState<PresentationData["tier"]>(
    presentation.tier,
  );
  const recoveryChecked = useRef(false);

  const slides = getPresentationSlides(presentation);
  const totalSlides = slides.length;
  const currentSlide = slides[currentIndex] ?? slides[0];

  useEffect(() => {
    if (recoveryChecked.current) return;
    recoveryChecked.current = true;

    if (presentation.onboardingStatus === "complete") {
      return;
    }

    if (presentation.onboardingStatus === "pending_payment") {
      setSigning(true);
      return;
    }

    const savedStep = readOnboardingStep(presentation.id);
    if (savedStep && savedStep !== "sign") {
      setSigning(true);
      return;
    }

    let cancelled = false;

    async function checkRecovery() {
      try {
        const res = await fetch(
          `/api/membership/onboarding-status?presentationId=${presentation.id}`,
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          onboardingIncomplete?: boolean;
          onboardingStatus?: string | null;
        };
        if (cancelled) return;
        if (data.onboardingStatus === "complete") return;
        if (data.onboardingIncomplete) {
          setSigning(true);
        }
      } catch {
        // Local-only — no cloud recovery.
      }
    }

    if (presentation.status === "signed" && !presentation.onboardingStatus) {
      void checkRecovery();
    }
  }, [presentation.id, presentation.onboardingStatus, presentation.status]);

  const next = useCallback(() => {
    setSlidePosition((p) => ({
      index: Math.min(p.index + 1, totalSlides - 1),
      direction: 1,
    }));
  }, [totalSlides]);

  const prev = useCallback(() => {
    setSlidePosition((p) => ({ index: Math.max(p.index - 1, 0), direction: -1 }));
  }, []);

  const goTo = useCallback((index: number) => {
    setSlidePosition((p) => ({ index, direction: index >= p.index ? 1 : -1 }));
  }, []);

  useEffect(() => {
    stageRef.current?.scrollTo({ top: 0 });
  }, [currentIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (signing) return;
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        next();
      }
      if (e.key === "ArrowLeft") prev();
      if (e.key === "Escape") {
        router.push(`/presentations/${presentation.id}/edit`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, presentation.id, router, signing]);

  useEffect(() => {
    if (currentIndex > 0 && presentation.status === "draft") {
      void fetch(`/api/presentations/${presentation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "presented" }),
      });
    }
  }, [currentIndex, presentation.id, presentation.status]);

  if (!currentSlide) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#060606] text-[#f5f2eb]">
        <p className="text-sm text-white/50">No slides available for this presentation.</p>
      </div>
    );
  }

  const variants = reducedMotion ? slideVariantsReduced : slideVariants;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#060606] text-[#f5f2eb]">
      {/* Environment layer — lit stage behind every slide */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -12%, rgba(201,184,150,0.07), transparent 65%)",
        }}
        aria-hidden
      />
      <div
        className="motion-grain pointer-events-none absolute inset-0 opacity-[0.03]"
        aria-hidden
      />

      <div
        ref={stageRef}
        className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain"
      >
        <AnimatePresence mode="wait" custom={slidePosition.direction} initial={false}>
          <motion.div
            key={currentSlide.id}
            custom={slidePosition.direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            className="flex min-h-full flex-col [&>*]:flex-1"
          >
            <SlideRenderer
              slideType={currentSlide.id}
              presentation={presentation}
              overrides={presentation.slideOverrides?.[currentSlide.id]}
              onSign={(tier) => {
                setSigningTier(tier);
                setSigning(true);
              }}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      <p className="sr-only" aria-live="polite">
        Slide {currentIndex + 1} of {totalSlides}
      </p>

      <footer
        className="relative flex min-h-[64px] items-center justify-between border-t border-white/[0.08] bg-[#060606]/80 px-6 backdrop-blur-md sm:px-8"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <span className="text-[11px] tracking-[0.2em] text-white/45 tabular-nums" aria-hidden>
          {String(currentIndex + 1).padStart(2, "0")}
          <span className="mx-1.5 text-white/20">/</span>
          {String(totalSlides).padStart(2, "0")}
        </span>

        <div className="flex items-center gap-1">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === currentIndex ? "true" : undefined}
              className="group rounded-full p-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent/60"
            >
              <span
                className="block h-1.5 rounded-full transition-[width,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{
                  width: i === currentIndex ? 20 : 6,
                  background:
                    i === currentIndex
                      ? "rgba(201,184,150,0.85)"
                      : "rgba(255,255,255,0.22)",
                }}
              />
            </button>
          ))}
        </div>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={prev}
            disabled={currentIndex === 0}
            aria-label="Previous slide"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition-colors duration-200 hover:border-white/25 hover:text-white active:scale-[0.97] disabled:opacity-30 disabled:hover:border-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent/60"
          >
            <Chevron direction="left" />
          </button>
          <button
            type="button"
            onClick={next}
            disabled={currentIndex === totalSlides - 1}
            aria-label="Next slide"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition-colors duration-200 hover:border-white/25 hover:text-white active:scale-[0.97] disabled:opacity-30 disabled:hover:border-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent/60"
          >
            <Chevron direction="right" />
          </button>
        </div>
      </footer>

      {signing ? (
        <PresentationOnboarding
          presentation={presentation}
          selectedTier={signingTier}
          onClose={() => setSigning(false)}
          onPresentationChange={onPresentationChange}
          onDone={() => {
            setSigning(false);
            router.push(`/presentations/${presentation.id}/edit`);
          }}
        />
      ) : null}
    </div>
  );
}
