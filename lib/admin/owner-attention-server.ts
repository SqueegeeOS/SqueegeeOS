import "server-only";

import { listLeadIntakes } from "@/lib/acquisition/leads/repository";
import { loadBillingWorkspace } from "@/lib/admin/billing-workspace-server";
import {
  buildOwnerAttentionQueue,
  type OwnerAttentionResponse,
  type OwnerAttentionSourceResult,
} from "@/lib/admin/owner-attention";
import { runProductionHealthReport } from "@/lib/admin/production-health-server";
import { loadJobberTodayBoard } from "@/lib/care-operations/jobber-today";
import { loadCommunicationsLaunchReadiness } from "@/lib/communications/integration-launch-readiness";
import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import { isSupabaseConfigured } from "@/lib/persistence/supabase/client";
import { DAVID_REP_PROFILE } from "@/lib/sales/rep-config";
import { loadSalesLeadAttentionSnapshot } from "@/lib/sales/workspace-server";

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
    today,
    billing,
    communications,
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
      id: "today",
      unavailableDetail: "Atlas could not verify today’s schedule and field proof.",
      load: () => loadJobberTodayBoard(reference),
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
      id: "production_health",
      unavailableDetail: "Atlas could not complete the production safeguard audit.",
      load: runProductionHealthReport,
    }),
  ]);

  return buildOwnerAttentionQueue({
    now: reference,
    customerLeads,
    davidPipeline,
    today,
    billing,
    communications,
    productionHealth,
  });
}
