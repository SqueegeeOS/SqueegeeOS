import { describe, expect, it, vi, beforeEach } from "vitest";
import { archiveMembership } from "./archive-membership";

const mockMaybeSingle = vi.fn();
const mockSelectAfterUpdate = vi.fn();
const mockUpdateEq = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockSyncAttributionLifecycle = vi.fn();

vi.mock("@/lib/persistence/config", () => ({
  isCloudPersistenceConnected: () => true,
}));

vi.mock("@/lib/persistence/supabase/client", () => ({
  createServerSupabaseClient: () => ({
    from: mockFrom,
  }),
}));

vi.mock("@/lib/sales/attribution-lifecycle-server", () => ({
  syncMembershipSalesAttributionLifecycle: (...args: unknown[]) =>
    mockSyncAttributionLifecycle(...args),
}));

describe("archiveMembership", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSyncAttributionLifecycle.mockResolvedValue({
      membershipId: "mem-1",
      attributionId: null,
      status: "not_attributed",
      changed: false,
      leadMarkedWon: false,
    });

    mockMaybeSingle.mockResolvedValue({
      data: {
        id: "mem-1",
        status: "active",
        homeowner_id: "home-1",
        property_id: "prop-1",
        agreement_id: "agr-1",
      },
      error: null,
    });

    mockSelectAfterUpdate.mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: "mem-1", status: "cancelled", cancelled_at: "2026-07-10T00:00:00.000Z" },
        error: null,
      }),
    });

    mockUpdateEq.mockReturnValue({
      select: mockSelectAfterUpdate,
    });

    mockUpdate.mockReturnValue({
      eq: mockUpdateEq,
    });

    mockEq.mockReturnValue({
      maybeSingle: mockMaybeSingle,
      select: vi.fn().mockReturnValue({
        data: [{ id: "obl-1" }],
        error: null,
      }),
    });

    mockSelect.mockReturnValue({
      eq: mockEq,
      in: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: [{ id: "obl-1" }],
          error: null,
        }),
      }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "memberships") {
        return {
          select: mockSelect,
          update: mockUpdate,
        };
      }
      if (table === "obligations") {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                select: vi.fn().mockResolvedValue({
                  data: [{ id: "obl-1" }],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });
  });

  it("sets membership status to cancelled without deleting related records", async () => {
    const result = await archiveMembership({
      membershipId: "mem-1",
      reason: "Test enrollment",
    });

    expect(result.membershipId).toBe("mem-1");
    expect(result.previousStatus).toBe("active");
    expect(result.obligationsVoided).toBe(1);
    expect(result.salesAttributionRepairRequired).toBe(false);
    expect(mockSyncAttributionLifecycle).toHaveBeenCalledWith(
      expect.objectContaining({
        membershipId: "mem-1",
        supabase: expect.any(Object),
      }),
    );
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "cancelled",
        cancelled_at: expect.any(String),
      }),
    );
  });

  it("preserves the archive when attribution cancellation needs repair", async () => {
    mockSyncAttributionLifecycle.mockRejectedValueOnce(
      new Error("temporary attribution failure"),
    );

    const result = await archiveMembership({ membershipId: "mem-1" });

    expect(result.membershipId).toBe("mem-1");
    expect(result.salesAttributionRepairRequired).toBe(true);
  });

  it("rejects already archived memberships", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: "mem-1",
        status: "cancelled",
        homeowner_id: "home-1",
        property_id: "prop-1",
        agreement_id: null,
      },
      error: null,
    });

    await expect(
      archiveMembership({ membershipId: "mem-1" }),
    ).rejects.toThrow("already archived");
  });
});
