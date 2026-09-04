import { describe, expect, it } from "vitest";
import { fieldJobTarget } from "./field-job-target";
import { validateTechnicianJobClockRequest } from "./technician-job-clock";
import { validateVisitPhotoUploadRequest, validateVisitFieldRecordCommit } from "../field-records/visit-field-record";

const propertyId = "11111111-1111-4111-8111-111111111111";
const appointmentId = "22222222-2222-4222-8222-222222222222";
const fieldAssignmentId = "33333333-3333-4333-8333-333333333333";
const requestId = "44444444-4444-4444-8444-444444444444";

describe("one exact target for member-linked native assignments", () => {
  it("makes clock-in, upload and closeout valid even when the visit also has member IDs", () => {
    const target = fieldJobTarget({ propertyId, appointmentId, fieldAssignmentId });
    expect(target).toEqual({ fieldAssignmentId });
    expect(validateTechnicianJobClockRequest({ ...target, actionId: requestId, action: "start" })).toBeNull();
    expect(validateVisitPhotoUploadRequest({ ...target, fieldRecordId: requestId, photos: [{
      clientId: requestId, fileName: "after.jpg", mimeType: "image/jpeg", sizeBytes: 1024,
      captureType: "after", customerVisible: false,
    }] })).toBeNull();
    expect(validateVisitFieldRecordCommit({ ...target, fieldRecordId: requestId,
      technicianName: "Tyler Germany", visitDate: "2026-09-04", customerSummary: "Windows cleaned.",
      internalNote: "", scopeException: "", followUpNeeded: false, scopeReadState: "available",
      serviceScope: [], photos: [],
    })).toBeNull();
  });

  it("preserves the existing member-job target when no native assignment exists", () => {
    expect(fieldJobTarget({ propertyId, appointmentId, fieldAssignmentId: null })).toEqual({ propertyId, appointmentId });
  });
});
