"use client";

import { useEffect, useRef, useState } from "react";
import { AtlasMark } from "@/components/theme/atlas-mark";

const GOLD = "#d4b98c";
const IVORY = "#f2efe7";
const MIST = "#8f9ab0";

/**
 * The Journey — the customer's whole arc, A to Z, drawn as a constellation.
 * The section is tall; a sticky viewport holds one night sky. As the
 * visitor scrolls, a line of light draws itself from star to star, each
 * station igniting with one chapter of the relationship. At the end the
 * constellation resolves into the Atlas mark: the journey **is** HomeAtlas.
 *
 * Reduced motion (or no JS) renders every chapter as a quiet readable list.
 */

interface Station {
  letter: string;
  x: number; // percent of viewport width
  y: number; // percent of viewport height
  title: string;
  body: string;
}

const STATIONS: Station[] = [
  {
    letter: "A",
    x: 14, y: 72,
    title: "You reach out",
    body: "Request a Home Care Plan. A short walk-through of what your home needs — no pressure, no obligation.",
  },
  {
    letter: "B",
    x: 30, y: 38,
    title: "We walk your home",
    body: "Every window counted. Every surface assessed. The gate code noted once — never asked for again.",
  },
  {
    letter: "C",
    x: 47, y: 60,
    title: "Your plan arrives",
    body: "One locked price. A rhythm your home can rely on — every 3 or 6 months, on the calendar before you think of it.",
  },
  {
    letter: "D",
    x: 63, y: 30,
    title: "The first visit",
    body: "The crew arrives already knowing your home. The record begins: photos, observations, promises made in writing.",
  },
  {
    letter: "E",
    x: 78, y: 55,
    title: "Every visit builds",
    body: "The hard water on the west glass, tracked. The screen promised for spring, delivered in spring. Nothing slips.",
  },
  {
    letter: "Z",
    x: 88, y: 26,
    title: "Your home, known",
    body: "Years in, nothing is ever explained twice. New faces, same memory. That is HomeAtlas.",
  },
];

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const fn = () => setReduced(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return reduced;
}

/**
 * 0 → 1 as the tall section scrolls through its sticky window.
 * Scroll-event driven (rAF-batched, quantized) — no perpetual loop, and
 * no re-render unless the visible value actually moved.
 */
function useJourneyProgress(ref: React.RefObject<HTMLElement | null>) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let raf = 0;
    let queued = false;
    const measure = () => {
      queued = false;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const passed = Math.min(Math.max(-rect.top, 0), Math.max(total, 1));
      const next = Math.round((total > 0 ? passed / total : 0) * 250) / 250;
      setProgress((current) => (current === next ? current : next));
    };
    const onScroll = () => {
      if (queued) return;
      queued = true;
      raf = requestAnimationFrame(measure);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ref]);
  return progress;
}

/** Gentle quadratic-curve path through the stations (SVG viewBox 100×100). */
function constellationPath(): string {
  const pts = STATIONS.map((s) => [s.x, s.y] as const);
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i += 1) {
    const [px, py] = pts[i - 1];
    const [x, y] = pts[i];
    const mx = (px + x) / 2;
    const my = (py + y) / 2 + (i % 2 ? -7 : 7);
    d += ` Q ${mx} ${my} ${x} ${y}`;
  }
  return d;
}

export function Journey() {
  const reduced = useReducedMotion();
  const sectionRef = useRef<HTMLElement | null>(null);
  const pathRef = useRef<SVGPathElement | null>(null);
  const [pathLength, setPathLength] = useState(1);
  const progress = useJourneyProgress(sectionRef);

  useEffect(() => {
    if (pathRef.current) setPathLength(pathRef.current.getTotalLength());
  }, []);

  if (reduced) {
    return (
      <section aria-label="The journey, A to Z" className="relative z-10 px-5 py-28 sm:px-12">
        <JourneyHeading />
        <ol className="mx-auto mt-14 max-w-2xl space-y-10">
          {STATIONS.map((s) => (
            <li key={s.letter} className="border-t pt-6" style={{ borderColor: "rgba(212,185,140,0.25)" }}>
              <p className="font-mono text-xs tracking-[0.3em]" style={{ color: GOLD }}>{s.letter}</p>
              <h3 className="mt-2 font-serif text-2xl font-light" style={{ color: IVORY }}>{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: MIST }}>{s.body}</p>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  // Draw phase occupies 0 → 0.86 of scroll; the finale (Atlas resolve) 0.86 → 1.
  const drawProgress = Math.min(progress / 0.86, 1);
  const finale = Math.max((progress - 0.88) / 0.12, 0);
  const activeIndex = Math.min(
    Math.floor(drawProgress * STATIONS.length),
    STATIONS.length - 1,
  );

  return (
    <section
      ref={sectionRef}
      aria-label="The journey, A to Z"
      className="relative z-10"
      style={{ height: `${(STATIONS.length + 2) * 100}vh` }}
    >
      <div className="sticky top-0 flex h-[100svh] flex-col overflow-hidden">
        <div className="px-5 pt-20 sm:px-12">
          <JourneyHeading />
        </div>

        {/* the sky in which the journey is written */}
        <div className="relative flex-1">
          <svg
            aria-hidden
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <path
              ref={pathRef}
              d={constellationPath()}
              fill="none"
              stroke={GOLD}
              strokeWidth="0.22"
              strokeLinecap="round"
              style={{
                opacity: 0.85 - finale * 0.6,
                strokeDasharray: pathLength,
                strokeDashoffset: pathLength * (1 - drawProgress),
                filter: "drop-shadow(0 0 1.2px rgba(212,185,140,0.8))",
              }}
            />
          </svg>

          {STATIONS.map((s, i) => {
            const lit = drawProgress * STATIONS.length >= i + 0.35;
            const isActive = i === activeIndex && finale === 0;
            return (
              <div
                key={s.letter}
                aria-hidden
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${s.x}%`, top: `${s.y}%`, opacity: 1 - finale * 0.7 }}
              >
                <div
                  className="mx-auto rounded-full transition-all duration-700"
                  style={{
                    width: lit ? 10 : 4,
                    height: lit ? 10 : 4,
                    background: lit ? GOLD : "rgba(232,236,245,0.5)",
                    boxShadow: lit
                      ? `0 0 18px 4px rgba(212,185,140,${isActive ? 0.75 : 0.4})`
                      : "none",
                  }}
                />
                <p
                  className="mt-3 text-center font-mono text-[11px] tracking-[0.3em] transition-opacity duration-700"
                  style={{ color: GOLD, opacity: lit ? 0.9 : 0.25 }}
                >
                  {s.letter}
                </p>
              </div>
            );
          })}

          {/* the finale: the constellation resolves into the Atlas */}
          <div
            aria-hidden
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center"
            style={{
              opacity: finale,
              transform: `translate(-50%, -50%) scale(${0.85 + finale * 0.15})`,
            }}
          >
            <div className="flex justify-center" style={{ color: IVORY }}>
              <AtlasMark size={120} />
            </div>
            <p className="mt-6 font-serif text-3xl font-light sm:text-4xl" style={{ color: IVORY }}>
              This is <em className="night-shimmer-text">HomeAtlas.</em>
            </p>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed" style={{ color: MIST }}>
              The whole journey, remembered. Included with every membership.
            </p>
          </div>
        </div>

        {/* the active chapter */}
        <div className="relative mx-auto w-full max-w-xl px-6 pb-16 text-center" aria-live="polite">
          {STATIONS.map((s, i) => {
            const visible = i === activeIndex && finale === 0;
            return (
              <div
                key={s.letter}
                className="absolute inset-x-6 bottom-16 transition-all duration-700"
                style={{
                  opacity: visible ? 1 : 0,
                  transform: `translateY(${visible ? 0 : 14}px)`,
                  pointerEvents: "none",
                }}
              >
                <p className="font-mono text-xs tracking-[0.35em]" style={{ color: GOLD }}>
                  {s.letter} — {String(i + 1).padStart(2, "0")} / {STATIONS.length}
                </p>
                <h3 className="mt-3 font-serif text-3xl font-light sm:text-4xl" style={{ color: IVORY }}>
                  {s.title}
                </h3>
                <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed sm:text-base" style={{ color: MIST }}>
                  {s.body}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function JourneyHeading() {
  return (
    <div className="text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: GOLD }}>
        From A to Z
      </p>
      <h2 className="mt-4 font-serif text-4xl font-light leading-[0.98] sm:text-6xl" style={{ color: IVORY }}>
        One journey, written
        <br />
        <em className="night-shimmer-text">in your home&apos;s sky.</em>
      </h2>
    </div>
  );
}
