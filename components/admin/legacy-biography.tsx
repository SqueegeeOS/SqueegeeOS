"use client";

import Image from "next/image";
import type { LegacyBaseline } from "@/lib/admin/legacy-baseline";
import { buildLegacyStory } from "@/lib/admin/legacy-story";

interface LegacyBiographyProps {
  baseline: LegacyBaseline;
  onEdit: () => void;
}

function FounderPortrait({
  name,
  portrait,
  about,
}: {
  name: string;
  portrait: string | null;
  about: string;
}) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

  return (
    <figure className="text-center">
      <div className="relative mx-auto aspect-[3/4] w-full max-w-[140px] overflow-hidden rounded-sm border border-border/80 bg-stone-900/5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
        {portrait ? (
          <Image
            src={portrait}
            alt={name}
            fill
            className="object-cover grayscale-[0.15]"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-b from-surface/80 to-background/60">
            <span className="font-serif text-3xl font-light tracking-[0.12em] text-foreground/35">
              {initials}
            </span>
          </div>
        )}
      </div>
      <figcaption className="mt-4">
        <p className="font-serif text-lg font-light text-foreground">{name}</p>
        {about && (
          <p className="mt-2 text-left text-sm leading-[1.7] text-muted/90">
            {about}
          </p>
        )}
      </figcaption>
    </figure>
  );
}

export function LegacyBiography({ baseline, onEdit }: LegacyBiographyProps) {
  const story = buildLegacyStory(baseline);

  return (
    <article className="overflow-hidden rounded-[2rem] border border-border/50 bg-gradient-to-b from-stone-500/[0.04] via-surface/40 to-background/20">
      <div className="border-b border-border/40 px-6 py-8 sm:px-10 sm:py-10">
        <p className="text-[10px] uppercase tracking-[0.34em] text-muted/90">
          Permanent Record · The Legacy
        </p>
        <h3 className="mt-4 font-serif text-3xl font-light leading-[1.1] text-foreground sm:text-4xl">
          Where we came from.
        </h3>
        <p className="mt-4 max-w-lg text-sm leading-[1.75] text-muted">
          Everything SqueegeeKing accomplished before the Operating System.
          Preserved — not generated.
        </p>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="border-b border-border/40 px-6 py-8 sm:px-10 sm:py-10 lg:border-b-0 lg:border-r">
          <div className="grid gap-10 sm:grid-cols-2">
            <FounderPortrait
              name={story.founders[0]}
              portrait={baseline.portraitNoah}
              about={story.aboutNoah}
            />
            <FounderPortrait
              name={story.founders[1]}
              portrait={baseline.portraitDasan}
              about={story.aboutDasan}
            />
          </div>

          {story.companyStandFor && (
            <blockquote className="mt-10 border-l-2 border-accent/30 pl-6">
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted">
                Company Story
              </p>
              <p className="mt-3 font-serif text-xl font-light leading-[1.6] text-foreground sm:text-2xl">
                &ldquo;{story.companyStandFor}&rdquo;
              </p>
            </blockquote>
          )}
        </div>

        <div className="px-6 py-8 sm:px-10 sm:py-10">
          <p className="text-[10px] uppercase tracking-[0.28em] text-muted">
            Exhibit
          </p>
          <dl className="mt-8 space-y-7">
            {story.chapters.map((chapter) => (
              <div key={chapter.id}>
                <dt className="text-[10px] uppercase tracking-[0.22em] text-muted/80">
                  {chapter.label}
                </dt>
                <dd className="mt-2 font-serif text-3xl font-light tabular-nums text-foreground">
                  {chapter.value}
                </dd>
              </div>
            ))}
          </dl>

          {story.milestones.length > 0 && (
            <div className="mt-10 border-t border-border/40 pt-8">
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted">
                Timeline
              </p>
              <ol className="mt-5 space-y-4">
                {story.milestones.map((item) => (
                  <li key={item.id} className="flex gap-4">
                    <span className="w-12 shrink-0 font-serif text-sm text-muted">
                      {item.year}
                    </span>
                    <span className="font-serif text-base font-light text-foreground/90">
                      {item.label}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border/40 px-6 py-5 sm:px-10">
        <button
          type="button"
          onClick={onEdit}
          className="text-[10px] uppercase tracking-[0.18em] text-muted/70 transition-colors hover:text-accent"
        >
          Update archive record
        </button>
      </div>
    </article>
  );
}
