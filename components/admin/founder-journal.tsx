"use client";

import { useEffect, useState } from "react";
import {
  JOURNAL_PROMPTS,
  createJournalEntry,
  loadFounderJournal,
  saveFounderJournal,
  type FounderJournalEntry,
} from "@/lib/admin/founder-journal";

const inputClassName =
  "w-full rounded-2xl border border-border bg-background/60 px-4 py-3.5 text-sm leading-relaxed text-foreground placeholder:text-muted/45 focus:border-accent/30 focus:outline-none focus:ring-1 focus:ring-accent/15";

interface FounderJournalProps {
  compact?: boolean;
}

export function FounderJournal({ compact = false }: FounderJournalProps) {
  const [entries, setEntries] = useState<FounderJournalEntry[]>([]);
  const [draft, setDraft] = useState({
    learned: "",
    mistake: "",
    proud: "",
    becoming: "",
  });
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    setEntries(loadFounderJournal());
  }, []);

  const handleSave = () => {
    const hasContent = Object.values(draft).some((v) => v.trim());
    if (!hasContent) return;

    const entry = createJournalEntry(draft);
    const next = [entry, ...entries];
    saveFounderJournal(next);
    setEntries(next);
    setDraft({ learned: "", mistake: "", proud: "", becoming: "" });
    setShowForm(false);
  };

  if (compact) {
    const latest = entries[0];
    return (
      <article className="border-t border-border/25 pt-8">
        <p className="text-[10px] uppercase tracking-[0.28em] text-muted/80">
          Founder Journal
        </p>
        {latest ? (
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted/70">
              {latest.monthLabel}
            </p>
            <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-foreground/85">
              {latest.becoming || latest.proud || latest.learned}
            </p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">
            No entries yet.
          </p>
        )}
      </article>
    );
  }

  return (
    <article className="rounded-[2rem] border border-border/60 bg-gradient-to-b from-background/50 to-surface/30 p-6 sm:p-9">
      <div className="max-w-2xl">
        <p className="text-[10px] uppercase tracking-[0.32em] text-muted">
          Founder Journal
        </p>
        <h3 className="mt-3 font-serif text-2xl font-light text-foreground sm:text-3xl">
          Reflections, not tasks.
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Private. Only Noah and Dasan. Imagine reading these entries ten years
          from now.
        </p>
      </div>

      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mt-8 rounded-full border border-border px-6 py-3 text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:border-accent/30 hover:text-accent"
        >
          Write this month&apos;s reflection
        </button>
      )}

      {showForm && (
        <div className="mt-8 max-w-2xl space-y-5">
          {(Object.keys(JOURNAL_PROMPTS) as Array<keyof typeof JOURNAL_PROMPTS>).map(
            (key) => (
              <div key={key}>
                <label className="mb-2 block font-serif text-base font-light text-foreground/90">
                  {JOURNAL_PROMPTS[key]}
                </label>
                <textarea
                  rows={3}
                  className={inputClassName}
                  value={draft[key]}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                />
              </div>
            ),
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              className="rounded-full border border-accent/30 bg-accent/[0.08] px-6 py-3 text-[10px] uppercase tracking-[0.2em] text-accent"
            >
              Preserve reflection
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-full border border-border px-6 py-3 text-[10px] uppercase tracking-[0.2em] text-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {entries.length > 0 && (
        <div className="mt-12 space-y-10 border-t border-border/50 pt-10">
          {entries.map((entry) => (
            <div key={entry.id} className="max-w-2xl">
              <p className="text-[10px] uppercase tracking-[0.24em] text-accent">
                {entry.monthLabel}
              </p>
              <dl className="mt-5 space-y-5">
                {(
                  [
                    ["learned", JOURNAL_PROMPTS.learned],
                    ["mistake", JOURNAL_PROMPTS.mistake],
                    ["proud", JOURNAL_PROMPTS.proud],
                    ["becoming", JOURNAL_PROMPTS.becoming],
                  ] as const
                ).map(([field, prompt]) =>
                  entry[field].trim() ? (
                    <div key={field}>
                      <dt className="text-xs text-muted">{prompt}</dt>
                      <dd className="mt-2 font-serif text-lg font-light leading-relaxed text-foreground">
                        {entry[field]}
                      </dd>
                    </div>
                  ) : null,
                )}
              </dl>
            </div>
          ))}
        </div>
      )}

      <p className="mt-8 text-xs text-muted/70">
        Saved locally in this browser only.
      </p>
    </article>
  );
}
