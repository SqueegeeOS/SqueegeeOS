interface AgreementSummaryProps {
  tierName: string;
  tierPrice: string;
  tierPeriod: string;
  lifestyle: string;
}

const summaryPoints = [
  "Scheduled home care visits based on your membership tier",
  "Priority booking for additional services",
  "Documented property history in your member portal",
  "Automatic add-on discount while membership payments are active (20% Bi-Annual · 25% Quarterly)",
  "Cancel with thirty days written notice",
];

export function AgreementSummary({
  tierName,
  tierPrice,
  tierPeriod,
  lifestyle,
}: AgreementSummaryProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface/50 p-5">
      <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted">
        Agreement summary
      </p>
      <p className="mt-3 text-sm leading-relaxed text-foreground">
        You are enrolling in{" "}
        <span className="font-medium">{tierName}</span> at{" "}
        <span className="font-medium">
          {tierPrice} {tierPeriod}
        </span>
        . {lifestyle}
      </p>
      <ul className="mt-4 space-y-2.5 text-sm text-muted">
        {summaryPoints.map((point) => (
          <li key={point} className="flex gap-2.5">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
