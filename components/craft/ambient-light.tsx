"use client";

type AmbientLightVariant = "hero" | "section" | "dawn";

const GRADIENTS: Record<AmbientLightVariant, string> = {
  hero:
    "radial-gradient(ellipse 130% 90% at 50% -18%, rgba(255, 248, 235, 0.048) 0%, rgba(201, 184, 150, 0.018) 38%, transparent 68%)",
  section:
    "radial-gradient(ellipse 115% 75% at 50% -8%, rgba(255, 248, 235, 0.03) 0%, rgba(201, 184, 150, 0.012) 42%, transparent 66%)",
  dawn:
    "radial-gradient(ellipse 90% 55% at 50% 100%, rgba(255, 248, 235, 0.022) 0%, transparent 62%)",
};

interface AmbientLightProps {
  variant?: AmbientLightVariant;
  className?: string;
}

/** Morning light — large, feathered, barely there. */
export function AmbientLight({
  variant = "section",
  className = "",
}: AmbientLightProps) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{ background: GRADIENTS[variant] }}
    />
  );
}
