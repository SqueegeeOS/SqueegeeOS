import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const insert = vi.fn();
  const update = vi.fn();
  const upsert = vi.fn();
  const remove = vi.fn();
  const from = vi.fn();
  let rows: unknown[] = [];

  function query() {
    const result = Promise.resolve({ data: rows, error: null });
    const builder: Record<string, unknown> = {};

    for (const method of ["select", "eq", "order"]) {
      builder[method] = vi.fn(() => builder);
    }
    builder.insert = insert;
    builder.update = update;
    builder.upsert = upsert;
    builder.delete = remove;
    builder.then = (
      onfulfilled?: ((value: unknown) => unknown) | null,
      onrejected?: ((reason: unknown) => unknown) | null,
    ) => result.then(onfulfilled, onrejected);

    return builder;
  }

  from.mockImplementation(() => query());

  return {
    client: { from },
    from,
    insert,
    update,
    upsert,
    remove,
    setRows(nextRows: unknown[]) {
      rows = nextRows;
    },
  };
});

vi.mock("@/lib/persistence/config", () => ({
  isCloudPersistenceConnected: () => true,
}));

vi.mock("@/lib/persistence/supabase/client", () => ({
  createPrivilegedServerSupabaseClient: () => mocks.client,
}));

import { loadMemberSavingsLedgerView } from "./member-savings-ledger-server";

describe("loadMemberSavingsLedgerView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setRows([]);
  });

  it("is select-only and derives truthful legacy savings without reconciling", async () => {
    const view = await loadMemberSavingsLedgerView({
      membershipId: "membership-1",
      memberProfileId: "profile-1",
      tierId: "biannual",
      addonDiscountPercent: 20,
      enrollmentSavingsPerVisit: 40,
      appointments: [
        {
          id: "appointment-1",
          date: "2026-07-24T17:00:00.000Z",
          serviceType: "home_care_visit",
          status: "completed",
        },
      ],
      careAddons: [
        {
          id: "addon-1",
          serviceName: "Interior window cleaning",
          serviceDate: "2026-07-24",
          amountCharged: 285,
          saved: 25,
          status: "paid",
        },
      ],
    });

    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledWith("member_savings_ledger_entries");
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(view.membershipVisits.total).toBe(40);
    expect(view.addonServices.total).toBe(25);
  });

  it("uses persisted evidence when it exists without changing it", async () => {
    mocks.setRows([
      {
        id: "ledger-1",
        entry_type: "addon_service",
        source_id: "addon-1",
        label: "Interior window cleaning",
        amount_cents: 2500,
        occurred_at: "2026-07-24T12:00:00.000Z",
        metadata: { detail: "Member price $285" },
      },
    ]);

    const view = await loadMemberSavingsLedgerView({
      membershipId: "membership-1",
      memberProfileId: "profile-1",
      tierId: "biannual",
      addonDiscountPercent: 20,
      enrollmentSavingsPerVisit: null,
      appointments: [],
      careAddons: [],
    });

    expect(view.addonServices.total).toBe(25);
    expect(view.addonServices.lines[0]?.detail).toBe("Member price $285");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
