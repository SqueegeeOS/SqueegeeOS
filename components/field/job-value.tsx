import type { FieldJobValue } from "@/lib/field-operations/field-job-value";

const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function JobValue({ value }: { value?: FieldJobValue }) {
  if (!value) return null;
  return <div className="mt-3 rounded-xl border border-accent/25 bg-accent/5 px-4 py-3">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="text-xs font-medium text-muted">Job value</span>
      <span className="text-lg font-semibold tabular-nums text-foreground">
        {value.amountCents === null ? "Not recorded" : dollars.format(value.amountCents / 100)}
      </span>
    </div>
    <p className="mt-1 text-xs leading-relaxed text-muted">
      {value.amountCents === null ? "Ask HQ to confirm the customer’s price."
        : value.source === "jobber" ? "Jobber job total · may cover multiple visits."
          : "Customer price recorded by HQ."}
    </p>
  </div>;
}
