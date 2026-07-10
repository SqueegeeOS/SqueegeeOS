import { describe, expect, it } from "vitest";
import {
  COMPANY_BUSINESS_TIMEZONE,
  getBusinessCalendarDayUtcBounds,
  isInstantOnBusinessCalendarDay,
  zonedDateTimeToUtc,
} from "./company-business-timezone";

describe("company business timezone (America/Los_Angeles)", () => {
  it("maps midnight PDT to 07:00 UTC", () => {
    const midnight = zonedDateTimeToUtc("2026-07-09", 0, 0, 0);
    expect(midnight.toISOString()).toBe("2026-07-09T07:00:00.000Z");
  });

  it("maps midnight PST to 08:00 UTC", () => {
    const midnight = zonedDateTimeToUtc("2026-01-09", 0, 0, 0);
    expect(midnight.toISOString()).toBe("2026-01-09T08:00:00.000Z");
  });

  describe("PDT day boundaries", () => {
    const reference = new Date("2026-07-09T22:00:00.000Z"); // Jul 9 3pm PT

    it("excludes the instant before Pacific midnight", () => {
      expect(
        isInstantOnBusinessCalendarDay("2026-07-09T06:59:59.999Z", reference),
      ).toBe(false);
    });

    it("includes Pacific midnight", () => {
      expect(
        isInstantOnBusinessCalendarDay("2026-07-09T07:00:00.000Z", reference),
      ).toBe(true);
    });

    it("includes the last moment of the Pacific day", () => {
      expect(
        isInstantOnBusinessCalendarDay("2026-07-10T06:59:59.999Z", reference),
      ).toBe(true);
    });

    it("excludes the next Pacific midnight", () => {
      expect(
        isInstantOnBusinessCalendarDay("2026-07-10T07:00:00.000Z", reference),
      ).toBe(false);
    });
  });

  describe("PST day boundaries", () => {
    const reference = new Date("2026-01-09T23:00:00.000Z"); // Jan 9 3pm PT

    it("excludes the instant before Pacific midnight", () => {
      expect(
        isInstantOnBusinessCalendarDay("2026-01-09T07:59:59.999Z", reference),
      ).toBe(false);
    });

    it("includes Pacific midnight", () => {
      expect(
        isInstantOnBusinessCalendarDay("2026-01-09T08:00:00.000Z", reference),
      ).toBe(true);
    });

    it("includes the last moment of the Pacific day", () => {
      expect(
        isInstantOnBusinessCalendarDay("2026-01-10T07:59:59.999Z", reference),
      ).toBe(true);
    });

    it("excludes the next Pacific midnight", () => {
      expect(
        isInstantOnBusinessCalendarDay("2026-01-10T08:00:00.000Z", reference),
      ).toBe(false);
    });
  });

  it("returns half-open UTC bounds for the reference calendar day", () => {
    const reference = new Date("2026-07-09T15:00:00.000Z");
    const { startUtc, endUtc } = getBusinessCalendarDayUtcBounds(reference);
    expect(startUtc.toISOString()).toBe("2026-07-09T07:00:00.000Z");
    expect(endUtc.toISOString()).toBe("2026-07-10T07:00:00.000Z");
    expect(COMPANY_BUSINESS_TIMEZONE).toBe("America/Los_Angeles");
  });
});
