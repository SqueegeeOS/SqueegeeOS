export type ProductionHealthStatus = "green" | "yellow" | "red";

export interface ProductionHealthCheck {
  id: string;
  label: string;
  status: ProductionHealthStatus;
  message: string;
  detail?: string;
}

export interface ProductionHealthSection {
  id: string;
  title: string;
  status: ProductionHealthStatus;
  checks: ProductionHealthCheck[];
}

export interface ProductionHealthReport {
  onboardingSafe: ProductionHealthStatus;
  summary: string;
  sections: ProductionHealthSection[];
  checkedAt: string;
}
