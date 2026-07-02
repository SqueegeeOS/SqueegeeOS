/** Persisted homeowner — maps to `homeowners` table in Supabase */
export interface PersistedHomeowner {
  id: string;
  slug: string;
  fullName: string;
  firstName: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PersistedHomeownerInput = Omit<
  PersistedHomeowner,
  "id" | "createdAt" | "updatedAt"
> & {
  id?: string;
};
