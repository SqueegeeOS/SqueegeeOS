import { describe, expect, it } from "vitest";
import {
  evaluateStrictExactCustomerLinks,
  homeAtlasAddressKey,
  jobberAddressKey,
  normalizeEmail,
  normalizePhone,
  normalizeStreet,
  type StrictAutoLinkInput,
} from "./jobber-customer-auto-linking";

function fixture(): StrictAutoLinkInput {
  return {
    clients: [
      {
        external_client_id: "jobber-client-1",
        email: "ADA@EXAMPLE.COM",
        phone: "(530) 555-0100",
        is_archived: false,
        properties: [
          {
            id: "jobber-property-1",
            address: {
              street: "123 Canyon Street",
              city: "Chico",
              province: "California",
              postalCode: "95928-1234",
            },
          },
        ],
        property_count: 1,
        properties_complete: true,
      },
    ],
    homeowners: [
      {
        id: "homeowner-1",
        email: "ada@example.com",
        phone: "5305550100",
      },
    ],
    properties: [
      {
        id: "property-1",
        homeowner_id: "homeowner-1",
        address: "123 Canyon St.",
        city: "Chico",
        state: "CA",
        zip: "95928",
      },
    ],
    memberships: [
      {
        id: "membership-1",
        homeowner_id: "homeowner-1",
        property_id: "property-1",
        status: "active",
        payment_setup_completed_at: "2026-08-01T00:00:00.000Z",
        stripe_payment_method_id: "pm_safe",
        stripe_customer_id: "cus_safe",
        agreement_id: "agreement-1",
        sales_tier: "biannual",
        visit_price: 250,
      },
    ],
    customerLinks: [],
    propertyLinks: [],
  };
}

describe("strict exact Jobber customer auto-linking", () => {
  it("normalizes only bounded exact identity and address formats", () => {
    expect(normalizeEmail(" ADA@Example.com ")).toBe("ada@example.com");
    expect(normalizePhone("+1 (530) 555-0100")).toBe("5305550100");
    expect(normalizeStreet("123 Canyon Street")).toBe("123 canyon st");
    expect(
      jobberAddressKey(fixture().clients[0].properties![0].address),
    ).toBe(homeAtlasAddressKey(fixture().properties[0]));
  });

  it("links on one unique exact address plus exact email and phone", () => {
    expect(evaluateStrictExactCustomerLinks(fixture())[0]).toMatchObject({
      outcome: "link",
      homeownerId: "homeowner-1",
      propertyId: "property-1",
      membershipId: "membership-1",
      matchedBy: ["email", "phone"],
    });
  });

  it("allows one unique exact contact signal when the other is absent", () => {
    const input = fixture();
    input.clients[0].phone = null;
    expect(evaluateStrictExactCustomerLinks(input)[0]).toMatchObject({
      outcome: "link",
      matchedBy: ["email"],
    });
  });

  it("never links from a name or missing address", () => {
    const input = fixture();
    input.clients[0].properties![0].address = null;
    expect(evaluateStrictExactCustomerLinks(input)[0]).toMatchObject({
      outcome: "insufficient_evidence",
      reason: "Complete Jobber property address unavailable",
    });
  });

  it("blocks multiple properties on either side", () => {
    const jobber = fixture();
    jobber.clients[0].property_count = 2;
    expect(evaluateStrictExactCustomerLinks(jobber)[0].outcome).toBe("manual_review");

    const homeAtlas = fixture();
    homeAtlas.properties.push({
      ...homeAtlas.properties[0],
      id: "property-2",
      address: "456 Other Road",
    });
    expect(evaluateStrictExactCustomerLinks(homeAtlas)[0].outcome).toBe("manual_review");
  });

  it("blocks duplicate address and contact evidence", () => {
    const duplicateAddress = fixture();
    duplicateAddress.properties.push({
      ...duplicateAddress.properties[0],
      id: "property-2",
      homeowner_id: "homeowner-2",
    });
    duplicateAddress.homeowners.push({
      id: "homeowner-2",
      email: "other@example.com",
      phone: "5305550199",
    });
    expect(evaluateStrictExactCustomerLinks(duplicateAddress)[0].outcome).toBe("manual_review");

    const duplicateContact = fixture();
    duplicateContact.homeowners.push({
      id: "homeowner-2",
      email: "ada@example.com",
      phone: null,
    });
    expect(evaluateStrictExactCustomerLinks(duplicateContact)[0]).toMatchObject({
      outcome: "link",
      matchedBy: ["phone"],
    });
    duplicateContact.homeowners[1].phone = "5305550100";
    expect(evaluateStrictExactCustomerLinks(duplicateContact)[0].outcome).toBe(
      "insufficient_evidence",
    );
  });

  it("treats any comparable contact mismatch as a hard conflict", () => {
    const emailConflict = fixture();
    emailConflict.homeowners[0].email = "different@example.com";
    expect(evaluateStrictExactCustomerLinks(emailConflict)[0]).toMatchObject({
      outcome: "conflict",
      reason: "Comparable email values conflict",
    });

    const phoneConflict = fixture();
    phoneConflict.homeowners[0].phone = "5305550199";
    expect(evaluateStrictExactCustomerLinks(phoneConflict)[0]).toMatchObject({
      outcome: "conflict",
      reason: "Comparable phone values conflict",
    });
  });

  it("respects customer and property revocations", () => {
    const customer = fixture();
    customer.customerLinks.push({
      external_client_id: "jobber-client-1",
      homeowner_id: "homeowner-1",
      link_state: "revoked",
    });
    expect(evaluateStrictExactCustomerLinks(customer)[0].outcome).toBe(
      "revocation_respected",
    );

    const property = fixture();
    property.propertyLinks.push({
      external_property_id: "jobber-property-1",
      property_id: "property-1",
      membership_id: "membership-1",
      link_state: "revoked",
    });
    expect(evaluateStrictExactCustomerLinks(property)[0].outcome).toBe(
      "revocation_respected",
    );
  });

  it("blocks existing one-to-one link conflicts", () => {
    const input = fixture();
    input.customerLinks.push({
      external_client_id: "different-jobber-client",
      homeowner_id: "homeowner-1",
      link_state: "active",
    });
    expect(evaluateStrictExactCustomerLinks(input)[0].outcome).toBe("conflict");
  });

  it("skips archived clients and requires a genuinely active membership", () => {
    const archived = fixture();
    archived.clients[0].is_archived = true;
    expect(evaluateStrictExactCustomerLinks(archived)[0].outcome).toBe("archived");

    const inactive = fixture();
    inactive.memberships[0].payment_setup_completed_at = null;
    expect(evaluateStrictExactCustomerLinks(inactive)[0].outcome).toBe(
      "insufficient_evidence",
    );
  });

  it("is idempotent when an active link already exists", () => {
    const input = fixture();
    input.customerLinks.push({
      external_client_id: "jobber-client-1",
      homeowner_id: "homeowner-1",
      link_state: "active",
    });
    expect(evaluateStrictExactCustomerLinks(input)[0]).toMatchObject({
      outcome: "already_linked",
      homeownerId: "homeowner-1",
    });
  });
});
