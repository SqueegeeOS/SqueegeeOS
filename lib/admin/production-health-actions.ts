import type {
  ProductionHealthCheck,
  ProductionHealthReport,
  ProductionHealthSection,
  ProductionHealthStatus,
} from "@/lib/admin/production-health-types";
import { ROUTES } from "@/lib/navigation/config";

export interface ProductionHealthAction {
  id: string;
  label: string;
  message: string;
  status: Exclude<ProductionHealthStatus, "green">;
  href: string;
  cta: string;
}

function destinationFor(
  section: ProductionHealthSection,
  item: ProductionHealthCheck,
): Pick<ProductionHealthAction, "href" | "cta"> {
  if (item.id.startsWith("jobber-")) {
    return { href: ROUTES.hqJobber, cta: "Open Jobber" };
  }
  if (
    item.id === "email-provider" ||
    item.id === "resend-webhook" ||
    item.id === "sms-provider" ||
    item.id === "twilio-webhook" ||
    item.id === "meta-lead-ads"
  ) {
    return { href: ROUTES.hqCommunications, cta: "Open Inbox" };
  }
  if (item.id === "atlas-ai" || item.id === "address-search") {
    return { href: ROUTES.newPresentation, cta: "Try Plan Studio" };
  }
  if (
    section.id === "stripe" ||
    section.id === "sales-billing" ||
    item.id === "automation-scheduler" ||
    item.id.startsWith("billing-") ||
    item.id === "automatic-billing"
  ) {
    return { href: ROUTES.hqBilling, cta: "Open Billing" };
  }
  if (section.id === "integrity") {
    return { href: ROUTES.hqMembership, cta: "Review Members" };
  }
  if (
    section.id === "schema" ||
    section.id === "storage" ||
    section.id === "agreement" ||
    section.id === "privacy" ||
    section.id === "persistence"
  ) {
    return { href: ROUTES.hqProductionCheck, cta: "Open Checklist" };
  }
  return { href: ROUTES.hq, cta: "Open HQ" };
}

export function buildProductionHealthActions(
  report: ProductionHealthReport,
  limit = 6,
): ProductionHealthAction[] {
  const pending = report.sections.flatMap((section) =>
    section.checks
      .filter(
        (item): item is ProductionHealthCheck & {
          status: Exclude<ProductionHealthStatus, "green">;
        } => item.status !== "green",
      )
      .map((item) => ({ section, item })),
  );

  const ordered = ["red", "yellow"].flatMap((status) =>
    pending.filter(({ item }) => item.status === status),
  );

  return ordered.slice(0, Math.max(0, limit)).map(({ section, item }) => ({
    id: `${section.id}:${item.id}`,
    label: item.label,
    message: item.message,
    status: item.status,
    ...destinationFor(section, item),
  }));
}
