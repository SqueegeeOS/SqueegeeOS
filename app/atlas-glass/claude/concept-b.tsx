"use client";

/**
 * ATLAS DIAL — Concept B.
 *
 * Central metaphor: HomeAtlas is literal cartography. Your home sits at the
 * center of its own atlas plate, and the year of care runs around it like a
 * compass bezel — documented visits stamped behind, today's hearth pulsing,
 * the next visit waiting ahead on a dashed meridian.
 *
 * Bold moment: the map inks itself in, then the dial turns, unprompted,
 * from "today" to "what's next" — the atlas anticipates.
 * Surprise: grab the dial (or arrow-key it) and spin your home's year.
 *
 * Real DOM/SVG throughout; sanitized sample data only.
 */

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AtlasMark } from "@/components/theme/atlas-mark";
import "./concept-b.css";

const PINE = "#173f32";
const SAGE = "#526b60";
const BRONZE = "#99683d";
const BRONZE_TEXT = "#8f5f37";
const CANVAS = "#f5f0e6";
const PAPER = "#fffdf8";
const GOLD = "#c9a35c";

/** Index (lubber line) sits at 12 o'clock. */
const INDEX_ANGLE = -90;
/** Waypoint ring radius as a fraction of the dial. */
const RING = 0.358;

type WaypointKind = "past" | "today" | "next";

interface Waypoint {
  id: string;
  kind: WaypointKind;
  /** Calendar-true angle: -90° = Jan 1, clockwise through the year. */
  angle: number;
  date: string;
  title: string;
  body: string;
  photos?: { src: string; pos: string; label: string }[];
  meta?: string;
}

const dayAngle = (dayOfYear: number) => -90 + (dayOfYear / 365) * 360;

/** Server and client libm can disagree in the 15th decimal of sin/cos —
 * round every serialized coordinate so SSR html matches hydration. */
const fx = (n: number) => Math.round(n * 100) / 100;

const WAYPOINTS: Waypoint[] = [
  {
    id: "jan",
    kind: "past",
    angle: dayAngle(9),
    date: "Jan 9",
    title: "Solar panel care",
    body: "Panels rinsed and inspected. Output kept honest through the wet season.",
    photos: [
      { src: "/atlas-glass/hero-house.jpg", pos: "50% 12%", label: "Roofline, after" },
      { src: "/day/hour-pressure.jpg", pos: "50% 78%", label: "Rinse detail" },
    ],
    meta: "12 photos · Documented",
  },
  {
    id: "apr",
    kind: "past",
    angle: dayAngle(102),
    date: "Apr 12",
    title: "Windows + screens",
    body: "Every pane and screen, inside edge to outside sill. Spring pollen gone.",
    photos: [
      { src: "/atlas-glass/hero-house.jpg", pos: "50% 34%", label: "Front windows, after" },
      { src: "/atlas-glass/hero-house.jpg", pos: "26% 42%", label: "West bay, after" },
    ],
    meta: "28 photos · Documented",
  },
  {
    id: "jul",
    kind: "past",
    angle: dayAngle(199),
    date: "Jul 18",
    title: "Full exterior wash",
    body: "Windows, siding, and the back patio. The whole envelope, reset.",
    photos: [
      { src: "/atlas-glass/hero-house.jpg", pos: "50% 52%", label: "Porch, after" },
      { src: "/day/hour-pressure.jpg", pos: "50% 60%", label: "Patio, during" },
    ],
    meta: "42 photos · Documented",
  },
  {
    id: "today",
    kind: "today",
    angle: dayAngle(220),
    date: "Today",
    title: "Your home, current",
    body: "Between visits the atlas holds the whole record — 82 photos, three seasons of notes, and what's coming next.",
    meta: "Aug 8 · The hearth is lit",
  },
  {
    id: "next",
    kind: "next",
    angle: dayAngle(287),
    date: "Oct 14",
    title: "Next care visit",
    body: "Exterior window detail · Solar rinse. Morning arrival, 8–11 AM. We'll text when the crew is on the way — no need to call.",
    meta: "Scheduled · Anticipated",
  },
];

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (cb: () => void) => {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const getReduced = () => window.matchMedia(REDUCED_QUERY).matches;
const getServerReduced = () => false;

/** Shortest-path rotation target so the dial never whips the long way. */
function nearestTurn(current: number, target: number) {
  let t = target;
  while (t - current > 180) t -= 360;
  while (t - current < -180) t += 360;
  return t;
}

export function ConceptB() {
  const [selectedId, setSelectedId] = useState<string>("today");
  const [rot, setRot] = useState<number>(
    INDEX_ANGLE - WAYPOINTS.find((w) => w.id === "today")!.angle,
  );
  const [dragging, setDragging] = useState(false);
  const reduced = useSyncExternalStore(subscribeReduced, getReduced, getServerReduced);

  const dialRef = useRef<HTMLDivElement>(null);
  const heroCtaRef = useRef<HTMLAnchorElement>(null);
  const closingCtaRef = useRef<HTMLAnchorElement>(null);
  const interactedRef = useRef(false);
  const dragState = useRef<{ startPointerAngle: number; startRot: number; moved: boolean } | null>(null);
  const [dockVisible, setDockVisible] = useState(false);

  const selected = useMemo(
    () => WAYPOINTS.find((w) => w.id === selectedId)!,
    [selectedId],
  );

  /* ---------- selection & rotation ---------- */

  const turnTo = useCallback(
    (id: string) => {
      const wp = WAYPOINTS.find((w) => w.id === id);
      if (!wp) return;
      setSelectedId(id);
      setRot((r) => nearestTurn(r, INDEX_ANGLE - wp.angle));
    },
    [],
  );

  const step = useCallback(
    (dir: 1 | -1) => {
      interactedRef.current = true;
      const i = WAYPOINTS.findIndex((w) => w.id === selectedId);
      const nextIndex = Math.min(WAYPOINTS.length - 1, Math.max(0, i + dir));
      turnTo(WAYPOINTS[nextIndex].id);
    },
    [selectedId, turnTo],
  );

  /* The anticipation turn: after the map finishes inking itself, the dial
     rotates on its own from today to the next visit. Reduced-motion
     visitors keep the fully drawn map, resting on "today". */
  useEffect(() => {
    if (getReduced()) return;
    const t = setTimeout(() => {
      if (!interactedRef.current) turnTo("next");
    }, 2600);
    return () => clearTimeout(t);
  }, [turnTo]);

  /* ---------- drag-to-turn ---------- */

  const pointerAngle = (e: React.PointerEvent) => {
    const rect = dialRef.current!.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!dialRef.current) return;
    // Arm the drag before capturing: capture can reject a pointer id the
    // browser no longer considers active, and losing the drag is worse
    // than losing capture.
    dragState.current = { startPointerAngle: pointerAngle(e), startRot: rot, moved: false };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      /* capture is an enhancement; the pointerup handler still ends the drag */
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = dragState.current;
    if (!s) return;
    const delta = pointerAngle(e) - s.startPointerAngle;
    if (!s.moved && Math.abs(delta) < 3) return;
    if (!s.moved) {
      s.moved = true;
      interactedRef.current = true;
      setDragging(true);
    }
    setRot(s.startRot + delta);
  };

  const endDrag = () => {
    const s = dragState.current;
    dragState.current = null;
    if (!s || !s.moved) return;
    setDragging(false);
    // Snap to whichever waypoint is closest to the index line.
    setRot((r) => {
      let best = WAYPOINTS[0];
      let bestDist = Infinity;
      for (const w of WAYPOINTS) {
        const pos = ((w.angle + r - INDEX_ANGLE) % 360 + 540) % 360 - 180;
        if (Math.abs(pos) < bestDist) {
          bestDist = Math.abs(pos);
          best = w;
        }
      }
      setSelectedId(best.id);
      return nearestTurn(r, INDEX_ANGLE - best.angle);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      step(-1);
    }
  };

  /* ---------- scroll ink-in ---------- */

  useEffect(() => {
    const els = document.querySelectorAll(".cb-ink");
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          if (en.isIntersecting) en.target.classList.add("cb-inked");
        }),
      { rootMargin: "-60px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  /* The ask is never more than a thumb away: dock the CTA whenever both
     the hero and closing buttons are off screen. Same pattern the
     production homepage uses. */
  useEffect(() => {
    const hero = heroCtaRef.current;
    const closing = closingCtaRef.current;
    if (!hero || !closing) return;
    const seen = new Map<Element, boolean>([
      [hero, true],
      [closing, false],
    ]);
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => seen.set(en.target, en.isIntersecting));
        setDockVisible(!seen.get(hero) && !seen.get(closing));
      },
      { threshold: 0.05 },
    );
    io.observe(hero);
    io.observe(closing);
    return () => io.disconnect();
  }, []);

  /* ---------- render ---------- */

  return (
    <main
      className="cb-root overflow-x-clip"
      style={{ background: CANVAS, color: PINE }}
    >
      {/* ————— HERO: the atlas plate ————— */}
      <section
        className="relative flex min-h-[100svh] flex-col justify-center px-5 pb-12 pt-10 sm:px-8 sm:pt-16 lg:px-14"
        aria-label="SqueegeeKing — HomeAtlas"
      >
        <div
          aria-hidden
          className="cb-grain pointer-events-none absolute inset-0 opacity-[0.05]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 72% 42%, rgba(214,197,161,0.34), transparent 62%), radial-gradient(ellipse 46% 38% at 8% 100%, rgba(187,205,174,0.25), transparent 58%)",
          }}
        />

        {/* Mobile reads top-to-bottom: promise → the atlas itself → proof →
            ask. Desktop splits it into copy left / plate right. */}
        <div className="relative mx-auto grid w-full max-w-[86rem] gap-7 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:grid-rows-[auto_auto] lg:items-center lg:gap-x-6 lg:gap-y-4">
          {/* A — promise */}
          <div className="max-w-xl lg:col-start-1 lg:row-start-1 lg:self-end">
            <p
              className="cb-rise mb-4 max-w-max rounded-full border px-3 py-1 font-mono text-[8.5px] uppercase tracking-[0.2em] sm:mb-5 sm:px-3.5 sm:py-1.5 sm:text-[10px] sm:tracking-[0.24em]"
              style={{ borderColor: "rgba(23,63,50,0.16)", background: "rgba(255,253,248,0.6)" }}
            >
              SqueegeeKing · Window cleaning · Chico, California
            </p>
            <h1
              className="cb-rise text-balance font-serif font-light leading-[1.0] tracking-tight"
              style={{ fontSize: "clamp(2.35rem, 8.6vw, 4.9rem)", animationDelay: "0.08s" }}
            >
              Your home keeps
              <br />
              <em className="italic" style={{ color: BRONZE_TEXT }}>
                its own atlas.
              </em>
            </h1>
            <p
              className="cb-rise mt-4 max-w-md text-pretty text-[0.95rem] leading-relaxed sm:mt-5 sm:text-lg"
              style={{ color: SAGE, animationDelay: "0.16s" }}
            >
              Every SqueegeeKing membership includes HomeAtlas — a living map
              of every visit, every photo, and everything your home needs
              next.
            </p>
          </div>

          {/* B — the atlas plate itself */}
          <div className="flex justify-center lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:justify-end">
            <AtlasDial
              rot={rot}
              dragging={dragging}
              reduced={reduced}
              selectedId={selectedId}
              dialRef={dialRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onKeyDown={onKeyDown}
              onSelect={(id) => {
                interactedRef.current = true;
                turnTo(id);
              }}
            />
          </div>

          {/* C — proof + ask */}
          <div className="lg:col-start-1 lg:row-start-2 lg:self-start">
            <FieldNote wp={selected} />
            <div
              className="cb-rise mt-6 flex flex-wrap items-center gap-x-5 gap-y-3"
              style={{ animationDelay: "0.24s" }}
            >
              <Link
                ref={heroCtaRef}
                href="/request"
                className="inline-flex min-h-[54px] w-full items-center justify-center gap-3 rounded-full px-8 text-sm font-medium tracking-[0.06em] shadow-[0_16px_40px_-22px_rgba(23,63,50,0.75)] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 motion-reduce:transform-none sm:w-auto"
                style={{ background: PINE, color: "#fffaf0", outlineColor: BRONZE }}
              >
                Get your free Home Care Plan
                <span aria-hidden className="font-mono">→</span>
              </Link>
              <a
                href="#legend"
                className="border-b-2 border-dotted pb-0.5 text-sm transition-colors hover:border-solid"
                style={{ borderColor: "rgba(143,95,55,0.55)", color: BRONZE_TEXT }}
              >
                How the atlas works
              </a>
            </div>
            <p
              className="cb-rise mt-3 font-mono text-[9px] uppercase tracking-[0.2em]"
              style={{ color: "rgba(23,63,50,0.55)", animationDelay: "0.3s" }}
            >
              Takes about 60 seconds · No obligation
            </p>
          </div>
        </div>

        <p
          className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-[8px] uppercase tracking-[0.3em]"
          style={{ color: "rgba(23,63,50,0.35)" }}
        >
          HomeAtlas · The Atlas Dial
        </p>
      </section>

      {/* ————— LEGEND ————— */}
      <section
        id="legend"
        className="border-y px-5 py-16 sm:px-8 sm:py-24"
        style={{ borderColor: "rgba(23,63,50,0.12)", background: PAPER }}
        aria-label="How the atlas works"
      >
        <div className="mx-auto max-w-5xl">
          <p className="cb-ink font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: BRONZE_TEXT }}>
            Map legend
          </p>
          <h2 className="cb-ink mt-3 max-w-xl text-balance font-serif text-3xl font-light leading-tight sm:text-5xl">
            How to read your home&rsquo;s atlas.
          </h2>
          <div className="mt-10 grid gap-8 sm:mt-14 sm:grid-cols-3 sm:gap-6">
            <LegendItem
              delay={0}
              symbol={
                <svg viewBox="0 0 44 44" className="h-11 w-11" aria-hidden>
                  <circle cx="22" cy="22" r="15" fill="none" stroke={PINE} strokeWidth="1.6" />
                  <path d="M15.5 22.5 L20 27 L29 17.5" fill="none" stroke={BRONZE} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
              title="Stamped visits"
              copy="Every visit is documented and photographed, then stamped into your record. Proof, not promises."
            />
            <LegendItem
              delay={0.12}
              symbol={
                <svg viewBox="0 0 44 44" className="h-11 w-11" aria-hidden>
                  <circle cx="22" cy="22" r="15" fill="none" stroke={PINE} strokeWidth="1.6" strokeDasharray="3.5 4" />
                  <circle cx="22" cy="22" r="5" fill={GOLD} />
                </svg>
              }
              title="The lit hearth"
              copy="Your home today, at the center of its own map. One living record instead of a shoebox of invoices."
            />
            <LegendItem
              delay={0.24}
              symbol={
                <svg viewBox="0 0 44 44" className="h-11 w-11" aria-hidden>
                  <path d="M8 30 Q22 8 36 18" fill="none" stroke={BRONZE} strokeWidth="2" strokeLinecap="round" strokeDasharray="1.5 6" />
                  <path d="M31.5 14.5 L36.5 18 L31.5 21.5" fill="none" stroke={BRONZE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
              title="The dashed road"
              copy="What's scheduled next, already on the map. Your home knows what's coming — you never have to remember."
            />
          </div>
        </div>
      </section>

      {/* ————— THE CRAFT ————— */}
      <section className="px-5 py-16 sm:px-8 sm:py-24" aria-label="Services">
        <div className="mx-auto max-w-5xl">
          <p className="cb-ink font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: BRONZE_TEXT }}>
            The craft the atlas records
          </p>
          <div className="mt-8 grid gap-px overflow-hidden rounded-[1.4rem] border sm:grid-cols-2 lg:grid-cols-4" style={{ borderColor: "rgba(23,63,50,0.14)", background: "rgba(23,63,50,0.14)" }}>
            {[
              ["01", "Window Cleaning", "Glass that disappears."],
              ["02", "Pressure Washing", "The years rinse off."],
              ["03", "Solar Panel Care", "Output kept honest."],
              ["04", "Maintenance Plans", "The calendar, handled."],
            ].map(([n, t, s], i) => (
              <Link
                key={n}
                href="/services"
                className="cb-ink group block p-6 transition-colors sm:p-7"
                style={{ background: PAPER, transitionDelay: `${i * 0.08}s` }}
              >
                <p className="font-mono text-[10px] tracking-[0.2em]" style={{ color: "rgba(23,63,50,0.45)" }}>
                  {n}
                </p>
                <p className="mt-2 font-serif text-xl" style={{ color: PINE }}>
                  {t}
                </p>
                <p className="mt-1 text-sm" style={{ color: SAGE }}>
                  {s}
                </p>
                <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] opacity-0 transition-opacity group-hover:opacity-100 motion-reduce:opacity-60" style={{ color: BRONZE_TEXT }}>
                  Explore →
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ————— CLOSE ————— */}
      <section
        className="px-5 py-20 text-center sm:px-8 sm:py-28"
        style={{ background: `linear-gradient(180deg, #14382c 0%, #0f2c22 100%)`, color: "#fffaf0" }}
        aria-label="Become a member"
      >
        <div className="cb-ink mx-auto flex max-w-2xl flex-col items-center">
          <AtlasMark size={64} className="text-[#fffaf0]" />
          <h2 className="mt-6 text-balance font-serif text-4xl font-light leading-tight sm:text-6xl">
            Window cleaning
            <br />
            with a{" "}
            <em className="italic" style={{ color: "#c9b896" }}>
              memory.
            </em>
          </h2>
          <p className="mt-5 max-w-md text-pretty text-sm leading-relaxed text-[#fffaf0]/70 sm:text-base">
            One visit starts the atlas. Every visit after adds to it — and it
            belongs to your home for good.
          </p>
          <Link
            ref={closingCtaRef}
            href="/request"
            className="mt-8 inline-flex min-h-[56px] items-center gap-3 rounded-full px-9 text-sm font-semibold tracking-[0.04em] shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 motion-reduce:transform-none"
            style={{ background: CANVAS, color: PINE, outlineColor: "#c9b896" }}
          >
            Get your free Home Care Plan
            <span aria-hidden className="font-mono">→</span>
          </Link>
          <p className="mt-6 font-mono text-[11px] tracking-[0.22em] text-[#c9b896]">
            SqueegeeKing.net · (530) 588-6235
          </p>
        </div>
      </section>

      {/* ————— docked ask ————— */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] transition-all duration-300 motion-reduce:transition-none"
        style={{
          opacity: dockVisible ? 1 : 0,
          transform: dockVisible ? "translateY(0)" : "translateY(120%)",
        }}
        aria-hidden={!dockVisible}
      >
        <div className="mx-auto max-w-md">
          <Link
            href="/request"
            tabIndex={dockVisible ? undefined : -1}
            className="pointer-events-auto flex min-h-[54px] items-center justify-center gap-3 rounded-full px-7 text-sm font-medium tracking-[0.04em] shadow-[0_18px_44px_-18px_rgba(23,63,50,0.85)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
            style={{ background: PINE, color: "#fffaf0", outlineColor: BRONZE }}
          >
            Get your free Home Care Plan
            <span aria-hidden className="font-mono">→</span>
          </Link>
        </div>
      </div>
    </main>
  );
}

/* ————————————————— the dial ————————————————— */

function AtlasDial({
  rot,
  dragging,
  reduced,
  selectedId,
  dialRef,
  onSelect,
  onKeyDown,
  ...pointerHandlers
}: {
  rot: number;
  dragging: boolean;
  reduced: boolean;
  selectedId: string;
  dialRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (id: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
}) {
  return (
    <div className="flex w-full flex-col items-center lg:items-end">
      {/* cartouche — the plate names itself, clear of the sweep zone */}
      <div
        className="cb-rise mb-3 flex items-center gap-2.5 rounded-lg border px-3 py-1.5"
        style={{
          borderColor: "rgba(23,63,50,0.16)",
          background: "rgba(255,253,248,0.75)",
          animationDelay: "1.55s",
        }}
      >
        <span style={{ color: PINE, ["--accent" as string]: BRONZE }}>
          <AtlasMark size={24} />
        </span>
        <span className="leading-tight">
          <span className="block font-mono text-[9px] uppercase tracking-[0.26em]" style={{ color: PINE }}>
            HomeAtlas
          </span>
          <span className="block font-mono text-[7.5px] uppercase tracking-[0.16em]" style={{ color: "rgba(23,63,50,0.5)" }}>
            Property record · 2026
          </span>
        </span>
      </div>

    <div
      ref={dialRef}
      role="group"
      aria-label="Your home's year of care. Use arrow keys to turn the dial between visits."
      onKeyDown={onKeyDown}
      {...pointerHandlers}
      className="relative aspect-square w-[min(78vw,440px)] cursor-grab touch-none select-none active:cursor-grabbing sm:w-[min(70vw,500px)] lg:w-[min(44vw,600px)]"
    >
      {/* static underlay: outer bezel + drifting meridian */}
      <svg viewBox="0 0 720 720" className="absolute inset-0 h-full w-full" aria-hidden>
        <circle cx="360" cy="360" r="352" fill="none" stroke={PINE} strokeOpacity="0.18" strokeWidth="1.2" />
        <g className="cb-drift">
          <circle
            cx="360" cy="360" r="336"
            fill="none" stroke={PINE} strokeOpacity="0.22" strokeWidth="1"
            strokeDasharray="40 18 90 18 160 18" strokeLinecap="round"
          />
        </g>
      </svg>

      {/* rotating plate */}
      <div
        className={`cb-rotator absolute inset-0 ${dragging ? "cb-dragging" : ""}`}
        style={{ transform: `rotate(${rot}deg)` }}
      >
        <svg viewBox="0 0 720 720" className="absolute inset-0 h-full w-full" aria-hidden>
          {/* month ticks + labels */}
          <g className="cb-ticks" style={{ animationDelay: "0.25s" }}>
            {MONTHS.map((m, i) => {
              const a = ((-90 + i * 30) * Math.PI) / 180;
              const x1 = fx(360 + Math.cos(a) * 340);
              const y1 = fx(360 + Math.sin(a) * 340);
              const x2 = fx(360 + Math.cos(a) * 326);
              const y2 = fx(360 + Math.sin(a) * 326);
              const lx = fx(360 + Math.cos(a) * 310);
              const ly = fx(360 + Math.sin(a) * 310);
              return (
                <g key={i}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={PINE} strokeOpacity="0.4" strokeWidth="1.4" />
                  {/* Counter-rotated so the year stays legible while it
                      turns. Uses the CSS transform (not the SVG attribute)
                      and the shared .cb-counter easing, so the letters
                      track the plate instead of snapping at the end. */}
                  <text
                    className="cb-counter"
                    x={lx} y={ly}
                    fontSize="15" fontFamily="var(--font-geist-mono)" fill={PINE} fillOpacity="0.5"
                    textAnchor="middle" dominantBaseline="central"
                    style={{
                      transform: `rotate(${-rot}deg)`,
                      transformBox: "fill-box",
                      transformOrigin: "center",
                    }}
                  >
                    {m}
                  </text>
                </g>
              );
            })}
          </g>

          {/* hand-drawn meridian contours, inked in sequence */}
          <circle className="cb-contour" pathLength={1} cx="360" cy="360" r="286" fill="none" stroke={PINE} strokeOpacity="0.3" strokeWidth="1.1" strokeDasharray="1" style={{ animationDelay: "0.1s" }} />
          <circle className="cb-contour" pathLength={1} cx="362" cy="358" r="252" fill="none" stroke={PINE} strokeOpacity="0.24" strokeWidth="1" strokeDasharray="1" style={{ animationDelay: "0.3s" }} />
          <circle className="cb-contour" pathLength={1} cx="358" cy="361" r="216" fill="none" stroke={PINE} strokeOpacity="0.2" strokeWidth="1" strokeDasharray="1" style={{ animationDelay: "0.5s" }} />

          {/* the care meridian: solid road behind, dashed road ahead */}
          <path
            className="cb-route"
            pathLength={1}
            d={arcPath(360, 360, 258, dayAngle(9), dayAngle(220))}
            fill="none" stroke={PINE} strokeOpacity="0.5" strokeWidth="2.4" strokeLinecap="round"
            style={{ animationDelay: "0.7s" }}
          />
          <path
            className="cb-future"
            d={arcPath(360, 360, 258, dayAngle(220), dayAngle(287))}
            fill="none" stroke={BRONZE} strokeOpacity="0.75" strokeWidth="2.4"
            strokeLinecap="round" strokeDasharray="2 9"
            style={{ animationDelay: "1.5s" }}
          />
        </svg>

        {/* waypoint markers (HTML for real text, counter-rotated upright) */}
        {WAYPOINTS.map((w, i) => {
          const a = (w.angle * Math.PI) / 180;
          const x = fx(50 + Math.cos(a) * RING * 100);
          const y = fx(50 + Math.sin(a) * RING * 100);
          const active = w.id === selectedId;
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => onSelect(w.id)}
              aria-pressed={active}
              aria-label={`${w.date} — ${w.title}`}
              className="cb-marker group absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                animationDelay: `${1.0 + i * 0.14}s`,
                zIndex: active ? 20 : 10,
                ["--tw-ring-color" as string]: BRONZE,
                ["--tw-ring-offset-color" as string]: CANVAS,
              }}
            >
              <span
                className="cb-counter relative flex items-center justify-center"
                style={{ transform: `rotate(${-rot}deg)` }}
              >
                <Glyph kind={w.kind} active={active} />
                {/* Only the waypoint under the needle is labelled — visits
                    days apart would otherwise stack their chips. */}
                <span
                  className={`pointer-events-none absolute top-full mt-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.16em] transition-opacity duration-300 sm:text-[9px] ${
                    active ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                  }`}
                  style={{
                    borderColor: active ? BRONZE : "rgba(23,63,50,0.18)",
                    background: "#fffdf8",
                    color: active ? BRONZE_TEXT : "rgba(23,63,50,0.75)",
                    boxShadow: active ? "0 6px 18px -8px rgba(23,63,50,0.4)" : "none",
                  }}
                >
                  {w.date}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* static overlay: house, needle, hearth */}
      <div className="pointer-events-none absolute inset-0">
        {/* index needle at 12 o'clock */}
        <svg viewBox="0 0 720 720" className="absolute inset-0 h-full w-full" aria-hidden>
          <path d="M360 78 L352 60 L368 60 Z" fill={BRONZE} />
          <line x1="360" y1="80" x2="360" y2="104" stroke={BRONZE} strokeWidth="1.6" strokeDasharray="2 4" />
        </svg>
        {/* the home, upright always */}
        <div
          className="cb-photo absolute left-1/2 top-1/2 aspect-square w-[41%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full"
          style={{
            boxShadow: "0 26px 70px -30px rgba(23,63,50,0.55), 0 0 0 1px rgba(23,63,50,0.16), 0 0 0 6px rgba(255,253,248,0.85), 0 0 0 7px rgba(201,163,92,0.55)",
            animationDelay: "0.45s",
          }}
        >
          <Image
            src="/atlas-glass/hero-house.jpg"
            alt="A cream craftsman home under oak trees — the home at the center of its atlas"
            fill
            priority
            sizes="(max-width: 1024px) 40vw, 260px"
            className="object-cover"
            style={{ objectPosition: "50% 38%" }}
            draggable={false}
          />
        </div>
        {/* hearth pulse under the photo */}
        <svg viewBox="0 0 720 720" className="absolute inset-0 h-full w-full" aria-hidden>
          <circle className="cb-hearth-ring" cx="360" cy="530" r="7" fill="none" stroke={GOLD} strokeWidth="2" />
          <circle cx="360" cy="530" r="4.5" fill={GOLD} />
        </svg>
      </div>
    </div>

      {/* nameplate + affordance — real DOM, clear of the rotating plate */}
      <p className="cb-rise mt-3 text-center font-serif text-base italic" style={{ color: "rgba(23,63,50,0.8)", animationDelay: "1.7s" }}>
        Oak Hollow Residence
        <span className="ml-2 font-mono text-[8.5px] not-italic uppercase tracking-[0.18em]" style={{ color: "rgba(23,63,50,0.45)" }}>
          Sample member home
        </span>
      </p>
      <p
        className="cb-rise mt-1.5 text-center font-mono text-[9px] uppercase tracking-[0.24em]"
        style={{ color: "rgba(23,63,50,0.5)", animationDelay: "1.9s" }}
      >
        {reduced ? "Select a visit to explore" : "Turn the dial — drag, tap, or arrow keys"}
      </p>
    </div>
  );
}

function Glyph({ kind, active }: { kind: WaypointKind; active: boolean }) {
  const size = active ? 30 : 24;
  if (kind === "past") {
    return (
      <svg width={size} height={size} viewBox="0 0 30 30" className="transition-all" aria-hidden>
        <circle cx="15" cy="15" r="12" fill={active ? PINE : "#fffdf8"} stroke={PINE} strokeWidth="1.6" />
        <path d="M10 15.5 L13.5 19 L20.5 11.5" fill="none" stroke={active ? "#c9b896" : BRONZE} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === "today") {
    return (
      <svg width={size} height={size} viewBox="0 0 30 30" className="transition-all" aria-hidden>
        <circle cx="15" cy="15" r="12" fill="#fffdf8" stroke={GOLD} strokeWidth="1.6" />
        <circle cx="15" cy="15" r="5.5" fill={GOLD} />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" className="transition-all" aria-hidden>
      <circle cx="15" cy="15" r="12" fill={active ? "#fffdf8" : "rgba(255,253,248,0.8)"} stroke={BRONZE} strokeWidth="1.8" strokeDasharray="3 3.5" />
      <path d="M11 15 H19 M16 11.5 L19.5 15 L16 18.5" fill="none" stroke={BRONZE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* SVG arc between two angles (degrees) on a circle. */
function arcPath(cx: number, cy: number, r: number, a1: number, a2: number) {
  const r1 = (a1 * Math.PI) / 180;
  const r2 = (a2 * Math.PI) / 180;
  const x1 = fx(cx + Math.cos(r1) * r);
  const y1 = fx(cy + Math.sin(r1) * r);
  const x2 = fx(cx + Math.cos(r2) * r);
  const y2 = fx(cy + Math.sin(r2) * r);
  const large = Math.abs(a2 - a1) > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

/* ————————————————— the field note ————————————————— */

function FieldNote({ wp }: { wp: Waypoint }) {
  return (
    <aside
      aria-live="polite"
      className="max-w-md rounded-[1.2rem] border p-5 sm:p-6"
      style={{
        borderColor: "rgba(23,63,50,0.14)",
        background: "rgba(255,253,248,0.85)",
        boxShadow: "0 22px 60px -40px rgba(23,63,50,0.4)",
      }}
    >
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-serif text-2xl" style={{ color: PINE }}>
          {wp.date}
          <span className="ml-3 text-base italic" style={{ color: BRONZE_TEXT }}>
            {wp.title}
          </span>
        </p>
      </div>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: SAGE }}>
        {wp.body}
      </p>
      {wp.photos ? (
        <div className="mt-4 flex gap-2.5">
          {wp.photos.map((p) => (
            <figure key={p.label} className="relative m-0 h-20 flex-1 overflow-hidden rounded-lg border" style={{ borderColor: "rgba(23,63,50,0.12)" }}>
              <Image
                src={p.src}
                alt={p.label}
                fill
                sizes="180px"
                className="object-cover"
                style={{ objectPosition: p.pos }}
              />
              <figcaption
                className="absolute bottom-1 left-1 rounded-full px-2 py-0.5 font-mono text-[7.5px] uppercase tracking-[0.12em]"
                style={{ background: "rgba(255,253,248,0.88)", color: PINE }}
              >
                {p.label}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}
      <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3" style={{ borderColor: "rgba(23,63,50,0.1)" }}>
        <p className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: BRONZE_TEXT }}>
          {wp.meta}
        </p>
        {wp.kind === "next" ? (
          <Link href="/request" className="whitespace-nowrap text-xs font-medium underline-offset-4 hover:underline" style={{ color: PINE }}>
            Get this for your home →
          </Link>
        ) : null}
      </div>
    </aside>
  );
}

function LegendItem({
  symbol,
  title,
  copy,
  delay,
}: {
  symbol: React.ReactNode;
  title: string;
  copy: string;
  delay: number;
}) {
  return (
    <div className="cb-ink" style={{ transitionDelay: `${delay}s` }}>
      {symbol}
      <h3 className="mt-4 font-serif text-xl" style={{ color: PINE }}>
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: SAGE }}>
        {copy}
      </p>
    </div>
  );
}
