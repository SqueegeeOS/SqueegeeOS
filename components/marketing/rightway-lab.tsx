"use client";

import { useEffect, useRef } from "react";

/* Demos for approval: #1 Squeegee Scroll hero · #7 blade wipe transition */

const INK = "#07080c";
const GOLD = "#d4b98c";
const IVORY = "#f2efe7";

function useScrub(ref: React.RefObject<HTMLElement | null>, fn: (p: number) => void) {
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const el = ref.current;
      if (el) {
        const r = el.getBoundingClientRect();
        const total = r.height - window.innerHeight;
        fn(total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ref, fn]);
}

/* #1 — scroll pulls a clean stripe down the hero */
function SqueegeeHero() {
  const ref = useRef<HTMLElement>(null);
  const clean = useRef<HTMLDivElement>(null);
  const blade = useRef<HTMLDivElement>(null);
  useScrub(ref, (p) => {
    const pct = p * 118;
    clean.current?.style.setProperty("clip-path", `inset(0 0 ${Math.max(0, 100 - pct)}% 0)`);
    if (blade.current) {
      blade.current.style.top = `${Math.min(100, pct)}%`;
      blade.current.style.opacity = p > 0.02 && p < 0.98 ? "1" : "0";
    }
  });
  return (
    <section ref={ref} style={{ height: "260vh", background: INK }}>
      <div className="sticky top-0 h-dvh overflow-hidden">
        {/* dirty layer */}
        <img src="/day/morning.jpg" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover"
          style={{ filter: "blur(7px) brightness(0.6) saturate(0.55)" }} draggable={false} />
        <div aria-hidden className="absolute inset-0" style={{ background: "rgba(140,150,160,0.14)" }} />
        {/* clean layer, revealed top-down */}
        <div ref={clean} className="absolute inset-0" style={{ clipPath: "inset(0 0 100% 0)" }}>
          <img src="/day/morning.jpg" alt="" aria-hidden className="h-full w-full object-cover" draggable={false} />
        </div>
        {/* the blade + water line */}
        <div ref={blade} aria-hidden className="absolute inset-x-0 h-[6px] transition-opacity duration-300"
          style={{ top: "0%", background: `linear-gradient(to bottom, transparent, ${GOLD})`, boxShadow: `0 6px 22px rgba(212,185,140,0.5), 0 2px 0 rgba(255,255,255,0.35)`, opacity: 0 }} />
        <div className="absolute inset-x-0 bottom-0 p-8 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: `${IVORY}b3` }}>
            Demo #1 — scroll: your scroll is the squeegee
          </p>
        </div>
        <h1 className="absolute left-1/2 top-[38%] -translate-x-1/2 text-center font-serif text-6xl font-light sm:text-8xl"
          style={{ color: IVORY, textShadow: "0 2px 30px rgba(0,0,0,0.5)" }}>
          Pull it <em style={{ color: GOLD }}>clean.</em>
        </h1>
      </div>
    </section>
  );
}

/* #7 — blade-edge wipe between two chapters */
function WipeDemo() {
  const ref = useRef<HTMLElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const edge = useRef<HTMLDivElement>(null);
  useScrub(ref, (p) => {
    const pct = Math.min(1, Math.max(0, (p - 0.2) / 0.6)) * 100;
    top.current?.style.setProperty("clip-path", `polygon(0 0, 100% 0, 100% ${100 - pct}%, 0 ${Math.max(0, 100 - pct - 7)}%)`);
    if (edge.current) edge.current.style.opacity = pct > 1 && pct < 99 ? "1" : "0";
  });
  return (
    <section ref={ref} style={{ height: "220vh" }}>
      <div className="sticky top-0 h-dvh overflow-hidden">
        {/* next chapter beneath */}
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#101627" }}>
          <h2 className="font-serif text-5xl font-light sm:text-7xl" style={{ color: GOLD }}>…to the next chapter.</h2>
        </div>
        {/* current chapter, wiped away along a slanted blade edge */}
        <div ref={top} className="absolute inset-0 flex items-center justify-center" style={{ background: INK, clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)" }}>
          <h2 className="font-serif text-5xl font-light sm:text-7xl" style={{ color: IVORY }}>One chapter wipes…</h2>
        </div>
        <div ref={edge} aria-hidden className="absolute inset-x-0 top-1/2 h-[3px] opacity-0"
          style={{ background: GOLD, boxShadow: "0 0 24px rgba(212,185,140,0.6)", transform: "rotate(-2deg) scaleX(1.1)" }} />
        <p className="absolute bottom-8 w-full text-center font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: `${IVORY}b3` }}>
          Demo #7 — scroll: the blade wipe between acts
        </p>
      </div>
    </section>
  );
}

export function RightwayLab() {
  return (
    <main style={{ background: INK, color: IVORY }}>
      <SqueegeeHero />
      <WipeDemo />
      <footer className="px-6 py-16 text-center">
        <p className="font-mono text-xs tracking-[0.2em]" style={{ color: "#8f9ab0" }}>
          Approve one, both, or neither — each ports into /rightway in minutes.
        </p>
      </footer>
    </main>
  );
}
