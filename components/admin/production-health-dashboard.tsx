"use client";

import type {
  ProductionHealthCheck,
  ProductionHealthReport,
  ProductionHealthSection,
  ProductionHealthStatus,
} from "@/lib/admin/production-health-types";
import { craftEyebrow, craftTableHead } from "@/lib/craft/tokens";

function statusLabel(status: ProductionHealthStatus): string {
  switch (status) {
    case "green":
      return "Ready";
    case "yellow":
      return "Review";
    case "red":
      return "Blocked";
    default:
      return status;
  }
}

function statusTone(status: ProductionHealthStatus): string {
  switch (status) {
    case "green":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    case "yellow":
      return "border-amber-500/30 bg-amber-500/10 text-amber-200";
    case "red":
      return "border-red-500/30 bg-red-500/10 text-red-200";
    default:
      return "border-border/40 text-muted";
  }
}

function summaryCardTone(status: ProductionHealthStatus): string {
  switch (status) {
    case "green":
      return "border-emerald-500/35 bg-emerald-500/10";
    case "yellow":
      return "border-amber-500/35 bg-amber-500/10";
    case "red":
      return "border-red-500/35 bg-red-500/10";
  }
}

function CheckRow({ item }: { item: ProductionHealthCheck }) {
  return (
    <div className="border-b border-border/30 px-5 py-4 last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{item.label}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {item.message}
          </p>
          {item.detail ? (
            <p className="mt-1 text-xs text-muted/80">{item.detail}</p>
          ) : null}
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${statusTone(item.status)}`}
        >
          {statusLabel(item.status)}
        </span>
      </div>
    </div>
  );
}

function SectionCard({ section }: { section: ProductionHealthSection }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/80 bg-background/40">
      <div className="flex items-center justify-between gap-4 border-b border-border/40 px-5 py-4">
        <div>
          <p className={craftEyebrow}>{section.title}</p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${statusTone(section.status)}`}
        >
          {statusLabel(section.status)}
        </span>
      </div>
      <div>
        {section.checks.map((check) => (
          <CheckRow key={check.id} item={check} />
        ))}
      </div>
    </section>
  );
}

export function ProductionHealthDashboard({
  report,
}: {
  report: ProductionHealthReport;
}) {
  return (
    <div className="space-y-6">
      <div
        className={`rounded-2xl border px-6 py-6 ${summaryCardTone(report.onboardingSafe)}`}
      >
        <p className={craftEyebrow}>Customer onboarding safe?</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-serif text-3xl font-light text-foreground">
              {report.onboardingSafe === "green"
                ? "Ready"
                : report.onboardingSafe === "yellow"
                  ? "Manual review"
                  : "Do not onboard"}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
              {report.summary}
            </p>
          </div>
          <p className={`text-[10px] uppercase tracking-[0.16em] ${craftTableHead}`}>
            Checked{" "}
            {new Date(report.checkedAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {report.sections.map((section) => (
          <SectionCard key={section.id} section={section} />
        ))}
      </div>
    </div>
  );
}
