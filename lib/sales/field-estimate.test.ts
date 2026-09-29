import { describe, expect, it } from "vitest";
import {
  calculateSolarFieldEstimate,
  calculateWindowFieldEstimate,
  calculateWindowSolarFieldEstimate,
  calculateWindowCarePlan,
  calculateFlexibleWindowPlan,
} from "@/lib/sales/field-estimate";

describe("David field estimate", () => {
  it.each([
    ["quarterly", 20000, 80000],
    ["triannual", 23000, 69000],
    ["biannual", 25000, 50000],
  ] as const)("uses the %s window rate per visit", (cadence, visit, annual) => {
    const result = calculateWindowFieldEstimate({
      squareFeet: 2000,
      cadence,
      screens: false,
      interior: false,
      twoStory: false,
    });
    expect(result?.visitTotalCents).toBe(visit);
    expect(result?.annualCents).toBe(annual);
  });

  it("adds selected extras per visit and supports a screen price adjustment", () => {
    const result = calculateWindowFieldEstimate({
      squareFeet: 2000,
      cadence: "biannual",
      screens: true,
      interior: true,
      twoStory: true,
      screenPrice: 75,
    });
    expect(result?.visitTotalCents).toBe(52500);
    expect(result?.annualCents).toBe(105000);
    expect(result?.lines.map((line) => line.cents)).toEqual([25000, 7500, 10000, 10000]);
  });

  it("combines solar and windows at the same recurring cadence", () => {
    const result = calculateWindowSolarFieldEstimate({
      squareFeet: 2000,
      panels: 10,
      cadence: "quarterly",
      screens: true,
      interior: false,
      twoStory: false,
    });
    expect(result?.visitTotalCents).toBe(32000);
    expect(result?.annualCents).toBe(128000);
    expect(result?.lines).toHaveLength(3);
  });

  it("prices one annual complete clean and three exterior visits", () => {
    const essential = calculateWindowCarePlan({
      squareFeet: 2000,
      cadence: "quarterly",
      screenRhythm: "annual",
      annualInterior: true,
      twoStory: false,
    });
    expect(essential?.annualResetCents).toBe(35000);
    expect(essential?.maintenanceCents).toBe(20000);
    expect(essential?.annualCents).toBe(95000);

    const plus = calculateWindowCarePlan({
      squareFeet: 2000,
      cadence: "quarterly",
      screenRhythm: "every_visit",
      annualInterior: true,
      twoStory: false,
    });
    expect(plus?.annualResetCents).toBe(35000);
    expect(plus?.maintenanceCents).toBe(25000);
    expect(plus?.annualCents).toBe(110000);
  });

  it("keeps two-story and solar on every visit while interior is annual", () => {
    const result = calculateWindowCarePlan({
      squareFeet: 2000,
      cadence: "triannual",
      screenRhythm: "annual",
      annualInterior: true,
      twoStory: true,
      solarPanels: 10,
      screenPrice: 75,
    });
    expect(result?.annualResetCents).toBe(58500);
    expect(result?.maintenanceCents).toBe(41000);
    expect(result?.annualCents).toBe(140500);
  });

  it("supports four exterior visits with two interior visits", () => {
    const result = calculateFlexibleWindowPlan({
      squareFeet: 2000,
      cadence: "quarterly",
      screenVisitsPerYear: 1,
      interiorVisitsPerYear: 2,
      twoStory: false,
    });
    expect(result?.exteriorVisitCents).toBe(20000);
    expect(result?.fullestVisitCents).toBe(35000);
    expect(result?.annualCents).toBe(105000);
    expect(result?.lines.map((line) => [line.visits, line.annualCents])).toEqual([
      [4, 80000], [1, 5000], [2, 20000],
    ]);
  });

  it("shows the essential and plus recurring examples", () => {
    const standard = { squareFeet: 2000, cadence: "quarterly" as const, interiorVisitsPerYear: 1, twoStory: false };
    expect(calculateFlexibleWindowPlan({ ...standard, screenVisitsPerYear: 1 })?.annualCents).toBe(95000);
    expect(calculateFlexibleWindowPlan({ ...standard, screenVisitsPerYear: 4 })?.annualCents).toBe(110000);
  });

  it.each([
    ["quarterly", 7000, 28000],
    ["triannual", 8000, 24000],
    ["biannual", 9000, 18000],
    ["one_time", 11000, null],
  ] as const)("uses the %s solar panel rate", (cadence, visit, annual) => {
    const result = calculateSolarFieldEstimate({ panels: 10, cadence });
    expect(result?.visitTotalCents).toBe(visit);
    expect(result?.annualCents).toBe(annual);
  });

  it("rejects empty, negative, fractional, or excessive measurements and invalid overrides", () => {
    const windows = {
      cadence: "quarterly" as const,
      screens: false,
      interior: false,
      twoStory: false,
    };
    expect(calculateWindowFieldEstimate({ ...windows, squareFeet: 0 })).toBeNull();
    expect(calculateWindowFieldEstimate({ ...windows, squareFeet: 100.5 })).toBeNull();
    expect(calculateWindowFieldEstimate({ ...windows, squareFeet: 2000, screens: true, screenPrice: -1 })).toBeNull();
    expect(calculateWindowFieldEstimate({ ...windows, squareFeet: 2000, screenPrice: -1 })?.visitTotalCents).toBe(20000);
    expect(calculateSolarFieldEstimate({ panels: -1, cadence: "one_time" })).toBeNull();
    expect(calculateSolarFieldEstimate({ panels: 100_001, cadence: "quarterly" })).toBeNull();
  });
});
