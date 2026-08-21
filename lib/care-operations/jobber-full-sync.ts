import "server-only";

import { getFreshJobberAccessToken } from "./jobber-connection-store";
import {
  syncAllJobberClients,
  type JobberClientSyncResult,
} from "./jobber-customer-matching";
import {
  syncAllJobberVisits,
  type JobberVisitSyncResult,
} from "./jobber-visit-sync";
import {
  reconcileStrictExactJobberCustomerLinks,
  type JobberAutoLinkSummary,
} from "./jobber-customer-auto-linking";

export interface JobberFullSyncResult {
  executionMode: "projection_sync_with_safe_linking";
  clients: JobberClientSyncResult;
  visits: JobberVisitSyncResult;
  autoLinking: JobberAutoLinkSummary;
  completedAt: string;
}

export async function syncAllJobberData(): Promise<JobberFullSyncResult> {
  const accessToken = await getFreshJobberAccessToken();
  const clients = await syncAllJobberClients(accessToken);
  const visits = await syncAllJobberVisits(accessToken);
  const autoLinking = await reconcileStrictExactJobberCustomerLinks();
  return {
    executionMode: "projection_sync_with_safe_linking",
    clients,
    visits,
    autoLinking,
    completedAt: new Date().toISOString(),
  };
}
