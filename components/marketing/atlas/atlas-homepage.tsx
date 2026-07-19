"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AtlasMark } from "@/components/theme/atlas-mark";
import { BeforeAfter, ReviewsWall, SoundToggle } from "@/components/marketing/rightway-extras";
import { Starfield } from "./starfield";
import { Journey } from "./journey";
import { GoldBuild } from "./gold-build";
import { AtlasMoment } from "./atlas-moment";

/*
 * ONE HOME, REMEMBERED — the SqueegeeKing homepage as a single night.
 * Twilight arrival (Higgsfield film) → the idea (Story scene, copy per
 * HOMEATLAS_HOMEPAGE_STORY_BRIEF, verbatim) → the journey A→Z written as a
 * constellation → the home held in 3D memory → the work → the family → dawn.
 * A fixed starfield binds every act into one sky.
 */

const INK = "#07080c";
const STORY_BG = "#060605";
const GOLD = "#d4b98c";
const IVORY = "#f2efe7";
const MIST = "#8f9ab0";

const ATLAS_MEDIA = {
  twilightFilm: "/home/atlas/twilight.mp4",
  twilightPoster: "/home/atlas/twilight.jpg",
  oblique: "/home/atlas/oblique.jpg",
  dawn: "/home/atlas/dawn.jpg",
  glb: "/home/atlas/home.glb",
};

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
 * ACT I hero with scroll-linked film scale and copy hand-off.
 * All motion is written imperatively on scroll (rAF-batched) so nothing
 * re-renders per frame and the full-viewport video layer never receives
 * competing CSS transitions — the page stays compositor-friendly.
 */
function HeroAct({ reduced }: { reduced: boolean }) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const filmRef = useRef<HTMLDivElement | null>(null);
  const veilRef = useRef<HTMLDivElement | null>(null);
  const copyRef = useRef<HTMLDivElement | null>(null);

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
      const p = Math.min(Math.max(-rect.top, 0), total) / total;
      if (filmRef.current) filmRef.current.style.transform = `scale(${1 + p * 0.08})`;
      if (veilRef.current)
        veilRef.current.style.background = `linear-gradient(to top, #07080c 4%, rgba(7,8,12,${0.3 + p * 0.5}) 45%, rgba(7,8,12,${0.45 + p * 0.4}))`;
      if (copyRef.current) {
        copyRef.current.style.opacity = String(Math.max(1 - p * 1.15, 0));
        copyRef.current.style.transform = `translateY(${-p * 60}px)`;
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
  }, [reduced]);

  return (
    <section ref={sectionRef} className="relative z-10" style={{ height: reduced ? "100svh" : "170svh" }} aria-label="SqueegeeKing">
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <div ref={filmRef} className="absolute inset-0">
          <Film src={ATLAS_MEDIA.twilightFilm} poster={ATLAS_MEDIA.twilightPoster} reduced={reduced}
            className="h-full w-full object-cover" />
        </div>
        <div ref={veilRef} aria-hidden className="absolute inset-0"
          style={{ background: `linear-gradient(to top, ${INK} 4%, rgba(7,8,12,0.3) 45%, rgba(7,8,12,0.45))` }} />
        <div ref={copyRef} className="relative z-10 flex h-[100svh] flex-col justify-end px-5 py-8 sm:px-12">
          <div>
            <h1 className="night-rise font-serif font-light uppercase leading-[0.86] tracking-tight"
              style={{ fontSize: "clamp(3.6rem, 13vw, 12rem)" }}>
              The right
              <br />
              <span className="night-shimmer-text italic normal-case">way.</span>
            </h1>
            <div className="night-rise-2 mt-8 flex flex-wrap items-end justify-between gap-6 pb-2">
              <p className="max-w-sm text-base leading-relaxed" style={{ color: MIST }}>
                Window, pressure washing, and solar care, done like we&apos;d do it
                for our own family. Because when you join, you are family.
              </p>
              <Cta big>Request a plan</Cta>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
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

const WORK = [
  ["01", "Window Cleaning", "Glass that disappears.", "/day/hour-window.mp4", "/day/hour-window.jpg"],
  ["02", "Pressure Washing", "The years rinse off.", "/day/hour-pressure.mp4", "/day/hour-pressure.jpg"],
  ["03", "Solar Panel Care", "Output kept honest.", "/day/hour-solar.mp4", "/day/hour-solar.jpg"],
  ["04", "Maintenance Plans", "The calendar, handled.", "/day/hour-dusk.mp4", "/day/hour-dusk.jpg"],
] as const;

const MARQUEE = "WINDOWS · PRESSURE WASHING · SOLAR · EVERY 3 MONTHS · EVERY 6 MONTHS · SEVEN-DAY GUARANTEE · RAINBLOCK · ";

/** Fades children up as they enter the viewport. Ethereal by default. */
function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setShown(true); }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: `translateY(${shown ? 0 : 26}px)`,
        filter: shown ? "blur(0px)" : "blur(6px)",
        transition: `opacity 1.1s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 1.1s cubic-bezier(0.16,1,0.3,1) ${delay}ms, filter 1.1s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

export function AtlasHomepage() {
  const reduced = useReducedMotion();

  return (
    <main className="overflow-x-clip" style={{ background: INK, color: IVORY }}>
      <Starfield />

      {/* ACT I — twilight arrival. The film pins; the words hand the page to the night. */}
      <HeroAct reduced={reduced} />

      {/* ACT II — the Story scene. The darkest room on the page. Copy is law. */}
      <section
        className="relative z-10 border-y py-36 text-center sm:py-44"
        style={{ background: STORY_BG, borderColor: "rgba(242,239,231,0.08)" }}
        aria-label="What is HomeAtlas"
      >
        <div className="relative mx-auto max-w-3xl px-6">
          <Reveal>
            <p className="font-mono text-[12px] uppercase tracking-[0.42em]" style={{ color: GOLD }}>
              HomeAtlas
            </p>
          </Reveal>
          <Reveal delay={120}>
            <h2 className="mt-8 font-serif text-5xl font-light leading-[0.98] sm:text-7xl">
              Your home, <em className="night-shimmer-text">remembered.</em>
            </h2>
          </Reveal>
          <Reveal delay={240}>
            <p className="mx-auto mt-10 max-w-xl text-lg leading-relaxed" style={{ color: MIST }}>
              Most home care starts over with every visit — the gate code, the west
              windows that catch hard water, the screen promised for spring, forgotten
              the moment the truck leaves. HomeAtlas is the living record of your
              home&apos;s care. Every visit leaves something behind. Every visit builds on
              the last. Your home becomes known.
            </p>
          </Reveal>
          <Reveal delay={360}>
            <div className="mx-auto mt-14 overflow-hidden rounded-[1.5rem] border" style={{ borderColor: "rgba(242,239,231,0.1)" }}>
              <img
                src={ATLAS_MEDIA.oblique}
                alt="A home under long-term care — the HomeAtlas launch film"
                className="w-full object-cover"
                draggable={false}
              />
            </div>
          </Reveal>
          <Reveal delay={480}>
            <p className="mt-14 font-serif text-2xl font-light italic sm:text-3xl" style={{ color: IVORY }}>
              No home should ever have to start over.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ACT III — the journey, A to Z, written in the sky */}
      <Journey />

      {/* ACT IV — the gold build: the phone pours, the house rises, one slow turn */}
      <GoldBuild />

      {/* ACT V — the home, held in memory */}
      <AtlasMoment glbUrl={ATLAS_MEDIA.glb} fallbackSrc={ATLAS_MEDIA.twilightPoster} />

      {/* the ribbon — never sleeps */}
      <div className="relative z-10 overflow-hidden border-y py-4" style={{ borderColor: "rgba(242,239,231,0.1)" }} aria-hidden>
        <div className="night-marquee whitespace-nowrap font-mono text-xs uppercase tracking-[0.35em]" style={{ color: GOLD }}>
          {MARQUEE.repeat(4)}
        </div>
      </div>

      {/* ACT V — the work */}
      <section className="relative z-10 px-5 py-28 sm:px-12 sm:py-36" aria-label="The work">
        <Reveal>
          <h2 className="max-w-3xl font-serif text-5xl font-light leading-[0.95] sm:text-8xl">
            Four crafts.
            <br />
            <em className="night-shimmer-text">One obsession.</em>
          </h2>
        </Reveal>
        <div className="mt-16 grid gap-6 md:grid-cols-2">
          {WORK.map(([n, title, line, film, poster], i) => (
            <Reveal key={n} delay={i * 90} className={i % 2 ? "md:translate-y-14" : ""}>
              <article
                className="group relative overflow-hidden rounded-[1.5rem] border transition-transform duration-500 hover:-translate-y-2"
                style={{ borderColor: "rgba(242,239,231,0.1)" }}>
                <Film src={film} poster={poster} reduced={reduced}
                  className="aspect-[16/10] w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]" />
                <div aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(to top, ${INK} 6%, transparent 55%)` }} />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-7">
                  <div>
                    <h3 className="font-serif text-3xl font-light" style={{ color: IVORY }}>{title}</h3>
                    <p className="mt-1 text-sm" style={{ color: MIST }}>{line}</p>
                  </div>
                  <span className="font-mono text-5xl font-light opacity-30" style={{ color: GOLD }}>{n}</span>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <BeforeAfter />

      <ReviewsWall />

      {/* ACT VI — the family */}
      <section className="relative z-10 px-5 py-28 sm:px-12 sm:py-36" aria-label="Membership">
        <Reveal>
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
        </Reveal>
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
          ].map(([t, d], i) => (
            <Reveal key={t} delay={i * 60}>
              <li className="border-t pt-5" style={{ borderColor: "rgba(212,185,140,0.25)" }}>
                <p className="font-serif text-xl font-light" style={{ color: IVORY }}>{t}</p>
                <p className="mt-1 text-sm leading-relaxed" style={{ color: MIST }}>{d}</p>
              </li>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* ACT VII — dawn. The same home, the morning after. */}
      <section className="relative z-10 min-h-[90svh]" aria-label="Begin">
        <img src={ATLAS_MEDIA.dawn} alt="" aria-hidden draggable={false}
          className="absolute inset-0 h-full w-full object-cover" />
        <div aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(to bottom, ${INK} 2%, rgba(7,8,12,0.15) 45%, rgba(7,8,12,0.72))` }} />
        <div className="relative z-10 flex min-h-[90svh] flex-col items-center justify-center px-6 text-center">
          <Reveal>
            <h2 className="max-w-3xl font-serif text-5xl font-light leading-[0.98] sm:text-7xl" style={{ color: IVORY }}>
              Morning looks better
              <br />
              <em className="night-shimmer-text">through clean glass.</em>
            </h2>
          </Reveal>
          <Reveal delay={200}>
            <div className="mt-12"><Cta big>Request a plan</Cta></div>
            <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: `${IVORY}b3` }}>
              Every 3 Months · Every 6 Months · One-Time Service
            </p>
          </Reveal>
        </div>
      </section>

      <SoundToggle />

      <footer className="relative z-10 px-6 py-10 text-center">
        <div className="mb-5 flex justify-center" style={{ color: IVORY }}>
          <AtlasMark size={40} />
        </div>
        <p className="font-mono text-xs tracking-[0.14em]" style={{ color: `${MIST}99` }}>
          SqueegeeKing · powered by HomeAtlas
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-xs leading-relaxed" style={{ color: `${MIST}80` }}>
          Professional window cleaning, pressure washing, and solar panel
          cleaning, plus recurring home maintenance memberships every 3 or 6
          months. Every visit is recorded in HomeAtlas, the living memory of
          your home&apos;s care.
        </p>
      </footer>
    </main>
  );
}
