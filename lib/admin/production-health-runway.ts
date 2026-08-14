import type {
  ProductionHealthReport,
  ProductionHealthStatus,
} from "@/lib/admin/production-health-types";

interface ProductionReadinessLaneDefinition {
  id: "sell" | "serve" | "follow-up" | "collect";
  label: string;
  description: string;
  checkIds: readonly string[];
}

export interface ProductionReadinessLane
  extends ProductionReadinessLaneDefinition {
  status: ProductionHealthStatus;
  readyCheckCount: number;
  totalCheckCount: number;
}

export const PRODUCTION_READINESS_LANES = [
  {
    id: "sell",
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
    id: "serve",
    label: "Serve",
    description: "Today notes, private photos, follow-ups, and portal proof",
    checkIds: [
      "field-record-media-schema",
      "field-record-follow-up-schema",
      "storage-visit-media",
    ],
  },
  {
    id: "follow-up",
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
    id: "collect",
    label: "Collect",
    description: "Safe schedules, Stripe proof, and exceptions",
    checkIds: [
      "automation-scheduler",
      "billing-webhook",
      "automatic-billing",
      "billing-exceptions",
    ],
  },
] as const satisfies readonly ProductionReadinessLaneDefinition[];

function resolveLaneStatus(
  statuses: Array<ProductionHealthStatus | undefined>,
): ProductionHealthStatus {
  if (statuses.includes("red")) return "red";
  if (statuses.includes("yellow") || statuses.includes(undefined)) {
    return "yellow";
  }
  return "green";
}

export function buildProductionReadinessLanes(
  report: ProductionHealthReport,
): ProductionReadinessLane[] {
  const statusByCheckId = new Map<string, ProductionHealthStatus>();
  for (const section of report.sections) {
    for (const item of section.checks) {
      statusByCheckId.set(item.id, item.status);
    }
  }

  return PRODUCTION_READINESS_LANES.map((lane) => {
    const statuses = lane.checkIds.map((id) => statusByCheckId.get(id));
    return {
      ...lane,
      status: resolveLaneStatus(statuses),
      readyCheckCount: statuses.filter((status) => status === "green").length,
      totalCheckCount: lane.checkIds.length,
    };
  });
}
