"use client";

import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { larryBuckley } from "../data";
import { easeLuxury } from "../motion";
import {
  Reveal,
  Section,
  SectionEyebrow,
  SectionLead,
  SectionTitle,
} from "../ui/section";

function AnimatedScore({ score }: { score: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    if (!inView) return;

    const duration = 2200;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(eased * score));
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, [inView, score]);

  const circumference = 2 * Math.PI * 88;
  const offset = circumference - (displayScore / 100) * circumference;

  return (
    <div ref={ref} className="relative flex items-center justify-center">
      <svg
        width="220"
        height="220"
        viewBox="0 0 200 200"
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx="100"
          cy="100"
          r="88"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          className="text-border"
        />
        <motion.circle
          cx="100"
          cy="100"
          r="88"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="text-accent"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={inView ? { strokeDashoffset: offset } : { strokeDashoffset: circumference }}
          transition={{ duration: 2.2, ease: easeLuxury }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-serif text-7xl font-light tracking-tight text-foreground">
          {displayScore}
        </span>
        <span className="mt-1 text-[11px] uppercase tracking-[0.35em] text-muted">
          of 100
        </span>
      </div>
    </div>
  );
}

export function HomeCareScore() {
  const { homeCareScore } = larryBuckley;

  return (
    <Section id="score" className="bg-surface/40">
      <div className="grid items-center gap-16 lg:grid-cols-[1fr_auto] lg:gap-24">
        <div>
          <Reveal>
            <SectionEyebrow>Home Care Score</SectionEyebrow>
          </Reveal>

          <Reveal delay={0.08} className="mt-6">
            <SectionTitle>{homeCareScore.label}</SectionTitle>
          </Reveal>

          <Reveal delay={0.16} className="mt-8">
            <SectionLead>{homeCareScore.summary}</SectionLead>
          </Reveal>

          <div className="mt-14 space-y-6">
            {homeCareScore.dimensions.map((dim, index) => (
              <Reveal key={dim.name} delay={0.2 + index * 0.06}>
                <div>
                  <div className="mb-3 flex items-baseline justify-between gap-4">
                    <p className="text-sm text-foreground/90">{dim.name}</p>
                    <p className="font-serif text-xl font-light text-accent">
                      {dim.score}
                    </p>
                  </div>
                  <div className="h-px w-full overflow-hidden rounded-full bg-border">
                    <motion.div
                      className="h-full bg-gradient-to-r from-accent/40 to-accent"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${dim.score}%` }}
                      viewport={{ once: true, margin: "-80px" }}
                      transition={{ duration: 1.4, delay: 0.3 + index * 0.1, ease: easeLuxury }}
                    />
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal delay={0.12} className="flex justify-center lg:justify-end">
          <div className="rounded-[2.5rem] border border-border bg-surface p-10 sm:p-14">
            <AnimatedScore score={homeCareScore.score} />
            <p className="mt-8 text-center text-[11px] uppercase tracking-[0.32em] text-muted">
              Larry&apos;s Score
            </p>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
