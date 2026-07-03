import type { LegacyBaseline, LegacyMilestone } from "./legacy-baseline";
import { buildDefaultLegacyMilestones } from "./legacy-baseline";
import { getYearsBuilding } from "./business-timeline";

export interface LegacyStoryChapter {
  id: string;
  label: string;
  value: string;
}

export interface LegacyStory {
  milestones: LegacyMilestone[];
  chapters: LegacyStoryChapter[];
  yearsInBusiness: number | null;
  founders: [string, string];
  aboutNoah: string;
  aboutDasan: string;
  companyStandFor: string;
}

export function buildLegacyStory(baseline: LegacyBaseline): LegacyStory {
  const yearsInBusiness = baseline.companyFoundedDate
    ? getYearsBuilding(baseline.companyFoundedDate)
    : null;

  const chapters: LegacyStoryChapter[] = [];

  if (baseline.companyFoundedDate) {
    chapters.push({
      id: "founded",
      label: "Founded",
      value: baseline.companyFoundedDate.slice(0, 4),
    });
  }

  chapters.push({
    id: "founders",
    label: "Founders",
    value: baseline.founders.join(" · "),
  });

  if (baseline.googleReviews > 0) {
    chapters.push({
      id: "reviews",
      label: "Google Reviews",
      value: String(baseline.googleReviews),
    });
  }

  if (baseline.lifetimeRevenue > 0) {
    chapters.push({
      id: "revenue",
      label: "Lifetime Revenue Before Platform",
      value: formatRevenueDisplay(baseline.lifetimeRevenue),
    });
  }

  if (baseline.homesServed > 0) {
    chapters.push({
      id: "homes",
      label: "Homes Served",
      value: formatCountDisplay(baseline.homesServed),
    });
  }

  if (baseline.largestMonth.trim()) {
    chapters.push({
      id: "largest-month",
      label: "Largest Month",
      value: baseline.largestMonth.trim(),
    });
  }

  if (baseline.largestJob.trim()) {
    chapters.push({
      id: "largest-job",
      label: "Largest Job",
      value: baseline.largestJob.trim(),
    });
  }

  if (yearsInBusiness !== null) {
    chapters.push({
      id: "years",
      label: "Years in Business",
      value: String(yearsInBusiness),
    });
  }

  if (baseline.recurringCustomers > 0) {
    chapters.push({
      id: "recurring",
      label: "Recurring Customers",
      value: String(baseline.recurringCustomers),
    });
  }

  return {
    milestones: buildDefaultLegacyMilestones(baseline),
    chapters,
    yearsInBusiness,
    founders: baseline.founders,
    aboutNoah: baseline.aboutNoah,
    aboutDasan: baseline.aboutDasan,
    companyStandFor: baseline.companyStandFor,
  };
}

function formatRevenueDisplay(value: number): string {
  if (value >= 1000) {
    const rounded = Math.round(value / 1000) * 1000;
    return `$${(rounded / 1000).toLocaleString("en-US")}k+`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCountDisplay(value: number): string {
  if (value >= 100) return "100+";
  return String(value);
}
