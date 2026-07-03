export interface AdminStats {
  totalHomeowners: number;
  totalProperties: number;
  activeMembers: number;
  homeCarePlansCreated: number;
  pendingRequests: number;
  signedAgreements: number;
  estimatedMrr: number;
  upcomingVisits: number;
  photosDocumentsStored: number;
  averageHomeCareScore: number;
}

export interface AdminRecentPlan {
  id: string;
  homeownerName: string;
  propertyName: string;
  membershipRecommendation: string;
  createdAt: string;
  status: string;
  href: string;
  source: "supabase" | "mock";
}

export interface AdminIncomingRequest {
  id: string;
  name: string;
  phone: string;
  serviceAddress: string;
  services: string[];
  submittedAt: string;
  status: "new" | "contacted" | "scheduled";
  source: "mock";
}

export interface AdminMembershipOverview {
  active: number;
  pending: number;
  canceled: number;
  estimatedMrr: number;
  popularTier: string;
  source: "supabase" | "mock" | "mixed";
}

export interface AdminPropertyIntel {
  topProperties: Array<{
    name: string;
    homeowner: string;
    score: number;
    href: string;
  }>;
  averageScore: number;
  needsAttention: Array<{
    name: string;
    reason: string;
    href: string;
  }>;
  timelineDepth: number;
  source: "supabase" | "mock" | "mixed";
}

export interface AdminFounderNotes {
  todaysFocus: string;
  followUps: string;
  customersToCall: string;
}

export interface AdminOverview {
  stats: AdminStats;
  recentPlans: AdminRecentPlan[];
  incomingRequests: AdminIncomingRequest[];
  membership: AdminMembershipOverview;
  propertyIntel: AdminPropertyIntel;
  dataSources: {
    stats: "supabase" | "mock" | "mixed";
    plans: "supabase" | "mock" | "mixed";
    requests: "mock";
    membership: "supabase" | "mock" | "mixed";
    propertyIntel: "supabase" | "mock" | "mixed";
  };
  supabaseConnected: boolean;
  privateBeta: boolean;
}
