"use client";

import Image from "next/image";
import {
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";

const STATIC_MEDIA_QUERY =
  "(prefers-reduced-motion: reduce), (max-width: 47.99rem)";

interface DataConnection {
  saveData?: boolean;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
}
interface NavigatorWithConnection extends Navigator {
  connection?: DataConnection;
}

function getConnection(): DataConnection | undefined {
  return (navigator as NavigatorWithConnection).connection;
}

function subscribeToMediaPreference(onStoreChange: () => void) {
  const query = window.matchMedia(STATIC_MEDIA_QUERY);
  const connection = getConnection();

  query.addEventListener("change", onStoreChange);
  connection?.addEventListener?.("change", onStoreChange);

  return () => {
    query.removeEventListener("change", onStoreChange);
    connection?.removeEventListener?.("change", onStoreChange);
  };
}

function getMediaPreferenceSnapshot() {
  return window.matchMedia(STATIC_MEDIA_QUERY).matches || Boolean(getConnection()?.saveData);
}

function getServerMediaPreferenceSnapshot() {
  return true;
}

const SERVICES = [
  {
    id: "window",
    number: "01",
    title: "Window Cleaning",
    indexLabel: "Glass",
    description:
      "Residential glass care, scoped around the home and confirmed in your plan.",
    video: "/day/hour-window.mp4",
    poster: "/day/hour-window.jpg",
  },
  {
    id: "pressure",
    number: "02",
    title: "Pressure Washing",
    indexLabel: "Exterior surfaces",
    description:
      "Exterior surface care for the areas confirmed in your Home Care Plan.",
    video: "/day/hour-pressure.mp4",
    poster: "/day/hour-pressure.jpg",
  },
  {
    id: "solar",
    number: "03",
    title: "Solar Panel Cleaning",
    indexLabel: "Panels",
    description:
      "Panel cleaning scoped to the property, access conditions, and approved plan.",
    video: "/day/hour-solar.mp4",
    poster: "/day/hour-solar.jpg",
  },
  {
    id: "recurring",
    number: "04",
    title: "Recurring Care",
    indexLabel: "Care rhythm",
    description:
      "A planned rhythm every 3 or 6 months, with exact services defined by your plan.",
    video: "/day/hour-dusk.mp4",
    poster: "/day/hour-dusk.jpg",
  },
] as const;

export function Home2ServiceIndex() {
  const [activeIndex, setActiveIndex] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const usePoster = useSyncExternalStore(
    subscribeToMediaPreference,
    getMediaPreferenceSnapshot,
    getServerMediaPreferenceSnapshot,
  );
  const active = SERVICES[activeIndex];

  const selectAndFocus = (index: number) => {
    const nextIndex = (index + SERVICES.length) % SERVICES.length;
    setActiveIndex(nextIndex);
    tabRefs.current[nextIndex]?.focus();
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      selectAndFocus(index + 1);
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      selectAndFocus(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      selectAndFocus(0);
    } else if (event.key === "End") {
      event.preventDefault();
      selectAndFocus(SERVICES.length - 1);
    }
  };

  return (
    <section
      aria-labelledby="service-index-heading"
      className="border-y border-[var(--editorial-rule)] bg-[var(--editorial-paper)]"
    >
      <div className="mx-auto w-full max-w-[90rem] px-5 py-24 sm:px-8 sm:py-28 lg:px-10 lg:py-36">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-x-8 xl:gap-x-10">
          <div className="lg:col-span-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--editorial-accent)] sm:text-[11px]">
              <span aria-hidden>02</span>
              <span aria-hidden className="mx-3">/</span>
              Service index
            </p>
          </div>
          <div className="lg:col-span-9">
            <h2
              id="service-index-heading"
              className="max-w-4xl font-serif text-[clamp(3.25rem,7.5vw,7.5rem)] font-light leading-[0.86] tracking-[-0.04em]"
            >
              Four forms of care.
              <span className="block italic text-[var(--editorial-accent)]">
                One attentive approach.
              </span>
            </h2>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-x-8 xl:gap-x-10">
          <div
            role="tablist"
            aria-label="Choose a SqueegeeKing service"
            aria-orientation="vertical"
            className="border-t border-[var(--editorial-rule)] lg:col-span-4"
          >
            {SERVICES.map((service, index) => {
              const selected = index === activeIndex;
              return (
                <button
                  key={service.id}
                  ref={(element) => {
                    tabRefs.current[index] = element;
                  }}
                  id={`service-tab-${service.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls="service-media-panel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActiveIndex(index)}
                  onKeyDown={(event) => handleKeyDown(event, index)}
                  className={`grid min-h-[76px] w-full grid-cols-[2.5rem_1fr_auto] items-center gap-3 border-b border-[var(--editorial-rule)] px-0 py-4 text-left outline-none transition-[background-color,padding] duration-200 focus-visible:bg-[var(--editorial-sage)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--editorial-accent)] motion-reduce:transition-none ${
                    selected
                      ? "bg-[var(--editorial-sage)] px-3"
                      : "hover:bg-[var(--editorial-canvas)] hover:px-3"
                  }`}
                >
                  <span className="font-mono text-[10px] tracking-[0.18em] text-[var(--editorial-accent)]">
                    {service.number}
                  </span>
                  <span className="font-serif text-xl font-light sm:text-2xl">
                    {service.title}
                  </span>
                  <span className="hidden font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--editorial-muted)] sm:block">
                    {service.indexLabel}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-8">
            <div
              id="service-media-panel"
              role="tabpanel"
              aria-labelledby={`service-tab-${active.id}`}
              tabIndex={0}
              className="outline-none focus-visible:ring-2 focus-visible:ring-[var(--editorial-accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--editorial-paper)]"
            >
              <div className="relative aspect-[4/5] overflow-hidden border border-[var(--editorial-rule)] bg-[var(--editorial-sage)] sm:aspect-[16/10]">
                {usePoster ? (
                  <Image
                    key={active.poster}
                    src={active.poster}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 66vw, 100vw"
                    className="object-cover"
                  />
                ) : (
                  <video
                    key={active.video}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    poster={active.poster}
                    aria-hidden
                    className="h-full w-full object-cover"
                  >
                    <source src={active.video} type="video/mp4" />
                  </video>
                )}
                <div className="absolute bottom-0 left-0 border-r border-t border-white/70 bg-[var(--editorial-paper)]/92 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--editorial-ink)] backdrop-blur-sm">
                  Service plate / {active.number}
                </div>
              </div>

              <div className="grid gap-5 border-b border-[var(--editorial-rule)] py-5 sm:grid-cols-[1fr_1.35fr]">
                <p className="font-serif text-2xl font-light">{active.title}</p>
                <p className="max-w-xl text-sm leading-relaxed text-[var(--editorial-muted)]">
                  {active.description}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
