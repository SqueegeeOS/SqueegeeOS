import { getPlaceholderLabel } from "@/lib/team/founders";
import type { PortraitPlaceholderKind } from "@/lib/team/types";
import { PORTRAIT_ASPECT } from "@/lib/team/types";

interface FounderPortraitPlaceholderProps {
  kind: PortraitPlaceholderKind;
  aspect?: keyof typeof PORTRAIT_ASPECT;
  className?: string;
}

export function FounderPortraitPlaceholder({
  kind,
  aspect = "card",
  className = "",
}: FounderPortraitPlaceholderProps) {
  const ratio = PORTRAIT_ASPECT[aspect];

  return (
    <div
      className={`relative w-full overflow-hidden border-b border-border bg-[#080808] ${className}`}
      style={{ aspectRatio: String(ratio) }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(201,184,150,0.06),transparent_65%)]" />
      <div className="absolute inset-[1px] border border-accent/10" />
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 h-px w-12 bg-accent/25" />
        <p className="max-w-[14rem] text-[10px] font-medium uppercase leading-relaxed tracking-[0.22em] text-muted">
          {getPlaceholderLabel(kind)}
        </p>
        <div className="mt-4 h-px w-12 bg-accent/25" />
      </div>
    </div>
  );
}
