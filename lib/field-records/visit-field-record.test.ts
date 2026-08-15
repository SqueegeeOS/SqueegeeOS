import { describe, expect, it } from "vitest";
import {
  buildVisitPhotoStoragePath,
  classifyVisitFieldFollowUp,
  MAX_VISIT_PHOTO_BYTES,
  nextVisitFieldFollowUpDueAt,
  validateVisitFieldRecordCommit,
  validateResolveVisitFieldFollowUp,
  validateVisitPhotoDescriptors,
  validateVisitPhotoUploadRequest,
  visitPhotoStoragePrefix,
} from "./visit-field-record";

const propertyId = "11111111-1111-4111-8111-111111111111";
const appointmentId = "22222222-2222-4222-8222-222222222222";
const fieldRecordId = "33333333-3333-4333-8333-333333333333";
const clientId = "44444444-4444-4444-8444-444444444444";

const photo = {
  clientId,
  fileName: "front-windows.jpg",
  mimeType: "image/jpeg",
  sizeBytes: 2_000_000,
  captureType: "before" as const,
  customerVisible: true,
};

describe("visit field record validation", () => {
  it("builds a record-scoped storage path", () => {
    const path = buildVisitPhotoStoragePath({
      propertyId,
      appointmentId,
      fieldRecordId,
      objectId: "55555555-5555-4555-8555-555555555555",
      mimeType: "image/jpeg",
    });

    expect(path).toBe(
      `${visitPhotoStoragePrefix({ propertyId, appointmentId, fieldRecordId })}55555555-5555-4555-8555-555555555555.jpg`,
    );
  });

  it("accepts a customer update with a correctly scoped uploaded photo", () => {
    const storagePath = buildVisitPhotoStoragePath({
      propertyId,
      appointmentId,
      fieldRecordId,
      objectId: "55555555-5555-4555-8555-555555555555",
      mimeType: "image/jpeg",
    });

    expect(
      validateVisitFieldRecordCommit({
        fieldRecordId,
        propertyId,
        appointmentId,
        technicianName: "Noah",
        visitDate: "2026-08-14",
        customerSummary: "Exterior glass cleaned and inspected.",
        internalNote: "Gate code confirmed.",
        followUpNeeded: false,
        scopeReadState: "available",
        serviceScope: [],
        scopeException: "",
        photos: [{ ...photo, storagePath }],
      }),
    ).toBeNull();
  });

  it("fails closed when a photo path belongs to another property", () => {
    expect(
      validateVisitFieldRecordCommit({
        fieldRecordId,
        propertyId,
        appointmentId,
        technicianName: "Noah",
        visitDate: "2026-08-14",
        customerSummary: "Service complete.",
        internalNote: "",
        followUpNeeded: false,
        scopeReadState: "available",
        serviceScope: [],
        scopeException: "",
        photos: [
          {
            ...photo,
            storagePath: buildVisitPhotoStoragePath({
              propertyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              appointmentId,
              fieldRecordId,
              objectId: "55555555-5555-4555-8555-555555555555",
              mimeType: "image/jpeg",
            }),
          },
        ],
      }),
    ).toContain("does not belong");
  });

  it("rejects unsupported or oversized phone files", () => {
    expect(
      validateVisitPhotoDescriptors([
        { ...photo, mimeType: "application/pdf" },
      ]),
    ).toContain("JPEG");
    expect(
      validateVisitPhotoDescriptors([
        { ...photo, sizeBytes: MAX_VISIT_PHOTO_BYTES + 1 },
      ]),
    ).toContain("15 MB");
  });

  it("requires uploads to be scoped to real record identities", () => {
    expect(
      validateVisitPhotoUploadRequest({
        fieldRecordId: "not-a-record",
        propertyId,
        appointmentId,
        photos: [photo],
      }),
    ).toContain("fieldRecordId");
    expect(
      validateVisitPhotoUploadRequest({
        fieldRecordId,
        propertyId,
        appointmentId,
        photos: [],
      }),
    ).toContain("Choose at least one");
  });

  it("requires meaningful field evidence", () => {
    expect(
      validateVisitFieldRecordCommit({
        fieldRecordId,
        propertyId,
        appointmentId,
        technicianName: "Noah",
        visitDate: "2026-08-14",
        customerSummary: "",
        internalNote: "",
        followUpNeeded: false,
        scopeReadState: "not_observed",
        serviceScope: [],
        scopeException: "",
        photos: [],
      }),
    ).toContain("Add a customer update");
  });

  it("turns unfinished Jobber scope into an explicit owner follow-up", () => {
    const serviceScope = [
      {
        id: "line-1",
        name: "Exterior window cleaning",
        description: "Glass and frames",
        quantity: 1,
        category: "SERVICE",
        completed: true,
      },
      {
        id: "line-2",
        name: "Screens",
        description: null,
        quantity: 12,
        category: "SERVICE",
        completed: false,
      },
    ];

    expect(
      validateVisitFieldRecordCommit({
        fieldRecordId,
        propertyId,
        appointmentId,
        technicianName: "Noah",
        visitDate: "2026-08-14",
        customerSummary: "Exterior glass completed.",
        internalNote: "",
        followUpNeeded: false,
        scopeReadState: "available",
        serviceScope,
        scopeException: "",
        photos: [],
      }),
    ).toContain("Explain any unfinished");

    expect(
      validateVisitFieldRecordCommit({
        fieldRecordId,
        propertyId,
        appointmentId,
        technicianName: "Noah",
        visitDate: "2026-08-14",
        customerSummary: "Exterior glass completed.",
        internalNote: "",
        followUpNeeded: false,
        scopeReadState: "available",
        serviceScope,
        scopeException: "Two screens were locked behind a patio enclosure.",
        photos: [],
      }),
    ).toContain("must create an HQ follow-up");

    expect(
      validateVisitFieldRecordCommit({
        fieldRecordId,
        propertyId,
        appointmentId,
        technicianName: "Noah",
        visitDate: "2026-08-14",
        customerSummary: "Exterior glass completed.",
        internalNote: "",
        followUpNeeded: true,
        scopeReadState: "available",
        serviceScope,
        scopeException: "Two screens were locked behind a patio enclosure.",
        photos: [],
      }),
    ).toBeNull();
  });

  it("validates an explicit operator before resolving a follow-up", () => {
    expect(
      validateResolveVisitFieldFollowUp({
        assessmentId: "not-an-assessment",
        resolvedBy: "HQ operator",
      }),
    ).toContain("assessmentId");
    expect(
      validateResolveVisitFieldFollowUp({
        assessmentId: "55555555-5555-4555-8555-555555555555",
        resolvedBy: "  ",
      }),
    ).toContain("who completed");
    expect(
      validateResolveVisitFieldFollowUp({
        assessmentId: "55555555-5555-4555-8555-555555555555",
        resolvedBy: "HQ operator",
      }),
    ).toBeNull();
  });

  it("classifies owner follow-ups by the Pacific business day", () => {
    const now = new Date("2026-08-14T19:00:00.000Z");
    expect(
      classifyVisitFieldFollowUp("2026-08-13T16:00:00.000Z", now),
    ).toBe("overdue");
    expect(
      classifyVisitFieldFollowUp("2026-08-14T16:00:00.000Z", now),
    ).toBe("due_today");
    expect(
      classifyVisitFieldFollowUp("2026-08-17T16:00:00.000Z", now),
    ).toBe("upcoming");
  });

  it("schedules the next business day at 9 AM Pacific across weekends and DST", () => {
    expect(nextVisitFieldFollowUpDueAt("2026-08-14")).toBe(
      "2026-08-17T16:00:00.000Z",
    );
    expect(nextVisitFieldFollowUpDueAt("2026-08-15")).toBe(
      "2026-08-17T16:00:00.000Z",
    );
    expect(nextVisitFieldFollowUpDueAt("2026-12-04")).toBe(
      "2026-12-07T17:00:00.000Z",
    );
  });
});
