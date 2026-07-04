import type { AgreementKind } from "@/lib/agreement/one-time-agreement";
import {
  MEMBERSHIP_SUMMARY_POINTS,
  ONE_TIME_SUMMARY_POINTS,
  oneTimeEnrollmentCopy,
} from "@/lib/agreement/agreement-content";

interface AgreementSummaryProps {
  kind: AgreementKind;
  tierName: string;
  tierPrice: string;
  tierPeriod: string;
  lifestyle: string;
}

export function AgreementSummary({
  kind,
  tierName,
  tierPrice,
  tierPeriod,
  lifestyle,
}: AgreementSummaryProps) {
  const isOneTime = kind === "one_time";
  const points = isOneTime ? ONE_TIME_SUMMARY_POINTS : MEMBERSHIP_SUMMARY_POINTS;

  return (
    <div className="rounded-2xl border border-border bg-surface/50 p-5">
      <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted">
        {isOneTime ? "Service agreement summary" : "Agreement summary"}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-foreground">
        {isOneTime ? (
          oneTimeEnrollmentCopy(tierName, tierPrice, tierPeriod)
        ) : (
          <>
            You are enrolling in{" "}
            <span className="font-medium">{tierName}</span> at{" "}
            <span className="font-medium">
              {tierPrice} {tierPeriod}
            </span>
            . {lifestyle}
          </>
        )}
      </p>
      <ul className="mt-4 space-y-2.5 text-sm text-muted">
        {points.map((point) => (
          <li key={point} className="flex gap-2.5">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
