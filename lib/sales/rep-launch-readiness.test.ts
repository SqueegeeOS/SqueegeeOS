import { describe, expect, it } from "vitest";
import {
  deriveSalesRepLaunchReadiness,
  type SalesRepLaunchCountsEvidence,
} from "./rep-launch-readiness";

const emptyCounts: SalesRepLaunchCountsEvidence = {
  status: "complete",
  doorCount: 0,
  leadCount: 0,
  presentationCount: 0,
  verifiedCloseCount: 0,
};

describe("sales rep first-loop readiness", () => {
  it("starts with a founder-issued pass without inventing field progress", () => {
    const readiness = deriveSalesRepLaunchReadiness({
      phonePass: "missing",
      counts: emptyCounts,
    });

    expect(readiness.stage).toBe("phone_pass_needed");
    expect(readiness.completedCount).toBe(0);
    expect(readiness.steps.every((step) => step.state === "pending")).toBe(true);
  });

  it("distinguishes an issued link from an installed phone session", () => {
    const readiness = deriveSalesRepLaunchReadiness({
      phonePass: "install_link_ready",
      counts: emptyCounts,
    });

    expect(readiness.stage).toBe("phone_install_needed");
    expect(readiness.steps[0]).toMatchObject({
      id: "phone",
      state: "pending",
      detail: "Install link ready",
    });
  });

  it("advances only from durable evidence in lifecycle order", () => {
    const readiness = deriveSalesRepLaunchReadiness({
      phonePass: "installed",
      counts: {
        status: "complete",
        doorCount: 7,
        leadCount: 2,
        presentationCount: 1,
        verifiedCloseCount: 0,
      },
    });

    expect(readiness.stage).toBe("first_close_needed");
    expect(readiness.completedCount).toBe(4);
    expect(readiness.steps.map((step) => step.state)).toEqual([
      "complete",
      "complete",
      "complete",
      "complete",
      "pending",
    ]);
  });

  it("marks the loop proven only after a signature-backed close exists", () => {
    expect(
      deriveSalesRepLaunchReadiness({
        phonePass: "installed",
        counts: {
          status: "complete",
          doorCount: 1,
          leadCount: 1,
          presentationCount: 1,
          verifiedCloseCount: 1,
        },
      }).stage,
    ).toBe("proven");
  });

  it("shows unreadable counts as unknown rather than zero", () => {
    const readiness = deriveSalesRepLaunchReadiness({
      phonePass: "installed",
      counts: {
        status: "unavailable",
        doorCount: null,
        leadCount: null,
        presentationCount: null,
        verifiedCloseCount: null,
      },
    });

    expect(readiness.stage).toBe("evidence_unavailable");
    expect(readiness.steps.slice(1).every((step) => step.state === "unknown")).toBe(
      true,
    );
  });
});
