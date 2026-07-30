export type AtlasPulseStageId =
  | "lead"
  | "presentation"
  | "agreement"
  | "payment"
  | "email"
  | "portal"
  | "jobber"
  | "scheduled";

export type AtlasPulseStageStatus = "complete" | "attention" | "waiting";

export interface AtlasPulseStage {
  id: AtlasPulseStageId;
  label: string;
  status: AtlasPulseStageStatus;
  detail: string;
}

export type AtlasPulseActionKind =
  | "resend_welcome"
  | "copy_portal"
  | "set_manual_completion"
  | "open_link"
  | "open_jobber"
  | "pair_jobber";

export interface AtlasPulseAction {
  id: string;
  kind: AtlasPulseActionKind;
  label: string;
  href?: string;
  membershipId?: string;
  portalUrl?: string;
  completed?: boolean;
  primary?: boolean;
}

export interface AtlasPulseManualCompletion {
  emailComplete: boolean;
  emailConfirmedAt: string | null;
  portalComplete: boolean;
  portalConfirmedAt: string | null;
}

export type AtlasPulseOpportunityId =
  | "interior_cleaning"
  | "screen_cleaning"
  | "gutter_care"
  | "solar_panel_care"
  | "pressure_washing";

export interface AtlasPulseOpportunity {
  id: AtlasPulseOpportunityId;
  label: string;
  reason: string;
  priceLabel: string;
  amount: number | null;
}

export interface AtlasPulseCustomer {
  recordKey: string;
  source: "membership" | "presentation" | "lead";
  homeownerId: string | null;
  membershipId: string | null;
  presentationId: string | null;
  leadId: string | null;
  homeownerName: string;
  email: string | null;
  phone: string | null;
  propertyLabel: string;
  planType: string;
  yearlyValue: number | null;
  stages: AtlasPulseStage[];
  completionPercent: number;
  exceptionCodes: string[];
  nextActionLabel: string;
  actions: AtlasPulseAction[];
  portalUrl: string | null;
  welcomeDeliveryStatus: string | null;
  welcomeDeliveryAt: string | null;
  manualCompletion: AtlasPulseManualCompletion;
  jobber: {
    linked: boolean;
    externalClientId: string | null;
    clientName: string | null;
    webUri: string | null;
    suggestedMatch: AtlasPulseMatchSuggestion | null;
  };
  nextServiceLabel: string | null;
  opportunities: AtlasPulseOpportunity[];
  updatedAt: string | null;
}

export type AtlasPulseConfidence = "high" | "likely" | "possible";

export interface AtlasPulseMatchSuggestion {
  externalClientId: string;
  jobberName: string;
  homeownerId: string;
  homeownerName: string;
  confidence: AtlasPulseConfidence;
  score: number;
  reasons: string[];
}

export type AtlasPulseIntegrationStatus = "healthy" | "attention" | "offline";

export interface AtlasPulseIntegration {
  id: "supabase" | "jobber" | "stripe" | "resend" | "reviews" | "deployment";
  label: string;
  status: AtlasPulseIntegrationStatus;
  message: string;
  detail?: string | null;
}

export interface AtlasPulseDashboard {
  connected: boolean;
  loadedAt: string;
  summary: {
    totalJourneys: number;
    completedJourneys: number;
    needsAttention: number;
    unpairedJobber: number;
    unscheduledMembers: number;
    revenueRadar: number;
  };
  customers: AtlasPulseCustomer[];
  matchSuggestions: AtlasPulseMatchSuggestion[];
  integrations: AtlasPulseIntegration[];
  dataNotes: string[];
}

export interface AtlasPulseUniversalSearchResult {
  search: string;
  homeAtlas: Array<{
    homeownerId: string;
    name: string;
    email: string | null;
    phone: string | null;
    properties: string[];
  }>;
  jobber: Array<{
    externalClientId: string;
    name: string;
    email: string | null;
    phone: string | null;
    webUri: string;
    linkedHomeownerName: string | null;
  }>;
}
