export type PersistedPropertyType =
  | "Residence"
  | "Commercial"
  | "Vacation"
  | "Rental";

export type PersistedPropertyHealthStatus =
  | "Excellent"
  | "Well Maintained"
  | "Needs Attention"
  | "Under Review";

/** Persisted property — maps to `properties` table in Supabase */
export interface PersistedProperty {
  id: string;
  homeownerId: string;
  slug: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  type: PersistedPropertyType;
  heroImage: string | null;
  homeCareScore: number | null;
  healthStatus: PersistedPropertyHealthStatus | null;
  yearBuilt: number | null;
  squareFeet: number | null;
  narrative: string | null;
  lastVisit: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PersistedPropertyInput = Omit<
  PersistedProperty,
  "id" | "createdAt" | "updatedAt"
> & {
  id?: string;
};
