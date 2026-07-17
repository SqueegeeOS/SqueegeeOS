"use client";

import { useEffect, useRef, useState } from "react";

const INK = "#07080c";
const GOLD = "#d4b98c";
const IVORY = "#f2efe7";
const MIST = "#8f9ab0";

/* ---- #3 Before / After: drag the blade ---------------------------- */
/* Swap images by replacing /rightway/before.jpg + /rightway/after.jpg  */
/* (currently stand-ins: the aligned night pair).                       */

export function BeforeAfter({
  before = "/night/house-dark.jpg",
  after = "/night/house-lit.jpg",
}: {
  before?: string;
  after?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0.5);
  const [ok, setOk] = useState(true);

  const move = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setP(Math.min(0.98, Math.max(0.02, (clientX - r.left) / r.width)));
  };

  if (!ok) return null;

  return (
    <section className="px-5 py-28 sm:px-12 sm:py-36" aria-label="Before and after">
      <h2 className="max-w-3xl font-serif text-5xl font-light leading-[0.95] sm:text-7xl" style={{ color: IVORY }}>
        Drag the blade.
        <br />
        <em className="night-shimmer-text">See the difference.</em>
      </h2>
      <div
        ref={ref}
        className="relative mt-14 aspect-[21/10] w-full cursor-ew-resize touch-none select-none overflow-hidden rounded-[1.5rem] border"
        style={{ borderColor: "rgba(242,239,231,0.12)" }}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          move(e.clientX);
        }}
        onPointerMove={(e) => e.buttons > 0 && move(e.clientX)}
        role="slider"
        aria-label="Before and after comparison"
        aria-valuenow={Math.round(p * 100)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setP((v) => Math.max(0.02, v - 0.05));
          if (e.key === "ArrowRight") setP((v) => Math.min(0.98, v + 0.05));
        }}
      >
        <img src={before} alt="Before our visit" className="absolute inset-0 h-full w-full object-cover" draggable={false} onError={() => setOk(false)} />
        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - p * 100}% 0 0)` }}>
          <img src={after} alt="After our visit" className="h-full w-full object-cover" draggable={false} />
        </div>
        {/* the blade */}
        <div aria-hidden className="absolute bottom-0 top-0 w-[3px]" style={{ left: `${p * 100}%`, background: GOLD, boxShadow: "0 0 18px rgba(212,185,140,0.7)" }}>
          <div className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full font-mono text-[10px]" style={{ background: GOLD, color: INK }}>
            ⇔
          </div>
        </div>
        <span aria-hidden className="absolute left-4 top-4 font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: `${IVORY}b3` }}>Before</span>
        <span aria-hidden className="absolute right-4 top-4 font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: GOLD }}>After</span>
      </div>
    </section>
  );
}

/* ---- #4 Living testimonial wall (real Google reviews only) -------- */

interface ReviewItem { author: string; rating: number; text: string; when: string }

export function ReviewsWall() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [meta, setMeta] = useState<{ rating?: number; count?: number }>({});

  useEffect(() => {
    fetch("/api/reviews/google")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const d = data?.data ?? data ?? {};
        const raw = d.reviews ?? d.result?.reviews ?? [];
        const mapped: ReviewItem[] = raw
          .filter((r: { rating?: number }) => (r.rating ?? 0) >= 4)
          .slice(0, 8)
          .map((r: { author_name?: string; authorName?: string; rating?: number; text?: string; relative_time_description?: string; relativeTime?: string }) => ({
            author: r.author_name ?? r.authorName ?? "A neighbor",
            rating: r.rating ?? 5,
            text: (r.text ?? "").slice(0, 220),
            when: r.relative_time_description ?? r.relativeTime ?? "",
          }))
          .filter((r: ReviewItem) => r.text.length > 0);
        setItems(mapped);
        setMeta({ rating: d.rating ?? d.result?.rating, count: d.userRatingCount ?? d.user_ratings_total ?? d.result?.user_ratings_total });
      })
      .catch(() => undefined);
  }, []);

  if (items.length === 0) return null; // never fake it

  return (
    <section className="overflow-hidden border-y py-24 sm:py-28" style={{ borderColor: "rgba(242,239,231,0.1)" }} aria-label="Reviews">
      <div className="px-5 sm:px-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: GOLD }}>
          {meta.rating ? `★ ${meta.rating.toFixed(1)} on Google` : "On Google"}
          {meta.count ? ` · ${meta.count} reviews` : ""}
        </p>
        <h2 className="mt-5 font-serif text-4xl font-light sm:text-6xl" style={{ color: IVORY }}>
          The neighbors talk.
        </h2>
      </div>
      <div className="night-marquee-slow mt-12 flex w-max gap-6 whitespace-normal">
        {[...items, ...items].map((r, i) => (
          <figure key={i} className="w-80 flex-none rounded-[1.25rem] border p-6" style={{ borderColor: "rgba(242,239,231,0.1)", background: "#0d0f16" }}>
            <p className="font-mono text-xs tracking-[0.2em]" style={{ color: GOLD }}>{"★".repeat(Math.round(r.rating))}</p>
            <blockquote className="mt-3 text-sm leading-relaxed" style={{ color: `${IVORY}d9` }}>&ldquo;{r.text}&rdquo;</blockquote>
            <figcaption className="mt-4 text-xs" style={{ color: MIST }}>{r.author}{r.when ? ` · ${r.when}` : ""}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/* ---- #5 Sound: unmute the films' own generated audio -------------- */

export function SoundToggle() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    document.querySelectorAll("video").forEach((v) => {
      v.muted = !on;
      if (on && v.paused && v.closest("section")) void v.play().catch(() => {});
    });
  }, [on]);
  return (
    <button
      type="button"
      onClick={() => setOn(!on)}
      aria-pressed={on}
      aria-label={on ? "Mute the films" : "Hear the films"}
      className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full border backdrop-blur-sm transition-colors"
      style={{ borderColor: on ? GOLD : "rgba(242,239,231,0.2)", background: "rgba(7,8,12,0.7)", color: on ? GOLD : MIST }}
    >
      {on ? "♪" : "∅"}
    </button>
  );
}
