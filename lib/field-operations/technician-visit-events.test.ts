import { describe, expect, it } from "vitest";
import {
  buildTechnicianCustomerAlertDraft,
  resolveTechnicianVisitNextAction,
  resolveTechnicianVisitSnapshot,
  technicianVisitStageProgress,
  validateTechnicianVisitEventRequest,
} from "./technician-visit-events";

const VALID_REQUEST = {
  eventId: "1c70e44a-4fcb-4ffd-94fa-820c12d58e4b",
  propertyId: "758b1b60-ebbb-4831-8103-3493b0e99410",
  appointmentId: "c8cd94e2-533d-49e7-afc5-c90d06bf5056",
  eventType: "arrived" as const,
};

describe("technician visit lifecycle", () => {
  it("turns a fresh route into five explicit field moments", () => {
    expect(
      resolveTechnicianVisitNextAction({
        stage: "not_started",
        hasFieldRecord: false,
        jobberComplete: false,
      }),
    ).toMatchObject({ kind: "event", eventType: "en_route" });
    expect(
      resolveTechnicianVisitNextAction({
        stage: "en_route",
        hasFieldRecord: false,
        jobberComplete: false,
      }),
    ).toMatchObject({ kind: "event", eventType: "arrived" });
    expect(
      resolveTechnicianVisitNextAction({
        stage: "arrived",
        hasFieldRecord: false,
        jobberComplete: false,
      }),
    ).toMatchObject({ kind: "event", eventType: "service_started" });
    expect(
      resolveTechnicianVisitNextAction({
        stage: "service_started",
        hasFieldRecord: false,
        jobberComplete: false,
      }),
    ).toMatchObject({ kind: "closeout" });
    expect(
      resolveTechnicianVisitNextAction({
        stage: "service_completed",
        hasFieldRecord: true,
        jobberComplete: true,
      }),
    ).toMatchObject({ kind: "event", eventType: "departed" });
    expect(
      resolveTechnicianVisitNextAction({
        stage: "departed",
        hasFieldRecord: true,
        jobberComplete: true,
      }),
    ).toBeNull();
    expect(technicianVisitStageProgress("departed")).toEqual({
      completed: 5,
      total: 5,
    });
  });

  it("repairs an older Jobber-complete stop instead of telling the tech to drive there", () => {
    expect(
      resolveTechnicianVisitNextAction({
        stage: "not_started",
        hasFieldRecord: true,
        jobberComplete: true,
      }),
    ).toMatchObject({
      kind: "event",
      eventType: "service_completed",
      label: "Confirm service complete",
    });
    expect(
      resolveTechnicianVisitNextAction({
        stage: "not_started",
        hasFieldRecord: false,
        jobberComplete: true,
      }),
    ).toMatchObject({ kind: "closeout" });
  });

  it("resolves stage by lifecycle order rather than a late replay timestamp", () => {
    expect(
      resolveTechnicianVisitSnapshot([
        {
          eventType: "service_completed",
          occurredAt: "2026-08-14T18:00:00.000Z",
          actorDisplayName: "David",
        },
        {
          eventType: "arrived",
          occurredAt: "2026-08-14T19:00:00.000Z",
          actorDisplayName: "David",
        },
      ]),
    ).toEqual({
      stage: "service_completed",
      occurredAt: "2026-08-14T18:00:00.000Z",
      actorDisplayName: "David",
      eventCount: 2,
    });
  });

  it("prepares only approved-moment customer copy and never a delivery instruction", () => {
    const onTheWay = buildTechnicianCustomerAlertDraft({
      eventType: "en_route",
      clientName: "Mandi Customer",
      serviceLabel: "Exterior window cleaning",
    });
    expect(onTheWay).toContain("Hi Mandi");
    expect(onTheWay).toContain("on the way");
    expect(onTheWay?.length).toBeLessThanOrEqual(160);
    expect(
      buildTechnicianCustomerAlertDraft({
        eventType: "service_started",
        clientName: "Mandi Customer",
        serviceLabel: "Exterior window cleaning",
      }),
    ).toBeNull();
    expect(
      buildTechnicianCustomerAlertDraft({
        eventType: "departed",
        clientName: "Mandi Customer",
        serviceLabel: "Exterior window cleaning",
      }),
    ).toBeNull();
  });

  it("accepts only bounded, appointment-scoped UUID requests", () => {
    expect(validateTechnicianVisitEventRequest(VALID_REQUEST)).toBeNull();
    expect(
      validateTechnicianVisitEventRequest({
        ...VALID_REQUEST,
        appointmentId: "not-an-appointment",
      }),
    ).toContain("valid HomeAtlas appointment");
    expect(
      validateTechnicianVisitEventRequest({
        ...VALID_REQUEST,
        eventType: "text_customer",
      }),
    ).toContain("valid technician route stage");
  });
});
