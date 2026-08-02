"use client";

import {
  type FocusEvent,
  type MutableRefObject,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
} from "react";

export const REVIEW_AUTO_ADVANCE_MS = 5_500;
const REVIEW_MANUAL_PAUSE_MS = 8_000;
const REVIEW_EDGE_TOLERANCE_PX = 4;

interface ReviewRailMetrics {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
}

interface ReviewRailAutoplayOptions {
  hasOverflow: boolean;
  itemCount: number;
  reducedMotion: boolean;
}

export function shouldAutoAdvanceReviews({
  hasOverflow,
  itemCount,
  reducedMotion,
}: ReviewRailAutoplayOptions): boolean {
  return hasOverflow && itemCount > 1 && !reducedMotion;
}

export function getNextReviewScrollLeft({
  scrollLeft,
  clientWidth,
  scrollWidth,
}: ReviewRailMetrics): number {
  const maximum = Math.max(0, scrollWidth - clientWidth);
  if (maximum <= REVIEW_EDGE_TOLERANCE_PX) return 0;
  if (scrollLeft >= maximum - REVIEW_EDGE_TOLERANCE_PX) return 0;

  const page = Math.max(clientWidth - 32, 240);
  return Math.min(scrollLeft + page, maximum);
}

function setPauseReason(
  reasons: MutableRefObject<{ focus: boolean; hover: boolean }>,
  reason: "focus" | "hover",
  value: boolean,
) {
  reasons.current[reason] = value;
}

export function useReviewRailAutoplay(
  railRef: RefObject<HTMLDivElement | null>,
  options: ReviewRailAutoplayOptions,
) {
  const { hasOverflow, itemCount, reducedMotion } = options;
  const pauseReasonsRef = useRef({ focus: false, hover: false });
  const resumeAfterRef = useRef(0);

  useEffect(() => {
    if (
      !shouldAutoAdvanceReviews({
        hasOverflow,
        itemCount,
        reducedMotion,
      })
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      const rail = railRef.current;
      const { focus, hover } = pauseReasonsRef.current;

      if (
        !rail ||
        focus ||
        hover ||
        Date.now() < resumeAfterRef.current ||
        document.visibilityState === "hidden"
      ) {
        return;
      }

      rail.scrollTo({
        left: getNextReviewScrollLeft(rail),
        behavior: "smooth",
      });
    }, REVIEW_AUTO_ADVANCE_MS);

    return () => window.clearInterval(interval);
  }, [hasOverflow, itemCount, reducedMotion, railRef]);

  const pauseAfterManualNavigation = useCallback(() => {
    resumeAfterRef.current = Date.now() + REVIEW_MANUAL_PAUSE_MS;
  }, []);

  const onMouseEnter = useCallback(() => {
    setPauseReason(pauseReasonsRef, "hover", true);
  }, []);

  const onMouseLeave = useCallback(() => {
    setPauseReason(pauseReasonsRef, "hover", false);
  }, []);

  const onFocusCapture = useCallback(() => {
    setPauseReason(pauseReasonsRef, "focus", true);
  }, []);

  const onBlurCapture = useCallback((event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setPauseReason(pauseReasonsRef, "focus", false);
    }
  }, []);

  return {
    onBlurCapture,
    onFocusCapture,
    onMouseEnter,
    onMouseLeave,
    pauseAfterManualNavigation,
  };
}
