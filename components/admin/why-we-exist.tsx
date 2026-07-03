"use client";

import { WHY_WE_EXIST } from "@/lib/admin/company-philosophy";

interface WhyWeExistProps {
  variant?: "full" | "compact";
}

export function WhyWeExist({ variant = "full" }: WhyWeExistProps) {
  if (variant === "compact") {
    return (
      <article className="rounded-[1.75rem] border border-border/60 bg-background/40 p-6 sm:p-7">
        <p className="text-[10px] uppercase tracking-[0.28em] text-muted">
          Why We Exist
        </p>
        <ul className="mt-5 space-y-3.5">
          {WHY_WE_EXIST.map((principle) => (
            <li
              key={principle.id}
              className="font-serif text-base font-light leading-relaxed text-foreground/90"
            >
              {principle.text}
            </li>
          ))}
        </ul>
      </article>
    );
  }

  return (
    <section className="rounded-[2rem] border border-border/50 bg-gradient-to-b from-surface/30 to-background/20 px-6 py-10 sm:px-10 sm:py-12">
      <p className="text-[10px] uppercase tracking-[0.32em] text-muted">
        Why We Exist
      </p>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted/85">
        Not marketing. The company&apos;s constitution.
      </p>
      <ul className="mt-10 grid gap-8 sm:grid-cols-2">
        {WHY_WE_EXIST.map((principle, index) => (
          <li key={principle.id} className="relative pl-8">
            <span className="absolute left-0 top-1 font-serif text-2xl font-light text-accent/40">
              {index + 1}
            </span>
            <p className="font-serif text-xl font-light leading-[1.55] text-foreground sm:text-2xl">
              {principle.text}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
