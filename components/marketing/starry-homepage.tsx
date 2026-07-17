"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AtlasMark } from "@/components/theme/atlas-mark";
import { BeforeAfter, ReviewsWall, SoundToggle } from "@/components/marketing/rightway-extras";

/* CINEMA MAXIMAL — SqueegeeKing. Full-bleed Higgsfield film, colossal type. */

const INK = "#07080c";
const GOLD = "#d4b98c";
const IVORY = "#f2efe7";
const MIST = "#8f9ab0";

function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setR(mq.matches);
    const fn = () => setR(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return r;
}

function Film({ src, poster, className = "", reduced }: { src: string; poster: string; className?: string; reduced: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) void el.play().catch(() => {});
      else el.pause();
    }, { rootMargin: "160px" });
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);
  if (reduced) return <img src={poster} alt="" aria-hidden className={className} draggable={false} />;
  return <video ref={ref} src={src} poster={poster} muted loop playsInline preload="none" aria-hidden className={className} />;
}

function Cta({ children, big = false }: { children: React.ReactNode; big?: boolean }) {
  const ref = useRef<HTMLAnchorElement>(null);
  return (
    <Link href="/request" ref={ref}
      onPointerMove={(e) => {
        const el = ref.current; if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--gx", `${e.clientX - r.left}px`);
        el.style.setProperty("--gy", `${e.clientY - r.top}px`);
      }}
      className={`night-cta inline-flex items-center font-medium tracking-[0.08em] ${big ? "min-h-[64px] px-12 text-base" : "min-h-[54px] px-9 text-sm"}`}>
      {children}
    </Link>
  );
}

function useScrub(ref: React.RefObject<HTMLElement | null>, fn: (p: number) => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
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
  }, [ref, fn, active]);
}

/* ACT I — approved demo #1: your scroll is the squeegee */
function SqueegeeHero({ reduced }: { reduced: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const clean = useRef<HTMLDivElement>(null);
  const blade = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  useScrub(ref, (p) => {
    const pct = p * 118;
    clean.current?.style.setProperty("clip-path", `inset(0 0 ${Math.max(0, 100 - pct)}% 0)`);
    if (blade.current) {
      blade.current.style.top = `${Math.min(100, pct)}%`;
      blade.current.style.opacity = p > 0.02 && p < 0.98 ? "1" : "0";
    }
    if (head.current) {
      const o = Math.min(1, Math.max(0, (p - 0.16) / 0.3));
      head.current.style.opacity = String(o);
      head.current.style.transform = `translateY(${(1 - o) * 26}px)`;
    }
  }, !reduced);
  return (
    <section ref={ref} style={{ height: reduced ? "auto" : "230vh" }} aria-label="SqueegeeKing">
      <div className={reduced ? "relative min-h-[100svh] overflow-hidden" : "sticky top-0 h-dvh overflow-hidden"}>
        {!reduced && (
          <>
            <img src="/home/family-twilight.jpg" alt="" aria-hidden draggable={false}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ filter: "blur(7px) brightness(0.55) saturate(0.55)" }} />
            <div aria-hidden className="absolute inset-0" style={{ background: "rgba(140,150,160,0.12)" }} />
          </>
        )}
        <div ref={clean} className="absolute inset-0" style={reduced ? undefined : { clipPath: "inset(0 0 100% 0)" }}>
          <img src="/home/family-twilight.jpg" alt="A family home glowing at twilight, freshly kept"
            draggable={false} className="h-full w-full object-cover" fetchPriority="high" />
        </div>
        <div ref={blade} aria-hidden className="absolute inset-x-0 h-[8px] opacity-0 transition-opacity duration-300" style={{ top: "0%" }}>
          <div className="absolute inset-x-0 top-0 h-px" style={{ background: "rgba(255,255,255,0.4)" }} />
          <div className="absolute inset-x-0 top-[1px] h-[3px]" style={{ background: `linear-gradient(to bottom, ${GOLD}, #9a7f52)`, boxShadow: "0 6px 24px rgba(212,185,140,0.55)" }} />
          <div className="absolute inset-x-0 top-[4px] h-[2px]" style={{ background: "#2a2118" }} />
          {[["18%","7px","5px",0.5],["46%","10px","6px",0.35],["71%","6px","4px",0.55],["88%","9px","5px",0.4]].map(([l,t,sz,o]) => (
            <span key={String(l)} className="absolute rounded-full" style={{ left: String(l), top: String(t), width: String(sz), height: String(sz), background: `rgba(220,230,240,${o})`, filter: "blur(0.5px)" }} />
          ))}
        </div>
        <div aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(to top, ${INK} 4%, transparent 45%)` }} />
        <div ref={head} className="absolute inset-x-0 bottom-0 z-10 px-5 pb-10 sm:px-12" style={reduced ? undefined : { opacity: 0 }}>
          <h1 className="font-serif font-light uppercase leading-[0.86] tracking-tight"
            style={{ fontSize: "clamp(3.6rem, 13vw, 12rem)" }}>
            The right
            <br />
            <span className="night-shimmer-text italic normal-case">way.</span>
          </h1>
          <div className="mt-8 flex flex-wrap items-end justify-between gap-6 pb-2">
            <p className="max-w-sm text-base leading-relaxed" style={{ color: MIST }}>
              Window, pressure washing, and solar care, done like we&apos;d do it
              for our own family. Because when you join, you are family.
              {reduced ? "" : " Scroll: the blade does the rest."}
            </p>
            <Cta big>Request a plan</Cta>
          </div>
        </div>
      </div>
    </section>
  );
}

/* Approved demo #7: blade wipe between acts */
function WipeInterlude({ reduced }: { reduced: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const edge = useRef<HTMLDivElement>(null);
  useScrub(ref, (p) => {
    const pct = Math.min(1, Math.max(0, (p - 0.15) / 0.7)) * 100;
    top.current?.style.setProperty("clip-path", `polygon(0 0, 100% 0, 100% ${100 - pct}%, 0 ${Math.max(0, 100 - pct - 7)}%)`);
    if (edge.current) edge.current.style.opacity = pct > 1 && pct < 99 ? "1" : "0";
  }, !reduced);
  if (reduced) {
    return (
      <section className="px-6 py-24 text-center" style={{ background: "#101627" }}>
        <h2 className="font-serif text-4xl font-light sm:text-6xl" style={{ color: GOLD }}>Done once. Done right.</h2>
      </section>
    );
  }
  return (
    <section ref={ref} style={{ height: "200vh" }} aria-label="Done once, done right">
      <div className="sticky top-0 h-dvh overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center px-6" style={{ background: "#101627" }}>
          <h2 className="text-center font-serif text-5xl font-light sm:text-7xl" style={{ color: GOLD }}>done <em>right.</em></h2>
        </div>
        <div ref={top} className="absolute inset-0 flex items-center justify-center px-6" style={{ background: INK }}>
          <h2 className="text-center font-serif text-5xl font-light sm:text-7xl" style={{ color: IVORY }}>Done once&hellip;</h2>
        </div>
        <div ref={edge} aria-hidden className="absolute inset-x-0 top-1/2 h-[3px] opacity-0"
          style={{ background: GOLD, boxShadow: "0 0 24px rgba(212,185,140,0.6)", transform: "rotate(-2deg) scaleX(1.1)" }} />
      </div>
    </section>
  );
}

const WORK = [
  ["01", "Window Cleaning", "Glass that disappears.", "/day/hour-window.mp4", "/day/hour-window.jpg"],
  ["02", "Pressure Washing", "The years rinse off.", "/day/hour-pressure.mp4", "/day/hour-pressure.jpg"],
  ["03", "Solar Panel Care", "Output kept honest.", "/day/hour-solar.mp4", "/day/hour-solar.jpg"],
  ["04", "Maintenance Plans", "The calendar, handled.", "/day/hour-dusk.mp4", "/day/hour-dusk.jpg"],
] as const;

const MARQUEE = "WINDOWS · PRESSURE WASHING · SOLAR · EVERY 3 MONTHS · EVERY 6 MONTHS · SEVEN-DAY GUARANTEE · RAINBLOCK · ";

export function StarryHomepage() {
  const reduced = useReducedMotion();
  return (
    <main className="overflow-x-clip" style={{ background: INK, color: IVORY }}>

      <SqueegeeHero reduced={reduced} />

      {/* the ribbon — never sleeps */}
      <div className="overflow-hidden border-y py-4" style={{ borderColor: "rgba(242,239,231,0.1)" }} aria-hidden>
        <div className="night-marquee whitespace-nowrap font-mono text-xs uppercase tracking-[0.3em]" style={{ color: GOLD }}>
          {MARQUEE.repeat(4)}
        </div>
      </div>

      {/* ACT II — the work, as film strips */}
      <section className="px-5 py-28 sm:px-12 sm:py-36" aria-label="The work">
        <h2 className="max-w-3xl font-serif text-5xl font-light leading-[0.95] sm:text-8xl">
          Four crafts.
          <br />
          <em className="night-shimmer-text">One obsession.</em>
        </h2>
        <div className="mt-16 grid gap-6 md:grid-cols-2">
          {WORK.map(([n, title, line, film, poster], i) => (
            <article key={n}
              className={`group relative overflow-hidden rounded-[1.5rem] border transition-transform duration-500 hover:-translate-y-2 ${i % 2 ? "md:translate-y-14" : ""}`}
              style={{ borderColor: "rgba(242,239,231,0.1)" }}>
              <Film src={film} poster={poster} reduced={reduced}
                className="aspect-[16/10] w-full object-cover transition-transform duration-700 group-hover:scale-[1.05] [filter:saturate(0.9)_sepia(0.1)_contrast(1.03)_brightness(0.96)]" />
              <div aria-hidden className="pointer-events-none absolute inset-0" style={{ boxShadow: "inset 0 0 120px rgba(7,8,12,0.55)" }} />
              <div aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(to top, ${INK} 6%, transparent 55%)` }} />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-7">
                <div>
                  <h3 className="font-serif text-3xl font-light" style={{ color: IVORY }}>{title}</h3>
                  <p className="mt-1 text-sm" style={{ color: MIST }}>{line}</p>
                </div>
                <span className="font-mono text-5xl font-light opacity-30" style={{ color: GOLD }}>{n}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <WipeInterlude reduced={reduced} />

      <BeforeAfter />

      <ReviewsWall />

      {/* ACT III — the family */}
      <section className="px-5 py-28 sm:px-12 sm:py-36" aria-label="Membership">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: GOLD }}>
          Membership
        </p>
        <h2 className="mt-6 max-w-3xl font-serif text-5xl font-light leading-[0.95] sm:text-8xl">
          Welcome to
          <br />
          <em className="night-shimmer-text">the family.</em>
        </h2>
        <p className="mt-8 max-w-xl text-lg leading-relaxed" style={{ color: MIST }}>
          A membership is not a subscription. It is a seat at our table:
          your home cared for on a rhythm, your history remembered, your
          calls answered first. We do things the right way, every time.
        </p>
        <ul className="mt-14 grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Preferred pricing", "Members pay the family rate, always."],
            ["Priority scheduling", "First in line, every season."],
            ["Seven-day guarantee", "Rain or streaks, we return. Free."],
            ["RainBlock treatment", "Glass that sheds the weather."],
            ["Hard-water removal", "Where your home needs it."],
            ["Add-on discounts", "Every extra, at the member rate."],
            ["Property history & photos", "Your home's record, kept for you."],
            ["Recurring care", "Every 3 or 6 months, automatically."],
            ["Simple billing", "The 1st of your service month. Done."],
          ].map(([t, d]) => (
            <li key={t} className="border-t pt-5" style={{ borderColor: "rgba(212,185,140,0.25)" }}>
              <p className="font-serif text-xl font-light" style={{ color: IVORY }}>{t}</p>
              <p className="mt-1 text-sm leading-relaxed" style={{ color: MIST }}>{d}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ACT IV — the idea */}
      <section className="relative overflow-hidden border-y py-36 text-center sm:py-48" style={{ borderColor: "rgba(242,239,231,0.1)" }} aria-label="HomeAtlas">
        <div aria-hidden className="absolute inset-0" style={{ background: `radial-gradient(ellipse 65% 50% at 50% 0%, rgba(143,154,176,0.12), transparent), radial-gradient(ellipse 55% 45% at 50% 115%, rgba(212,165,110,0.16), transparent)` }} />
        <div className="relative mx-auto max-w-3xl px-6">
          <div className="mb-10 flex justify-center"><AtlasMark size={88} /></div>
          <h2 className="font-serif text-5xl font-light leading-[0.98] sm:text-7xl">
            What if your home
            <br />
            <em className="night-shimmer-text">remembered?</em>
          </h2>
          <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed" style={{ color: MIST }}>
            Every membership includes HomeAtlas: a living record of every
            visit, photo, observation, and promise. Nothing about your home
            explained twice, ever again.
          </p>
        </div>
      </section>

      {/* ACT IV — dawn */}
      <section className="relative min-h-[80svh]" aria-label="Begin">
        <Film src="/day/hero-film.mp4" poster="/day/morning.jpg" reduced={reduced}
          className="absolute inset-0 h-full w-full object-cover" />
        <div aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(to bottom, ${INK} 2%, rgba(7,8,12,0.25) 45%, rgba(7,8,12,0.7))` }} />
        <div className="relative z-10 flex min-h-[80svh] flex-col items-center justify-center px-6 text-center">
          <h2 className="max-w-3xl font-serif text-5xl font-light leading-[0.98] sm:text-7xl" style={{ color: IVORY }}>
            Morning looks better
            <br />
            <em className="night-shimmer-text">through clean glass.</em>
          </h2>
          <div className="mt-12"><Cta big>Request a plan</Cta></div>
          <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: `${IVORY}b3` }}>
            Every 3 Months · Every 6 Months · One-Time Service
          </p>
        </div>
      </section>

      <SoundToggle />

      <div className="flex flex-col items-center gap-5 px-6 pb-4 pt-20 text-center">
        <AtlasMark size={44} />
        <p className="font-serif text-xl font-light italic" style={{ color: `${IVORY}cc` }}>
          Done once. Done right.
        </p>
      </div>

      <footer className="px-6 py-10 text-center">
        <p className="font-mono text-xs tracking-[0.14em]" style={{ color: `${MIST}99` }}>
          SqueegeeKing · powered by HomeAtlas
        </p>
      </footer>
    </main>
  );
}
