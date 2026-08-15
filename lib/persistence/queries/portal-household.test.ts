import { afterEach, describe, expect, it, vi } from "vitest";
import type { PortalAccessContext } from "./portal-access";

let result: { data: unknown; error: { message: string } | null };
const eqSpy = vi.fn();
const inSpy = vi.fn();
const notSpy = vi.fn();

function queryBuilder() {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn((field: string, value: unknown) => {
    eqSpy(field, value);
    return builder;
  });
  builder.in = vi.fn((field: string, values: unknown[]) => {
    inSpy(field, values);
    return builder;
  });
  builder.not = vi.fn((field: string, operator: string, value: unknown) => {
    notSpy(field, operator, value);
    return builder;
  });
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.then = (
    onfulfilled?: ((value: unknown) => unknown) | null,
    onrejected?: ((reason: unknown) => unknown) | null,
  ) => Promise.resolve(result).then(onfulfilled, onrejected);
  return builder;
}

const fromSpy = vi.fn(() => queryBuilder());

vi.mock("@/lib/persistence/supabase/client", () => ({
  createPrivilegedServerSupabaseClient: vi.fn(() => ({ from: fromSpy })),
}));

const access: PortalAccessContext = {
  membershipId: "11111111-1111-4111-8111-111111111111",
  homeownerId: "22222222-2222-4222-8222-222222222222",
  propertyId: "33333333-3333-4333-8333-333333333333",
  memberName: "Mandi Rivera",
  homeownerSlug: "mandi-rivera",
  propertySlug: "davis-street",
  portalAccessToken: "current-token",
};

describe("portal household projection", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns only the homeowner-scoped current membership projection", async () => {
    result = {
      data: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          property_id: "55555555-5555-4555-8555-555555555555",
          plan_name: "Quarterly Care",
          status: "active",
          portal_access_token: "second-token",
          properties: {
            id: "55555555-5555-4555-8555-555555555555",
            name: "Canyon Oaks Home",
            address: "12 Canyon Oaks Drive",
            city: "Chico",
            state: "CA",
            zip: "95928",
          },
        },
        {
          id: access.membershipId,
          property_id: access.propertyId,
          plan_name: "Biannual Care",
          status: "active",
          portal_access_token: access.portalAccessToken,
          properties: [
            {
              id: access.propertyId,
              name: "Davis Street Residence",
              address: "1420 Davis Street",
              city: "Chico",
              state: "CA",
              zip: "95928-1234",
            },
          ],
        },
        {
          id: "66666666-6666-4666-8666-666666666666",
          property_id: "77777777-7777-4777-8777-777777777777",
          plan_name: "Quarterly Care",
          status: "active",
          portal_access_token: "mismatched-property-token",
          properties: {
            id: "88888888-8888-4888-8888-888888888888",
            name: "Mismatched row",
            address: "Unknown",
            city: "Chico",
            state: "CA",
            zip: "95928",
          },
        },
      ],
      error: null,
    };
    const { loadPortalHouseholdSnapshot } = await import("./portal-household");
    const snapshot = await loadPortalHouseholdSnapshot(access);

    expect(eqSpy).toHaveBeenCalledWith("homeowner_id", access.homeownerId);
    expect(inSpy).toHaveBeenCalledWith("status", [
      "pending_checkout",
      "pending_payment",
      "active",
      "paused",
    ]);
    expect(notSpy).toHaveBeenCalledWith("portal_access_token", "is", null);
    expect(snapshot).toEqual({
      truncated: false,
      properties: [
        expect.objectContaining({
          membershipId: access.membershipId,
          current: true,
          href: "/portal/current-token",
          address: "1420 Davis Street, Chico CA 95928-1234",
        }),
        expect.objectContaining({
          membershipId: "44444444-4444-4444-8444-444444444444",
          current: false,
          href: "/portal/second-token",
        }),
      ],
    });
  });

  it("fails closed when the household projection cannot be read", async () => {
    result = { data: null, error: { message: "household query failed" } };
    const { loadPortalHouseholdSnapshot } = await import("./portal-household");

    await expect(loadPortalHouseholdSnapshot(access)).rejects.toThrow(
      "household query failed",
    );
  });
});
