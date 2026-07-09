"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

/*
 * THE DAY'S WORK — the DAYBREAK experience, at home.
 * Scroll is a sundial: 06:00 at the top of the page, 19:00 at the footer.
 * The sky, the sun, the clock, and every shadow follow your scroll.
 */

const PAPER = "#f7f6f1";
const INK = "#1c2430";
const COBALT = "#2b59c3";
const SLATE = "#6a7280";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/* ------------------------------------------------------------------ */

type RGB = [number, number, number];

const SKY: Array<{ top: RGB; mid: RGB }> = [
  { top: [252, 233, 198], mid: [247, 246, 241] },
  { top: [223, 233, 250], mid: [245, 246, 244] },
  { top: [201, 214, 242], mid: [243, 228, 207] },
];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function mixRgb(a: RGB, b: RGB, t: number): string {
  return `rgb(${Math.round(lerp(a[0], b[0], t))}, ${Math.round(
    lerp(a[1], b[1], t),
  )}, ${Math.round(lerp(a[2], b[2], t))})`;
}

function phaseAt(h: number): string {
  if (h < 7.5) return "first light";
  if (h < 10) return "morning";
  if (h < 13) return "midday";
  if (h < 16) return "afternoon";
  if (h < 18) return "golden hour";
  return "dusk";
}

function SunEngine() {
  const skyRef = useRef<HTMLDivElement>(null);
  const sunRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const phaseRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const sky = skyRef.current;
    const sun = sunRef.current;
    const time = timeRef.current;
    const phase = phaseRef.current;
    if (!sky || !sun || !time || !phase) return;

    let raf = 0;
    let last = -1;

    const loop = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;

      if (Math.abs(p - last) > 0.0004) {
        last = p;

        const seg = p < 0.5 ? 0 : 1;
        const t = p < 0.5 ? p * 2 : (p - 0.5) * 2;
        const top = mixRgb(SKY[seg].top, SKY[seg + 1].top, t);
        const mid = mixRgb(SKY[seg].mid, SKY[seg + 1].mid, t);
        sky.style.background = `linear-gradient(180deg, ${top} 0%, ${mid} 46%, ${PAPER} 100%)`;

        const x = 6 + p * 88;
        const y = 74 - Math.sin(p * Math.PI) * 60;
        sun.style.transform = `translate(${(x / 100) * window.innerWidth}px, ${
          (y / 100) * window.innerHeight
        }px)`;

        const hour = 6 + p * 13;
        const hh = String(Math.floor(hour)).padStart(2, "0");
        const mm = String(Math.floor((hour % 1) * 60)).padStart(2, "0");
        time.textContent = `${hh}:${mm}`;
        phase.textContent = phaseAt(hour);

        document.documentElement.style.setProperty(
          "--sun-shadow-dx",
          `${Math.round(34 - p * 68)}px`,
        );
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      <div
        ref={skyRef}
        aria-hidden
        className="fixed inset-0 z-0"
        style={{
          background: `linear-gradient(180deg, #fce9c6 0%, ${PAPER} 46%, ${PAPER} 100%)`,
        }}
      />
      <div
        ref={sunRef}
        aria-hidden
        className="fixed left-0 top-0 z-[1]"
        style={{ transform: "translate(-200px, -200px)", willChange: "transform" }}
      >
        <div
          className="-ml-14 -mt-14 h-28 w-28 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(255,222,150,0.95) 0%, rgba(244,190,96,0.55) 42%, transparent 70%)",
            filter: "blur(2px)",
          }}
        />
      </div>
      <div
        aria-hidden
        className="fixed bottom-5 left-5 z-30 flex items-baseline gap-3 rounded-full border px-5 py-2.5 backdrop-blur-sm"
        style={{
          borderColor: "rgba(28,36,48,0.12)",
          background: `${PAPER}cc`,
        }}
      >
        <span
          ref={timeRef}
          className="font-mono text-sm font-medium"
          style={{ color: INK }}
        >
          06:00
        </span>
        <span ref={phaseRef} className="font-mono text-xs" style={{ color: SLATE }}>
          first light
        </span>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

/** Plays only while visible; loads nothing until near the viewport. */
function LazyVideo({ src, poster }: { src: string; poster: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const v = e.target as HTMLVideoElement;
          if (e.isIntersecting) {
            void v.play().catch(() => {});
          } else {
            v.pause();
          }
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      aria-hidden
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}

function SunriseCta({ children }: { children: ReactNode }) {
  return (
    <Link
      href="/request"
      className="day-cta inline-flex min-h-[54px] items-center px-9 text-sm font-medium tracking-[0.04em]"
    >
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ */

function Hero({ reduced }: { reduced: boolean }) {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-24 pt-24 sm:px-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-32 lg:pt-28">
      <div>
        <p
          className="day-rise font-mono text-xs uppercase tracking-[0.3em]"
          style={{ color: SLATE }}
        >
          SqueegeeKing · powered by HomeAtlas
        </p>
        <h1
          className="day-rise mt-5 max-w-xl text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl"
          style={{ color: INK }}
        >
          Morning comes back.
          <br />
          <span style={{ color: COBALT }}>So do we.</span>
        </h1>
        <p
          className="day-rise-2 mt-6 max-w-md text-lg leading-relaxed"
          style={{ color: SLATE }}
        >
          Windows, stone, solar, and the whole calendar of care. SqueegeeKing
          does the work. HomeAtlas remembers every detail.
        </p>
        <div className="day-rise-3 mt-9">
          <SunriseCta>Request a plan</SunriseCta>
        </div>
      </div>
      <div className="day-rise-2">
        <div
          className="day-arch day-shadow overflow-hidden border"
          style={{ borderColor: "rgba(28,36,48,0.12)" }}
        >
          {reduced ? (
            <img
              src="/day/morning.jpg"
              alt="A cream farmhouse in first morning light"
              className="aspect-[4/5] w-full object-cover sm:aspect-[3/4]"
              draggable={false}
            />
          ) : (
            <video
              src="/day/hero-film.mp4"
              poster="/day/morning.jpg"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              className="aspect-[4/5] w-full object-cover sm:aspect-[3/4]"
            />
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Statement() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-24 sm:px-10 sm:py-32">
      <p
        className="text-3xl font-medium leading-[1.3] tracking-tight sm:text-5xl"
        style={{ color: INK }}
      >
        A house is easiest to love in the morning.
        <span style={{ color: SLATE }}> We keep it that way all year.</span>
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */

const HOURS: Array<{
  time: string;
  title: string;
  line: string;
  film: string;
  poster: string;
}> = [
  {
    time: "07:12",
    title: "Window cleaning",
    line: "First light through clean glass. Frames, screens, and tracks included.",
    film: "/day/hour-window.mp4",
    poster: "/day/hour-window.jpg",
  },
  {
    time: "11:30",
    title: "Pressure washing",
    line: "Paths, patios, siding. The years rinse off before lunch.",
    film: "/day/hour-pressure.mp4",
    poster: "/day/hour-pressure.jpg",
  },
  {
    time: "16:45",
    title: "Solar panel cleaning",
    line: "Golden hour is an audit. Clean panels keep the output honest.",
    film: "/day/hour-solar.mp4",
    poster: "/day/hour-solar.jpg",
  },
  {
    time: "19:04",
    title: "Maintenance plans",
    line: "The porch light comes on. The record is one day longer.",
    film: "/day/hour-dusk.mp4",
    poster: "/day/hour-dusk.jpg",
  },
];

function DaysWork({ reduced }: { reduced: boolean }) {
  return (
    <section className="py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6 sm:px-10">
        <p
          className="font-mono text-xs uppercase tracking-[0.3em]"
          style={{ color: SLATE }}
        >
          The day&apos;s work
        </p>
        <h2
          className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl"
          style={{ color: INK }}
        >
          Four hours worth watching.
        </h2>
      </div>
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-16"
          style={{
            background: `linear-gradient(to left, ${PAPER}, transparent)`,
          }}
        />
        <div className="day-strip mt-12 flex snap-x snap-mandatory gap-6 overflow-x-auto px-6 pb-6 sm:px-10">
          {HOURS.map((h) => (
            <article
              key={h.time}
              className="day-arch day-shadow w-[22rem] flex-none snap-start overflow-hidden border bg-white/60 transition-transform duration-300 hover:-translate-y-1.5 sm:w-[27rem]"
              style={{ borderColor: "rgba(28,36,48,0.12)" }}
            >
              <div className="day-arch relative aspect-video w-full overflow-hidden">
                {reduced ? (
                  <img
                    src={h.poster}
                    alt=""
                    aria-hidden
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <LazyVideo src={h.film} poster={h.poster} />
                )}
                <span
                  className="absolute left-4 top-4 rounded-full px-3 py-1 font-mono text-xs font-medium backdrop-blur-sm"
                  style={{ background: `${PAPER}d9`, color: INK }}
                >
                  {h.time}
                </span>
              </div>
              <div className="px-6 pb-7 pt-5">
                <h3 className="text-xl font-semibold" style={{ color: INK }}>
                  {h.title}
                </h3>
                <p
                  className="mt-2 text-[15px] leading-relaxed"
                  style={{ color: SLATE }}
                >
                  {h.line}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function QuoteBand() {
  return (
    <section
      className="border-y py-24 backdrop-blur-sm sm:py-32"
      style={{
        borderColor: "rgba(28,36,48,0.12)",
        background: "rgba(255,255,255,0.45)",
      }}
    >
      <figure className="mx-auto max-w-3xl px-6 text-center sm:px-10">
        <blockquote
          className="text-3xl font-medium leading-snug tracking-tight sm:text-4xl"
          style={{ color: INK }}
        >
          &ldquo;They knew our garden gate sticks in July. I never told them
          twice.&rdquo;
        </blockquote>
        <figcaption
          className="mt-8 font-mono text-xs uppercase tracking-[0.25em]"
          style={{ color: SLATE }}
        >
          A SqueegeeKing member, year three
        </figcaption>
      </figure>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Close() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-28 sm:px-10 sm:py-36">
      <div
        className="day-arch day-shadow relative overflow-hidden border px-8 py-20 text-center sm:py-24"
        style={{ borderColor: "rgba(28,36,48,0.12)" }}
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, #c9d6f2 0%, #ecdfc9 62%, ${PAPER} 100%)`,
          }}
        />
        <div className="relative">
          <h2
            className="mx-auto max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl"
            style={{ color: INK }}
          >
            Tomorrow is already planned.
          </h2>
          <p
            className="mx-auto mt-5 max-w-md text-base leading-relaxed"
            style={{ color: "#4b5563" }}
          >
            Join the calendar your home deserves. The first visit starts the
            record.
          </p>
          <div className="mt-10 flex justify-center">
            <SunriseCta>Request a plan</SunriseCta>
          </div>
          <p className="mt-8 text-sm" style={{ color: SLATE }}>
            After dark?{" "}
            <Link
              href="/night"
              className="day-link font-medium"
              style={{ color: COBALT }}
            >
              See the night watch
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

export function DayExperience() {
  const reduced = useReducedMotion();

  return (
    <div className="relative" style={{ background: PAPER }}>
      {!reduced && <SunEngine />}
      <main className="relative z-10">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 sm:px-10">
          <Link
            href="/"
            className="text-xl font-semibold tracking-tight"
            style={{ color: INK }}
          >
            SqueegeeKing
          </Link>
          <Link
            href="/night"
            className="day-link font-mono text-xs uppercase tracking-[0.2em]"
            style={{ color: COBALT }}
          >
            The night watch
          </Link>
        </header>

        <Hero reduced={reduced} />
        <Statement />
        <DaysWork reduced={reduced} />
        <QuoteBand />
        <Close />

        <footer className="relative z-10 px-6 pb-24 text-center sm:pb-10">
          <p className="font-mono text-xs tracking-[0.14em]" style={{ color: SLATE }}>
            SqueegeeKing · powered by HomeAtlas ·{" "}
            <Link href="/day/guide" className="day-link" style={{ color: COBALT }}>
              How this was made
            </Link>
          </p>
        </footer>
      </main>
    </div>
  );
}
