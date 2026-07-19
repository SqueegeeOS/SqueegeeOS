"use client";

import { useEffect, useRef } from "react";

/**
 * The night itself — a fixed starfield behind the whole page.
 * Stars drift with scroll at three parallax depths and twinkle on a slow
 * phase. Cheap by design: one canvas, capped star count and DPR, paused
 * when the tab is hidden. Reduced motion renders one static frame.
 */
export function Starfield({ opacity = 1 }: { opacity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let raf = 0;
    let stars: Array<{
      x: number; y: number; r: number; depth: number; phase: number; gold: boolean;
    }> = [];

    const seed = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(Math.round((width * height) / 8500), 240);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.4 + Math.random() * 1.1,
        depth: 0.12 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
        gold: Math.random() < 0.14,
      }));
    };

    const draw = (t: number) => {
      const scroll = window.scrollY;
      ctx.clearRect(0, 0, width, height);
      for (const s of stars) {
        const y = (((s.y - scroll * s.depth * 0.18) % height) + height) % height;
        const tw = reduced ? 0.75 : 0.55 + 0.45 * Math.sin(t / 1600 + s.phase);
        ctx.globalAlpha = tw * 0.9;
        ctx.fillStyle = s.gold ? "#d4b98c" : "#e8ecf5";
        ctx.beginPath();
        ctx.arc(s.x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const loop = (t: number) => {
      draw(t);
      raf = requestAnimationFrame(loop);
    };

    seed();
    if (reduced) {
      draw(0);
    } else {
      raf = requestAnimationFrame(loop);
    }

    const onResize = () => {
      seed();
      if (reduced) draw(0);
    };
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!reduced && document.visibilityState === "visible") {
        raf = requestAnimationFrame(loop);
      }
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{ opacity }}
    />
  );
}
