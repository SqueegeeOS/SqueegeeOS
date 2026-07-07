"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, type RefObject } from "react";

/** Damped rim origin — card notices the pointer without tracking it. */
export function useRimPointer<T extends HTMLElement>(
  ref: RefObject<T | null>,
  enabled: boolean,
) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!enabled || reduceMotion) return;

    const element = ref.current;
    if (!element) return;

    const finePointer = window.matchMedia("(pointer: fine)").matches;
    if (!finePointer) return;

    let frame = 0;
    let running = false;
    let targetX = 18;
    let targetY = 0;
    let currentX = 18;
    let currentY = 0;

    const paint = () => {
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;
      element.style.setProperty("--rim-x", `${currentX}%`);
      element.style.setProperty("--rim-y", `${currentY}%`);
      if (Math.abs(targetX - currentX) < 0.1 && Math.abs(targetY - currentY) < 0.1) {
        running = false;
        return;
      }
      frame = window.requestAnimationFrame(paint);
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      targetX = ((event.clientX - rect.left) / rect.width) * 100;
      targetY = ((event.clientY - rect.top) / rect.height) * 100;
      if (!running) {
        running = true;
        frame = window.requestAnimationFrame(paint);
      }
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.cancelAnimationFrame(frame);
    };
  }, [enabled, reduceMotion, ref]);
}
