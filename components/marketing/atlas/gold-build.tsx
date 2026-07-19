"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AtlasMark } from "@/components/theme/atlas-mark";

const GOLD = "#d4b98c";
const IVORY = "#f2efe7";
const MIST = "#8f9ab0";

/*
 * THE GOLD BUILD — a phone rises from the dark; gold bars pour out of its
 * screen and assemble, bar by bar, into a house; the house turns slowly in
 * space; the line lands. Slow is smooth, smooth is fast: every movement is
 * scroll-owned, eased, and composed of transforms/opacity only.
 *
 * PROVISIONAL SLOGAN — awaiting founder approval, easy to swap below.
 */
const SLOGAN = "Your whole home, in your hand.";
const SLOGAN_SUB = "HomeAtlas comes with every membership.";

/** House drawn as line segments in a local coordinate space (y down). */
const SEGMENTS: Array<[number, number, number, number]> = [
  [-95, 85, 95, 85],    // floor
  [-95, 85, -95, 8],    // left wall
  [95, 85, 95, 8],      // right wall
  [-108, 12, 0, -72],   // roof left
  [108, 12, 0, -72],    // roof right
  [-20, 85, -20, 42],   // door left
  [20, 85, 20, 42],     // door right
  [-20, 42, 20, 42],    // door lintel
  [-70, 30, -38, 30],   // window left sill
  [-70, 52, -38, 52],   // window left head
  [38, 30, 70, 30],     // window right sill
  [38, 52, 70, 52],     // window right head
  [52, -38, 52, -6],    // chimney
];

const BAR_LENGTH = 24;

interface Bar {
  x: number; y: number; angle: number; order: number;
}

function buildBars(): Bar[] {
  const bars: Bar[] = [];
  for (const [x1, y1, x2, y2] of SEGMENTS) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    const count = Math.max(Math.round(length / BAR_LENGTH), 1);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    for (let i = 0; i < count; i += 1) {
      const t = (i + 0.5) / count;
      bars.push({ x: x1 + dx * t, y: y1 + dy * t, angle, order: 0 });
    }
  }
  // Deterministic shuffle for the pour order — same build every visit.
  let seed = 42;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const order = bars.map((_, i) => i).sort(() => random() - 0.5);
  order.forEach((barIndex, position) => { bars[barIndex].order = position; });
  return bars;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

export function GoldBuild() {
  const bars = useMemo(() => buildBars(), []);
  const sectionRef = useRef<HTMLElement | null>(null);
  const phoneRef = useRef<HTMLDivElement | null>(null);
  const houseRef = useRef<HTMLDivElement | null>(null);
  const sloganRef = useRef<HTMLDivElement | null>(null);
  const barRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const fn = () => setReduced(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    let queued = false;

    const apply = () => {
      queued = false;
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = Math.max(rect.height - window.innerHeight, 1);
      const p = clamp01(Math.min(Math.max(-rect.top, 0), total) / total);

      // Phone: rises 0 → 0.18, breathes, then recedes during the turn.
      const rise = easeOut(clamp01(p / 0.18));
      const recede = smooth(clamp01((p - 0.72) / 0.2));
      if (phoneRef.current) {
        phoneRef.current.style.transform =
          `translate(-50%, ${(1 - rise) * 130 + recede * 26}%) rotateX(${8 - rise * 8 + recede * 6}deg)`;
        phoneRef.current.style.opacity = String(rise * (1 - recede * 0.55));
      }

      // Bars: pour 0.16 → 0.68, each on its own staggered window.
      const pour = clamp01((p - 0.16) / 0.52);
      const n = bars.length;
      for (let i = 0; i < n; i += 1) {
        const node = barRefs.current[i];
        if (!node) continue;
        const bar = bars[i];
        const start = (bar.order / n) * 0.72;
        const t = easeOut(clamp01((pour - start) / 0.28));
        // Quadratic arc from the phone mouth (0, 210) to the bar's slot.
        const arcX = bar.x * 0.35 + (bar.order % 2 ? 90 : -90);
        const mx = (0 + bar.x) / 2 + arcX * (1 - t) * 0.4;
        const my = (210 + bar.y) / 2 - 80;
        const ix = (1 - t) * (1 - t) * 0 + 2 * (1 - t) * t * mx + t * t * bar.x;
        const iy = (1 - t) * (1 - t) * 210 + 2 * (1 - t) * t * my + t * t * bar.y;
        const spin = (1 - t) * (bar.order % 2 ? 260 : -220);
        node.style.transform =
          `translate(${ix}px, ${iy}px) rotate(${bar.angle + spin}deg)`;
        node.style.opacity = String(t < 0.02 ? 0 : 0.35 + t * 0.65);
      }

      // The turn: 0.7 → 1, one slow revolution; a gentle drift after.
      const turn = smooth(clamp01((p - 0.7) / 0.3));
      if (houseRef.current) {
        houseRef.current.style.transform = `rotateY(${turn * 360}deg)`;
      }

      // The line: 0.84 → 0.96.
      const say = smooth(clamp01((p - 0.84) / 0.12));
      if (sloganRef.current) {
        sloganRef.current.style.opacity = String(say);
        sloganRef.current.style.transform = `translateY(${(1 - say) * 22}px)`;
        sloganRef.current.style.filter = `blur(${(1 - say) * 5}px)`;
      }
    };

    const onScroll = () => {
      if (queued) return;
      queued = true;
      raf = requestAnimationFrame(apply);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [bars, reduced]);

  const barElements = (staticBuild: boolean) =>
    bars.map((bar, i) => (
      <span
        key={i}
        ref={(node) => { barRefs.current[i] = node; }}
        aria-hidden
        className="absolute left-1/2 top-1/2 block rounded-[3px]"
        style={{
          width: 26,
          height: 8,
          marginLeft: -13,
          marginTop: -4,
          background: "linear-gradient(180deg, #f2dcab 0%, #d4b98c 45%, #a8834f 100%)",
          boxShadow: "0 0 12px 1px rgba(212,185,140,0.45), inset 0 1px 0 rgba(255,244,214,0.85)",
          transform: staticBuild
            ? `translate(${bar.x}px, ${bar.y}px) rotate(${bar.angle}deg)`
            : `translate(0px, 210px) rotate(0deg)`,
          opacity: staticBuild ? 1 : 0,
          willChange: staticBuild ? undefined : "transform, opacity",
        }}
      />
    ));

  if (reduced) {
    return (
      <section aria-label={SLOGAN} className="relative z-10 px-5 py-28 text-center sm:py-36">
        <div className="relative mx-auto h-[300px] w-[320px] scale-90 sm:scale-100">
          {barElements(true)}
        </div>
        <p className="mt-10 font-serif text-4xl font-light sm:text-5xl" style={{ color: IVORY }}>
          {SLOGAN.split(", ")[0]},{" "}
          <em className="night-shimmer-text">{SLOGAN.split(", ")[1]}</em>
        </p>
        <p className="mt-4 text-sm" style={{ color: MIST }}>{SLOGAN_SUB}</p>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      aria-label={SLOGAN}
      className="relative z-10"
      style={{ height: "520vh" }}
    >
      <div className="sticky top-0 flex h-[100svh] items-center justify-center overflow-hidden">
        {/* the house being poured, one slow revolution */}
        <div aria-hidden className="relative -mt-24" style={{ perspective: 1100 }}>
          <div
            ref={houseRef}
            className="relative h-[300px] w-[320px] scale-[0.82] sm:scale-100"
            style={{ transformStyle: "preserve-3d" }}
          >
            {barElements(false)}
          </div>
        </div>

        {/* the phone it pours from */}
        <div
          ref={phoneRef}
          aria-hidden
          className="absolute bottom-[-70px] left-1/2 w-[168px]"
          style={{ transform: "translate(-50%, 130%)", opacity: 0, willChange: "transform, opacity" }}
        >
          <div
            className="rounded-[30px] border px-3 pb-10 pt-3"
            style={{
              borderColor: "rgba(242,239,231,0.22)",
              background: "linear-gradient(180deg, rgba(20,22,30,0.96), rgba(10,11,16,0.98))",
              boxShadow: "0 -18px 60px rgba(212,185,140,0.14), inset 0 0 0 1px rgba(7,8,12,0.9)",
            }}
          >
            <div className="mx-auto mb-3 h-1.5 w-14 rounded-full" style={{ background: "rgba(242,239,231,0.16)" }} />
            <div
              className="flex h-[190px] flex-col items-center justify-center gap-3 rounded-[18px]"
              style={{
                background: "radial-gradient(ellipse 80% 60% at 50% 30%, rgba(212,185,140,0.2), rgba(10,11,16,0.6))",
                color: IVORY,
              }}
            >
              <AtlasMark size={54} />
              <p className="font-mono text-[9px] uppercase tracking-[0.32em]" style={{ color: GOLD }}>
                HomeAtlas
              </p>
            </div>
          </div>
        </div>

        {/* the line */}
        <div
          ref={sloganRef}
          className="pointer-events-none absolute inset-x-6 bottom-[16svh] text-center"
          style={{ opacity: 0, willChange: "transform, opacity, filter" }}
        >
          <p className="font-serif text-4xl font-light leading-tight sm:text-6xl" style={{ color: IVORY }}>
            Your whole home,{" "}
            <em className="night-shimmer-text">in your hand.</em>
          </p>
          <p className="mt-4 text-sm sm:text-base" style={{ color: MIST }}>
            {SLOGAN_SUB}
          </p>
        </div>
      </div>
    </section>
  );
}
