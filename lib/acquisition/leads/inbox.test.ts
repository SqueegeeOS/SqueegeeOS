import { describe, expect, it } from "vitest";
import type { LeadIntakeStatus } from "@/lib/acquisition/lead-record";
import { formatLeadIntakeStatus } from "./inbox";

describe("lead pipeline labels", () => {
  it("presents the owner-facing five-stage sales pipeline", () => {
    const stages: LeadIntakeStatus[] = [
      "new",
      "contacted",
      "scheduled",
      "booked",
      "archived",
    ];

    expect(stages.map(formatLeadIntakeStatus)).toEqual([
      "New",
      "Contacted",
      "Quoted",
      "Booked",
      "Lost",
    ]);
  });
});
