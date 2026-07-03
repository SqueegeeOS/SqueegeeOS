"use client";

const FOCUS_ITEMS = [
  "Log your first closed job",
  "Build recurring memberships",
  "Grow Annual Recurring Revenue",
  "Protect every home like it's your own",
] as const;

export function AdminTodaysFocusCard() {
  return (
    <article className="rounded-[1.75rem] border border-accent/20 bg-gradient-to-br from-accent/[0.08] via-surface/70 to-background/40 p-6 sm:p-7">
      <p className="text-[10px] uppercase tracking-[0.28em] text-accent">
        Today&apos;s Focus
      </p>
      <ul className="mt-5 space-y-3.5">
        {FOCUS_ITEMS.map((item) => (
          <li
            key={item}
            className="flex items-start gap-3 text-sm leading-relaxed text-foreground/90"
          >
            <span
              className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent"
              aria-hidden
            />
            {item}
          </li>
        ))}
      </ul>
    </article>
  );
}
