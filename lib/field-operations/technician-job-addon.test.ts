import { describe, expect, it } from "vitest";
import { dollarsToAddonCents, validateTechnicianJobAddonRequest } from "./technician-job-addon";

const valid = {
  clientRequestId: "528e72e6-4938-4447-a10e-79b47a91631d",
  assignmentId: "99999999-9999-4999-8999-999999999999",
  serviceName: " Solar panel rinse ",
  reportedAmountCents: 4000,
};

describe("technician-reported job add-ons", () => {
  it("accepts only an exact assigned-job target, bounded service, and positive cents", () => {
    expect(validateTechnicianJobAddonRequest(valid)?.serviceName).toBe("Solar panel rinse");
    expect(validateTechnicianJobAddonRequest({ ...valid, assignmentId: "someone-else" })).toBeNull();
    expect(validateTechnicianJobAddonRequest({ ...valid, reportedAmountCents: 0 })).toBeNull();
    expect(validateTechnicianJobAddonRequest({ ...valid, reportedAmountCents: 1.25 })).toBeNull();
    expect(validateTechnicianJobAddonRequest({ ...valid, reportedAmountCents: 1_000_001 })).toBeNull();
    expect(validateTechnicianJobAddonRequest({ ...valid, serviceName: "x" })).toBeNull();
  });

  it("parses dollars precisely without rounding malformed prices", () => {
    expect(dollarsToAddonCents("40")).toBe(4000);
    expect(dollarsToAddonCents("40.5")).toBe(4050);
    expect(dollarsToAddonCents("0.01")).toBe(1);
    expect(dollarsToAddonCents("40.005")).toBeNull();
    expect(dollarsToAddonCents("10000.01")).toBeNull();
    expect(dollarsToAddonCents("-1")).toBeNull();
  });
});
