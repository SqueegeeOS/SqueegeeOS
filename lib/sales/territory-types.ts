export interface TerritoryCoordinate {
  latitude: number;
  longitude: number;
}

export interface TerritoryServiceProof {
  label: string;
  completedAt: string | null;
  jobNumber: number | null;
}

export interface TerritoryCustomerPin {
  propertyId: string;
  clientId: string;
  customerName: string;
  address: string;
  jobberWebUri: string;
  location: TerritoryCoordinate;
  completedVisitCount: number;
  lastCompletedAt: string | null;
  services: TerritoryServiceProof[];
}

export interface TerritoryMapCoverage {
  completedProperties: number;
  mappedProperties: number;
  pendingProperties: number;
  unmatchedAddresses: number;
  unmappableProperties: number;
}

export interface TerritoryMapPayload {
  executionMode: "private_jobber_proof_map";
  source: "jobber_completed_visits";
  repSlug: string;
  generatedAt: string;
  lastJobberObservedAt: string | null;
  coverage: TerritoryMapCoverage;
  pins: TerritoryCustomerPin[];
}

export interface TerritoryRefreshPayload extends TerritoryMapPayload {
  refresh: {
    jobberClientsObserved: number;
    jobberVisitsObserved: number;
    geocoded: number;
    unresolved: number;
    failed: number;
    remaining: number;
  };
}
