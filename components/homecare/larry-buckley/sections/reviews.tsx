"use client";

import { motion } from "framer-motion";
import { larryBuckley } from "../data";
import { easeLuxury } from "../motion";
import {
  Reveal,
  Section,
  SectionEyebrow,
  SectionTitle,
} from "../ui/section";

function Stars() {
  return (
    <div className="flex gap-1" aria-label="5 out of 5 stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="text-accent"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

export function Reviews() {
  const { reviews } = larryBuckley;

  return (
    <Section id="reviews">
      <div className="text-center">
        <Reveal>
          <SectionEyebrow>Reviews</SectionEyebrow>
        </Reveal>

        <Reveal delay={0.08} className="mt-6">
          <SectionTitle className="mx-auto">
            {reviews.count}+ Five-Star Reviews
          </SectionTitle>
        </Reveal>

        <Reveal delay={0.16} className="mt-6 flex justify-center">
          <Stars />
        </Reveal>
      </div>

      <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:mt-20 lg:grid-cols-3">
        {reviews.featured.map((review, index) => (
          <Reveal key={review.author} delay={0.1 + index * 0.08}>
            <motion.blockquote
              whileHover={{ y: -4 }}
              transition={{ duration: 0.4, ease: easeLuxury }}
              className="flex h-full flex-col rounded-3xl border border-border bg-surface p-8 sm:p-10"
            >
              <Stars />
              <p className="mt-6 flex-1 font-serif text-xl font-light leading-relaxed text-foreground sm:text-2xl sm:leading-relaxed">
                &ldquo;{review.quote}&rdquo;
              </p>
              <footer className="mt-8 border-t border-border pt-6">
                <p className="text-sm text-foreground">{review.author}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.25em] text-muted">
                  {review.location}
                </p>
              </footer>
            </motion.blockquote>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
