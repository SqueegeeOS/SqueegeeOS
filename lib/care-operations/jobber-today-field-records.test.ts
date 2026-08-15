import { describe, expect, it } from "vitest";
import {
  isMissingVisitFieldRecordSchema,
  summarizeJobberTodayFieldRecords,
} from "./jobber-today-field-records";

describe("Today field record truth", () => {
  it("counts unique records and keeps the latest recorder per appointment", () => {
    const summaries = summarizeJobberTodayFieldRecords([
      {
        appointmentId: "appointment-1",
        fieldRecordId: "record-1",
        technicianName: "Donovan",
        createdAt: "invalid-legacy-time",
        customerVisible: false,
        followUpOpen: true,
      },
      {
        appointmentId: "appointment-1",
        fieldRecordId: "record-2",
        technicianName: "Dasan",
        createdAt: "2026-08-14T19:00:00.000Z",
        customerVisible: true,
        followUpOpen: false,
      },
      {
        appointmentId: "appointment-1",
        fieldRecordId: "record-2",
        technicianName: "Duplicate projection",
        createdAt: "2026-08-14T18:00:00.000Z",
        customerVisible: true,
        followUpOpen: false,
      },
      {
        appointmentId: "appointment-2",
        fieldRecordId: "record-3",
        technicianName: "David",
        createdAt: "2026-08-14T16:00:00.000Z",
        customerVisible: false,
        followUpOpen: false,
      },
    ]);

    expect(summaries.get("appointment-1")).toEqual({
      count: 2,
      latestFieldRecordAt: "2026-08-14T19:00:00.000Z",
      latestTechnicianName: "Dasan",
      customerVisibleCount: 1,
      openFollowUpCount: 1,
    });
    expect(summaries.get("appointment-2")?.count).toBe(1);
  });

  it("ignores rows that cannot prove an exact appointment record", () => {
    expect(
      summarizeJobberTodayFieldRecords([
        {
          appointmentId: null,
          fieldRecordId: "record-1",
          technicianName: "Unknown",
          createdAt: "2026-08-14T17:00:00.000Z",
          customerVisible: true,
          followUpOpen: false,
        },
        {
          appointmentId: "appointment-1",
          fieldRecordId: null,
          technicianName: "Legacy",
          createdAt: "2026-08-14T17:00:00.000Z",
          customerVisible: true,
          followUpOpen: false,
        },
      ]).size,
    ).toBe(0);
  });

  it("fails softly only for a missing field-record migration", () => {
    expect(
      isMissingVisitFieldRecordSchema({
        code: "42703",
        message: 'column "field_record_id" does not exist',
      }),
    ).toBe(true);
    expect(
      isMissingVisitFieldRecordSchema({
        code: "42501",
        message: "permission denied for table property_assessments",
      }),
    ).toBe(false);
  });
});
