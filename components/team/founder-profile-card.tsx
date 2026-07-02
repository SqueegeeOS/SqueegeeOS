import type { FounderProfile } from "@/lib/team/types";
import { FounderPortrait } from "./founder-portrait";

interface FounderProfileCardProps {
  founder: FounderProfile;
  priority?: boolean;
}

export function FounderProfileCard({
  founder,
  priority = false,
}: FounderProfileCardProps) {
  return (
    <article className="overflow-hidden rounded-[1.5rem] border border-border bg-surface sm:rounded-3xl">
      <FounderPortrait founder={founder} layout="card" priority={priority} />
      <div className="p-6 sm:p-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-accent">
          {founder.role}
        </p>
        <h3 className="mt-3 font-serif text-2xl font-light tracking-tight text-foreground sm:text-3xl">
          {founder.name}
        </h3>
        <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
          {founder.bio}
        </p>
        {founder.quote && (
          <blockquote className="mt-6 border-l border-accent/30 pl-4">
            <p className="font-serif text-lg font-light italic leading-relaxed text-foreground/85">
              &ldquo;{founder.quote}&rdquo;
            </p>
          </blockquote>
        )}
        {founder.socialLinks &&
          Object.keys(founder.socialLinks).length > 0 && (
            <div className="mt-6 flex gap-3">
              {/* Social links — wire when URLs are provided */}
            </div>
          )}
      </div>
    </article>
  );
}
