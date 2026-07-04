"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { spring } from "@/lib/motion/system";

export function AmbientField({ breathing = true }: { breathing?: boolean }) {
  const reduceMotion = useReducedMotion();
  const glowRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((event: PointerEvent) => {
    const el = glowRef.current;
    if (!el) return;
    const x = (event.clientX / window.innerWidth) * 100;
    const y = (event.clientY / window.innerHeight) * 100;
    el.style.setProperty("--mouse-x", `${x}%`);
    el.style.setProperty("--mouse-y", `${y}%`);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    window.addEventListener("pointermove", handleMove, { passive: true });
    return () => window.removeEventListener("pointermove", handleMove);
  }, [handleMove, reduceMotion]);

  return (
    <>
      <motion.div
        aria-hidden
        className="motion-grain pointer-events-none fixed inset-0 z-0 opacity-[0.04]"
        initial={{ opacity: 0 }}
        animate={{ opacity: reduceMotion ? 0.03 : [0.025, 0.045, 0.025] }}
        transition={
          reduceMotion
            ? { duration: 0.3 }
            : { duration: 14, repeat: Infinity, ease: "easeInOut" }
        }
      />
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,rgba(201,184,150,0.07),transparent_58%)]"
        initial={{ opacity: 0 }}
        animate={{
          opacity: reduceMotion ? 1 : breathing ? [0.6, 1, 0.6] : 1,
          scale: reduceMotion ? 1 : breathing ? [1, 1.015, 1] : 1,
        }}
        transition={
          reduceMotion
            ? { duration: 0.5, delay: 0.1 }
            : { duration: 10, repeat: Infinity, ease: "easeInOut", delay: 0.14 }
        }
      />
      <div
        ref={glowRef}
        aria-hidden
        className="motion-mouse-glow pointer-events-none fixed inset-0 z-0"
        style={
          {
            "--mouse-x": "50%",
            "--mouse-y": "40%",
          } as React.CSSProperties
        }
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_bottom,rgba(0,0,0,0.35),transparent_65%)]"
      />
    </>
  );
}

export function AmbientFieldScoped({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate min-h-[100svh] overflow-x-hidden">
      <AmbientField />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
