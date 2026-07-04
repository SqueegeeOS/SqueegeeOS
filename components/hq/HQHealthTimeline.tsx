import {
  HEALTH_SCORE_COLORS,
  HEALTH_SCORE_LABELS,
  parseHealthScore,
  type PropertyHealthCheck,
} from "@/lib/health/types";

const SCORE_GRID: Array<[string, keyof PropertyHealthCheck["scores"]]> = [
  ["Windows", "windowHealth"],
  ["Screens", "screenHealth"],
  ["Track/Sill", "trackSillHealth"],
  ["Frames", "frameHealth"],
  ["Hard Water", "hardWaterRisk"],
  ["Debris", "debrisBuildup"],
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function ScoreChip({
  label,
  score,
}: {
  label: string;
  score: number | null;
}) {
  const s = parseHealthScore(score);
  const color = s ? HEALTH_SCORE_COLORS[s] : "#222";

  return (
    <div className="rounded-lg bg-[#0d0d0d] px-2 py-2.5 text-center">
      <p className="mb-1 text-[10px] text-[#333]">{label}</p>
      {s !== null ? (
        <>
          <p className="font-serif text-base" style={{ color }}>
            {s}
          </p>
          <p className="mt-0.5 text-[9px]" style={{ color }}>
            {HEALTH_SCORE_LABELS[s]}
          </p>
        </>
      ) : (
        <p className="text-sm text-[#222]">—</p>
      )}
    </div>
  );
}

export function HQHealthTimeline({ checks }: { checks: PropertyHealthCheck[] }) {
  return (
    <div className="space-y-4">
      {checks.map((check) => (
        <div key={check.id} className="rounded-2xl bg-[#111] px-6 py-5">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-white">
                {formatDate(check.visitDate)}
              </p>
              <p className="mt-0.5 text-xs text-[#444]">
                {check.technicianName}
              </p>
            </div>
            {check.overallScore !== null && (
              <div className="text-right">
                <p className="font-serif text-2xl text-[#c9a96e]">
                  {check.overallScore}%
                </p>
                <p className="text-[10px] text-[#444]">overall</p>
              </div>
            )}
          </div>

          <div className="mb-5 grid grid-cols-3 gap-2">
            {SCORE_GRID.map(([label, key]) => (
              <ScoreChip
                key={key}
                label={label}
                score={check.scores[key]}
              />
            ))}
          </div>

          {check.internalNote && (
            <div className="mb-2 rounded-lg border border-[#1e1e1e] px-3 py-2.5">
              <p className="mb-1 text-[10px] uppercase tracking-widest text-[#444]">
                Internal Note
              </p>
              <p className="text-xs leading-relaxed text-[#777]">
                {check.internalNote}
              </p>
            </div>
          )}

          {check.customerNote && (
            <div className="rounded-lg border border-[#c9a96e18] px-3 py-2.5">
              <div className="mb-1 flex items-center gap-2">
                <p className="text-[10px] uppercase tracking-widest text-[#c9a96e]">
                  Customer Note
                </p>
                <span className="text-[10px] text-[#333]">
                  {check.customerNoteVisible
                    ? "· visible in portal"
                    : "· hidden from customer"}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-[#777]">
                {check.customerNote}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
