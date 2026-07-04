import {
  HEALTH_SCORE_COLORS,
  HEALTH_SCORE_LABELS,
  type HealthScore,
} from "@/lib/health/types";

interface PortalScoreCardProps {
  label: string;
  score: HealthScore | null;
  invertColor?: boolean;
  themed?: boolean;
}

export function PortalScoreCard({
  label,
  score,
  invertColor,
  themed = false,
}: PortalScoreCardProps) {
  const colorScore =
    invertColor && score ? ((6 - score) as HealthScore) : score;

  const color = colorScore ? HEALTH_SCORE_COLORS[colorScore] : undefined;

  if (themed) {
    return (
      <div className="rounded-xl border border-border/70 bg-surface/50 px-3 py-4 text-center">
        <p className="mb-2 text-[10px] uppercase tracking-wider text-muted">
          {label}
        </p>
        {score !== null ? (
          <>
            <p
              className="mb-1 font-serif text-2xl"
              style={color ? { color } : undefined}
            >
              {score}
            </p>
            <p
              className="text-[10px] leading-tight"
              style={color ? { color } : undefined}
            >
              {HEALTH_SCORE_LABELS[score]}
            </p>
          </>
        ) : (
          <p className="text-lg text-muted/40">—</p>
        )}
      </div>
    );
  }

  const fallbackColor = color ?? "#2a2a2a";

  return (
    <div className="rounded-xl bg-[#111] px-3 py-4 text-center">
      <p className="mb-2 text-[10px] uppercase tracking-wider text-[#444]">
        {label}
      </p>
      {score !== null ? (
        <>
          <p className="mb-1 font-serif text-2xl" style={{ color: fallbackColor }}>
            {score}
          </p>
          <p className="text-[10px] leading-tight" style={{ color: fallbackColor }}>
            {HEALTH_SCORE_LABELS[score]}
          </p>
        </>
      ) : (
        <p className="text-lg text-[#2a2a2a]">—</p>
      )}
    </div>
  );
}
