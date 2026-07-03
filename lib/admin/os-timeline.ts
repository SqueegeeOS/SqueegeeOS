import type { ClosedJob } from "./closed-jobs-types";
import { formatBusinessDate } from "./business-timeline";
import { filterOperatingSystemJobs } from "./growth-journey";

export interface OsTimelineEvent {
  id: string;
  date: string;
  monthLabel: string;
  label: string;
  automatic: boolean;
}

interface OsTimelineInput {
  osLaunchedDate: string;
  closedJobs: ClosedJob[];
  homeCarePlansCreated: number;
  signedAgreements: number;
}

function monthLabelFromDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(parsed);
}

export function computeOsTimeline({
  osLaunchedDate,
  closedJobs,
  homeCarePlansCreated,
  signedAgreements,
}: OsTimelineInput): OsTimelineEvent[] {
  const osJobs = filterOperatingSystemJobs(closedJobs, osLaunchedDate);
  const events: OsTimelineEvent[] = [
    {
      id: "platform-activated",
      date: osLaunchedDate,
      monthLabel: monthLabelFromDate(osLaunchedDate),
      label: "Platform Activated",
      automatic: true,
    },
  ];

  const firstJob = osJobs[osJobs.length - 1];
  if (firstJob) {
    events.push({
      id: "first-closed-job",
      date: firstJob.closedDate,
      monthLabel: monthLabelFromDate(firstJob.closedDate),
      label: "First Closed Job Logged",
      automatic: true,
    });
  }

  const firstMembership = [...osJobs]
    .reverse()
    .find((job) => job.saleType === "recurring_membership");
  if (firstMembership) {
    events.push({
      id: "first-membership",
      date: firstMembership.closedDate,
      monthLabel: monthLabelFromDate(firstMembership.closedDate),
      label: "First Membership Sold",
      automatic: true,
    });
  }

  if (homeCarePlansCreated > 0) {
    events.push({
      id: "first-home-care-plan",
      date: osLaunchedDate,
      monthLabel: monthLabelFromDate(osLaunchedDate),
      label: "First Home Care Plan Generated",
      automatic: true,
    });
  }

  if (signedAgreements > 0) {
    events.push({
      id: "first-agreement",
      date: osLaunchedDate,
      monthLabel: monthLabelFromDate(osLaunchedDate),
      label: "First Signed Agreement",
      automatic: true,
    });
  }

  const membershipCount = osJobs.filter(
    (job) => job.saleType === "recurring_membership",
  ).length;
  if (membershipCount >= 1) {
    events.push({
      id: "memberships-tracking",
      date: osJobs[0]?.closedDate ?? osLaunchedDate,
      monthLabel: monthLabelFromDate(osJobs[0]?.closedDate ?? osLaunchedDate),
      label: `${membershipCount} Membership${membershipCount === 1 ? "" : "s"} in OS Ledger`,
      automatic: true,
    });
  }

  if (osJobs.length >= 5) {
    events.push({
      id: "jobs-milestone",
      date: osJobs[0].closedDate,
      monthLabel: monthLabelFromDate(osJobs[0].closedDate),
      label: `${osJobs.length} Closed Jobs Tracked`,
      automatic: true,
    });
  }

  const deduped = new Map<string, OsTimelineEvent>();
  for (const event of events) {
    deduped.set(event.id, event);
  }

  return [...deduped.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function formatOsEventDate(date: string): string {
  return formatBusinessDate(date);
}
