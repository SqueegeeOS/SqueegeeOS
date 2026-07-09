import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How /day was made · SqueegeeKing",
  description:
    "The method behind the SqueegeeKing daylight page: a scroll-driven sun, five generated films, and zero animation libraries.",
};

const PAPER = "#f7f6f1";
const INK = "#1c2430";
const COBALT = "#2b59c3";
const SLATE = "#6a7280";

function Block({
  k,
  title,
  children,
}: {
  k: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="grid gap-4 border-t py-12 sm:grid-cols-[11rem_1fr] sm:gap-10"
      style={{ borderColor: "rgba(28,36,48,0.12)" }}
    >
      <p
        className="font-mono text-xs uppercase tracking-[0.25em]"
        style={{ color: COBALT }}
      >
        {k}
      </p>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight" style={{ color: INK }}>
          {title}
        </h2>
        <div
          className="mt-4 space-y-4 text-[15px] leading-relaxed"
          style={{ color: SLATE }}
        >
          {children}
        </div>
      </div>
    </section>
  );
}

export default function DayGuidePage() {
  return (
    <main className="min-h-dvh" style={{ background: PAPER }}>
      <div className="mx-auto max-w-4xl px-6 pb-28 pt-20 sm:px-10">
        <Link
          href="/day"
          className="day-link font-mono text-xs uppercase tracking-[0.2em]"
          style={{ color: COBALT }}
        >
          Back to the day
        </Link>

        <h1
          className="mt-10 text-5xl font-semibold leading-none tracking-tight sm:text-6xl"
          style={{ color: INK }}
        >
          How this page was made.
        </h1>
        <p
          className="mt-6 max-w-xl text-base leading-relaxed"
          style={{ color: SLATE }}
        >
          The page is a day. Scrolling moves the sun from 06:00 to 19:00, and
          the work of SqueegeeKing plays out hour by hour in generated film.
        </p>

        <div className="mt-16">
          <Block k="01 · engine" title="Scroll is a sundial">
            <p>
              One requestAnimationFrame loop reads scroll progress and drives
              four things: a sky layer interpolated between dawn, noon and
              dusk color keyframes; a sun disc traveling a sine arc across the
              viewport; a live clock chip with a phase word; and a single CSS
              variable for shadow direction, so every card&apos;s shadow
              swings from west to east as the day passes. No animation
              libraries, native scroll, reduced motion gets a still page.
            </p>
          </Block>

          <Block k="02 · films" title="Five films from five stills">
            <p>
              Every moving image began as a Nano Banana still in one locked
              palette (cream, cobalt, morning gold), then became a five second
              Seedance clip with a fixed camera and one honest motion: sun
              sweeping the farmhouse, a squeegee stripe at 07:12, a rainbow in
              the pressure mist at 11:30, water draining off solar panels at
              16:45, and the porch lamp taking over at 19:04. The solar shot
              was re-edited by prompt to swap a hose for the water-fed carbon
              pole we actually use. Films below the fold load nothing until
              they scroll near, and pause when they leave.
            </p>
          </Block>

          <Block k="03 · honesty" title="What it cost, what it is">
            <p>
              About 160 Higgsfield credits of generated imagery, one Next.js
              route in the real SqueegeeKing codebase, and no invented
              statistics anywhere. The quote is a composite, the hours are a
              storyboard, and the services are exactly the four we sell:
              window cleaning, pressure washing, solar panel cleaning, and
              maintenance plans, remembered by HomeAtlas.
            </p>
          </Block>
        </div>

        <footer
          className="border-t pt-10"
          style={{ borderColor: "rgba(28,36,48,0.12)" }}
        >
          <p className="font-mono text-xs tracking-[0.14em]" style={{ color: SLATE }}>
            SqueegeeKing · powered by HomeAtlas
          </p>
        </footer>
      </div>
    </main>
  );
}
