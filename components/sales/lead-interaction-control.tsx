"use client";

import { useState } from "react";
import type {
  RecordSalesLeadInteractionInput,
  SalesLeadInteraction,
  SalesLeadInteractionChannel,
  SalesLeadInteractionOutcome,
  SalesRepLead,
} from "@/lib/sales/workspace-types";

const OUTCOMES: Array<{
  value: SalesLeadInteractionOutcome;
  label: string;
  detail: string;
  daysAhead: number | null;
}> = [
  {
    value: "no_answer",
    label: "No answer",
    detail: "Try again tomorrow",
    daysAhead: 1,
  },
  {
    value: "spoke_follow_up",
    label: "Spoke · follow up",
    detail: "Keep the conversation moving",
    daysAhead: 3,
  },
  {
    value: "presentation_scheduled",
    label: "Presentation set",
    detail: "Put the pitch on deck",
    daysAhead: 1,
  },
  {
    value: "not_interested",
    label: "Not interested",
    detail: "Close with a reason",
    daysAhead: null,
  },
];

const CHANNEL_LABELS: Record<SalesLeadInteractionChannel, string> = {
  call: "Call",
  email: "Email",
  sms: "Text",
  in_person: "In person",
};

const OUTCOME_LABELS: Record<SalesLeadInteractionOutcome, string> = {
  no_answer: "No answer",
  spoke_follow_up: "Spoke · follow up",
  presentation_scheduled: "Presentation set",
  not_interested: "Not interested",
};

function localDateTimeInput(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function suggestedNextAction(daysAhead: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setHours(daysAhead === 0 ? 17 : 9, 0, 0, 0);
  if (date.getTime() <= Date.now()) date.setDate(date.getDate() + 1);
  return localDateTimeInput(date.toISOString());
}

function interactionTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function nextActionLabel(value: string | null): string {
  if (!value) return "Lead closed";
  return `Next ${interactionTime(value)}`;
}

function availableChannels(lead: SalesRepLead): SalesLeadInteractionChannel[] {
  const channels: SalesLeadInteractionChannel[] = [];
  if (lead.phone) channels.push("call");
  if (lead.email && lead.emailConsentStatus === "opted_in") {
    channels.push("email");
  }
  if (lead.phone && lead.smsConsentStatus === "opted_in") {
    channels.push("sms");
  }
  channels.push("in_person");
  return channels;
}

function initialChannel(lead: SalesRepLead): SalesLeadInteractionChannel {
  return availableChannels(lead)[0] ?? "in_person";
}

function Timeline({ interactions }: { interactions: SalesLeadInteraction[] }) {
  if (interactions.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-white/10 px-3 py-3 text-xs leading-5 text-white/38">
        No follow-up outcome recorded yet. The first one becomes the beginning of
        this lead&apos;s permanent conversation memory.
      </p>
    );
  }

  return (
    <ol className="space-y-2">
      {interactions.map((interaction) => (
        <li
          key={interaction.id}
          className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-white/78">
              {OUTCOME_LABELS[interaction.outcome]}
            </p>
            <p className="text-[9px] uppercase tracking-[0.12em] text-white/32">
              {CHANNEL_LABELS[interaction.channel]} · {interactionTime(interaction.occurredAt)}
            </p>
          </div>
          {interaction.note ? (
            <p className="mt-2 text-xs leading-5 text-white/48">
              {interaction.note}
            </p>
          ) : null}
          <p className="mt-2 text-[10px] text-accent/72">
            {nextActionLabel(interaction.nextFollowUpAt)} · recorded by{" "}
            {interaction.recordedBy === "owner" ? "owner" : "rep"}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function LeadInteractionControl({
  lead,
  onRecord,
  showContactActions = true,
}: {
  lead: SalesRepLead;
  onRecord: (input: RecordSalesLeadInteractionInput) => Promise<string | void>;
  showContactActions?: boolean;
}) {
  const channels = availableChannels(lead);
  const [expanded, setExpanded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [channel, setChannel] = useState<SalesLeadInteractionChannel>(() =>
    initialChannel(lead),
  );
  const [outcome, setOutcome] = useState<SalesLeadInteractionOutcome>(
    "no_answer",
  );
  const [nextFollowUpAt, setNextFollowUpAt] = useState(() =>
    suggestedNextAction(1),
  );
  const [note, setNote] = useState("");
  const [clientEventId, setClientEventId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const activeChannel = channels.includes(channel)
    ? channel
    : (channels[0] ?? "in_person");

  function chooseOutcome(nextOutcome: SalesLeadInteractionOutcome) {
    setOutcome(nextOutcome);
    const choice = OUTCOMES.find((item) => item.value === nextOutcome);
    setNextFollowUpAt(
      choice?.daysAhead === null
        ? ""
        : suggestedNextAction(choice?.daysAhead ?? 1),
    );
  }

  function openRecorder() {
    const next = !expanded;
    if (next && !clientEventId) setClientEventId(crypto.randomUUID());
    setExpanded(next);
    setError(null);
    setFeedback(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setFeedback(null);
    const retryId = clientEventId || crypto.randomUUID();
    setClientEventId(retryId);

    try {
      const message = await onRecord({
        leadId: lead.id,
        clientEventId: retryId,
        channel: activeChannel,
        outcome,
        note,
        nextFollowUpAt: nextFollowUpAt
          ? new Date(nextFollowUpAt).toISOString()
          : null,
        expectedLeadUpdatedAt: lead.updatedAt,
      });
      setFeedback(message ?? "Outcome recorded. Nothing was sent.");
      setExpanded(false);
      setNote("");
      setClientEventId(crypto.randomUUID());
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "The follow-up outcome could not be recorded.",
      );
    } finally {
      setSaving(false);
    }
  }

  const phone = lead.phone?.replace(/[^\d+]/g, "") ?? "";
  const canText = Boolean(phone) && lead.smsConsentStatus === "opted_in";
  const canEmail = Boolean(lead.email) && lead.emailConsentStatus === "opted_in";

  return (
    <div className="mt-4 rounded-2xl border border-white/[0.075] bg-white/[0.018] p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        {showContactActions && phone ? (
          <a
            href={`tel:${phone}`}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-white/75"
          >
            Call
          </a>
        ) : null}
        {showContactActions && canText ? (
          <a
            href={`sms:${phone}`}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-white/75"
          >
            Open text
          </a>
        ) : null}
        {showContactActions && canEmail ? (
          <a
            href={`mailto:${encodeURIComponent(lead.email ?? "")}`}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-white/75"
          >
            Open email
          </a>
        ) : null}
        <button
          type="button"
          onClick={openRecorder}
          aria-expanded={expanded}
          className="inline-flex min-h-11 flex-[1.2] items-center justify-center rounded-xl border border-accent/30 bg-accent/[0.08] px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-accent"
        >
          {expanded ? "Close outcome" : "Record outcome"}
        </button>
      </div>
      <p className="mt-2 text-[10px] leading-4 text-white/32">
        {showContactActions
          ? "Contact links only open your device app. Recording below never sends, schedules, enrolls, invoices, or charges."
          : "Recording below never sends, schedules, enrolls, invoices, or charges."}
      </p>

      {feedback ? (
        <p className="mt-3 text-xs text-emerald-200" aria-live="polite">
          {feedback}
        </p>
      ) : null}

      {expanded ? (
        <form
          onSubmit={submit}
          className="mt-4 space-y-4 border-t border-white/[0.07] pt-4"
        >
          <fieldset>
            <legend className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/40">
              What happened?
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {OUTCOMES.map((choice) => (
                <button
                  key={choice.value}
                  type="button"
                  onClick={() => chooseOutcome(choice.value)}
                  aria-pressed={outcome === choice.value}
                  className={`min-h-[4.5rem] rounded-xl border px-3 py-2 text-left transition ${
                    outcome === choice.value
                      ? "border-accent/45 bg-accent/[0.1] text-white"
                      : "border-white/[0.08] bg-black/15 text-white/55"
                  }`}
                >
                  <span className="block text-xs font-semibold">{choice.label}</span>
                  <span className="mt-1 block text-[9px] leading-4 opacity-55">
                    {choice.detail}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/40">
                Channel
              </span>
              <select
                value={activeChannel}
                onChange={(event) =>
                  setChannel(event.target.value as SalesLeadInteractionChannel)
                }
                className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-[#11100e] px-3 text-sm text-white outline-none focus:border-accent/45"
              >
                {channels.map((value) => (
                  <option key={value} value={value}>
                    {CHANNEL_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
            {outcome !== "not_interested" ? (
              <label className="block">
                <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/40">
                  Next action
                </span>
                <input
                  type="datetime-local"
                  required
                  value={nextFollowUpAt}
                  onChange={(event) => setNextFollowUpAt(event.target.value)}
                  className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-[#11100e] px-3 text-sm text-white outline-none focus:border-accent/45"
                />
              </label>
            ) : null}
          </div>

          <label className="block">
            <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/40">
              {outcome === "not_interested"
                ? "Reason · required"
                : "Conversation note · optional"}
            </span>
            <textarea
              rows={3}
              required={outcome === "not_interested"}
              minLength={outcome === "not_interested" ? 3 : undefined}
              maxLength={1200}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What did they say, and what should the next person know?"
              className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-[#11100e] px-3 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/25 focus:border-accent/45"
            />
          </label>

          {error ? (
            <p role="alert" className="text-xs leading-5 text-red-300">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={saving}
            className="min-h-12 w-full rounded-xl bg-accent px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-background transition active:scale-[0.99] disabled:cursor-wait disabled:opacity-55"
          >
            {saving ? "Recording safely…" : "Record outcome + next move"}
          </button>
        </form>
      ) : null}

      <button
        type="button"
        onClick={() => setHistoryOpen((current) => !current)}
        aria-expanded={historyOpen}
        className="mt-3 min-h-10 w-full rounded-xl text-left text-[10px] font-bold uppercase tracking-[0.12em] text-white/42"
      >
        {historyOpen ? "Hide history" : "Show history"} · {lead.recentInteractions.length}
      </button>
      {historyOpen ? <Timeline interactions={lead.recentInteractions} /> : null}
    </div>
  );
}
