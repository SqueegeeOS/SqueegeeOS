import type { ReactNode } from "react";
import { GlassCard } from "./glass-card";

export function StatePanel({
  eyebrow,
  title,
  detail,
  action,
  busy = false,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  detail?: string;
  action?: ReactNode;
  busy?: boolean;
  className?: string;
}) {
  return (
    <GlassCard
      tone="subtle"
      className={`text-center ${className}`}
      padding="lg"
    >
      {busy ? (
        <span
          className="mx-auto mb-5 block h-9 w-9 rounded-full border border-accent/25 border-t-accent motion-safe:animate-spin"
          aria-hidden
        />
      ) : null}
      {eyebrow ? (
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent/75">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-2 font-serif text-3xl font-light tracking-[-0.025em] text-foreground">
        {title}
      </h2>
      {detail ? (
        <p className="mx-auto mt-3 max-w-lg text-base leading-relaxed text-foreground/62">
          {detail}
        </p>
      ) : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </GlassCard>
  );
}
