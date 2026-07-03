import type { LegacyBaseline } from "./legacy-baseline";
import type { OsTimelineEvent } from "./os-timeline";

export type StoryMilestoneKind =
  | "legacy"
  | "operating_system"
  | "future";

export interface StoryMilestone {
  id: string;
  year: string;
  label: string;
  kind: StoryMilestoneKind;
  narrative?: string;
}

interface BuildOurStoryInput {
  legacyBaseline: LegacyBaseline;
  osEvents: OsTimelineEvent[];
}

const FUTURE_PLACEHOLDERS: StoryMilestone[] = [
  {
    id: "future-employee",
    year: "—",
    label: "First employee",
    kind: "future",
    narrative: "A chapter waiting to be written.",
  },
  {
    id: "future-1000-homes",
    year: "—",
    label: "1,000 homes protected",
    kind: "future",
    narrative: "Scale with the same care as the first home.",
  },
  {
    id: "future-1m",
    year: "—",
    label: "One million dollars in lifetime revenue",
    kind: "future",
    narrative: "Built one job, one relationship at a time.",
  },
];

export function buildOurStory({
  legacyBaseline,
  osEvents,
}: BuildOurStoryInput): StoryMilestone[] {
  const items: StoryMilestone[] = [];

  const foundedYear = legacyBaseline.companyFoundedDate?.slice(0, 4);
  if (foundedYear) {
    items.push({
      id: "story-founded",
      year: foundedYear,
      label: "SqueegeeKing founded",
      kind: "legacy",
      narrative: "The first bucket. The first squeegee. The first customer.",
    });
  }

  for (const milestone of legacyBaseline.legacyMilestones) {
    if (milestone.id === "founded") continue;
    items.push({
      id: `legacy-${milestone.id}`,
      year: milestone.year,
      label: milestone.label,
      kind: "legacy",
    });
  }

  if (legacyBaseline.aboutNoah.trim() || legacyBaseline.aboutDasan.trim()) {
    items.push({
      id: "story-founders",
      year: foundedYear ?? "—",
      label: "Noah & Dasan",
      kind: "legacy",
      narrative: [legacyBaseline.aboutNoah, legacyBaseline.aboutDasan]
        .filter(Boolean)
        .join(" "),
    });
  }

  for (const event of osEvents) {
    items.push({
      id: `os-${event.id}`,
      year: event.monthLabel,
      label: event.label,
      kind: "operating_system",
    });
  }

  const hasEmployee = legacyBaseline.hasEmployee;
  const futureItems = FUTURE_PLACEHOLDERS.filter((item) => {
    if (item.id === "future-employee" && hasEmployee) return false;
    return true;
  });

  return [...items, ...futureItems].sort((a, b) => {
    const yearA = parseInt(a.year, 10);
    const yearB = parseInt(b.year, 10);
    if (!Number.isNaN(yearA) && !Number.isNaN(yearB)) return yearA - yearB;
    if (!Number.isNaN(yearA)) return -1;
    if (!Number.isNaN(yearB)) return 1;
    return 0;
  });
}
