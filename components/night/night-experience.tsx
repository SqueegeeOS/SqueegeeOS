"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

/*
 * THE NIGHT WATCH — the NOCTURNE experience, at home.
 * Two renders of the same house: dormant and kept. Your attention is the
 * lamp. Scroll commits, and the whole street wakes.
 */

const INK = "#0a0d13";
const CHAMPAGNE = "#d4b98c";
const IVORY = "#f2efe7";
const MIST = "#8b93a3";

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

function LampCta({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLAnchorElement>(null);
  return (
    <Link
      href="/request"
      ref={ref}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--gx", `${e.clientX - r.left}px`);
        el.style.setProperty("--gy", `${e.clientY - r.top}px`);
      }}
      className="night-cta inline-flex min-h-[54px] items-center px-9 text-sm font-medium tracking-[0.08em]"
    >
      {children}
    </Link>
  );
}

/* ---------------------------------------------------------------- */

function Hero({ reduced }: { reduced: boolean }) {
  const sectionRef = useRef<HTMLElement>(null);
  const litRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced) return;
    const section = sectionRef.current;
    const lit = litRef.current;
    const halo = haloRef.current;
    if (!section || !lit || !halo) return;

    const fine = window.matchMedia("(pointer: fine)").matches;
    let tx = window.innerWidth / 2;
    let ty = window.innerHeight * 0.42;
    let x = tx;
    let y = ty;
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
    };

    const loop = () => {
      const rect = section.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const progress =
        total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 1;

      const vmax = Math.max(window.innerWidth, window.innerHeight);
      const base = fine ? 0.16 : 0.2;
      const r = (base + Math.pow(progress, 1.4) * 1.7) * vmax;

      if (fine) {
        x += (tx - x) * 0.07;
        y += (ty - y) * 0.07;
      } else {
        x = window.innerWidth / 2;
        y = window.innerHeight * 0.42;
      }

      const mask = `radial-gradient(circle ${r}px at ${x}px ${y}px, black 0%, black 62%, transparent 100%)`;
      lit.style.setProperty("-webkit-mask-image", mask);
      lit.style.setProperty("mask-image", mask);

      const ring = `radial-gradient(circle ${r}px at ${x}px ${y}px, transparent 0%, transparent 56%, black 68%, black 78%, transparent 96%)`;
      halo.style.setProperty("-webkit-mask-image", ring);
      halo.style.setProperty("mask-image", ring);
      halo.style.opacity = String(
        0.55 * Math.max(0, 1 - Math.pow(progress, 1.2)),
      );
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    if (fine) window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      if (fine) window.removeEventListener("pointermove", onMove);
    };
  }, [reduced]);

  const initialMask =
    "radial-gradient(circle 12vmax at 50% 42%, black 0%, black 62%, transparent 100%)";
  const initialRing =
    "radial-gradient(circle 12vmax at 50% 42%, transparent 0%, transparent 56%, black 68%, black 78%, transparent 96%)";

  return (
    <section
      ref={sectionRef}
      className="relative"
      style={{ height: reduced ? "100dvh" : "230vh" }}
      aria-label="A house at night that lights up under your attention"
    >
      <div className="sticky top-0 h-dvh overflow-hidden">
        <img
          src="/night/house-dark.jpg"
          alt="A craftsman house at blue hour, every window dark"
          className="absolute inset-0 h-full w-full object-cover"
          fetchPriority="high"
          draggable={false}
        />
        <div
          ref={litRef}
          className="absolute inset-0"
          style={
            reduced
              ? undefined
              : { maskImage: initialMask, WebkitMaskImage: initialMask }
          }
        >
          <img
            src="/night/house-lit.jpg"
            alt=""
            aria-hidden
            className="h-full w-full object-cover"
            draggable={false}
          />
        </div>
        {!reduced && (
          <div
            ref={haloRef}
            aria-hidden
            className="absolute inset-0"
            style={{
              mixBlendMode: "screen",
              opacity: 0,
              filter: "brightness(1.5) saturate(1.25) sepia(0.3)",
              maskImage: initialRing,
              WebkitMaskImage: initialRing,
            }}
          >
            <img
              src="/night/house-lit.jpg"
              alt=""
              aria-hidden
              className="h-full w-full object-cover"
              draggable={false}
            />
          </div>
        )}

        <div
          className="absolute inset-x-0 bottom-0 h-[46dvh]"
          style={{
            background: `linear-gradient(to top, ${INK}, ${INK}bf, transparent)`,
          }}
        />

        <div className="absolute inset-x-0 bottom-0 px-6 pb-14 sm:px-12 sm:pb-16 lg:px-20">
          <h1
            className="night-rise max-w-3xl font-serif text-5xl font-light leading-[1.02] tracking-tight sm:text-7xl"
            style={{ color: IVORY }}
          >
            Every house sleeps.
            <br />
            <em style={{ color: CHAMPAGNE }}>Yours is watched.</em>
          </h1>
          <p
            className="night-rise-2 mt-6 max-w-md text-base leading-relaxed"
            style={{ color: MIST }}
          >
            HomeAtlas keeps a living record of your home, so the people who
            care for it never forget a thing.
          </p>
          <div className="night-rise-3 mt-9">
            <LampCta>Request care</LampCta>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- */

const SERVICES: Array<{ img: string; title: string; line: string }> = [
  {
    img: "/night/service-window.jpg",
    title: "Window cleaning",
    line: "Glass that disappears. Frames, screens, and tracks included.",
  },
  {
    img: "/night/service-pressure.jpg",
    title: "Pressure washing",
    line: "Paths, patios, siding. The years rinse off.",
  },
  {
    img: "/night/service-solar.jpg",
    title: "Solar panel cleaning",
    line: "Clean panels work harder. We keep the output honest.",
  },
  {
    img: "/night/house-lit.jpg",
    title: "Maintenance plans",
    line: "The whole calendar, handled. Visits arrive before problems do.",
  },
];

function Services() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-28 sm:px-12 sm:py-36">
      <p
        className="font-mono text-xs uppercase tracking-[0.3em]"
        style={{ color: MIST }}
      >
        The night watch
      </p>
      <h2
        className="mt-4 font-serif text-4xl font-light sm:text-5xl"
        style={{ color: IVORY }}
      >
        Four ways we keep it.
      </h2>
      <div className="mt-14 grid gap-6 sm:grid-cols-2">
        {SERVICES.map((s) => (
          <article
            key={s.title}
            className="group overflow-hidden rounded-[1.35rem] border border-white/[0.08]"
            style={{ background: "#11151f" }}
          >
            <div className="relative h-56 overflow-hidden sm:h-64">
              <img
                src={s.img}
                alt=""
                aria-hidden
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                draggable={false}
              />
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(to top, #11151f, transparent 55%)`,
                }}
              />
            </div>
            <div className="px-7 pb-8 pt-2">
              <h3
                className="font-serif text-2xl font-light"
                style={{ color: IVORY }}
              >
                {s.title}
              </h3>
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{ color: MIST }}
              >
                {s.line}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- */

const LEDGER: Array<{ date: string; entry: string; note: string }> = [
  {
    date: "OCT 12",
    entry: "West windows show the first trace of hard water.",
    note: "watch list",
  },
  {
    date: "JAN 08",
    entry: "Gate code changed. Noted for every future visit.",
    note: "access",
  },
  {
    date: "MAR 22",
    entry: "Panels washed. Output back where it belongs.",
    note: "solar",
  },
  {
    date: "JUN 04",
    entry: "North path pressure washed ahead of algae season.",
    note: "exterior",
  },
  {
    date: "SEP 17",
    entry: "Screens measured. Replacement set for spring.",
    note: "promise kept",
  },
];

function Ledger({ reduced }: { reduced: boolean }) {
  const listRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rail = railRef.current;
    if (reduced) {
      if (rail) rail.style.transform = "scaleY(1)";
      return;
    }
    const list = listRef.current;
    if (!list || !rail) return;

    let raf = 0;
    const loop = () => {
      const rect = list.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = Math.min(1, Math.max(0, (vh * 0.85 - rect.top) / rect.height));
      rail.style.transform = `scaleY(${p})`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return (
    <section className="mx-auto max-w-4xl px-6 pb-28 sm:px-12 sm:pb-36">
      <p
        className="font-mono text-xs uppercase tracking-[0.3em]"
        style={{ color: MIST }}
      >
        The ledger
      </p>
      <h2
        className="mt-4 font-serif text-4xl font-light sm:text-5xl"
        style={{ color: IVORY }}
      >
        What the record keeps.
      </h2>

      <div ref={listRef} className="relative mt-14">
        <div
          aria-hidden
          className="absolute bottom-0 left-0 top-0 w-px"
          style={{ background: `${CHAMPAGNE}26` }}
        />
        <div
          ref={railRef}
          aria-hidden
          className="absolute bottom-0 left-0 top-0 w-px origin-top"
          style={{ background: CHAMPAGNE, transform: "scaleY(0)" }}
        />
        <ul className="divide-y divide-white/[0.09]">
          {LEDGER.map((row) => (
            <li
              key={row.date + row.note}
              className="grid gap-2 py-7 pl-8 transition-colors duration-500 hover:bg-[#d4b98c]/[0.04] sm:grid-cols-[7rem_1fr_auto] sm:items-baseline sm:gap-6"
            >
              <span
                className="font-mono text-xs tracking-[0.14em]"
                style={{ color: MIST }}
              >
                {row.date}
              </span>
              <span
                className="text-lg leading-relaxed"
                style={{ color: `${IVORY}e6` }}
              >
                {row.entry}
              </span>
              <span
                className="font-mono text-[11px] uppercase tracking-[0.2em]"
                style={{ color: `${CHAMPAGNE}cc` }}
              >
                {row.note}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p
        className="mt-10 max-w-lg text-sm leading-relaxed"
        style={{ color: MIST }}
      >
        Entries from a real season of care, kept the way HomeAtlas keeps them:
        dated, plain, and never lost between visits.
      </p>
    </section>
  );
}

/* ---------------------------------------------------------------- */

function NightFilm({ reduced }: { reduced: boolean }) {
  return (
    <section
      className="relative overflow-hidden border-y border-white/[0.09]"
      aria-label="The house at night, alive"
    >
      <div className="relative min-h-[70vh]">
        {reduced ? (
          <img
            src="/night/house-lit.jpg"
            alt="Warm light in every window of a cared-for house at night"
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <video
            src="/night/night-film.mp4"
            poster="/night/house-lit.jpg"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to top, ${INK} 0%, transparent 45%), linear-gradient(to right, ${INK}99 0%, transparent 45%)`,
          }}
        />
        <div className="relative flex min-h-[70vh] flex-col justify-end px-6 pb-16 sm:px-12 lg:px-20">
          <h2
            className="max-w-xl font-serif text-3xl font-light leading-tight sm:text-5xl"
            style={{ color: IVORY }}
          >
            While you sleep, the record keeps.
          </h2>
          <p
            className="mt-5 max-w-md text-base leading-relaxed"
            style={{ color: MIST }}
          >
            Every visit adds a line. Every season adds a chapter. Every year
            makes the next one easier to care for.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- */

function Close() {
  return (
    <section className="px-6 py-36 text-center sm:py-48">
      <h2
        className="mx-auto max-w-2xl font-serif text-4xl font-light leading-[1.1] sm:text-6xl"
        style={{ color: IVORY }}
      >
        Care that remembers <em style={{ color: CHAMPAGNE }}>you</em> back.
      </h2>
      <div className="mt-12 flex justify-center">
        <LampCta>Request care</LampCta>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- */

export function NightExperience() {
  const reduced = useReducedMotion();

  return (
    <main style={{ background: INK }} className="min-h-dvh">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-6 sm:px-12">
        <Link
          href="/"
          className="pointer-events-auto font-serif text-xl font-light tracking-wide"
          style={{ color: IVORY }}
        >
          HomeAtlas
        </Link>
        <Link
          href="/day"
          className="night-link pointer-events-auto font-mono text-xs uppercase tracking-[0.2em]"
          style={{ color: MIST }}
        >
          Back to daylight
        </Link>
      </header>

      <Hero reduced={reduced} />
      <Services />
      <Ledger reduced={reduced} />
      <NightFilm reduced={reduced} />
      <Close />

      <footer className="border-t border-white/[0.09] px-6 py-10 text-center">
        <p
          className="font-mono text-xs tracking-[0.14em]"
          style={{ color: `${MIST}b3` }}
        >
          The night watch · HomeAtlas by SqueegeeKing
        </p>
      </footer>
    </main>
  );
}
