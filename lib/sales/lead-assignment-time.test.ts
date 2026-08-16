import { describe, expect, it } from "vitest";
import {
  futureLocalDateTimeValue,
  inboundTriageMinutesAhead,
  tomorrowMorningLocalDateTimeValue,
} from "./lead-assignment-time";

describe("lead assignment times", () => {
  it("defaults a hot inbound lead to a next action 15 minutes away", () => {
    const reference = new Date(2026, 7, 16, 10, 42, 31, 400);

    expect(futureLocalDateTimeValue(reference)).toBe("2026-08-16T10:57");
  });

  it("supports an explicit near-term follow-up window", () => {
    const reference = new Date(2026, 7, 16, 10, 42, 31, 400);

    expect(futureLocalDateTimeValue(reference, 60)).toBe("2026-08-16T11:42");
  });

  it("staggers the visible inbound queue into deliberate follow-up slots", () => {
    expect(inboundTriageMinutesAhead(0)).toBe(15);
    expect(inboundTriageMinutesAhead(1)).toBe(30);
    expect(inboundTriageMinutesAhead(7)).toBe(120);
  });

  it("fails invalid triage positions and spacing back to one safe slot", () => {
    expect(inboundTriageMinutesAhead(-1)).toBe(15);
    expect(inboundTriageMinutesAhead(Number.NaN)).toBe(15);
    expect(inboundTriageMinutesAhead(0, 2)).toBe(15);
  });

  it("sets tomorrow morning in the operator's local timezone", () => {
    const reference = new Date(2026, 7, 16, 22, 42, 31, 400);

    expect(tomorrowMorningLocalDateTimeValue(reference)).toBe(
      "2026-08-17T09:00",
    );
  });
});
