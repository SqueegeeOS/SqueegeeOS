"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AtlasMark } from "@/components/theme/atlas-mark";
import styles from "./atlas-glass.module.css";

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

export function AtlasGlass() {
  const [activeIndex, setActiveIndex] = useState(0);
  const userSelectedRef = useRef(false);
  const heroRef = useRef<HTMLElement>(null);
  const activeMemory = MEMORIES[activeIndex];

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      if (!userSelectedRef.current && !document.hidden) {
        setActiveIndex((current) => (current + 1) % MEMORIES.length);
      }
    }, 3600);
    return () => window.clearInterval(timer);
  }, []);

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
          src="/atlas-glass/hero-house.jpg"
          alt="A cared-for Chico home in warm evening light"
          fill
          preload
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
        </div>

        <div className={styles.signalRail} aria-hidden="true"><span /></div>

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
            <div className={styles.atlasCore} aria-hidden="true">
              <div className={styles.orbitOne}><span /></div>
              <div className={styles.orbitTwo}><span /></div>
              <div className={styles.coreMark}><AtlasMark size={76} /></div>
              <p>ONE HOME<br />ONE RECORD</p>
            </div>
          </div>

          <div className={styles.portalShell}>
            <div className={styles.portalTopbar}>
              <div className={styles.windowControls} aria-hidden="true"><span /><span /><span /></div>
              <div className={styles.portalIdentity}>
                <AtlasMark size={26} />
                <span><strong>HomeAtlas</strong><small>The Bennett Home</small></span>
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
                    src="/atlas-glass/hero-house.jpg"
                    alt="The example property attached to this HomeAtlas record"
                    fill
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
    </main>
  );
}
