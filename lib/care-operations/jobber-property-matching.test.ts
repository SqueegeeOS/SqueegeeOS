import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  JobberClientProviderError,
  type JobberPropertyOwnershipEvidence,
} from "./jobber-client-search-provider";
import {
  classifyJobberProperty,
  isEligibleMemberProperty,
  isEligibleSignedMemberProperty,
  linkSearchedJobberClientProperty,
  persistJobberMemberPropertySearchLink,
} from "./jobber-property-matching";

const activeMembership = {
  id: "membership-1",
  homeowner_id: "homeowner-1",
  property_id: "property-1",
  status: "active",
  payment_setup_completed_at: "2026-07-12T20:00:00.000Z",
  stripe_payment_method_id: "pm_test",
  stripe_customer_id: "cus_test",
  agreement_id: "agreement-1",
  sales_tier: "quarterly",
  visit_price: 225,
};

const ownershipEvidence: JobberPropertyOwnershipEvidence = {
  clientId: "client-1",
  externalPropertyId: "property-owned",
  jobberPropertyWebUri:
    "https://secure.getjobber.com/properties/property-owned",
  observedGraphqlVersion: "2025-04-16",
  observedAt: "2026-07-18T12:34:56.000Z",
  pagesScanned: 2,
  propertyCoverageComplete: true,
};

describe("supervised Jobber property classification", () => {
  it("treats every unlinked or revoked property as Jobber-only", () => {
    expect(classifyJobberProperty(null, false)).toBe("jobber_only");
    expect(classifyJobberProperty("revoked", true)).toBe("jobber_only");
  });

  it("recognizes a member property only through an active explicit link", () => {
    expect(classifyJobberProperty("active", true)).toBe(
      "homeatlas_member_property",
    );
    expect(classifyJobberProperty("active", false)).toBe("link_attention");
  });

  it("requires the canonical active membership and exact property owner", () => {
    expect(
      isEligibleMemberProperty(activeMembership, {
        id: "property-1",
        homeowner_id: "homeowner-1",
      }),
    ).toBe(true);
    expect(
      isEligibleMemberProperty(
        { ...activeMembership, status: "paused" },
        { id: "property-1", homeowner_id: "homeowner-1" },
      ),
    ).toBe(false);
    expect(
      isEligibleMemberProperty(activeMembership, {
        id: "property-1",
        homeowner_id: "someone-else",
      }),
    ).toBe(false);
  });

  it("requires a completed agreement bound to the same membership and property", () => {
    const property = { id: "property-1", homeowner_id: "homeowner-1" };
    const agreement = {
      id: "agreement-1",
      membership_id: "membership-1",
      property_id: "property-1",
      homeowner_id: "homeowner-1",
      status: "complete",
    };
    expect(
      isEligibleSignedMemberProperty(activeMembership, property, agreement),
    ).toBe(true);
    expect(
      isEligibleSignedMemberProperty(activeMembership, property, {
        ...agreement,
        status: "voided",
      }),
    ).toBe(false);
    expect(
      isEligibleSignedMemberProperty(activeMembership, property, {
        ...agreement,
        property_id: "another-property",
      }),
    ).toBe(false);
  });

  it("keeps database guardrails explicit and append-only", () => {
    const sql = readFileSync(
      new URL(
        "../persistence/supabase/migrations/034_jobber_supervised_property_links.sql",
        import.meta.url,
      ),
      "utf8",
    );
    expect(sql).toContain("No row means Jobber-only");
    expect(sql).toContain("jobber_property_links_membership_property_fkey");
    expect(sql).toContain("strictly active HomeAtlas membership");
    expect(sql).toContain("must be revoked, never deleted");
    expect(sql).toContain("append-only and immutable");
    expect(sql).toContain(
      "alter table public.jobber_property_links enable row level security",
    );
  });

  it("does not turn property matching into appointment, obligation, or billing writes", () => {
    const service = readFileSync(
      new URL("./jobber-property-matching.ts", import.meta.url),
      "utf8",
    );
    expect(service).not.toContain('.from("member_appointments")');
    expect(service).not.toContain('.from("obligations")');
    expect(service).not.toContain('.from("billing_orders")');
    expect(service).not.toMatch(/\bmutation\b/i);
  });

  it("keeps the client-search link path independent of visit and money systems", () => {
    const workflow = linkSearchedJobberClientProperty.toString();
    expect(workflow).not.toMatch(
      /projection|visit|appointment|obligation|pricing|billing|stripe|property.?memory|mutation/i,
    );
  });

  it("re-proves client ownership and refuses an arbitrary external property ID", async () => {
    const persistLink = vi.fn();
    const proveOwnership = vi.fn().mockRejectedValue(
      new JobberClientProviderError(
        "property_not_owned",
        "Jobber property did not belong to the selected client",
      ),
    );
    await expect(
      linkSearchedJobberClientProperty(
        {
          clientId: "client-1",
          externalPropertyId: "property-arbitrary",
          membershipId: "00000000-0000-4000-8000-000000000341",
          actorId: "00000000-0000-4000-8000-000000000342",
          samePhysicalPropertyConfirmed: true,
        },
        {
          getAccessToken: vi.fn().mockResolvedValue("fresh-token"),
          proveOwnership,
          persistLink,
        },
      ),
    ).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("does not belong"),
    });
    expect(proveOwnership).toHaveBeenCalledWith(
      "fresh-token",
      "client-1",
      "property-arbitrary",
    );
    expect(persistLink).not.toHaveBeenCalled();
  });

  it("links only after current Jobber ownership proof and passes atomic evidence", async () => {
    const proveOwnership = vi.fn().mockResolvedValue(ownershipEvidence);
    const persistLink = vi.fn().mockResolvedValue("linked");
    const outcome = await linkSearchedJobberClientProperty(
      {
        clientId: "client-1",
        externalPropertyId: "property-owned",
        membershipId: "00000000-0000-4000-8000-000000000341",
        actorId: "00000000-0000-4000-8000-000000000342",
        samePhysicalPropertyConfirmed: true,
      },
      {
        getAccessToken: vi.fn().mockResolvedValue("fresh-token"),
        proveOwnership,
        persistLink,
      },
    );
    expect(outcome).toBe("linked");
    expect(proveOwnership).toHaveBeenCalledWith(
      "fresh-token",
      "client-1",
      "property-owned",
    );
    expect(persistLink).toHaveBeenCalledWith({
      ownership: ownershipEvidence,
      membershipId: "00000000-0000-4000-8000-000000000341",
      actorId: "00000000-0000-4000-8000-000000000342",
      samePhysicalPropertyConfirmed: true,
    });
  });

  it.each(["linked", "already_linked"] as const)(
    "maps the atomic RPC %s result and sends complete evidence",
    async (outcome) => {
      const rpc = vi.fn().mockResolvedValue({
        data: { outcome, link_id: "link-1" },
        error: null,
      });

      await expect(
        persistJobberMemberPropertySearchLink(
          {
            ownership: ownershipEvidence,
            membershipId: "00000000-0000-4000-8000-000000000341",
            actorId: "00000000-0000-4000-8000-000000000342",
            samePhysicalPropertyConfirmed: true,
          },
          { rpc },
        ),
      ).resolves.toBe(outcome);
      expect(rpc).toHaveBeenCalledWith(
        "link_jobber_member_property_from_search",
        {
          requested_actor_id: "00000000-0000-4000-8000-000000000342",
          requested_connection_id: "squeegeeking",
          requested_jobber_client_id: "client-1",
          requested_external_property_id: "property-owned",
          requested_jobber_property_web_uri:
            "https://secure.getjobber.com/properties/property-owned",
          requested_graphql_version: "2025-04-16",
          requested_ownership_observed_at: "2026-07-18T12:34:56.000Z",
          requested_ownership_pages_scanned: 2,
          requested_property_coverage_complete: true,
          requested_membership_id:
            "00000000-0000-4000-8000-000000000341",
          requested_same_physical_property_confirmed: true,
        },
      );
    },
  );

  it.each([
    ["jobber_link_forbidden: actor inactive", 403],
    ["jobber_link_conflict: active link differs", 409],
    ["jobber_link_invalid: evidence missing", 400],
  ] as const)(
    "maps %s atomic RPC failures to HTTP %i",
    async (message, status) => {
      const rpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message },
      });

      await expect(
        persistJobberMemberPropertySearchLink(
          {
            ownership: ownershipEvidence,
            membershipId: "00000000-0000-4000-8000-000000000341",
            actorId: "00000000-0000-4000-8000-000000000342",
            samePhysicalPropertyConfirmed: true,
          },
          { rpc },
        ),
      ).rejects.toMatchObject({ status });
    },
  );
});
