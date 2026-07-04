"use client";

interface HealthSummaryPreviewProps {
  score: number;
  className?: string;
}

export function HealthSummaryPreview({
  score,
  className = "",
}: HealthSummaryPreviewProps) {
  const color =
    score >= 80
      ? "#22c55e"
      : score >= 60
        ? "#84cc16"
        : score >= 40
          ? "#eab308"
          : score >= 20
            ? "#f97316"
            : "#ef4444";

  return (
    <div className={`rounded-xl bg-[#111] px-4 py-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-widest text-[#444]">
            Overall Care Score
          </p>
          <p
            className="font-serif text-4xl transition-all duration-300"
            style={{ color }}
          >
            {score}%
          </p>
        </div>

        <div
          className="flex h-14 w-14 items-center justify-center rounded-full border-2"
          style={{ borderColor: color }}
        >
          <span className="text-xs font-semibold" style={{ color }}>
            {score}
          </span>
        </div>
      </div>

      <div className="mt-3 h-[2px] overflow-hidden rounded-full bg-[#1a1a1a]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
