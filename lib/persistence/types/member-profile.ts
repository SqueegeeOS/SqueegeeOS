export type MembershipTier = "standard" | "premium" | "elite";

export type AppointmentStatus =
  | "scheduled"
  | "completed"
  | "cancelled"
  | "no_show";

/** Maps to `member_profiles` */
export interface PersistedMemberProfile {
  id: string;
  homeownerId: string;
  membershipTier: MembershipTier;
  /** Lifetime member savings in cents */
  totalSavedCents: number;
  preferredServices: string[];
  preferences: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type PersistedMemberProfileInput = Omit<
  PersistedMemberProfile,
  "id" | "createdAt" | "updatedAt"
> & {
  id?: string;
};

/** Maps to `member_savings_transactions` */
export interface PersistedMemberSavingsTransaction {
  id: string;
  memberProfileId: string;
  propertyId: string | null;
  appointmentId: string | null;
  serviceType: string;
  regularPriceCents: number;
  memberPriceCents: number;
  savedCents: number;
  occurredAt: string;
  notes: string | null;
  createdAt: string;
}

export type PersistedMemberSavingsTransactionInput = Omit<
  PersistedMemberSavingsTransaction,
  "id" | "createdAt"
> & {
  id?: string;
};

/** Maps to `member_appointments` */
export interface PersistedMemberAppointment {
  id: string;
  memberProfileId: string;
  propertyId: string;
  serviceType: string;
  scheduledAt: string;
  status: AppointmentStatus;
  technicianName: string | null;
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PersistedMemberAppointmentInput = Omit<
  PersistedMemberAppointment,
  "id" | "createdAt" | "updatedAt"
> & {
  id?: string;
};
