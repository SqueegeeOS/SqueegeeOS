import { describe, expect, it } from "vitest";
import { buildSalesLeadCloseJourney } from "./lead-close-journey";

const PRESENTATION = {
  id: "presentation-1",
  status: "presented" as const,
  updatedAt: "2026-08-16T18:00:00.000Z",
};

describe("sales lead close journey", () => {
  it("starts with one clear plan-building action", () => {
    expect(
      buildSalesLeadCloseJourney({ presentations: [], packets: [] }),
    ).toMatchObject({
      stage: "plan_needed",
      label: "Plan not started",
      actionLabel: "Build their plan",
      presentationId: null,
    });
  });

  it("resumes the authoritative presentation before a handoff exists", () => {
    expect(
      buildSalesLeadCloseJourney({
        presentations: [{ ...PRESENTATION, status: "draft" }],
        packets: [],
      }),
    ).toMatchObject({
      stage: "plan_draft",
      actionLabel: "Resume plan",
      presentationId: PRESENTATION.id,
    });

    expect(
      buildSalesLeadCloseJourney({
        presentations: [PRESENTATION],
        packets: [],
      }),
    ).toMatchObject({
      stage: "presented",
      actionLabel: "Open close",
    });
  });

  it("turns the durable provider record into the next field action", () => {
    const cases = [
      ["signature_sent", "Check signature", "accent"],
      ["payment_sent", "Check card setup", "accent"],
      ["payment_complete", "Open activation", "success"],
      ["portal_ready", "View customer setup", "success"],
      ["needs_attention", "Fix handoff", "warning"],
    ] as const;

    for (const [status, actionLabel, tone] of cases) {
      expect(
        buildSalesLeadCloseJourney({
          presentations: [PRESENTATION],
          packets: [
            {
              presentationId: PRESENTATION.id,
              status,
              updatedAt: "2026-08-16T19:00:00.000Z",
            },
          ],
        }),
      ).toMatchObject({
        stage: status,
        enrollmentStatus: status,
        actionLabel,
        tone,
        updatedAt: "2026-08-16T19:00:00.000Z",
      });
    }
  });

  it("ignores a packet that belongs to another presentation", () => {
    expect(
      buildSalesLeadCloseJourney({
        presentations: [PRESENTATION],
        packets: [
          {
            presentationId: "different-presentation",
            status: "portal_ready",
            updatedAt: "2026-08-16T20:00:00.000Z",
          },
        ],
      }),
    ).toMatchObject({
      stage: "presented",
      enrollmentStatus: null,
    });
  });
});
