"use client";

import type { ApolloWelcomeContent } from "@/lib/membership/unlock-apollo";
import { APOLLO_BENEFITS } from "@/lib/membership/unlock-apollo";

interface ApolloWelcomeProps {
  content: ApolloWelcomeContent;
  visible: boolean;
  /** Number of welcome steps revealed (0–11) */
  step: number;
}

export function ApolloWelcome({ content, visible, step }: ApolloWelcomeProps) {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-[8] flex flex-col items-center justify-center px-10">
      <div className="max-w-[560px] w-full text-center">
        <p
          className="mb-6 font-sans text-[10px] font-extralight uppercase tracking-[0.4em] text-white/35 transition-opacity duration-700"
          style={{ opacity: step >= 1 ? 1 : 0 }}
        >
          {content.eyebrow}
        </p>

        <h1
          className="mb-5 font-serif text-[clamp(28px,4vw,42px)] font-light leading-[1.2] tracking-[0.02em] text-white/95 transition-opacity duration-1000"
          style={{ opacity: step >= 2 ? 1 : 0 }}
        >
          {content.headlinePrimary}
          <br />
          <em className="font-normal italic">{content.headlineEmphasis}</em>
          <br />
          {content.headlineSecondary}
        </h1>

        <p
          className="mb-3 font-sans text-[13px] font-light leading-[1.8] tracking-[0.05em] text-white/60 transition-opacity duration-700"
          style={{ opacity: step >= 3 ? 1 : 0 }}
        >
          {content.subtitle}
        </p>

        <p
          className="mb-2 font-serif text-base italic text-white/50 transition-opacity duration-600"
          style={{ opacity: step >= 4 ? 1 : 0 }}
        >
          {content.statementOne}
        </p>

        <p
          className="mb-2 font-serif text-base italic text-white/50 transition-opacity duration-600"
          style={{ opacity: step >= 5 ? 1 : 0 }}
        >
          {content.statementTwo}
        </p>

        <div
          className="mx-auto my-8 h-px w-10 bg-gradient-to-r from-transparent via-white/30 to-transparent transition-opacity duration-600"
          style={{ opacity: step >= 6 ? 1 : 0 }}
        />

        <ul className="mb-10 flex flex-col gap-2.5">
          {APOLLO_BENEFITS.map((benefit, index) => (
            <li
              key={benefit}
              className="flex items-center justify-center gap-3 font-sans text-xs font-light uppercase tracking-[0.12em] text-white/60 transition-opacity duration-500"
              style={{ opacity: step >= 7 + index ? 1 : 0 }}
            >
              <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-white/25">
                <span className="h-1 w-1 rounded-full bg-white/60" />
              </span>
              {benefit}
            </li>
          ))}
        </ul>

        <p
          className="mb-5 font-serif text-[11px] font-light uppercase tracking-[0.5em] text-white/35 transition-opacity duration-800"
          style={{ opacity: step >= 12 ? 1 : 0 }}
        >
          {content.emblem}
        </p>

        <p
          className="font-serif text-[clamp(20px,3vw,28px)] font-light italic tracking-[0.08em] text-white/70 transition-opacity duration-1000"
          style={{ opacity: step >= 13 ? 1 : 0 }}
        >
          {content.finalLine}
        </p>
      </div>
    </div>
  );
}
