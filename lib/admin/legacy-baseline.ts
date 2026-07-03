export const LEGACY_BASELINE_KEY = "squeegeeking:legacy-baseline";
export const FOUNDER_ONBOARDING_KEY = "squeegeeking:founder-onboarding-complete";

export interface LegacyMilestone {
  id: string;
  year: string;
  label: string;
}

export interface LegacyBaseline {
  configured: boolean;
  onboardingComplete: boolean;
  companyFoundedDate: string | null;
  founders: [string, string];
  googleReviews: number;
  lifetimeRevenue: number;
  homesServed: number;
  largestMonth: string;
  largestJob: string;
  recurringCustomers: number;
  aboutNoah: string;
  aboutDasan: string;
  companyStandFor: string;
  portraitNoah: string | null;
  portraitDasan: string | null;
  legacyMilestones: LegacyMilestone[];
  /** Growth-journey fields — honored pre-OS operational history */
  lifetimeArr: number;
  closedJobs: number;
  membershipsSold: number;
  activeMembers: number;
  fiveStarReviews: number;
  homesProtected: number;
  hasEmployee: boolean;
  hasCompanyTruck: boolean;
  multiCityExpansion: boolean;
  updatedAt: string | null;
}

export const DEFAULT_FOUNDERS: [string, string] = [
  "Noah Thomas",
  "Dasan Gramps",
];

export const EMPTY_LEGACY_BASELINE: LegacyBaseline = {
  configured: false,
  onboardingComplete: false,
  companyFoundedDate: null,
  founders: DEFAULT_FOUNDERS,
  googleReviews: 0,
  lifetimeRevenue: 0,
  homesServed: 0,
  largestMonth: "",
  largestJob: "",
  recurringCustomers: 0,
  aboutNoah: "",
  aboutDasan: "",
  companyStandFor: "",
  portraitNoah: null,
  portraitDasan: null,
  legacyMilestones: [],
  lifetimeArr: 0,
  closedJobs: 0,
  membershipsSold: 0,
  activeMembers: 0,
  fiveStarReviews: 0,
  homesProtected: 0,
  hasEmployee: false,
  hasCompanyTruck: false,
  multiCityExpansion: false,
  updatedAt: null,
};

function normalizeBaseline(parsed: Partial<LegacyBaseline>): LegacyBaseline {
  const googleReviews = parsed.googleReviews ?? parsed.fiveStarReviews ?? 0;
  const homesServed = parsed.homesServed ?? parsed.homesProtected ?? 0;

  return {
    ...EMPTY_LEGACY_BASELINE,
    ...parsed,
    founders:
      parsed.founders?.length === 2
        ? [parsed.founders[0], parsed.founders[1]]
        : DEFAULT_FOUNDERS,
    googleReviews,
    fiveStarReviews: googleReviews,
    homesServed,
    homesProtected: homesServed,
    recurringCustomers:
      parsed.recurringCustomers ?? parsed.activeMembers ?? parsed.membershipsSold ?? 0,
    activeMembers: parsed.activeMembers ?? parsed.recurringCustomers ?? 0,
    legacyMilestones: parsed.legacyMilestones ?? [],
    configured: Boolean(parsed.configured),
    onboardingComplete: Boolean(
      parsed.onboardingComplete ?? parsed.configured,
    ),
  };
}

export function normalizeLegacyBaseline(
  parsed: Partial<LegacyBaseline>,
): LegacyBaseline {
  return normalizeBaseline(parsed);
}

export function loadLegacyBaseline(): LegacyBaseline {
  if (typeof window === "undefined") return EMPTY_LEGACY_BASELINE;

  const raw = localStorage.getItem(LEGACY_BASELINE_KEY);
  if (!raw) return EMPTY_LEGACY_BASELINE;

  try {
    return normalizeBaseline(JSON.parse(raw) as Partial<LegacyBaseline>);
  } catch {
    return EMPTY_LEGACY_BASELINE;
  }
}

export function saveLocalLegacyBaseline(baseline: LegacyBaseline): LegacyBaseline {
  if (typeof window === "undefined") {
    return normalizeBaseline({
      ...baseline,
      configured: true,
      updatedAt: new Date().toISOString(),
    });
  }

  const normalized = normalizeBaseline({
    ...baseline,
    configured: true,
    fiveStarReviews: baseline.googleReviews,
    homesProtected: baseline.homesServed,
    activeMembers: baseline.recurringCustomers || baseline.activeMembers,
    updatedAt: new Date().toISOString(),
  });

  localStorage.setItem(LEGACY_BASELINE_KEY, JSON.stringify(normalized));
  if (normalized.onboardingComplete) {
    localStorage.setItem(FOUNDER_ONBOARDING_KEY, "true");
  }

  return normalized;
}

/** Local browser cache only — prefer persistHeadquartersProfile for cloud sync. */
export function saveLegacyBaseline(baseline: LegacyBaseline): void {
  saveLocalLegacyBaseline(baseline);
}

export function isFounderOnboardingComplete(): boolean {
  if (typeof window === "undefined") return false;
  const legacy = loadLegacyBaseline();
  return legacy.onboardingComplete;
}

export function legacyBaselineHasHistory(baseline: LegacyBaseline): boolean {
  if (!baseline.configured) return false;
  return (
    baseline.lifetimeRevenue > 0 ||
    baseline.lifetimeArr > 0 ||
    baseline.closedJobs > 0 ||
    baseline.membershipsSold > 0 ||
    baseline.homesServed > 0 ||
    baseline.recurringCustomers > 0 ||
    baseline.googleReviews > 0 ||
    baseline.hasEmployee ||
    baseline.hasCompanyTruck ||
    baseline.multiCityExpansion ||
    Boolean(baseline.companyFoundedDate) ||
    baseline.legacyMilestones.length > 0 ||
    Boolean(baseline.aboutNoah.trim()) ||
    Boolean(baseline.companyStandFor.trim())
  );
}

export function buildDefaultLegacyMilestones(
  baseline: LegacyBaseline,
): LegacyMilestone[] {
  const milestones: LegacyMilestone[] = [];
  const foundedYear = baseline.companyFoundedDate?.slice(0, 4);

  if (foundedYear) {
    milestones.push({
      id: "founded",
      year: foundedYear,
      label: "SqueegeeKing Founded",
    });
  }

  if (baseline.googleReviews >= 100) {
    milestones.push({
      id: "reviews-100",
      year: new Date().getFullYear().toString(),
      label: "100 Google Reviews",
    });
  } else if (baseline.googleReviews > 0) {
    milestones.push({
      id: "reviews",
      year: new Date().getFullYear().toString(),
      label: `${baseline.googleReviews} Google Reviews`,
    });
  }

  if (baseline.lifetimeRevenue >= 50_000) {
    milestones.push({
      id: "revenue-50k",
      year: new Date().getFullYear().toString(),
      label: "$50,000 Lifetime Revenue",
    });
  } else if (baseline.lifetimeRevenue > 0) {
    milestones.push({
      id: "revenue",
      year: foundedYear ?? new Date().getFullYear().toString(),
      label: `${formatLegacyCurrency(baseline.lifetimeRevenue)} Lifetime Revenue`,
    });
  }

  if (baseline.homesServed >= 100) {
    milestones.push({
      id: "homes-100",
      year: new Date().getFullYear().toString(),
      label: "100 Homes Served",
    });
  } else if (baseline.homesServed > 0) {
    milestones.push({
      id: "homes",
      year: foundedYear ?? new Date().getFullYear().toString(),
      label: `${baseline.homesServed} Homes Served`,
    });
  }

  for (const custom of baseline.legacyMilestones) {
    if (!milestones.some((item) => item.id === custom.id)) {
      milestones.push(custom);
    }
  }

  return milestones.sort((a, b) => Number(a.year) - Number(b.year));
}

function formatLegacyCurrency(value: number): string {
  if (value >= 1000) {
    return `$${Math.round(value / 1000)}k`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
