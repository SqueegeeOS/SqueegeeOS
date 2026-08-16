import { afterEach, describe, expect, it, vi } from "vitest";
import type { LeadIntakeSalesAssignment } from "./lead-intake-assignment";

const loadAssignment = vi.fn();
const assignLead = vi.fn();

vi.mock("./lead-intake-assignment-server", () => ({
  loadLeadIntakeSalesAssignment: loadAssignment,
  assignLeadIntakeToSalesRep: assignLead,
}));

const EXISTING_ASSIGNMENT: LeadIntakeSalesAssignment = {
  salesRepLeadId: "sales-lead-1",
  leadIntakeId: "intake-1",
  repId: "rep-david",
  repSlug: "david",
  repDisplayName: "David",
  repWorkspacePath: "/david",
  status: "follow_up",
  source: "request_form",
  nextFollowUpAt: "2026-08-16T18:15:00.000Z",
  createdAt: "2026-08-16T18:00:00.000Z",
  updatedAt: "2026-08-16T18:00:00.000Z",
};

describe("inbound lead routing server", () => {
  afterEach(() => {
    loadAssignment.mockReset();
    assignLead.mockReset();
  });

  it("does nothing when an owner has not been explicitly configured", async () => {
    const { routeInboundLeadToConfiguredOwner } = await import(
      "./inbound-lead-routing-server"
    );
    const result = await routeInboundLeadToConfiguredOwner({
      leadIntakeId: "intake-1",
      environment: {},
    });

    expect(result).toEqual({ status: "not_configured", assignment: null });
    expect(loadAssignment).not.toHaveBeenCalled();
    expect(assignLead).not.toHaveBeenCalled();
  });

  it("preserves an existing owner without moving the next action", async () => {
    loadAssignment.mockResolvedValue(EXISTING_ASSIGNMENT);
    const { routeInboundLeadToConfiguredOwner } = await import(
      "./inbound-lead-routing-server"
    );
    const result = await routeInboundLeadToConfiguredOwner({
      leadIntakeId: "intake-1",
      environment: { INBOUND_LEAD_OWNER_SLUG: "noah" },
    });

    expect(result).toEqual({
      status: "already_owned",
      assignment: EXISTING_ASSIGNMENT,
    });
    expect(assignLead).not.toHaveBeenCalled();
  });

  it("assigns a new durable request with a 15-minute next move", async () => {
    loadAssignment.mockResolvedValue(null);
    assignLead.mockResolvedValue({
      ...EXISTING_ASSIGNMENT,
      repId: "rep-noah",
      repSlug: "noah",
      repDisplayName: "Noah Thomas",
      repWorkspacePath: "/sales/noah",
    });
    const { routeInboundLeadToConfiguredOwner } = await import(
      "./inbound-lead-routing-server"
    );
    const result = await routeInboundLeadToConfiguredOwner({
      leadIntakeId: "intake-1",
      reference: new Date("2026-08-16T18:00:00.000Z"),
      environment: { INBOUND_LEAD_OWNER_SLUG: "NOAH" },
    });

    expect(assignLead).toHaveBeenCalledWith({
      leadIntakeId: "intake-1",
      repSlug: "noah",
      nextFollowUpAt: "2026-08-16T18:15:00.000Z",
    });
    expect(result.status).toBe("assigned");
  });
});
