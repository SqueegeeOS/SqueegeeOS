"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Day2ReviewsWall } from "@/components/marketing/day2-reviews-wall";
import { AtlasMark } from "@/components/theme/atlas-mark";
import { CUSTOMER_CONTACT } from "@/lib/brand/customer";
import { SQUEEGEEKING_FOUNDERS } from "@/lib/team/founders";
import heroHouse from "@/public/atlas-glass/hero-house-wide.png";
import styles from "./atlas-glass.module.css";

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

const MEMORIES = [
  {
    id: "next-visit",
    number: "01",
    eyebrow: "Next Visit",
    title: "October 14",
    metric: "8-11 AM",
    body: "Exterior window detail and solar rinse, already organized around your home.",
    footer: "Morning arrival",
  },
  {
    id: "photo-proof",
    number: "02",
    eyebrow: "Photo Proof",
    title: "42 photos",
    metric: "Jul 18",
    body: "A visual record after every visit, so the work never disappears when the crew leaves.",
    footer: "Latest visit story",
  },
  {
    id: "service-history",
    number: "03",
    eyebrow: "Service History",
    title: "Three seasons",
    metric: "3 visits",
    body: "Dates, services, notes, and recommendations remain attached to the property itself.",
    footer: "Every promise on record",
  },
  {
    id: "care-plan",
    number: "04",
    eyebrow: "Home Care Plan",
    title: "Windows + Solar",
    metric: "All year",
    body: "A living plan that keeps the next service visible instead of waiting for the home to look overdue.",
    footer: "Built around your property",
  },
] as const;

const CARE_OPTIONS = [
  {
    number: "01",
    title: "Window cleaning",
    detail: "Exterior, interior, and screens arranged around the way you live.",
    cadence: "One-time or planned",
    href: "/services/window-cleaning",
    image: "/day/hour-window.jpg",
  },
  {
    number: "02",
    title: "Pressure washing",
    detail: "A careful reset for concrete, siding, patios, and outdoor spaces.",
    cadence: "Seasonal care",
    href: "/services/pressure-washing",
    image: "/day/hour-pressure.jpg",
  },
  {
    number: "03",
    title: "Solar panel cleaning",
    detail: "Documented panel care that keeps buildup from becoming the baseline.",
    cadence: "Performance care",
    href: "/services/solar-panel-cleaning",
    image: "/day/hour-solar.jpg",
  },
  {
    number: "04",
    title: "Home care memberships",
    detail: "Quarterly or bi-annual care, with a custom 3x/year option when it fits.",
    cadence: "Your home, on rhythm",
    href: "/services/home-care-memberships",
    image: "/day/hour-dusk.jpg",
  },
] as const;

const MEMBER_ORBIT_FEATURES = [
  "RainBlock treatment",
  "Priority scheduling",
  "7-day guarantee",
  "Member pricing",
  "Property history",
  "Simple billing",
] as const;

const HOMEOWNER_QUESTIONS = [
  {
    question: "Do you offer one-time window cleaning?",
    answer:
      "Yes. You can start with one visit. If recurring care would genuinely help, we can build a quarterly or bi-annual rhythm around the property, with a custom three-times-yearly option when it fits.",
  },
  {
    question: "Can I choose exterior, interior, and screens separately?",
    answer:
      "Absolutely. Your plan can be exterior-only, include screens every visit, add interior cleaning once a year, or use another combination that fits the home. The scope stays visible before you approve it.",
  },
  {
    question: "What is HomeAtlas?",
    answer:
      "HomeAtlas is the member portal attached to your home. It keeps your next visit, care plan, property notes, visit history, and available proof in one dependable place.",
  },
  {
    question: "Where does SqueegeeKing work?",
    answer:
      "We are based in Chico, California. Send us the property address and the services you need, and we will confirm availability in your area before building the plan.",
  },
] as const;

export function AtlasGlass() {
  const [activeIndex, setActiveIndex] = useState(0);
  const userSelectedRef = useRef(false);
  const heroRef = useRef<HTMLElement>(null);
  const activeMemory = MEMORIES[activeIndex];
  const reducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getServerReducedMotionSnapshot,
  );

  useEffect(() => {
    if (reducedMotion) return;
    const timer = window.setInterval(() => {
      if (!userSelectedRef.current && !document.hidden) {
        setActiveIndex((current) => (current + 1) % MEMORIES.length);
      }
    }, 3600);
    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  const selectMemory = (index: number) => {
    userSelectedRef.current = true;
    setActiveIndex(index);
  };

  const moveLight = (event: React.PointerEvent<HTMLElement>) => {
    const hero = heroRef.current;
    if (!hero) return;
    const bounds = hero.getBoundingClientRect();
    hero.style.setProperty("--pointer-x", (((event.clientX - bounds.left) / bounds.width - 0.5) * 2).toFixed(3));
    hero.style.setProperty("--pointer-y", (((event.clientY - bounds.top) / bounds.height - 0.5) * 2).toFixed(3));
  };

  const resetLight = () => {
    heroRef.current?.style.setProperty("--pointer-x", "0");
    heroRef.current?.style.setProperty("--pointer-y", "0");
  };

  return (
    <main className={styles.page}>
      <section
        ref={heroRef}
        className={styles.hero}
        onPointerMove={moveLight}
        onPointerLeave={resetLight}
        aria-labelledby="atlas-hero-title"
      >
        <Image
          src={heroHouse}
          alt="A cared-for Chico home in warm evening light"
          fill
          preload
          placeholder="blur"
          quality={90}
          sizes="100vw"
          className={styles.heroImage}
          draggable={false}
        />
        <div className={styles.heroShade} aria-hidden="true" />
        <div className={styles.sunField} aria-hidden="true" />
        <div className={styles.lightSweep} aria-hidden="true" />
        <div className={styles.glassEdge} aria-hidden="true" />

        <header className={styles.header}>
          <Link href="/" className={styles.brand} aria-label="SqueegeeKing home">
            <AtlasMark size={38} />
            <span><strong>SqueegeeKing</strong><small>with HomeAtlas</small></span>
          </Link>
          <div className={styles.headerActions}>
            <nav className={styles.headerNav} aria-label="Primary navigation">
              <a href="#care-options">Services</a>
              <a href="#reviews">Reviews</a>
            </nav>
            <span className={styles.liveBadge}><i aria-hidden="true" />Home care, live</span>
            <Link href="/request" className={styles.headerCta}>Build my plan</Link>
          </div>
        </header>

        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>The SqueegeeKing membership, powered by HomeAtlas</p>
          <h1 id="atlas-hero-title">Your home<em>remembers.</em></h1>
          <p className={styles.heroBody}>
            Cleaning is the visit. HomeAtlas is everything your home keeps:
            what happened, what is next, and the proof behind every promise.
          </p>
          <div className={styles.heroActions}>
            <Link href="/request" className={styles.primaryCta}>
              Get your free Home Care Plan <span aria-hidden="true">↗</span>
            </Link>
            <a href="#homeatlas-live" className={styles.secondaryCta}>See the app in motion</a>
          </div>
          <div className={styles.heroTrust} aria-label="SqueegeeKing promises">
            <span><i aria-hidden="true" />Founder-led in Chico</span>
            <span>7-day workmanship guarantee</span>
            <span>Your home keeps the record</span>
          </div>
        </div>

        <div className={styles.memoryDock} aria-label="HomeAtlas property memory">
          <div className={styles.dockHeading}>
            <span>Property memory</span><span>Live preview</span>
          </div>
          <div className={styles.memoryGrid}>
            {MEMORIES.map((memory, index) => (
              <button
                key={memory.id}
                type="button"
                className={`${styles.memoryCard} ${index === activeIndex ? styles.memoryCardActive : ""}`}
                aria-pressed={index === activeIndex}
                onClick={() => selectMemory(index)}
                style={{ "--card-delay": `${280 + index * 110}ms` } as React.CSSProperties}
              >
                <span className={styles.cardNumber}>{memory.number}</span>
                <span className={styles.cardEyebrow}>{memory.eyebrow}</span>
                <strong>{memory.title}</strong>
                <small>{memory.footer}</small>
                <span className={styles.cardArrow} aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
        </div>

        <a className={styles.scrollCue} href="#homeatlas-live">
          <span>Enter HomeAtlas</span><i aria-hidden="true" />
        </a>
      </section>

      <section id="homeatlas-live" className={styles.portalSection} aria-labelledby="portal-title">
        <div className={styles.portalIntro}>
          <div className={styles.portalNarrative}>
            <p className={styles.darkEyebrow}>A care system, not another appointment</p>
            <h2 id="portal-title">The house stays still.<em>Its story keeps moving.</em></h2>
            <p>
              HomeAtlas turns every service into useful memory. Tap the signals
              to see the same home from four different angles.
            </p>
            <div className={styles.atlasCore} aria-label="HomeAtlas member care features">
              <div className={styles.orbitOne}><span /></div>
              <div className={styles.orbitTwo}><span /></div>
              <div className={styles.featureOrbit}>
                {MEMBER_ORBIT_FEATURES.map((feature, index) => {
                  const angle = index * (360 / MEMBER_ORBIT_FEATURES.length) - 90;
                  return (
                    <span
                      key={feature}
                      className={styles.orbitFeature}
                      style={{
                        "--orbit-angle": `${angle}deg`,
                        "--orbit-counter-angle": `${-angle}deg`,
                      } as React.CSSProperties}
                    >
                      <span>{feature}</span>
                    </span>
                  );
                })}
              </div>
              <div className={styles.coreMark}><AtlasMark size={76} /></div>
              <p>MEMBER CARE<br />IN ORBIT</p>
            </div>
          </div>

          <div className={styles.portalShell}>
            <div className={styles.portalTopbar}>
              <div className={styles.windowControls} aria-hidden="true"><span /><span /><span /></div>
              <div className={styles.portalIdentity}>
                <AtlasMark size={26} />
                <span><strong>HomeAtlas</strong><small>Your Chico home · live example</small></span>
              </div>
              <span className={styles.memberChip}>CARE MEMBER</span>
            </div>

            <div className={styles.portalBody}>
              <nav className={styles.portalNav} aria-label="HomeAtlas preview modules">
                {MEMORIES.map((memory, index) => (
                  <button
                    key={memory.id}
                    type="button"
                    onClick={() => selectMemory(index)}
                    aria-current={index === activeIndex ? "page" : undefined}
                    className={index === activeIndex ? styles.portalNavActive : ""}
                  >
                    <span>{memory.number}</span>{memory.eyebrow}
                  </button>
                ))}
              </nav>

              <div className={styles.portalContent} key={activeMemory.id}>
                <div className={styles.portalContentHeader}>
                  <div><p>{activeMemory.eyebrow}</p><h3>{activeMemory.title}</h3></div>
                  <strong>{activeMemory.metric}</strong>
                </div>

                <div className={styles.propertyStrip}>
                  <Image
                    src={heroHouse}
                    alt="The example property attached to this HomeAtlas record"
                    fill
                    placeholder="blur"
                    sizes="(max-width: 800px) 100vw, 55vw"
                    className={styles.propertyImage}
                  />
                  <div className={styles.propertyLabel}><span>Property 01</span><strong>Chico, California</strong></div>
                  <div className={styles.scanLine} aria-hidden="true" />
                </div>

                <div className={styles.activeMemoryPanel}>
                  <span className={styles.activeNumber}>{activeMemory.number}</span>
                  <div><p>{activeMemory.body}</p><span>{activeMemory.footer}</span></div>
                  <div className={styles.memoryPulse} aria-hidden="true"><i /></div>
                </div>

                <div className={styles.timeline} aria-label="Example property timeline">
                  <span className={styles.timelineDone}><i />Jan 9</span>
                  <span className={styles.timelineDone}><i />Apr 12</span>
                  <span className={styles.timelineDone}><i />Jul 18</span>
                  <span className={styles.timelineNext}><i />Oct 14</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="care-options"
        className={styles.careSection}
        aria-labelledby="care-options-title"
      >
        <div className={styles.careHeading}>
          <div>
            <p className={styles.darkEyebrow}>Window cleaning &amp; exterior home care in Chico</p>
            <h2 id="care-options-title">One home.<em>Every clear next step.</em></h2>
          </div>
          <p>
            Start with the service you need today. If recurring care makes
            sense, we shape the rhythm around your property instead of forcing
            your home into a generic package.
          </p>
        </div>

        <div className={styles.careGrid}>
          {CARE_OPTIONS.map((option) => (
            <Link key={option.href} href={option.href} className={styles.careCard}>
              <span className={styles.careImageWrap}>
                <Image
                  src={option.image}
                  alt=""
                  fill
                  sizes="(max-width: 800px) 100vw, 50vw"
                  className={styles.careImage}
                />
                <span className={styles.careShade} aria-hidden="true" />
              </span>
              <span className={styles.careNumber}>{option.number}</span>
              <span className={styles.careCopy}>
                <small>{option.cadence}</small>
                <strong>{option.title}</strong>
                <span>{option.detail}</span>
              </span>
              <span className={styles.careArrow} aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>

        <ul className={styles.trustStrip} aria-label="SqueegeeKing service promises">
          <li><strong>Chico, California</strong><span>Local home care</span></li>
          <li><strong>7-day workmanship guarantee</strong><span>We make it right</span></li>
          <li><strong>Member HomeAtlas</strong><span>Visits and proof in one place</span></li>
        </ul>
      </section>

      <section className={styles.humanSection} aria-labelledby="human-title">
        <div className={styles.humanSignal} aria-hidden="true">
          <span>LOCAL CARE</span><i /><span>PROPERTY MEMORY</span><i /><span>HUMAN FOLLOW-THROUGH</span>
        </div>
        <div className={styles.humanLayout}>
          <div className={styles.humanIntro}>
            <p className={styles.darkEyebrow}>Technology that keeps service personal</p>
            <h2 id="human-title">Built in Chico.<em>Kept human.</em></h2>
            <p>
              HomeAtlas handles the memory so our team can focus on your home.
              You get real people, a clear plan, and one living record that
              follows every promise from the first quote through the next visit.
            </p>
            <div className={styles.careLoop} aria-label="How SqueegeeKing care stays connected">
              <span><b>01</b><strong>We listen</strong><small>Your priorities shape the plan</small></span>
              <span><b>02</b><strong>We document</strong><small>Visits and proof stay attached</small></span>
              <span><b>03</b><strong>We remember</strong><small>The next step is never a mystery</small></span>
            </div>
          </div>

          <div className={styles.founderGrid}>
            {SQUEEGEEKING_FOUNDERS.map((founder, index) => {
              const initials = founder.name
                .split(/\s+/)
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();

              return (
                <article key={founder.id} className={styles.founderCard}>
                  <div className={styles.founderCardTop}>
                    <div className={styles.founderOrb} aria-hidden="true">
                      <i /><span>{initials}</span><b />
                    </div>
                    <span className={styles.founderNumber}>{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <div className={styles.founderIdentity}>
                    <small>{founder.role}</small>
                    <h3>{founder.name}</h3>
                  </div>
                  <p>{founder.bio}</p>
                  {founder.quote ? <blockquote>“{founder.quote}”</blockquote> : null}
                  <span className={styles.founderStatus}><i aria-hidden="true" />Building your care system</span>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <div id="reviews" className={styles.reviewAnchor}>
        <Day2ReviewsWall reduced={reducedMotion} />
      </div>

      <section className={styles.faqSection} aria-labelledby="faq-title">
        <div className={styles.faqHeading}>
          <p className={styles.darkEyebrow}>Straight answers before the first visit</p>
          <h2 id="faq-title">Built around<em>the actual home.</em></h2>
          <p>
            Professional window cleaning should begin with a clear scope—not a
            mystery package. These are the questions Chico homeowners ask most.
          </p>
        </div>
        <div className={styles.faqList}>
          {HOMEOWNER_QUESTIONS.map((item, index) => (
            <details key={item.question} className={styles.faqItem}>
              <summary>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {item.question}
                <i aria-hidden="true" />
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className={styles.closingSection} aria-labelledby="closing-title">
        <div className={styles.marquee} aria-hidden="true">
          <span>CARE / MEMORY / PROOF / PLAN / CARE / MEMORY / PROOF / PLAN /</span>
          <span>CARE / MEMORY / PROOF / PLAN / CARE / MEMORY / PROOF / PLAN /</span>
        </div>
        <div className={styles.closingContent}>
          <p className={styles.darkEyebrow}>Included with SqueegeeKing membership</p>
          <h2 id="closing-title">Clean windows are the beginning.</h2>
          <p>
            Give your home a care record, a next step, and a service company
            that remembers what it promised.
          </p>
          <Link href="/request" className={styles.darkCta}>
            Build my Home Care Plan <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>

      <footer className={styles.siteFooter}>
        <div className={styles.footerBrand}>
          <AtlasMark size={34} />
          <span><strong>SqueegeeKing</strong><small>Chico, California · powered by HomeAtlas</small></span>
        </div>
        <nav aria-label="Footer navigation">
          <Link href="/services">Services</Link>
          <Link href="/request">Request a plan</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
        <a className={styles.footerPhone} href={CUSTOMER_CONTACT.phoneHref}>
          {CUSTOMER_CONTACT.phoneDisplay}
        </a>
      </footer>
    </main>
  );
}
