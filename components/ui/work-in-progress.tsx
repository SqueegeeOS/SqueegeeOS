import Link from "next/link";
import { AmbientGlow, Eyebrow, Reveal } from "@/components/marketing/ui";

interface WorkInProgressPageProps {
  eyebrow?: string;
  title: string;
  description: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}

export function WorkInProgressPage({
  eyebrow = "Work in progress",
  title,
  description,
  primaryHref = "/request",
  primaryLabel = "Request your Home Care Plan",
  secondaryHref,
  secondaryLabel,
}: WorkInProgressPageProps) {
  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center overflow-x-hidden bg-background px-5 py-28 text-center"
      style={{ paddingTop: "var(--site-chrome-offset)" }}
    >
      <AmbientGlow />
      <Reveal className="relative mx-auto max-w-lg">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-8 font-serif text-4xl font-light leading-tight text-foreground sm:text-5xl">
          {title}
        </h1>
        <p className="mt-6 text-base leading-relaxed text-muted">{description}</p>
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href={primaryHref}
            className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-accent/40 bg-accent px-8 text-sm font-medium tracking-[0.12em] text-background"
          >
            {primaryLabel}
          </Link>
          {secondaryHref && secondaryLabel && (
            <Link
              href={secondaryHref}
              className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-border px-8 text-sm tracking-[0.12em] text-foreground"
            >
              {secondaryLabel}
            </Link>
          )}
        </div>
      </Reveal>
    </div>
  );
}
