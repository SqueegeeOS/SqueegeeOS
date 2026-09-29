export type RecurringCadence = "quarterly" | "triannual" | "biannual";
export type SolarCadence = RecurringCadence | "one_time";

export const VISITS_PER_YEAR: Record<RecurringCadence, number> = {
  quarterly: 4,
  triannual: 3,
  biannual: 2,
};

export const WINDOW_RATE_PER_SQFT: Record<RecurringCadence, number> = {
  quarterly: 0.1,
  triannual: 0.115,
  biannual: 0.125,
};

export const SOLAR_RATE_PER_PANEL: Record<SolarCadence, number> = {
  quarterly: 7,
  triannual: 8,
  biannual: 9,
  one_time: 11,
};

export const WINDOW_ADD_ONS = {
  screens: 50,
  interior: 100,
  twoStory: 100,
} as const;

export type ScreenRhythm = "none" | "annual" | "every_visit";

export interface WindowCarePlanEstimate {
  annualResetCents: number;
  maintenanceCents: number;
  annualCents: number;
  visitsPerYear: number;
  annualResetLines: FieldEstimateLine[];
  maintenanceLines: FieldEstimateLine[];
}

export interface FieldEstimateLine {
  label: string;
  cents: number;
}

export interface FieldEstimate {
  lines: FieldEstimateLine[];
  visitTotalCents: number;
  annualCents: number | null;
  visitsPerYear: number | null;
}

export interface FlexibleWindowPlanEstimate {
  exteriorVisitCents: number;
  fullestVisitCents: number;
  annualCents: number;
  exteriorVisitsPerYear: number;
  lines: Array<{ label: string; visits: number; unitCents: number; annualCents: number }>;
}

function validCount(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= 100_000;
}

function validPrice(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100_000;
}

function cents(value: number): number {
  return Math.round(value * 100);
}

export function calculateWindowFieldEstimate(input: {
  squareFeet: number;
  cadence: RecurringCadence;
  screens: boolean;
  interior: boolean;
  twoStory: boolean;
  screenPrice?: number;
  interiorPrice?: number;
  twoStoryPrice?: number;
}): FieldEstimate | null {
  if (!validCount(input.squareFeet)) return null;

  const screenPrice = input.screenPrice ?? WINDOW_ADD_ONS.screens;
  const interiorPrice = input.interiorPrice ?? WINDOW_ADD_ONS.interior;
  const twoStoryPrice = input.twoStoryPrice ?? WINDOW_ADD_ONS.twoStory;
  if (
    (input.screens && !validPrice(screenPrice)) ||
    (input.interior && !validPrice(interiorPrice)) ||
    (input.twoStory && !validPrice(twoStoryPrice))
  ) return null;

  const baseCents = cents(input.squareFeet * WINDOW_RATE_PER_SQFT[input.cadence]);
  const lines: FieldEstimateLine[] = [
    { label: "Exterior windows", cents: baseCents },
  ];
  if (input.screens) lines.push({ label: "Screens cleaned", cents: cents(screenPrice) });
  if (input.interior) lines.push({ label: "Interior windows", cents: cents(interiorPrice) });
  if (input.twoStory) lines.push({ label: "Two-story home", cents: cents(twoStoryPrice) });

  const visitTotalCents = lines.reduce((sum, line) => sum + line.cents, 0);
  const visitsPerYear = VISITS_PER_YEAR[input.cadence];
  return {
    lines,
    visitTotalCents,
    annualCents: visitTotalCents * visitsPerYear,
    visitsPerYear,
  };
}

export function calculateSolarFieldEstimate(input: {
  panels: number;
  cadence: SolarCadence;
  panelRate?: number;
}): FieldEstimate | null {
  if (!validCount(input.panels)) return null;
  const panelRate = input.panelRate ?? SOLAR_RATE_PER_PANEL[input.cadence];
  if (!validPrice(panelRate)) return null;

  const visitTotalCents = cents(input.panels * panelRate);
  const visitsPerYear = input.cadence === "one_time" ? null : VISITS_PER_YEAR[input.cadence];
  return {
    lines: [{ label: `${input.panels} panels × $${panelRate} each`, cents: visitTotalCents }],
    visitTotalCents,
    annualCents: visitsPerYear === null ? null : visitTotalCents * visitsPerYear,
    visitsPerYear,
  };
}

export function calculateWindowSolarFieldEstimate(input: Parameters<typeof calculateWindowFieldEstimate>[0] & {
  panels: number;
}): FieldEstimate | null {
  const windows = calculateWindowFieldEstimate(input);
  const solar = calculateSolarFieldEstimate({ panels: input.panels, cadence: input.cadence });
  if (!windows || !solar) return null;
  return {
    lines: [...windows.lines, ...solar.lines],
    visitTotalCents: windows.visitTotalCents + solar.visitTotalCents,
    annualCents: (windows.annualCents ?? 0) + (solar.annualCents ?? 0),
    visitsPerYear: windows.visitsPerYear,
  };
}

/** One complete visit every year, followed by exterior maintenance visits. */
export function calculateWindowCarePlan(input: {
  squareFeet: number;
  cadence: RecurringCadence;
  screenRhythm: ScreenRhythm;
  annualInterior: boolean;
  twoStory: boolean;
  solarPanels?: number | null;
  screenPrice?: number;
  interiorPrice?: number;
  twoStoryPrice?: number;
}): WindowCarePlanEstimate | null {
  if (!validCount(input.squareFeet)) return null;
  if (input.solarPanels != null && !validCount(input.solarPanels)) return null;

  const screenPrice = input.screenPrice ?? WINDOW_ADD_ONS.screens;
  const interiorPrice = input.interiorPrice ?? WINDOW_ADD_ONS.interior;
  const twoStoryPrice = input.twoStoryPrice ?? WINDOW_ADD_ONS.twoStory;
  if (
    (input.screenRhythm !== "none" && !validPrice(screenPrice)) ||
    (input.annualInterior && !validPrice(interiorPrice)) ||
    (input.twoStory && !validPrice(twoStoryPrice))
  ) return null;

  const baseCents = cents(input.squareFeet * WINDOW_RATE_PER_SQFT[input.cadence]);
  const storyCents = input.twoStory ? cents(twoStoryPrice) : 0;
  const solarCents = input.solarPanels == null
    ? 0
    : cents(input.solarPanels * SOLAR_RATE_PER_PANEL[input.cadence]);
  const commonLines: FieldEstimateLine[] = [
    { label: "Exterior windows", cents: baseCents },
  ];
  if (storyCents > 0) commonLines.push({ label: "Two-story home", cents: storyCents });
  if (solarCents > 0) commonLines.push({ label: "Solar panels", cents: solarCents });

  const annualResetLines = [...commonLines];
  const maintenanceLines = [...commonLines];
  if (input.screenRhythm !== "none") {
    const line = { label: "Screens cleaned", cents: cents(screenPrice) };
    annualResetLines.push(line);
    if (input.screenRhythm === "every_visit") maintenanceLines.push(line);
  }
  if (input.annualInterior) {
    annualResetLines.push({ label: "Interior windows", cents: cents(interiorPrice) });
  }

  const annualResetCents = annualResetLines.reduce((sum, line) => sum + line.cents, 0);
  const maintenanceCents = maintenanceLines.reduce((sum, line) => sum + line.cents, 0);
  const visitsPerYear = VISITS_PER_YEAR[input.cadence];
  return {
    annualResetCents,
    maintenanceCents,
    annualCents: annualResetCents + maintenanceCents * (visitsPerYear - 1),
    visitsPerYear,
    annualResetLines,
    maintenanceLines,
  };
}

/** Service frequency is independent within the recurring window-care rhythm. */
export function calculateFlexibleWindowPlan(input: {
  squareFeet: number;
  cadence: RecurringCadence;
  screenVisitsPerYear: number;
  interiorVisitsPerYear: number;
  twoStory: boolean;
  screenPrice?: number;
  interiorPrice?: number;
  twoStoryPrice?: number;
}): FlexibleWindowPlanEstimate | null {
  const exteriorVisitsPerYear = VISITS_PER_YEAR[input.cadence];
  if (!validCount(input.squareFeet)) return null;
  if (
    !Number.isSafeInteger(input.screenVisitsPerYear) ||
    input.screenVisitsPerYear < 0 ||
    input.screenVisitsPerYear > exteriorVisitsPerYear ||
    !Number.isSafeInteger(input.interiorVisitsPerYear) ||
    input.interiorVisitsPerYear < 0 ||
    input.interiorVisitsPerYear > exteriorVisitsPerYear
  ) return null;

  const screenPrice = input.screenPrice ?? WINDOW_ADD_ONS.screens;
  const interiorPrice = input.interiorPrice ?? WINDOW_ADD_ONS.interior;
  const twoStoryPrice = input.twoStoryPrice ?? WINDOW_ADD_ONS.twoStory;
  if (
    (input.screenVisitsPerYear > 0 && !validPrice(screenPrice)) ||
    (input.interiorVisitsPerYear > 0 && !validPrice(interiorPrice)) ||
    (input.twoStory && !validPrice(twoStoryPrice))
  ) return null;

  const exteriorVisitCents = cents(input.squareFeet * WINDOW_RATE_PER_SQFT[input.cadence]) +
    (input.twoStory ? cents(twoStoryPrice) : 0);
  const screenCents = cents(screenPrice);
  const interiorCents = cents(interiorPrice);
  const lines = [
    { label: "Exterior windows", visits: exteriorVisitsPerYear, unitCents: exteriorVisitCents, annualCents: exteriorVisitCents * exteriorVisitsPerYear },
    { label: "Screens cleaned", visits: input.screenVisitsPerYear, unitCents: screenCents, annualCents: screenCents * input.screenVisitsPerYear },
    { label: "Interior windows", visits: input.interiorVisitsPerYear, unitCents: interiorCents, annualCents: interiorCents * input.interiorVisitsPerYear },
  ].filter((line) => line.visits > 0);
  return {
    exteriorVisitCents,
    fullestVisitCents: exteriorVisitCents +
      (input.screenVisitsPerYear > 0 ? screenCents : 0) +
      (input.interiorVisitsPerYear > 0 ? interiorCents : 0),
    annualCents: lines.reduce((sum, line) => sum + line.annualCents, 0),
    exteriorVisitsPerYear,
    lines,
  };
}
