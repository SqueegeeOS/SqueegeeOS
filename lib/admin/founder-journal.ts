import { FOUNDER_JOURNAL_KEY } from "./config";

export interface FounderJournalEntry {
  id: string;
  monthLabel: string;
  learned: string;
  mistake: string;
  proud: string;
  becoming: string;
  createdAt: string;
}

export const JOURNAL_PROMPTS = {
  learned: "What did we learn this month?",
  mistake: "What was our biggest mistake?",
  proud: "What are we proud of?",
  becoming: "What kind of company are we becoming?",
} as const;

function currentMonthLabel(): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date());
}

export function loadFounderJournal(): FounderJournalEntry[] {
  if (typeof window === "undefined") return [];

  const raw = localStorage.getItem(FOUNDER_JOURNAL_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as FounderJournalEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveFounderJournal(entries: FounderJournalEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(FOUNDER_JOURNAL_KEY, JSON.stringify(entries));
}

export function createJournalEntry(
  fields: Omit<FounderJournalEntry, "id" | "monthLabel" | "createdAt">,
): FounderJournalEntry {
  return {
    id: `journal-${Date.now()}`,
    monthLabel: currentMonthLabel(),
    createdAt: new Date().toISOString(),
    ...fields,
  };
}
