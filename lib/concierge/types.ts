import type { AdminDashboardData } from "@/lib/admin/closed-jobs-types";
import type { CurrentMission } from "@/lib/admin/current-mission";
import type { OperatingContext } from "@/lib/admin/growth-journey";

export type ConciergeInsightCategory =
  | "revenue"
  | "arr"
  | "reputation"
  | "operations"
  | "membership"
  | "platform";

export interface ConciergeInsight {
  id: string;
  category: ConciergeInsightCategory;
  title: string;
  body: string;
  priority: number;
}

export interface GoogleReviewsBriefSnapshot {
  connected: boolean;
  totalCount: number;
  averageRating: number;
}

export interface MorningBriefInput {
  operatingContext: OperatingContext;
  dashboard: AdminDashboardData;
  googleReviews: GoogleReviewsBriefSnapshot | null;
  missions: CurrentMission[];
}

export interface MorningBrief {
  /** ISO timestamp when the brief was generated */
  generatedAt: string;
  insights: ConciergeInsight[];
  /** Shown when there is not enough real data for rule-based insights */
  fallbackMessage: string | null;
  hasEnoughData: boolean;
}

/** Future AI layer can extend this without changing rule contracts */
export interface ConciergeProvider {
  id: "rules" | "openai";
  buildMorningBrief(input: MorningBriefInput): MorningBrief;
}

export const MORNING_BRIEF_FALLBACK_MESSAGE =
  "Log more jobs and memberships to unlock smarter recommendations.";

export const MORNING_BRIEF_MAX_INSIGHTS = 5;
export const MORNING_BRIEF_MIN_INSIGHTS = 3;
