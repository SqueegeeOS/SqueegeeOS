import type { AssessmentAreaKey } from "./assessment-areas";

export type ScoreValue = 1 | 2 | 3 | 4 | 5 | null;

export type AssessmentType =
  | "window_service"
  | "care_package"
  | "custom"
  | "visit_note";

export interface RecommendedService {
  id: string;
  service: string;
  priority: "high" | "medium" | "low";
  note: string;
}

export interface AssessmentFormState {
  propertyId: string;
  visitId?: string;
  technicianName: string;
  visitDate: string;
  assessmentType: AssessmentType;
  activeAreas: AssessmentAreaKey[];
  scores: Partial<Record<AssessmentAreaKey, ScoreValue>>;
  naAreas: AssessmentAreaKey[];
  internalNote: string;
  customerNote: string;
  customerNoteVisible: boolean;
  proposalSummary: string;
  recommendedServices: RecommendedService[];
}

export interface PropertyAssessment {
  id: string;
  propertyId: string;
  visitId: string | null;
  assessmentType: AssessmentType;
  technicianName: string;
  visitDate: string;
  scores: Record<string, ScoreValue>;
  assessedAreas: AssessmentAreaKey[];
  naAreas: AssessmentAreaKey[];
  overallScore: number | null;
  internalNote: string | null;
  customerNote: string | null;
  customerNoteVisible: boolean;
  proposalSummary: string | null;
  recommendedServices: RecommendedService[];
  proposalSent: boolean;
  proposalSentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const SCORE_COLORS: Record<number, string> = {
  1: "#ef4444",
  2: "#f97316",
  3: "#eab308",
  4: "#84cc16",
  5: "#22c55e",
};

export function calculateAssessmentOverallScore(
  scores: Partial<Record<string, ScoreValue>>,
  activeAreas: string[],
  naAreas: string[],
): number | null {
  const scoreable = activeAreas.filter(
    (key) => !naAreas.includes(key) && scores[key] != null,
  );

  if (scoreable.length === 0) return null;

  const sum = scoreable.reduce(
    (acc, key) => acc + (scores[key] as number),
    0,
  );
  const avg = sum / scoreable.length;
  return Math.round((avg / 5) * 100 * 10) / 10;
}

export function scoreColor(score: number | null): string {
  if (score === null) return "#333";
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#84cc16";
  if (score >= 40) return "#eab308";
  if (score >= 20) return "#f97316";
  return "#ef4444";
}

export function parseScoreValue(value: unknown): ScoreValue {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < 1 || value > 5) return null;
  return value as ScoreValue;
}

export function assessmentTypeLabel(type: AssessmentType): string {
  switch (type) {
    case "window_service":
      return "Window Service";
    case "care_package":
      return "Care Package";
    case "custom":
      return "Custom";
    case "visit_note":
      return "Visit Note";
  }
}
