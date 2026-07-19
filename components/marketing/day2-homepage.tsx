"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AtlasMark } from "@/components/theme/atlas-mark";
import { Day2ReviewsWall } from "@/components/marketing/day2-reviews-wall";

/* CINEMA MAXIMAL — SqueegeeKing. Full-bleed residential film, colossal type. */

const CANVAS = "#f5f0e6";
const PINE = "#173f32";
const SAGE = "#526b60";
const BRONZE = "#99683d";
const BRONZE_TEXT = "#8f5f37";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onStoreChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function getServerReducedMotionSnapshot() {
  return false;
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

function Cta({
  children,
  big = false,
  dock = false,
  anchorRef,
  tabIndex,
}: {
  children: React.ReactNode;
  big?: boolean;
  dock?: boolean;
  anchorRef?: React.Ref<HTMLAnchorElement>;
  tabIndex?: number;
}) {
  return (
    <Link
      ref={anchorRef}
      href="/request"
      tabIndex={tabIndex}
      className={`group inline-flex items-center justify-center gap-4 rounded-full border border-[#173f32]/10 bg-[#173f32] font-medium tracking-[0.08em] text-[#fffaf0] shadow-[0_16px_40px_-24px_rgba(23,63,50,0.75)] transition-[background-color,box-shadow,transform] duration-300 outline-none hover:bg-[#214c3d] hover:shadow-[0_20px_44px_-22px_rgba(23,63,50,0.65)] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[#99683d] focus-visible:ring-offset-4 focus-visible:ring-offset-[#f5f0e6] motion-reduce:transition-none ${dock ? "min-h-[56px] w-full px-7 text-sm md:min-h-[54px] md:w-auto" : big ? "min-h-[60px] px-8 text-sm sm:min-h-[64px] sm:px-10 sm:text-base" : "min-h-[54px] px-9 text-sm"}`}
    >
      <span>{children}</span>
      <span aria-hidden className="font-mono text-base transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none">
        →
      </span>
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

export function Day2Homepage() {
  const reduced = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getServerReducedMotionSnapshot,
  );
  const heroCtaRef = useRef<HTMLAnchorElement>(null);
  const closingCtaRef = useRef<HTMLAnchorElement>(null);
  const [heroCtaVisible, setHeroCtaVisible] = useState(true);
  const [closingCtaVisible, setClosingCtaVisible] = useState(false);

  useEffect(() => {
    const heroCta = heroCtaRef.current;
    const closingCta = closingCtaRef.current;
    if (!heroCta || !closingCta) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target === heroCta) {
            setHeroCtaVisible(entry.isIntersecting);
          }
          if (entry.target === closingCta) {
            setClosingCtaVisible(entry.isIntersecting);
          }
        });
      },
      { threshold: 0.05 },
    );

    observer.observe(heroCta);
    observer.observe(closingCta);
    return () => observer.disconnect();
  }, []);

  const dockVisible = !heroCtaVisible && !closingCtaVisible;

  return (
    <main className="overflow-x-clip" style={{ background: CANVAS, color: PINE }}>

      {/* ACT I — the family home in morning light */}
      <section className="relative min-h-[100svh] overflow-hidden" aria-label="SqueegeeKing">
        <Image
          src="/day/morning.jpg"
          alt="A white family home surrounded by a garden in warm morning light"
          fill
          sizes="100vw"
          preload
          draggable={false}
          className="object-cover object-center"
        />
        <div aria-hidden className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(250,246,236,0.99) 0%, rgba(250,246,236,0.94) 24%, rgba(250,246,236,0.54) 50%, rgba(250,246,236,0.12) 76%), linear-gradient(to right, rgba(250,246,236,0.58), transparent 68%)" }} />
        <div className="relative z-10 flex min-h-[100svh] flex-col justify-end px-5 pb-10 pt-28 sm:px-8 sm:pb-12 lg:px-12 lg:pb-16">
          <div className="mx-auto w-full max-w-[90rem]">
            <h1 className="night-rise font-serif font-light uppercase leading-[0.86] tracking-tight"
              style={{ color: PINE, fontSize: "clamp(3.6rem, 13vw, 11.5rem)" }}>
              The right
              <br />
              <span className="italic normal-case" style={{ color: BRONZE }}>way.</span>
            </h1>
            <div className="night-rise-2 mt-7 flex flex-col items-start gap-7 pb-1 sm:mt-8 lg:flex-row lg:items-end lg:justify-between">
              <p className="max-w-md text-base leading-relaxed sm:text-lg" style={{ color: SAGE }}>
                Window, pressure washing, and solar care, done like we&apos;d do it
                for our own family. Because when you join, you are family.
              </p>
              <Cta big anchorRef={heroCtaRef}>Request a plan</Cta>
            </div>
          </div>
        </div>
      </section>

      {/* ACT II — the idea, first */}
      <section className="relative overflow-hidden border-y py-28 text-center sm:py-40" style={{ borderColor: "rgba(23,63,50,0.12)", background: "linear-gradient(180deg, #f7f3e9 0%, #edf3eb 58%, #f6efe2 100%)" }} aria-label="HomeAtlas">
        <div aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(ellipse 64% 50% at 50% 0%, rgba(180,214,224,0.4), transparent), radial-gradient(ellipse 58% 45% at 50% 112%, rgba(187,205,174,0.35), transparent)" }} />
        <div className="relative mx-auto max-w-3xl px-5 sm:px-8">
          <div className="mx-auto mb-9 flex h-28 w-28 items-center justify-center rounded-full border border-[#173f32]/10 bg-white/70 shadow-[0_20px_60px_-36px_rgba(23,63,50,0.45)] [--accent:#99683d] [--foreground:#173f32] sm:mb-10"><AtlasMark size={78} /></div>
          <h2 className="font-serif text-[2.85rem] font-light leading-[0.98] sm:text-7xl" style={{ color: PINE }}>
            What if your home
            <br />
            <em style={{ color: BRONZE }}>remembered?</em>
          </h2>
          <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed" style={{ color: SAGE }}>
            Every membership includes HomeAtlas: a living record of every
            visit, photo, observation, and promise. Nothing about your home
            explained twice, ever again.
          </p>
        </div>
      </section>

      {/* the ribbon — never sleeps */}
      <div className="overflow-hidden border-y py-4" style={{ borderColor: "rgba(153,104,61,0.2)", background: "#e5eadf" }} aria-hidden>
        <div className="night-marquee whitespace-nowrap font-mono text-xs uppercase tracking-[0.35em]" style={{ color: PINE }}>
          {MARQUEE.repeat(4)}
        </div>
      </div>

      {/* ACT II — the work, as film strips */}
      <section className="py-24 sm:py-32 lg:py-40" aria-label="The work">
        <div className="mx-auto w-full max-w-[90rem] px-5 sm:px-8 lg:px-12">
          <h2 className="max-w-3xl font-serif text-5xl font-light leading-[0.95] sm:text-7xl lg:text-8xl" style={{ color: PINE }}>
            Four crafts.
            <br />
            <em style={{ color: BRONZE }}>One obsession.</em>
          </h2>
          <div className="mt-12 grid gap-5 sm:mt-16 sm:gap-6 md:grid-cols-2">
            {WORK.map(([n, title, line, film, poster]) => (
              <article key={n}
                className="group relative isolate overflow-hidden rounded-[1.5rem] border border-[#173f32]/10 bg-[#fffdf8] shadow-[0_24px_70px_-50px_rgba(23,63,50,0.4)] transition-[border-color,box-shadow] duration-500 hover:border-[#99683d]/30 hover:shadow-[0_30px_80px_-48px_rgba(23,63,50,0.35)] motion-reduce:transition-none">
                <Film src={film} poster={poster} reduced={reduced}
                  className="aspect-[16/10] w-full object-cover transition-[filter,transform] duration-700 ease-out group-hover:scale-[1.015] group-hover:brightness-[1.05] motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
                <div aria-hidden className="absolute inset-0 transition-opacity duration-500 group-hover:opacity-95 motion-reduce:transition-none" style={{ background: "linear-gradient(to top, rgba(255,253,248,0.99) 3%, rgba(255,250,240,0.94) 27%, rgba(255,250,240,0.32) 58%, transparent 72%)" }} />
                <div aria-hidden className="pointer-events-none absolute inset-px rounded-[calc(1.5rem-1px)] ring-1 ring-inset ring-white/55 transition-shadow duration-500 group-hover:ring-[#99683d]/15 motion-reduce:transition-none" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-6 p-6 sm:p-7">
                  <div>
                    <h3 className="font-serif text-3xl font-light" style={{ color: PINE }}>{title}</h3>
                    <p className="mt-1 text-sm" style={{ color: SAGE }}>{line}</p>
                  </div>
                  <span className="font-mono text-5xl font-light opacity-55" style={{ color: BRONZE }}>{n}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <Day2ReviewsWall reduced={reduced} />

      {/* ACT III — the family */}
      <section className="relative overflow-hidden border-y py-24 sm:py-32 lg:py-40" style={{ borderColor: "rgba(23,63,50,0.1)", background: "linear-gradient(135deg, #e7ecdf 0%, #f0eadc 100%)" }} aria-label="Membership">
        <div aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(circle at 10% 10%, rgba(255,255,255,0.7), transparent 34%), radial-gradient(circle at 92% 90%, rgba(177,199,176,0.35), transparent 38%)" }} />
        <div className="relative mx-auto w-full max-w-[90rem] px-5 sm:px-8 lg:px-12">
          <div className="rounded-[2rem] border border-[#173f32]/10 bg-[#fffdf8]/90 px-5 py-10 shadow-[0_28px_90px_-58px_rgba(23,63,50,0.45)] backdrop-blur-sm sm:rounded-[2.5rem] sm:px-10 sm:py-14 lg:px-16 lg:py-18">
            <p className="font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: BRONZE }}>
              Membership
            </p>
            <h2 className="mt-6 max-w-3xl font-serif text-5xl font-light leading-[0.95] sm:text-7xl lg:text-8xl" style={{ color: PINE }}>
              Welcome to
              <br />
              <em style={{ color: BRONZE }}>the family.</em>
            </h2>
            <p className="mt-8 max-w-xl text-lg leading-relaxed" style={{ color: SAGE }}>
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
                <li key={t} className="border-t pt-5" style={{ borderColor: "rgba(153,104,61,0.26)" }}>
                  <p className="font-serif text-xl font-light" style={{ color: PINE }}>{t}</p>
                  <p className="mt-1 text-sm leading-relaxed" style={{ color: SAGE }}>{d}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>


      {/* ACT IV — dawn */}
      <section className="relative min-h-[80svh]" aria-label="Begin">
        <Film src="/day/hero-film.mp4" poster="/day/morning.jpg" reduced={reduced}
          className="absolute inset-0 h-full w-full object-cover" />
        <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(245,240,230,0.24) 0%, rgba(245,240,230,0.38) 48%, rgba(245,240,230,0.72) 100%)" }} />
        <div className="relative z-10 mx-auto flex min-h-[80svh] w-full max-w-[90rem] flex-col items-center justify-center px-5 py-24 text-center sm:px-8 lg:px-12">
          <div className="w-full max-w-4xl rounded-[2rem] border border-white/65 bg-[#fffaf0]/80 px-5 py-12 shadow-[0_28px_90px_-50px_rgba(23,63,50,0.4)] backdrop-blur-sm sm:px-10 sm:py-16">
            <h2 className="mx-auto max-w-3xl font-serif text-[2.85rem] font-light leading-[0.98] sm:text-7xl" style={{ color: PINE }}>
              Morning looks better
              <br />
              <em style={{ color: BRONZE }}>through clean glass.</em>
            </h2>
            <div className="mt-12"><Cta big anchorRef={closingCtaRef}>Request a plan</Cta></div>
            <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: SAGE }}>
              Every 3 Months · Every 6 Months · One-Time Service
            </p>
          </div>
        </div>
      </section>

      <div
        aria-hidden={!dockVisible}
        className={`fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:inset-x-auto md:bottom-6 md:right-6 md:p-0 ${reduced ? "transition-none" : "transition-[opacity,transform,visibility] duration-300 ease-out"} ${dockVisible ? "visible translate-y-0 opacity-100" : "invisible pointer-events-none translate-y-2 opacity-0"}`}
      >
        <div className="rounded-[1.25rem] border border-[#173f32]/10 bg-[#fffaf0]/92 p-2 shadow-[0_18px_48px_-24px_rgba(23,63,50,0.42)] backdrop-blur-lg md:rounded-full md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none">
          <Cta dock tabIndex={dockVisible ? 0 : -1}>Request a plan</Cta>
        </div>
      </div>

      <footer className="mx-auto max-w-3xl px-6 py-10 text-center">
        <p className="font-mono text-xs tracking-[0.14em]" style={{ color: BRONZE_TEXT }}>
          SqueegeeKing · powered by HomeAtlas
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-xs leading-relaxed" style={{ color: SAGE }}>
          Professional window cleaning, pressure washing, and solar panel
          cleaning, plus recurring home maintenance memberships every 3 or 6
          months. Every visit is recorded in HomeAtlas, the living memory of
          your home&apos;s care.
        </p>
      </footer>
    </main>
  );
}
