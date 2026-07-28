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

export interface JobberFullSyncResult {
  executionMode: "read_only_sync";
  clients: JobberClientSyncResult;
  visits: JobberVisitSyncResult;
  completedAt: string;
}

export async function syncAllJobberData(): Promise<JobberFullSyncResult> {
  const accessToken = await getFreshJobberAccessToken();
  const clients = await syncAllJobberClients(accessToken);
  const visits = await syncAllJobberVisits(accessToken);
  return {
    executionMode: "read_only_sync",
    clients,
    visits,
    completedAt: new Date().toISOString(),
  };
}
