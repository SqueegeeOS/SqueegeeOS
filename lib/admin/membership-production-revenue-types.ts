export interface MembershipProductionSigning {
  membershipId: string;
  propertyId: string;
  customerName: string;
  propertyAddress: string;
  tier: "biannual" | "quarterly" | "unknown";
  visitPrice: number | null;
  yearlyValue: number | null;
  signedAt: string;
  cardOnFile: boolean;
}

export interface MembershipProductionRevenueOverview {
  /** Memberships with a signed agreement whose signed_at falls on today (UTC). */
  membersSignedToday: number;
  /** Same, current UTC calendar month. */
  membersSignedThisMonth: number;
  /** Non-cancelled members with card on file (Stripe PM or payment setup completed). */
  cardOnFileCount: number;
  /** Non-cancelled members on book with a signed agreement. */
  membersOnBook: number;
  /** Sum of yearly value for on-book members with card on file. */
  activeMembershipValue: number;
  /** Sum of yearly value for all on-book members (signed agreement, not cancelled). */
  expectedYearlyMembershipRevenue: number;
  /** Completed/paid add-on charges from member_addon_transactions. */
  addonRevenueCollected: number;
  /** Expected yearly membership revenue + collected add-on revenue (no visit cash double-count). */
  totalCustomerRevenue: number;
  recentSignings: MembershipProductionSigning[];
  source: "supabase" | "unavailable";
}
