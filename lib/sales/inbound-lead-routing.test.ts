import { describe, expect, it } from "vitest";
import {
  configuredInboundLeadOwnerSlug,
  inboundLeadNextFollowUpAt,
  normalizeInboundLeadOwnerSlug,
  resolveInboundLeadRouting,
} from "./inbound-lead-routing";

const REPS = [
  { slug: "david", displayName: "David" },
  { slug: "noah", displayName: "Noah Thomas" },
];

describe("inbound lead routing", () => {
  it("normalizes a configured owner without accepting arbitrary values", () => {
    expect(normalizeInboundLeadOwnerSlug(" Noah ")).toBe("noah");
    expect(normalizeInboundLeadOwnerSlug("noah/../../")).toBeNull();
    expect(configuredInboundLeadOwnerSlug({ INBOUND_LEAD_OWNER_SLUG: "DAVID" })).toBe(
      "david",
    );
  });

  it("reports whether the configured owner is active in the verified roster", () => {
    expect(resolveInboundLeadRouting(REPS, "noah")).toEqual({
      status: "active",
      ownerSlug: "noah",
      ownerDisplayName: "Noah Thomas",
      followUpMinutes: 15,
    });
    expect(resolveInboundLeadRouting(REPS, undefined)).toMatchObject({
      status: "not_configured",
      ownerSlug: null,
    });
    expect(resolveInboundLeadRouting(REPS, "retired-rep")).toMatchObject({
      status: "owner_unavailable",
      ownerSlug: "retired-rep",
    });
  });

  it("creates a bounded future next action", () => {
    const reference = new Date("2026-08-16T18:00:00.000Z");
    expect(inboundLeadNextFollowUpAt(reference)).toBe(
      "2026-08-16T18:15:00.000Z",
    );
    expect(inboundLeadNextFollowUpAt(reference, Number.NaN)).toBe(
      "2026-08-16T18:15:00.000Z",
    );
    expect(inboundLeadNextFollowUpAt(reference, 10_000)).toBe(
      "2026-08-17T18:00:00.000Z",
    );
  });
});
