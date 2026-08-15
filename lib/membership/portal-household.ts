import type { MembershipStatus } from "@/lib/persistence/types/membership";

export interface PortalHouseholdProperty {
  membershipId: string;
  propertyId: string;
  name: string;
  address: string;
  planName: string;
  status: MembershipStatus;
  href: string;
  current: boolean;
}

export interface PortalHouseholdSnapshot {
  properties: PortalHouseholdProperty[];
  truncated: boolean;
}
