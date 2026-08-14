"use client";

import Link from "next/link";
import { buildProductionHealthActions } from "@/lib/admin/production-health-actions";
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
    <section
      id={`health-${section.id}`}
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-border/80 bg-background/40"
    >
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

const readinessLanes = [
  {
    label: "Sell",
    description: "Jobber, AI plans, and accurate addresses",
    checkIds: [
      "jobber-oauth-config",
      "jobber-connection",
      "atlas-ai",
      "address-search",
    ],
  },
  {
    label: "Follow up",
    description: "Email, text, replies, and incoming leads",
    checkIds: [
      "email-provider",
      "resend-webhook",
      "sms-provider",
      "twilio-webhook",
      "meta-lead-ads",
    ],
  },
  {
    label: "Collect",
    description: "Safe schedules, Stripe proof, and exceptions",
    checkIds: [
      "automation-scheduler",
      "billing-webhook",
      "automatic-billing",
      "billing-exceptions",
    ],
  },
] as const;

function laneStatus(
  section: ProductionHealthSection,
  checkIds: readonly string[],
): ProductionHealthStatus {
  const statuses = section.checks
    .filter((item) => checkIds.includes(item.id))
    .map((item) => item.status);
  if (statuses.includes("red")) return "red";
  if (statuses.includes("yellow") || statuses.length === 0) return "yellow";
  return "green";
}

function AutomationRunway({ section }: { section: ProductionHealthSection }) {
  return (
    <section
      aria-labelledby="automation-runway-title"
      className="rounded-2xl border border-border/80 bg-background/40 p-5"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={craftEyebrow}>Automation runway</p>
          <h2
            id="automation-runway-title"
            className="mt-2 font-serif text-2xl font-light text-foreground"
          >
            From first conversation to collected visit
          </h2>
        </div>
        <p className="max-w-md text-xs leading-relaxed text-muted">
          Readiness is visible here. Nothing on this screen sends a message or
          charges a customer.
        </p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {readinessLanes.map((lane, index) => {
          const status = laneStatus(section, lane.checkIds);
          return (
            <div
              key={lane.label}
              className="relative rounded-xl border border-border/60 bg-card/40 px-4 py-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-foreground">
                  {index + 1}. {lane.label}
                </p>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] ${statusTone(status)}`}
                >
                  {statusLabel(status)}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                {lane.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function NextOperatorActions({ report }: { report: ProductionHealthReport }) {
  const actions = buildProductionHealthActions(report);

  return (
    <section
      aria-labelledby="next-actions-title"
      className="rounded-2xl border border-border/80 bg-background/40 p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={craftEyebrow}>Next operator actions</p>
          <h2
            id="next-actions-title"
            className="mt-2 font-serif text-2xl font-light text-foreground"
          >
            What deserves attention now
          </h2>
        </div>
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted sm:text-right">
          Blockers first
        </p>
      </div>

      {actions.length ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {actions.map((action) => (
            <Link
              key={action.id}
              href={action.href}
              className="group rounded-xl border border-border/60 bg-card/40 p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {action.label}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                    {action.message}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] ${statusTone(action.status)}`}
                >
                  {statusLabel(action.status)}
                </span>
              </div>
              <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-primary transition group-hover:text-foreground">
                {action.cta} →
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4">
          <p className="text-sm font-medium text-emerald-100">
            No setup actions are waiting.
          </p>
          <p className="mt-1 text-xs text-emerald-100/70">
            Core onboarding and optional automations are reporting ready.
          </p>
        </div>
      )}
    </section>
  );
}

export function ProductionHealthDashboard({
  report,
}: {
  report: ProductionHealthReport;
}) {
  const integrationSection = report.sections.find(
    (section) => section.id === "integrations",
  );

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

      <NextOperatorActions report={report} />

      {integrationSection ? (
        <AutomationRunway section={integrationSection} />
      ) : null}

      <div className="grid gap-4">
        {report.sections.map((section) => (
          <SectionCard key={section.id} section={section} />
        ))}
      </div>
    </div>
  );
}
