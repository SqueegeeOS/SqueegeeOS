export const HOSTED_MEMBERSHIP_SETUP_OPERATION = "membership_hosted_setup";

export interface HostedMembershipSetupBinding {
  handoffId: string;
  membershipId: string;
  presentationId: string;
  agreementId: string;
  homeownerId: string;
  propertyId: string;
  billingTermsHash: string;
}

export function buildHostedMembershipSetupMetadata(
  binding: HostedMembershipSetupBinding,
): Record<string, string> {
  return {
    homeatlas_operation: HOSTED_MEMBERSHIP_SETUP_OPERATION,
    homeatlas_handoff_id: binding.handoffId,
    membership_id: binding.membershipId,
    presentation_id: binding.presentationId,
    agreement_id: binding.agreementId,
    homeowner_id: binding.homeownerId,
    property_id: binding.propertyId,
    billing_terms_hash: binding.billingTermsHash,
  };
}

export function hostedMembershipSetupBindingIssues(
  metadata: Record<string, string> | null | undefined,
  expected: HostedMembershipSetupBinding,
): string[] {
  const actual = metadata ?? {};
  const expectedMetadata = buildHostedMembershipSetupMetadata(expected);
  return Object.entries(expectedMetadata)
    .filter(([key, value]) => actual[key] !== value)
    .map(([key]) => `${key}_mismatch`);
}
