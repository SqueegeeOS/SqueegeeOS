import { describe, expect, it } from "vitest";
import {
  buildHostedMembershipSetupMetadata,
  hostedMembershipSetupBindingIssues,
  type HostedMembershipSetupBinding,
} from "./hosted-payment-handoff-contract";

const binding: HostedMembershipSetupBinding = {
  handoffId: "handoff-1",
  membershipId: "membership-1",
  presentationId: "presentation-1",
  agreementId: "agreement-1",
  homeownerId: "homeowner-1",
  propertyId: "property-1",
  billingTermsHash: "a".repeat(64),
};

describe("hosted membership setup binding", () => {
  it("binds Stripe to the complete signed customer graph", () => {
    expect(buildHostedMembershipSetupMetadata(binding)).toEqual({
      homeatlas_operation: "membership_hosted_setup",
      homeatlas_handoff_id: "handoff-1",
      membership_id: "membership-1",
      presentation_id: "presentation-1",
      agreement_id: "agreement-1",
      homeowner_id: "homeowner-1",
      property_id: "property-1",
      billing_terms_hash: "a".repeat(64),
    });
  });

  it("fails closed when any signed authority binding drifts", () => {
    const metadata = buildHostedMembershipSetupMetadata(binding);
    expect(
      hostedMembershipSetupBindingIssues(
        { ...metadata, agreement_id: "another-agreement" },
        binding,
      ),
    ).toEqual(["agreement_id_mismatch"]);
  });
});
