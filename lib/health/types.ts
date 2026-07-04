// Atlas Home Memory — v1: collect, save, display.

export type HealthScore = 1 | 2 | 3 | 4 | 5;

export const HEALTH_SCORE_LABELS: Record<HealthScore, string> = {
  1: "Needs Attention",
  2: "Fair",
  3: "Good",
  4: "Very Good",
  5: "Excellent",
};

export const HEALTH_SCORE_COLORS: Record<HealthScore, string> = {
  1: "#ef4444",
  2: "#f97316",
  3: "#eab308",
  4: "#84cc16",
  5: "#22c55e",
};

export interface HealthScores {
  windowHealth: HealthScore | null;
  screenHealth: HealthScore | null;
  trackSillHealth: HealthScore | null;
  frameHealth: HealthScore | null;
  hardWaterRisk: HealthScore | null;
  debrisBuildup: HealthScore | null;
}

export const HEALTH_CATEGORY_LABELS: Record<keyof HealthScores, string> = {
  windowHealth: "Window Health",
  screenHealth: "Screen Health",
  trackSillHealth: "Track & Sill Health",
  frameHealth: "Frame Health",
  hardWaterRisk: "Hard Water Risk",
  debrisBuildup: "Debris & Cobweb Buildup",
};

export type NoteVisibility = "internal" | "customer";

export interface PropertyHealthCheck {
  id: string;
  propertyId: string;
  visitId: string | null;
  technicianName: string;
  visitDate: string;
  scores: HealthScores;
  overallScore: number | null;
  internalNote: string | null;
  customerNote: string | null;
  customerNoteVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HealthCheckFormState {
  propertyId: string;
  visitId?: string;
  technicianName: string;
  visitDate: string;
  scores: HealthScores;
  internalNote: string;
  customerNote: string;
  customerNoteVisible: boolean;
}

export interface CustomerHealthView {
  visitDate: string;
  overallScore: number | null;
  windowHealth: HealthScore | null;
  screenHealth: HealthScore | null;
  hardWaterRisk: HealthScore | null;
  customerNote: string | null;
}

export interface CustomerHealthNote {
  visitDate: string;
  customerNote: string;
}

export function calculateOverallScore(scores: HealthScores): number | null {
  const values = Object.values(scores).filter(
    (v): v is HealthScore => v !== null,
  );

  if (values.length === 0) return null;

  const average = values.reduce((sum, v) => sum + v, 0) / values.length;
  return Math.round((average / 5) * 100 * 10) / 10;
}

export function parseHealthScore(value: unknown): HealthScore | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < 1 || value > 5) return null;
  return value as HealthScore;
}

export function emptyHealthScores(): HealthScores {
  return {
    windowHealth: null,
    screenHealth: null,
    trackSillHealth: null,
    frameHealth: null,
    hardWaterRisk: null,
    debrisBuildup: null,
  };
}
