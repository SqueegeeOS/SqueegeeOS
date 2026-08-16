import { describe, expect, it } from "vitest";
import {
  buildSalesRepRecentWins,
  selectRecentSalesRepWinSources,
  type SalesRepWinAttributionSource,
} from "./recent-wins";

function attribution(
  id: string,
  attributedAt: string,
  overrides: Partial<SalesRepWinAttributionSource> = {},
): SalesRepWinAttributionSource {
  return {
    id,
    membershipId: `membership-${id}`,
    leadId: `lead-${id}`,
    presentationId: `presentation-${id}`,
    attributedArrCents: 120_000,
    status: "pending",
    attributedAt,
    ...overrides,
  };
}

describe("signature-backed recent sales wins", () => {
  it("orders the newest non-cancelled credits without mutating source data", () => {
    const sources = [
      attribution("older", "2026-08-13T18:00:00.000Z"),
      attribution("cancelled", "2026-08-15T18:00:00.000Z", {
        status: "cancelled",
      }),
      attribution("newer", "2026-08-14T18:00:00.000Z", {
        status: "active",
      }),
    ];

    expect(
      selectRecentSalesRepWinSources(sources, 6).map(({ id }) => id),
    ).toEqual(["newer", "older"]);
    expect(sources.map(({ id }) => id)).toEqual([
      "older",
      "cancelled",
      "newer",
    ]);
  });

  it("uses lead identity first and presentation identity as a safe fallback", () => {
    const wins = buildSalesRepRecentWins({
      attributions: [
        attribution("lead", "2026-08-14T18:00:00.000Z"),
        attribution("presentation", "2026-08-13T18:00:00.000Z", {
          leadId: null,
        }),
        attribution("legacy", "2026-08-12T18:00:00.000Z", {
          leadId: null,
          presentationId: null,
          attributedArrCents: Number.NaN,
          status: "qualified",
        }),
      ],
      leads: [
        {
          id: "lead-lead",
          fullName: "Mandi Rivera",
          propertyAddress: "88 Oak Way",
        },
      ],
      presentations: [
        {
          id: "presentation-lead",
          clientName: "Old Mandi Name",
          clientAddress: "Old Mandi Address",
        },
        {
          id: "presentation-presentation",
          clientName: "Jeff Mason",
          clientAddress: "1420 Davis Avenue",
        },
      ],
      productionHandoffs: [],
    });

    expect(wins).toEqual([
      expect.objectContaining({
        presentationId: "presentation-lead",
        fullName: "Mandi Rivera",
        propertyAddress: "88 Oak Way",
        status: "pending",
      }),
      expect.objectContaining({
        presentationId: "presentation-presentation",
        fullName: "Jeff Mason",
        propertyAddress: "1420 Davis Avenue",
        status: "pending",
      }),
      expect.objectContaining({
        presentationId: null,
        fullName: "Signed homeowner",
        propertyAddress: "Service property on file",
        attributedArrCents: 0,
        status: "qualified",
      }),
    ]);
  });

  it("bounds the visible ledger while preserving exact raw credits elsewhere", () => {
    const sources = Array.from({ length: 30 }, (_, index) =>
      attribution(
        `credit-${String(index).padStart(2, "0")}`,
        new Date(Date.UTC(2026, 7, index + 1)).toISOString(),
      ),
    );
    expect(selectRecentSalesRepWinSources(sources, 100)).toHaveLength(20);
    expect(selectRecentSalesRepWinSources(sources, 0)).toHaveLength(1);
  });
});
