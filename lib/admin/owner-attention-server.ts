import "server-only";

import { listLeadIntakes } from "@/lib/acquisition/leads/repository";
import { loadBillingWorkspace } from "@/lib/admin/billing-workspace-server";
import { loadOwnerLeverageSnapshot } from "@/lib/admin/owner-leverage-server";
import { loadCustomerAftercareSnapshot } from "@/lib/aftercare/customer-aftercare-server";
import {
  buildOwnerAttentionQueue,
  type OwnerAttentionResponse,
  type OwnerAttentionSourceResult,
} from "@/lib/admin/owner-attention";
import { runProductionHealthReport } from "@/lib/admin/production-health-server";
import { loadJobberTodayBoard } from "@/lib/care-operations/jobber-today";
import { loadCommunicationsLaunchReadiness } from "@/lib/communications/integration-launch-readiness";
import { loadTechnicianReadinessSnapshot } from "@/lib/field-operations/technician-readiness-server";
import { loadTechnicianCapacitySnapshot } from "@/lib/field-operations/technician-capacity-server";
import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import { isSupabaseConfigured } from "@/lib/persistence/supabase/client";
import { DAVID_REP_PROFILE } from "@/lib/sales/rep-config";
import { loadReferralAttentionSnapshot } from "@/lib/referrals/attention-server";
import { loadSalesRetentionAttentionSnapshot } from "@/lib/sales/attribution-lifecycle-server";
import {
  loadSalesLeadAttentionSnapshot,
  loadSalesProductionHandoffAttentionSnapshot,
} from "@/lib/sales/workspace-server";

async function captureSource<T>(input: {
  id: string;
  unavailableDetail: string;
  load: () => Promise<T>;
}): Promise<OwnerAttentionSourceResult<T>> {
  try {
    return { state: "ready", data: await input.load() };
  } catch (error) {
    console.error(`[owner-attention] ${input.id} source failed`, error);
    return { state: "degraded", detail: input.unavailableDetail };
  }
}

export async function loadOwnerAttentionQueue(
  reference = new Date(),
): Promise<OwnerAttentionResponse> {
  const [
    customerLeads,
    davidPipeline,
    salesHandoffs,
    salesRetention,
    today,
    ownerLeverage,
    technicianReadiness,
    technicianCapacity,
    billing,
    communications,
    aftercare,
    referrals,
    productionHealth,
  ] = await Promise.all([
    captureSource({
      id: "customer_leads",
      unavailableDetail: "Atlas could not read the customer request inbox.",
      load: () => {
        if (!isCloudPersistenceConnected()) {
          throw new Error("Cloud persistence is not connected.");
        }
        return listLeadIntakes();
      },
    }),
    captureSource({
      id: "david_pipeline",
      unavailableDetail: "Atlas could not read David’s open pipeline.",
      load: () =>
        loadSalesLeadAttentionSnapshot(DAVID_REP_PROFILE.slug, reference),
    }),
    captureSource({
      id: "sales_handoffs",
      unavailableDetail:
        "Atlas could not verify whether David’s signed members reached scheduled production.",
      load: () =>
        loadSalesProductionHandoffAttentionSnapshot(
          DAVID_REP_PROFILE.slug,
          reference,
        ),
    }),
    captureSource({
      id: "sales_retention",
      unavailableDetail: "Atlas could not verify salesperson retention state.",
      load: () => {
        if (!isSupabaseConfigured()) {
          throw new Error("Supabase is not configured.");
        }
        return loadSalesRetentionAttentionSnapshot(reference);
      },
    }),
    captureSource({
      id: "today",
      unavailableDetail: "Atlas could not verify today’s schedule and field proof.",
      load: () => loadJobberTodayBoard(reference),
    }),
    captureSource({
      id: "owner_leverage",
      unavailableDetail:
        "Atlas could not verify field independence and Growth Hours. Apply migration 061 before trusting the buyback ladder.",
      load: async () => {
        const snapshot = await loadOwnerLeverageSnapshot(reference);
        if (!snapshot.schemaAvailable) {
          throw new Error(snapshot.warnings[0] ?? "Owner leverage is unavailable.");
        }
        return snapshot;
      },
    }),
    captureSource({
      id: "technician_readiness",
      unavailableDetail:
        "Atlas could not verify technician readiness and independent-day evidence. Apply migrations 061 and 062 before trusting the first owner-free route.",
      load: async () => {
        const snapshot = await loadTechnicianReadinessSnapshot(reference);
        if (!snapshot.schemaAvailable) {
          throw new Error(
            snapshot.warnings[0] ?? "Technician readiness is unavailable.",
          );
        }
        return snapshot;
      },
    }),
    captureSource({
      id: "technician_capacity",
      unavailableDetail:
        "Atlas could not verify the four-week field capacity runway. Apply migration 063 and restore fresh Jobber schedule evidence before trusting open hours.",
      load: async () => {
        const snapshot = await loadTechnicianCapacitySnapshot(reference);
        if (!snapshot.schemaAvailable) {
          throw new Error(
            snapshot.warnings[0] ?? "Technician capacity is unavailable.",
          );
        }
        return snapshot;
      },
    }),
    captureSource({
      id: "billing",
      unavailableDetail: "Atlas could not verify the billing register.",
      load: () => {
        if (!isSupabaseConfigured()) {
          throw new Error("Supabase is not configured.");
        }
        return loadBillingWorkspace();
      },
    }),
    captureSource({
      id: "communications",
      unavailableDetail: "Atlas could not verify messaging and lead-ingestion readiness.",
      load: loadCommunicationsLaunchReadiness,
    }),
    captureSource({
      id: "aftercare",
      unavailableDetail: "Atlas could not verify customer aftercare opportunities.",
      load: () => loadCustomerAftercareSnapshot(reference),
    }),
    captureSource({
      id: "referrals",
      unavailableDetail: "Atlas could not verify referral and reward state.",
      load: () => loadReferralAttentionSnapshot(reference),
    }),
    captureSource({
      id: "production_health",
      unavailableDetail: "Atlas could not complete the production safeguard audit.",
      load: runProductionHealthReport,
    }),
  ]);

  return buildOwnerAttentionQueue({
    now: reference,
    customerLeads,
    davidPipeline,
    salesHandoffs,
    salesRetention,
    today,
    ownerLeverage,
    technicianReadiness,
    technicianCapacity,
    billing,
    communications,
    aftercare,
    referrals,
    productionHealth,
  });
}
