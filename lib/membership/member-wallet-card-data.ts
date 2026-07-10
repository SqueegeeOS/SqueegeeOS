import type { MemberPortalData } from "@/lib/persistence/queries/member-portal";
import { PLATFORM_BRAND } from "@/lib/brand/platform";
import { isMembershipActive } from "@/lib/membership/membership-status";
import type { MemberPortalStatus } from "./member-portal-status";
import type { MemberMembershipView } from "./resolve-member-membership";

export interface MemberWalletCardData {
  brandName: string;
  memberName: string;
  tierLabel: string;
  addonDiscountLabel: string | null;
  addonDiscountPercent: number | null;
  memberSinceLabel: string;
  isActive: boolean;
}

export function isMemberMembershipActive(
  portalData?: MemberPortalData | null,
): boolean {
  if (!portalData) return false;
  return isMembershipActive({
    status: portalData.membershipStatus,
    payment_setup_completed_at: portalData.paymentSetupCompletedAt,
  });
}

function formatMemberSince(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function buildMemberWalletCardData(
  membership: MemberMembershipView,
  careStatus: MemberPortalStatus,
  options?: { isActive?: boolean },
): MemberWalletCardData {
  const discount = careStatus.addOnDiscountPercent;
  const addonDiscountLabel =
    discount != null ? `${discount}% off add-ons` : null;

  return {
    brandName: PLATFORM_BRAND.name,
    memberName: membership.memberName,
    tierLabel: `${careStatus.cadenceLabel} Member`,
    addonDiscountLabel,
    addonDiscountPercent: discount,
    memberSinceLabel: `Member since ${formatMemberSince(membership.memberSince)}`,
    isActive: options?.isActive ?? true,
  };
}
