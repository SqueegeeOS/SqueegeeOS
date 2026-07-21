import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Home2ReviewsWall } from "@/components/marketing/home2-reviews-wall";
import { Home2ServiceIndex } from "@/components/marketing/home2-service-index";
import { CUSTOMER_BRAND } from "@/lib/brand/customer";
import { PLATFORM_BRAND } from "@/lib/brand/platform";
import utilityRailStyles from "./home2-utility-rail.module.css";

const REQUEST_CTA = "Request your Home Care Plan";

const UTILITY_ITEMS = [
  "Window cleaning",
  "Pressure washing",
  "Solar panel cleaning",
  "Every 3 months",
  "Every 6 months",
  CUSTOMER_BRAND.location,
] as const;

const EDITORIAL_COLORS = {
  "--editorial-canvas": "#f4efe5",
  "--editorial-paper": "#fffaf0",
  "--editorial-ink": "#173f32",
  "--editorial-muted": "#465d53",
  "--editorial-accent": "#804825",
  "--editorial-peach": "#e7c9ad",
  "--editorial-sage": "#dce5d5",
  "--editorial-rule": "rgba(23, 63, 50, 0.2)",
} as CSSProperties;

function ChapterLabel({ number, children }: { number: string; children: ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--editorial-accent)] sm:text-[11px]">
      <span aria-hidden>{number}</span>
      <span aria-hidden className="mx-3">/</span>
      {children}
    </p>
  );
}
function RequestCta() {
  return (
    <Link
      href="/request"
      className="group inline-flex min-h-[52px] items-center justify-center gap-5 border border-[var(--editorial-ink)] bg-[var(--editorial-ink)] px-6 py-3.5 text-sm font-medium tracking-[0.04em] text-[var(--editorial-paper)] outline-none transition-[background-color,color] duration-200 hover:bg-transparent hover:text-[var(--editorial-ink)] focus-visible:ring-2 focus-visible:ring-[var(--editorial-accent)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--editorial-canvas)] motion-reduce:transition-none sm:px-8"
    >
      <span>{REQUEST_CTA}</span>
      <span
        aria-hidden
        className="font-mono text-base transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none"
      >
        →
      </span>
    </Link>
  );
}

function UtilityRailItems() {
  return UTILITY_ITEMS.map((item, index) => (
    <li
      key={item}
      className={`shrink-0 py-3 font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--editorial-muted)] sm:text-[10px] ${
        index === 0
          ? "pr-5"
          : "border-l border-[var(--editorial-rule)] px-5"
      }`}
    >
      {item}
    </li>
  ));
}

function UtilityRail() {
  return (
    <div className="border-b border-[var(--editorial-rule)]">
      <div
        role="region"
        aria-label="SqueegeeKing services and membership rhythms"
        tabIndex={0}
        className={`${utilityRailStyles.viewport} mx-auto w-full max-w-[90rem] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--editorial-accent)]`}
      >
        <div className={utilityRailStyles.track}>
          <ul
            aria-label="SqueegeeKing services, care rhythms, and location"
            className={`${utilityRailStyles.sequence} px-5 sm:px-8 lg:px-10`}
          >
            <UtilityRailItems />
          </ul>
          <ul
            aria-hidden="true"
            className={`${utilityRailStyles.sequence} ${utilityRailStyles.clone} px-5 sm:px-8 lg:px-10`}
          >
            <UtilityRailItems />
          </ul>
        </div>
      </div>
    </div>
  );
}

function HowMembershipWorks() {
  const steps = ["Property assessment", "Home Care Plan", "Review and enroll"];

  return (
    <section
      aria-labelledby="membership-process-heading"
      className="border-b border-[var(--editorial-rule)] bg-[var(--editorial-paper)]"
    >
      <h2 id="membership-process-heading" className="sr-only">
        How SqueegeeKing membership begins
      </h2>
      <div className="mx-auto grid w-full max-w-[90rem] grid-cols-1 gap-6 px-5 py-7 sm:px-8 lg:grid-cols-12 lg:items-center lg:gap-x-8 lg:px-10 xl:gap-x-10">
        <ol className="grid gap-0 border-y border-[var(--editorial-rule)] sm:grid-cols-3 lg:col-span-8 lg:border-y-0">
          {steps.map((step, index) => (
            <li
              key={step}
              className={`flex min-h-[52px] items-center justify-between gap-3 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--editorial-ink)] sm:px-4 ${
                index > 0
                  ? "border-t border-[var(--editorial-rule)] sm:border-l sm:border-t-0"
                  : "sm:pl-0"
              }`}
            >
              <span>{step}</span>
              {index < steps.length - 1 && (
                <span aria-hidden className="text-[var(--editorial-accent)]">
                  →
                </span>
              )}
            </li>
          ))}
        </ol>
        <p className="text-sm leading-relaxed text-[var(--editorial-muted)] lg:col-span-4">
          Assessment first. Home Care Plan second. Membership only after you
          review it.
        </p>
      </div>
    </section>
  );
}

export function Home2Homepage() {
  return (
    <main
      className="overflow-x-clip bg-[var(--editorial-canvas)] text-[var(--editorial-ink)]"
      style={EDITORIAL_COLORS}
    >
      <section
        aria-labelledby="editorial-hero-heading"
        className="min-h-[calc(100svh-var(--site-nav-height))] pt-[var(--site-nav-height)]"
      >
        <UtilityRail />

        <div className="mx-auto grid w-full max-w-[90rem] grid-cols-1 gap-10 px-5 py-10 sm:px-8 sm:py-14 lg:grid-cols-12 lg:gap-x-8 lg:px-10 lg:py-16 xl:gap-x-10">
          <div className="flex flex-col lg:col-span-7 lg:min-h-[36rem]">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--editorial-accent)] sm:text-[11px]">
                {CUSTOMER_BRAND.name} Home Care Membership · {CUSTOMER_BRAND.location}
              </p>
              <h1
                id="editorial-hero-heading"
                className="mt-8 max-w-[9ch] font-serif text-[clamp(4.35rem,11vw,10.5rem)] font-light leading-[0.76] tracking-[-0.055em] sm:mt-10"
              >
                Home care,
                <span className="block italic text-[var(--editorial-accent)]">
                  put on a plan.
                </span>
              </h1>
            </div>

            <div className="mt-12 grid gap-8 border-t border-[var(--editorial-rule)] pt-6 sm:grid-cols-2 lg:mt-16">
              <p className="max-w-sm text-lg leading-relaxed text-[var(--editorial-ink)] sm:text-xl">
                Choose exterior window care every 3 months or every 6 months,
                built around your property.
              </p>
              <div className="sm:justify-self-end lg:justify-self-start">
                <RequestCta />
                <p className="mt-4 max-w-xs text-xs leading-relaxed text-[var(--editorial-muted)]">
                  A request starts a conversation. Your services, cadence, and
                  price are confirmed in your plan.
                </p>
              </div>
            </div>
          </div>

          <figure className="lg:col-span-5 lg:self-end">
            <div className="relative aspect-[16/11] overflow-hidden border border-[var(--editorial-rule)] bg-[var(--editorial-sage)] lg:aspect-[4/5]">
              <Image
                src="/day/morning.jpg"
                alt="A light-colored home and garden in warm morning light"
                fill
                sizes="(min-width: 1024px) 40vw, 100vw"
                preload
                className="object-cover object-center"
              />
              <span className="absolute left-0 top-0 border-b border-r border-white/70 bg-[var(--editorial-paper)]/90 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--editorial-ink)] backdrop-blur-sm">
                Residential care / plate 01
              </span>
            </div>
            <figcaption className="grid grid-cols-2 gap-5 border-b border-[var(--editorial-rule)] py-4 text-xs leading-relaxed text-[var(--editorial-muted)]">
              <span>The right way.</span>
              <span>
                Scope is confirmed property by property in the Home Care Plan.
              </span>
            </figcaption>
          </figure>
        </div>
      </section>

      <HowMembershipWorks />

      <section
        aria-labelledby="membership-rhythm-heading"
        className="border-y border-[var(--editorial-rule)] bg-[var(--editorial-peach)]"
      >
        <div className="mx-auto w-full max-w-[90rem] px-5 py-24 sm:px-8 sm:py-28 lg:px-10 lg:py-36">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-x-8 xl:gap-x-10">
            <div className="lg:col-span-3">
              <ChapterLabel number="01">Membership-first home care</ChapterLabel>
              <p className="mt-5 max-w-[15rem] text-xs leading-relaxed text-[var(--editorial-muted)]">
                A personalized plan
                <br />
                A recurring rhythm
                <br />
                A clear starting point next season
              </p>
            </div>
            <div className="lg:col-span-9">
              <h2
                id="membership-rhythm-heading"
                className="max-w-5xl font-serif text-[clamp(3.6rem,8.5vw,8.75rem)] font-light leading-[0.82] tracking-[-0.045em]"
              >
                Choose your care rhythm.
              </h2>
              <div className="mt-10 grid gap-8 border-t border-[var(--editorial-rule)] pt-7 lg:grid-cols-2">
                <p className="max-w-xl text-lg leading-relaxed text-[var(--editorial-ink)] sm:text-xl">
                  A different way to care for your home: SqueegeeKing
                  membership builds exterior window care around a recurring
                  rhythm and a personalized Home Care Plan.
                </p>
                <div>
                  <p className="max-w-xl text-sm leading-relaxed text-[var(--editorial-muted)] sm:text-base">
                    The plan gives each season a clear starting point: the home,
                    selected services, and care cadence are already in context
                    rather than beginning the planning conversation from zero
                    each season.
                  </p>
                  <div className="mt-7">
                    <RequestCta />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-16 grid border-t border-[var(--editorial-rule)] lg:grid-cols-2">
            <article className="border-b border-[var(--editorial-rule)] py-9 lg:border-r lg:pr-10">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--editorial-accent)]">
                Rhythm 01
              </p>
              <h3 className="mt-6 font-serif text-[clamp(3.75rem,7.5vw,7.75rem)] font-light leading-[0.76] tracking-[-0.045em]">
                Every 3
                <span className="block italic text-[var(--editorial-accent)]">
                  Months
                </span>
              </h3>
              <p className="mt-8 max-w-md text-base leading-relaxed text-[var(--editorial-muted)]">
                The more frequent recurring rhythm, when that cadence fits the
                property and the approved plan.
              </p>
            </article>

            <article className="border-b border-[var(--editorial-rule)] py-9 lg:pl-10">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--editorial-accent)]">
                Rhythm 02
              </p>
              <h3 className="mt-6 font-serif text-[clamp(3.75rem,7.5vw,7.75rem)] font-light leading-[0.76] tracking-[-0.045em]">
                Every 6
                <span className="block italic text-[var(--editorial-accent)]">
                  Months
                </span>
              </h3>
              <p className="mt-8 max-w-md text-base leading-relaxed text-[var(--editorial-muted)]">
                The lighter recurring rhythm, when that cadence fits the
                property and the approved plan.
              </p>
            </article>
          </div>

          <p className="mt-8 max-w-3xl text-sm leading-relaxed text-[var(--editorial-muted)]">
            Your Home Care Plan presents the services, benefits, cadence, and
            visit price; your signed agreement confirms them. Included services
            and benefits vary by plan.
          </p>
        </div>
      </section>

      <Home2ServiceIndex />
      <Home2ReviewsWall />

      <section
        aria-labelledby="homeatlas-heading"
        className="border-b border-[var(--editorial-rule)] bg-[var(--editorial-sage)]"
      >
        <div className="mx-auto grid w-full max-w-[90rem] grid-cols-1 gap-8 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-12 lg:gap-x-8 lg:px-10 xl:gap-x-10">
          <div className="lg:col-span-3">
            <ChapterLabel number="03">HomeAtlas support</ChapterLabel>
          </div>

          <div className="lg:col-span-9">
            <h2
              id="homeatlas-heading"
              className="max-w-4xl font-serif text-[clamp(2.6rem,5.5vw,5.5rem)] font-light leading-[0.92] tracking-[-0.035em]"
            >
              HomeAtlas supports the member experience behind the scenes.
            </h2>
            <p className="mt-7 max-w-2xl border-t border-[var(--editorial-rule)] pt-5 text-sm leading-relaxed text-[var(--editorial-muted)] sm:text-base">
              It is the system behind SqueegeeKing&apos;s private member
              experience. Your Home Care Plan presents the services, benefits,
              cadence, and visit price; your signed agreement confirms them.
            </p>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="editorial-close-heading"
        className="border-b border-[var(--editorial-rule)] bg-[var(--editorial-peach)]"
      >
        <div className="mx-auto grid w-full max-w-[90rem] grid-cols-1 gap-12 px-5 py-24 sm:px-8 sm:py-28 lg:grid-cols-12 lg:items-end lg:gap-x-8 lg:px-10 lg:py-36 xl:gap-x-10">
          <div className="lg:col-span-8">
            <ChapterLabel number="04">Begin with the home</ChapterLabel>
            <h2
              id="editorial-close-heading"
              className="mt-8 max-w-5xl font-serif text-[clamp(3.5rem,8vw,8.5rem)] font-light leading-[0.82] tracking-[-0.045em]"
            >
              A considered plan starts with a conversation.
            </h2>
          </div>
          <div className="border-t border-[var(--editorial-rule)] pt-7 lg:col-span-4">
            <RequestCta />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-[var(--editorial-muted)]">
              A request starts a conversation. Your services, cadence, and
              price are confirmed in your plan.
            </p>
          </div>
        </div>
      </section>

      <footer className="bg-[var(--editorial-canvas)]">
        <div className="mx-auto grid w-full max-w-[90rem] gap-8 px-5 py-10 sm:px-8 md:grid-cols-2 lg:px-10">
          <p className="font-serif text-xl font-light tracking-[0.08em]">
            {CUSTOMER_BRAND.name}
          </p>
          <div className="space-y-2 text-xs leading-relaxed text-[var(--editorial-muted)] md:text-right">
            <p>
              {CUSTOMER_BRAND.tagline} / {CUSTOMER_BRAND.location}
            </p>
            <p>{PLATFORM_BRAND.poweredByLabel}</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
