import Image from "next/image";
import type { PortalVisitStory } from "@/lib/membership/portal-visit-stories";

const VISIT_STORY_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  month: "long",
  day: "numeric",
  year: "numeric",
});

function captureLabel(value: PortalVisitStory["photos"][number]["captureType"]): string {
  switch (value) {
    case "before":
      return "Before";
    case "after":
      return "After";
    case "detail":
      return "Detail";
    default:
      return "Visit";
  }
}

export function MemberVisitStories({
  stories,
}: {
  stories: PortalVisitStory[];
}) {
  if (stories.length === 0) return null;

  return (
    <section className="mt-10" aria-labelledby="visit-stories-title">
      <div className="mb-5">
        <p className="text-[10px] uppercase tracking-[0.28em] text-accent">
          Proof of care
        </p>
        <h2
          id="visit-stories-title"
          className="mt-2 font-serif text-2xl font-light text-foreground"
        >
          Your visit stories
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Each update stays with the photos from that exact service visit.
        </p>
      </div>

      <ol className="space-y-5">
        {stories.map((story) => (
          <li
            key={story.id}
            className="overflow-hidden rounded-3xl border border-border bg-surface/40 shadow-[var(--shadow-ambient)]"
          >
            <article>
              <header className="border-b border-border/60 px-5 py-5 sm:px-7">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted">
                  {VISIT_STORY_DATE_FORMATTER.format(new Date(story.observedAt))}
                  {story.observedBy ? ` · Documented by ${story.observedBy}` : ""}
                </p>
                {story.note ? (
                  <p className="mt-3 text-sm leading-relaxed text-foreground/90">
                    {story.note}
                  </p>
                ) : (
                  <p className="mt-3 text-sm leading-relaxed text-foreground/65">
                    Service progress documented for your home record.
                  </p>
                )}
              </header>

              {story.photos.length > 0 ? (
                <ul
                  className={
                    story.photos.length === 1
                      ? "grid gap-px bg-border/40"
                      : "grid grid-cols-2 gap-px bg-border/40"
                  }
                >
                  {story.photos.map((photo, index) => {
                    const label = captureLabel(photo.captureType);
                    return (
                      <li
                        key={photo.id ?? `${photo.uploadedAt}-${index}`}
                        className="min-w-0 bg-background/70"
                      >
                        <a
                          href={photo.url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open full-size ${label.toLowerCase()} visit photo`}
                          className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                        >
                          <div className="relative aspect-[4/3] overflow-hidden bg-black/20">
                            <Image
                              src={photo.url}
                              alt={photo.caption || `${label} service photo`}
                              fill
                              sizes="(max-width: 640px) 50vw, 320px"
                              className="object-cover transition duration-500 group-hover:scale-[1.02]"
                            />
                            <span className="absolute left-3 top-3 rounded-full bg-black/75 px-2.5 py-1 text-[9px] uppercase tracking-[0.15em] text-white">
                              {label}
                            </span>
                            <span className="absolute bottom-3 right-3 rounded-full bg-black/65 px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-white/80 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                              Full size
                            </span>
                          </div>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}
