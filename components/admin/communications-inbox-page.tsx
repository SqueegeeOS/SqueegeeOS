"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminPinGate } from "@/components/admin/admin-pin-gate";
import { CommunicationsLaunchReadinessPanel } from "@/components/admin/communications-launch-readiness";
import { HqFounderNav } from "@/components/admin/hq-founder-nav";
import { AmbientStage } from "@/components/craft/ambient-stage";
import { GlassCard } from "@/components/craft/glass-card";
import { MotionReveal } from "@/components/craft/motion-reveal";
import { ShimmerBlock } from "@/components/motion/shimmer-block";
import { getAdminRequestHeaders } from "@/lib/admin/api-client";
import { useAdminUnlockedState } from "@/lib/admin/use-admin-unlocked-state";
import type { LeadIntakeStatus } from "@/lib/acquisition/lead-record";
import { formatLeadIntakeStatus } from "@/lib/acquisition/leads/inbox";
import {
  manualSendFingerprint,
  resolveManualSendAttempt,
  type ManualSendAttempt,
} from "@/lib/communications/manual-send-idempotency";
import {
  craftEyebrow,
  craftHeading,
  craftInput,
  craftPrimaryButton,
  craftTextarea,
} from "@/lib/craft/tokens";

type CommunicationsChannel = "email" | "sms";
type CommunicationsDirection = "inbound" | "outbound" | "system";

interface CommunicationsMessage {
  id: string;
  channel: CommunicationsChannel;
  direction: CommunicationsDirection;
  body: string;
  subject: string | null;
  status: string;
  occurredAt: string;
}

interface ConversationContact {
  email: string | null;
  phone: string | null;
}

interface ConversationConsent {
  emailStatus: string;
  smsStatus: string;
}

interface ConversationVerification {
  emailStatus: string;
  smsStatus: string;
}

interface CommunicationsConversation {
  id: string;
  leadIntakeId: string | null;
  leadStatus: LeadIntakeStatus | null;
  customerName: string;
  preview: string;
  updatedAt: string;
  unreadCount: number;
  channels: CommunicationsChannel[];
  contact: ConversationContact;
  consent: ConversationConsent;
  verification: ConversationVerification;
  propertyLabel: string | null;
  messages: CommunicationsMessage[] | null;
}

interface ProviderConfiguration {
  configured: boolean | null;
  fromLabel: string | null;
  detail: string | null;
}

interface CommunicationsConfiguration {
  email: ProviderConfiguration;
  sms: ProviderConfiguration;
}

interface CommunicationsAutomationRule {
  id: AutomationRuleId;
  channel: CommunicationsChannel;
  enabled: boolean;
  consentRequired: boolean;
  verifiedContactRequired: boolean;
  scheduleOffsetMinutes: number;
  updatedAt: string | null;
}

type AutomationRuleId =
  | "lead_acknowledgement_email"
  | "lead_acknowledgement_sms"
  | "visit_reminder_24h_email"
  | "visit_reminder_24h_sms"
  | "review_request_after_visit_sms";

interface AutomationRulePresentation {
  id: AutomationRuleId;
  title: string;
  description: string;
  channel: CommunicationsChannel;
  timing: string;
}

interface NormalizedInboxResponse {
  conversations: CommunicationsConversation[];
  selectedConversation: CommunicationsConversation | null;
  configuration: CommunicationsConfiguration;
  configurationProvided: boolean;
}

const EMPTY_CONFIGURATION: CommunicationsConfiguration = {
  email: { configured: null, fromLabel: null, detail: null },
  sms: { configured: null, fromLabel: null, detail: null },
};

const AUTOMATION_RULES: AutomationRulePresentation[] = [
  {
    id: "lead_acknowledgement_email",
    title: "Lead email acknowledgement",
    description:
      "Send a reassuring confirmation as soon as a website request is safely recorded.",
    channel: "email",
    timing: "After website request",
  },
  {
    id: "lead_acknowledgement_sms",
    title: "Lead text acknowledgement",
    description:
      "Send a brief first-touch text only when the customer explicitly chose and approved texting.",
    channel: "sms",
    timing: "After website request",
  },
  {
    id: "visit_reminder_24h_email",
    title: "Visit email reminder",
    description:
      "Email customers before a verified, matched Jobber visit appears on their HomeAtlas schedule.",
    channel: "email",
    timing: "Target: 24 hours before",
  },
  {
    id: "visit_reminder_24h_sms",
    title: "Visit text reminder",
    description:
      "Text a concise visit reminder when the destination is verified and active consent is on file.",
    channel: "sms",
    timing: "Target: 24 hours before",
  },
  {
    id: "review_request_after_visit_sms",
    title: "Completed-visit review request",
    description:
      "Ask for one honest Google review after a verified completed visit with saved proof and no open service issue.",
    channel: "sms",
    timing: "At least 24 hours after",
  },
];

const TERMINAL_FAILURE_STATUSES = new Set([
  "failed",
  "undelivered",
  "bounced",
  "suppressed",
  "canceled",
  "cancelled",
]);

const LEAD_PIPELINE: Array<{
  status: LeadIntakeStatus;
  label: string;
}> = [
  { status: "new", label: "New" },
  { status: "contacted", label: "Contacted" },
  { status: "scheduled", label: "Quoted" },
  { status: "booked", label: "Booked" },
  { status: "archived", label: "Lost" },
];

function normalizeLeadStatus(value: unknown): LeadIntakeStatus | null {
  return typeof value === "string" &&
    LEAD_PIPELINE.some((stage) => stage.status === value)
    ? (value as LeadIntakeStatus)
    : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function firstString(
  record: Record<string, unknown> | null,
  keys: string[],
): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function firstNumber(
  record: Record<string, unknown> | null,
  keys: string[],
): number | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function firstBoolean(
  record: Record<string, unknown> | null,
  keys: string[],
): boolean | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
  }
  return null;
}

function isAutomationRuleId(value: string): value is AutomationRuleId {
  return AUTOMATION_RULES.some((rule) => rule.id === value);
}

function normalizeAutomationRule(value: unknown): CommunicationsAutomationRule | null {
  const record = asRecord(value);
  const id = firstString(record, ["id"]);
  const channel = normalizeChannel(record?.channel);
  const enabled = firstBoolean(record, ["enabled"]);
  if (!id || !isAutomationRuleId(id) || !channel || enabled === null) return null;

  return {
    id,
    channel,
    enabled,
    consentRequired:
      firstBoolean(record, ["consentRequired", "consent_required"]) ??
      channel === "sms",
    verifiedContactRequired:
      firstBoolean(record, [
        "verifiedContactRequired",
        "verified_contact_required",
      ]) ?? false,
    scheduleOffsetMinutes:
      firstNumber(record, ["scheduleOffsetMinutes", "schedule_offset_minutes"]) ??
      0,
    updatedAt: firstString(record, ["updatedAt", "updated_at"]),
  };
}

function normalizeChannel(value: unknown): CommunicationsChannel | null {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase();
  if (normalized === "email") return "email";
  if (normalized === "sms" || normalized === "text") return "sms";
  return null;
}

function normalizeDirection(value: unknown): CommunicationsDirection {
  if (typeof value !== "string") return "outbound";
  const normalized = value.toLowerCase();
  if (normalized === "inbound") return "inbound";
  if (normalized === "system") return "system";
  return "outbound";
}

function normalizeMessage(value: unknown, index: number): CommunicationsMessage | null {
  const record = asRecord(value);
  if (!record) return null;
  const channel = normalizeChannel(record.channel);
  if (!channel) return null;

  const occurredAt =
    firstString(record, [
      "occurredAt",
      "occurred_at",
      "sentAt",
      "sent_at",
      "receivedAt",
      "received_at",
      "providerEventAt",
      "provider_event_at",
      "createdAt",
      "created_at",
      "scheduledFor",
      "scheduled_for",
    ]) ?? new Date(0).toISOString();

  return {
    id:
      firstString(record, ["id", "messageId", "message_id"]) ??
      `${channel}-${occurredAt}-${index}`,
    channel,
    direction: normalizeDirection(record.direction),
    body: firstString(record, ["body", "bodyText", "body_text", "text", "content"]) ?? "",
    subject: firstString(record, ["subject"]),
    status: firstString(record, ["status", "deliveryStatus", "delivery_status"]) ??
      (normalizeDirection(record.direction) === "inbound" ? "received" : "queued"),
    occurredAt,
  };
}

function normalizeConversation(value: unknown): CommunicationsConversation | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = firstString(record, ["id", "conversationId", "conversation_id"]);
  if (!id) return null;

  const contact = asRecord(record.contact) ?? asRecord(record.customer);
  const consent = asRecord(record.consent) ?? asRecord(record.preferences);
  const verification = asRecord(record.verification);
  const homeowner = asRecord(record.homeowner);
  const property = asRecord(record.property);
  const latestMessage =
    asRecord(record.lastMessage) ?? asRecord(record.last_message) ?? asRecord(record.latestMessage);
  const contactPoints = Array.isArray(record.contactPoints)
    ? record.contactPoints
    : Array.isArray(record.contact_points)
      ? record.contact_points
      : [];
  const emailPoint = contactPoints
    .map(asRecord)
    .find((point) => normalizeChannel(point?.channel) === "email") ?? null;
  const smsPoint = contactPoints
    .map(asRecord)
    .find((point) => normalizeChannel(point?.channel) === "sms") ?? null;
  const rawChannels = Array.isArray(record.channels) ? record.channels : [];
  const channels = Array.from(
    new Set(
      rawChannels
        .map(normalizeChannel)
        .filter((channel): channel is CommunicationsChannel => Boolean(channel)),
    ),
  );
  const hasMessages = Array.isArray(record.messages);
  const messages = hasMessages
    ? (record.messages as unknown[])
        .map(normalizeMessage)
        .filter((message): message is CommunicationsMessage => Boolean(message))
        .sort(
          (left, right) =>
            new Date(left.occurredAt).getTime() -
            new Date(right.occurredAt).getTime(),
        )
    : null;

  if (channels.length === 0 && messages) {
    channels.push(...Array.from(new Set(messages.map((message) => message.channel))));
  }
  if (channels.length === 0) {
    if (emailPoint) channels.push("email");
    if (smsPoint) channels.push("sms");
  }

  const email =
    firstString(contact, ["email", "emailAddress", "email_address"]) ??
    firstString(emailPoint, [
      "addressNormalized",
      "address_normalized",
      "addressMasked",
      "address_masked",
    ]) ??
    firstString(record, ["email", "customerEmail", "customer_email"]);
  const phone =
    firstString(contact, ["phone", "phoneNumber", "phone_number"]) ??
    firstString(smsPoint, [
      "addressNormalized",
      "address_normalized",
      "addressMasked",
      "address_masked",
    ]) ??
    firstString(record, ["phone", "customerPhone", "customer_phone"]);

  return {
    id,
    leadIntakeId: firstString(record, ["leadIntakeId", "lead_intake_id"]),
    leadStatus: normalizeLeadStatus(
      record.leadStatus ?? record.lead_status,
    ),
    customerName:
      firstString(record, [
        "customerName",
        "customer_name",
        "homeownerName",
        "homeowner_name",
        "displayName",
        "display_name",
        "name",
      ]) ??
      firstString(contact, ["name", "displayName", "display_name"]) ??
      firstString(homeowner, ["name", "displayName", "display_name", "fullName", "full_name"]) ??
      "Customer",
    preview:
      firstString(record, [
        "preview",
        "lastMessagePreview",
        "last_message_preview",
        "latestMessage",
        "latest_message",
      ]) ??
      firstString(latestMessage, ["body", "bodyText", "body_text", "text", "content"]) ??
      messages?.at(-1)?.body ??
      "No messages yet",
    updatedAt:
      firstString(record, [
        "updatedAt",
        "updated_at",
        "lastMessageAt",
        "last_message_at",
        "createdAt",
        "created_at",
      ]) ?? messages?.at(-1)?.occurredAt ?? new Date(0).toISOString(),
    unreadCount: Math.max(
      0,
      Math.trunc(firstNumber(record, ["unreadCount", "unread_count"]) ?? 0),
    ),
    channels,
    contact: { email, phone },
    consent: {
      emailStatus:
        firstString(consent, [
          "emailStatus",
          "email_status",
          "emailConsentStatus",
          "email_consent_status",
        ]) ?? firstString(emailPoint, ["consentStatus", "consent_status"]) ?? "unknown",
      smsStatus:
        firstString(consent, [
          "smsStatus",
          "sms_status",
          "smsConsentStatus",
          "sms_consent_status",
        ]) ?? firstString(smsPoint, ["consentStatus", "consent_status"]) ?? "unknown",
    },
    verification: {
      emailStatus:
        firstString(verification, ["emailStatus", "email_status"]) ??
        firstString(emailPoint, ["verificationStatus", "verification_status"]) ??
        "unknown",
      smsStatus:
        firstString(verification, ["smsStatus", "sms_status"]) ??
        firstString(smsPoint, ["verificationStatus", "verification_status"]) ??
        "unknown",
    },
    propertyLabel:
      firstString(record, [
        "propertyLabel",
        "property_label",
        "serviceAddress",
        "service_address",
      ]) ??
      firstString(property, [
        "label",
        "serviceAddress",
        "service_address",
        "address",
      ]) ??
      null,
    messages,
  };
}

function normalizeProvider(
  value: unknown,
  fallbackConfigured: unknown,
): ProviderConfiguration {
  if (typeof value === "boolean") {
    return { configured: value, fromLabel: null, detail: null };
  }
  const record = asRecord(value);
  const configuredValue = record?.configured ?? record?.ready ?? fallbackConfigured;
  return {
    configured:
      typeof configuredValue === "boolean" ? configuredValue : null,
    fromLabel: firstString(record, ["fromLabel", "from_label", "from", "sender"]),
    detail: firstString(record, ["detail", "message", "reason"]),
  };
}

function normalizeInboxResponse(value: unknown): NormalizedInboxResponse {
  const outer = asRecord(value) ?? {};
  const data = asRecord(outer.data) ?? outer;
  const conversationValues = Array.isArray(data.conversations)
    ? data.conversations
    : Array.isArray(data.items)
      ? data.items
      : [];
  const conversations = conversationValues
    .map(normalizeConversation)
    .filter((conversation): conversation is CommunicationsConversation =>
      Boolean(conversation),
    )
    .sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
    );
  const selectedValue =
    data.selectedConversation ??
    data.selected_conversation ??
    data.conversation ??
    (firstString(data, ["id", "conversationId", "conversation_id"]) ? data : null);
  const selectedRecord = asRecord(selectedValue);
  const selectedConversation = normalizeConversation(
    selectedRecord && Array.isArray(data.messages) && !Array.isArray(selectedRecord.messages)
      ? { ...selectedRecord, messages: data.messages }
      : selectedValue,
  );
  const configuration =
    asRecord(data.configuration) ??
    asRecord(data.providers) ??
    asRecord(outer.configuration) ??
    asRecord(outer.providers) ??
    null;
  const configurationProvided =
    Boolean(configuration) ||
    Object.prototype.hasOwnProperty.call(data, "emailConfigured") ||
    Object.prototype.hasOwnProperty.call(data, "email_configured") ||
    Object.prototype.hasOwnProperty.call(data, "resendConfigured") ||
    Object.prototype.hasOwnProperty.call(data, "resend_configured") ||
    Object.prototype.hasOwnProperty.call(data, "smsConfigured") ||
    Object.prototype.hasOwnProperty.call(data, "sms_configured") ||
    Object.prototype.hasOwnProperty.call(data, "twilioConfigured") ||
    Object.prototype.hasOwnProperty.call(data, "twilio_configured");

  return {
    conversations,
    selectedConversation,
    configurationProvided,
    configuration: {
      email: normalizeProvider(
        configuration?.email ?? configuration?.resend,
        data.emailConfigured ??
          data.email_configured ??
          data.resendConfigured ??
          data.resend_configured,
      ),
      sms: normalizeProvider(
        configuration?.sms ?? configuration?.twilio,
        data.smsConfigured ??
          data.sms_configured ??
          data.twilioConfigured ??
          data.twilio_configured,
      ),
    },
  };
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return new Intl.DateTimeFormat("en-US", {
    month: sameDay ? undefined : "short",
    day: sameDay ? undefined : "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatStatus(status: string): string {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function consentTone(status: string): string {
  const normalized = status.toLowerCase();
  if (["opted_in", "subscribed", "granted"].includes(normalized)) {
    return "border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-200";
  }
  if (["opted_out", "unsubscribed", "suppressed", "denied"].includes(normalized)) {
    return "border-red-300/20 bg-red-300/[0.07] text-red-200";
  }
  return "border-white/[0.08] bg-white/[0.035] text-muted";
}

function ProviderBadge({
  channel,
  configuration,
}: {
  channel: CommunicationsChannel;
  configuration: ProviderConfiguration;
}) {
  const label = channel === "email" ? "Email" : "Text";
  const state =
    configuration.configured === true
      ? "Ready"
      : configuration.configured === false
        ? "Needs setup"
        : "Checking";
  const tone =
    configuration.configured === true
      ? "border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-200"
      : configuration.configured === false
        ? "border-amber-300/20 bg-amber-300/[0.07] text-amber-100"
        : "border-white/[0.08] bg-white/[0.035] text-muted";

  return (
    <span
      title={configuration.detail ?? configuration.fromLabel ?? undefined}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] ${tone}`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${
          configuration.configured === true
            ? "bg-emerald-300"
            : configuration.configured === false
              ? "bg-amber-300"
              : "bg-muted"
        }`}
      />
      {label} · {state}
    </span>
  );
}

function CommunicationsAutomationPanel({
  configuration,
}: {
  configuration: CommunicationsConfiguration;
}) {
  const [rules, setRules] = useState<
    Partial<Record<AutomationRuleId, CommunicationsAutomationRule>>
  >({});
  const [loading, setLoading] = useState(true);
  const [savingRuleId, setSavingRuleId] = useState<AutomationRuleId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/communications/automation", {
        headers: getAdminRequestHeaders(),
        cache: "no-store",
      });
      const responseBody = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        throw new Error(
          firstString(asRecord(responseBody), ["error", "message"]) ??
            "Automation controls could not be loaded.",
        );
      }

      const responseRecord = asRecord(responseBody);
      const values = Array.isArray(responseRecord?.rules)
        ? responseRecord.rules
        : [];
      const nextRules: Partial<
        Record<AutomationRuleId, CommunicationsAutomationRule>
      > = {};
      for (const value of values) {
        const rule = normalizeAutomationRule(value);
        if (rule) nextRules[rule.id] = rule;
      }
      setRules(nextRules);
      if (Object.keys(nextRules).length !== AUTOMATION_RULES.length) {
        setError(
          "Some automation controls are not installed yet. Run the communications migration before enabling them.",
        );
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Automation controls could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadRules();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadRules]);

  const updateRule = useCallback(
    async (presentation: AutomationRulePresentation, enabled: boolean) => {
      if (savingRuleId) return;
      setSavingRuleId(presentation.id);
      setError(null);
      setNotice(null);
      try {
        const response = await fetch("/api/admin/communications/automation", {
          method: "PATCH",
          headers: getAdminRequestHeaders(),
          body: JSON.stringify({ id: presentation.id, enabled }),
        });
        const responseBody = (await response.json().catch(() => null)) as unknown;
        if (!response.ok) {
          throw new Error(
            firstString(asRecord(responseBody), ["error", "message"]) ??
              "The automation setting could not be saved.",
          );
        }
        const updated = normalizeAutomationRule(asRecord(responseBody)?.rule);
        if (!updated) {
          throw new Error("The saved automation setting could not be verified.");
        }
        setRules((current) => ({ ...current, [updated.id]: updated }));
        setNotice(`${presentation.title} is now ${enabled ? "on" : "off"}.`);
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "The automation setting could not be saved.",
        );
      } finally {
        setSavingRuleId(null);
      }
    },
    [savingRuleId],
  );

  return (
    <GlassCard
      as="section"
      tone="subtle"
      padding="none"
      motion="rise"
      className="mb-4 overflow-hidden"
    >
      <div className="flex flex-col gap-4 border-b border-white/[0.06] px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className={craftEyebrow}>Automation studio</p>
            <span className="rounded-full border border-accent/15 bg-accent/[0.055] px-2.5 py-1 text-[9px] uppercase tracking-[0.14em] text-accent/90">
              Founder controlled
            </span>
          </div>
          <h2 className="mt-2 font-serif text-2xl font-light text-foreground">
            Customer touchpoints
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Turn on only the moments Atlas should handle automatically. Every send still passes destination, consent, and provider checks.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadRules()}
          disabled={loading || Boolean(savingRuleId)}
          className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.035] px-4 text-[10px] uppercase tracking-[0.14em] text-muted transition-colors hover:border-accent/25 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Checking..." : "Refresh controls"}
        </button>
      </div>

      <div className="p-4 sm:p-5">
        {configuration.sms.configured === false ? (
          <div className="mb-4 rounded-[1rem] border border-amber-300/15 bg-amber-300/[0.055] px-4 py-4 text-xs leading-relaxed text-amber-50">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-medium text-foreground">Finish text setup</p>
                <p className="mt-1 text-amber-100/80">
                  Create a Twilio Messaging Service, add an approved sender,
                  finish the required U.S. registration, and connect the Atlas
                  inbound and delivery-status webhooks. Set sender approval only
                  after Twilio confirms it, then send a signed webhook test.
                  Text automations stay locked off until those checks pass.
                </p>
                <p className="mt-2 break-all font-mono text-[10px] text-amber-100/65">
                  Inbound: https://www.squeegeeking.net/api/integrations/twilio/inbound
                  <br />
                  Status: https://www.squeegeeking.net/api/integrations/twilio/status
                </p>
              </div>
              <a
                href="https://console.twilio.com/"
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-[9px] uppercase tracking-[0.16em] text-amber-50 underline decoration-amber-200/30 underline-offset-4"
              >
                Open Twilio
              </a>
            </div>
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="mb-4 flex flex-col gap-3 rounded-[1rem] border border-amber-300/15 bg-amber-300/[0.055] px-4 py-3 text-xs leading-relaxed text-amber-100 sm:flex-row sm:items-center sm:justify-between"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void loadRules()}
              disabled={loading}
              className="shrink-0 text-[9px] uppercase tracking-[0.16em] underline decoration-amber-200/30 underline-offset-4 disabled:opacity-50"
            >
              Try again
            </button>
          </div>
        ) : null}

        {notice ? (
          <p
            aria-live="polite"
            className="mb-4 rounded-[1rem] border border-emerald-300/15 bg-emerald-300/[0.05] px-4 py-3 text-xs text-emerald-200"
          >
            {notice}
          </p>
        ) : null}

        {loading && Object.keys(rules).length === 0 ? (
          <div className="grid gap-3 md:grid-cols-2" aria-label="Loading automation controls">
            {AUTOMATION_RULES.map((rule) => (
              <ShimmerBlock key={rule.id} className="h-40 rounded-[1.2rem]" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {AUTOMATION_RULES.map((presentation) => {
              const rule = rules[presentation.id];
              const enabled = rule?.enabled ?? false;
              const saving = savingRuleId === presentation.id;
              const provider = configuration[presentation.channel];
              const providerBlocksEnable =
                !enabled && provider.configured === false;
              const unavailable = !rule;
              const disabled =
                unavailable || Boolean(savingRuleId) || providerBlocksEnable;
              const channelLabel =
                presentation.channel === "sms" ? "Text" : "Email";

              return (
                <article
                  key={presentation.id}
                  className={`rounded-[1.2rem] border p-4 transition-colors sm:p-5 ${
                    enabled
                      ? "border-accent/20 bg-accent/[0.05]"
                      : "border-white/[0.065] bg-black/[0.075]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[9px] uppercase tracking-[0.14em]">
                        <span className="text-accent/85">{channelLabel}</span>
                        <span className="text-muted/45" aria-hidden>
                          /
                        </span>
                        <span className="text-muted/75">{presentation.timing}</span>
                      </div>
                      <h3 className="mt-2 text-sm font-medium text-foreground">
                        {presentation.title}
                      </h3>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      aria-label={`${presentation.title}: ${enabled ? "on" : "off"}`}
                      title={
                        providerBlocksEnable
                          ? `${channelLabel} provider setup is required before enabling this rule.`
                          : undefined
                      }
                      onClick={() => void updateRule(presentation, !enabled)}
                      disabled={disabled}
                      className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-45 ${
                        enabled
                          ? "border-accent/40 bg-accent/80"
                          : "border-white/[0.1] bg-white/[0.055]"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`absolute top-1 h-[1.15rem] w-[1.15rem] rounded-full shadow-sm transition-[left,background-color] ${
                          enabled
                            ? "left-[1.55rem] bg-background"
                            : "left-1 bg-muted"
                        }`}
                      />
                    </button>
                  </div>

                  <p className="mt-3 min-h-10 text-xs leading-relaxed text-muted">
                    {presentation.description}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-[9px] uppercase tracking-[0.13em]">
                    <span
                      className={`rounded-full border px-2.5 py-1 ${
                        enabled
                          ? "border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-200"
                          : "border-white/[0.08] bg-white/[0.035] text-muted"
                      }`}
                    >
                      {saving ? "Saving..." : unavailable ? "Unavailable" : enabled ? "On" : "Off"}
                    </span>
                    {presentation.channel === "sms" ? (
                      <span className="rounded-full border border-white/[0.07] px-2.5 py-1 text-muted/70">
                        Consent required
                      </span>
                    ) : null}
                    {providerBlocksEnable ? (
                      <span className="rounded-full border border-amber-300/15 bg-amber-300/[0.055] px-2.5 py-1 text-amber-100">
                        Provider setup needed
                      </span>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="mt-4 grid gap-3 border-t border-white/[0.055] pt-4 text-xs leading-relaxed text-muted md:grid-cols-2">
          <p className="rounded-[1rem] bg-white/[0.025] px-4 py-3">
            <span className="font-medium text-foreground">Text safety:</span>{" "}
            SMS sends only when explicit customer consent is active and the Twilio sender is configured. STOP always wins.
          </p>
          <p className="rounded-[1rem] bg-white/[0.025] px-4 py-3">
            <span className="font-medium text-foreground">Reminder timing:</span>{" "}
            Visit reminders run in the current once-daily scheduler, so the 24-hour mark is a target window rather than minute-precise delivery.
          </p>
        </div>
      </div>
    </GlassCard>
  );
}

function InboxLoadingShell() {
  return (
    <div className="grid min-h-[34rem] gap-4 lg:grid-cols-[minmax(17rem,0.78fr)_minmax(0,1.5fr)]">
      <GlassCard tone="subtle" padding="none" motion="none" className="overflow-hidden">
        <div className="border-b border-white/[0.06] p-4">
          <ShimmerBlock className="h-11 w-full rounded-2xl" />
        </div>
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="border-b border-white/[0.05] p-5 last:border-0">
            <div className="flex items-center justify-between gap-4">
              <ShimmerBlock className="h-4 w-28 rounded-full" />
              <ShimmerBlock className="h-3 w-14 rounded-full" />
            </div>
            <ShimmerBlock className="mt-3 h-3 w-4/5 rounded-full" />
          </div>
        ))}
      </GlassCard>
      <GlassCard tone="subtle" padding="lg" motion="none">
        <ShimmerBlock className="h-7 w-48 rounded-full" />
        <ShimmerBlock className="mt-3 h-4 w-64 rounded-full" />
        <div className="mt-12 space-y-4">
          <ShimmerBlock className="ml-auto h-24 w-3/4 rounded-3xl" />
          <ShimmerBlock className="h-20 w-2/3 rounded-3xl" />
          <ShimmerBlock className="ml-auto h-28 w-4/5 rounded-3xl" />
        </div>
      </GlassCard>
      <p className="sr-only">Loading customer conversations</p>
    </div>
  );
}

function EmptyConversationState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex min-h-[28rem] items-center justify-center px-6 py-16 text-center">
      <div className="max-w-sm">
        <div
          aria-hidden
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-accent/15 bg-accent/[0.055] font-serif text-xl text-accent"
        >
          A
        </div>
        <h2 className="mt-5 font-serif text-2xl font-light text-foreground">
          {filtered ? "No matching conversations" : "The inbox is ready"}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {filtered
            ? "Try a customer name, email, phone number, or property address."
            : "New website requests and customer replies will gather here as soon as the communication service is active."}
        </p>
      </div>
    </div>
  );
}

function CommunicationsInboxContent() {
  const [conversations, setConversations] = useState<CommunicationsConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] =
    useState<CommunicationsConversation | null>(null);
  const [configuration, setConfiguration] =
    useState<CommunicationsConfiguration>(EMPTY_CONFIGURATION);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [channel, setChannel] = useState<CommunicationsChannel>("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendNotice, setSendNotice] = useState<string | null>(null);
  const [smsConsentEvidence, setSmsConsentEvidence] = useState("");
  const [smsConsentAttested, setSmsConsentAttested] = useState(false);
  const [smsConsentSaving, setSmsConsentSaving] = useState(false);
  const [leadStatusSaving, setLeadStatusSaving] = useState(false);
  const inboxRequest = useRef(0);
  const detailRequest = useRef(0);
  const selectedIdRef = useRef<string | null>(null);
  const sendAttemptRef = useRef<ManualSendAttempt | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(searchQuery.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const loadConversation = useCallback(async (conversationId: string, quiet = false) => {
    const requestId = ++detailRequest.current;
    if (!quiet) setDetailLoading(true);
    try {
      const params = new URLSearchParams({ conversationId });
      const response = await fetch(`/api/admin/communications?${params.toString()}`, {
        headers: getAdminRequestHeaders(),
        cache: "no-store",
      });
      const responseBody = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        const responseRecord = asRecord(responseBody);
        throw new Error(
          firstString(responseRecord, ["error", "message"]) ??
            "Could not load this conversation.",
        );
      }
      if (requestId !== detailRequest.current) return;
      const normalized = normalizeInboxResponse(responseBody);
      const detail =
        normalized.selectedConversation ??
        normalized.conversations.find((conversation) => conversation.id === conversationId) ??
        null;
      if (detail) setSelectedConversation(detail);
      if (normalized.configurationProvided) {
        setConfiguration(normalized.configuration);
      }
    } catch (loadError) {
      if (requestId !== detailRequest.current) return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load this conversation.",
      );
    } finally {
      if (requestId === detailRequest.current) setDetailLoading(false);
    }
  }, []);

  const loadInbox = useCallback(
    async (query: string, quiet = false) => {
      const requestId = ++inboxRequest.current;
      if (!quiet) setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        const suffix = params.size > 0 ? `?${params.toString()}` : "";
        const response = await fetch(`/api/admin/communications${suffix}`, {
          headers: getAdminRequestHeaders(),
          cache: "no-store",
        });
        const responseBody = (await response.json().catch(() => null)) as unknown;
        if (!response.ok) {
          const responseRecord = asRecord(responseBody);
          throw new Error(
            firstString(responseRecord, ["error", "message"]) ??
              "Could not load customer conversations.",
          );
        }
        if (requestId !== inboxRequest.current) return;

        const normalized = normalizeInboxResponse(responseBody);
        setConversations(normalized.conversations);
        if (normalized.configurationProvided) {
          setConfiguration(normalized.configuration);
        }

        const currentId = selectedIdRef.current;
        const nextId =
          (currentId &&
          normalized.conversations.some((conversation) => conversation.id === currentId)
            ? currentId
            : normalized.selectedConversation?.id) ??
          normalized.conversations[0]?.id ??
          null;

        selectedIdRef.current = nextId;
        setSelectedId(nextId);
        if (!nextId) {
          setSelectedConversation(null);
          return;
        }

        const inlineDetail =
          normalized.selectedConversation?.id === nextId
            ? normalized.selectedConversation
            : normalized.conversations.find(
                (conversation) => conversation.id === nextId && conversation.messages !== null,
              ) ?? null;
        if (inlineDetail) {
          setSelectedConversation(inlineDetail);
        } else {
          const summary = normalized.conversations.find(
            (conversation) => conversation.id === nextId,
          );
          if (summary) setSelectedConversation(summary);
          void loadConversation(nextId, quiet);
        }
      } catch (loadError) {
        if (requestId !== inboxRequest.current) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load customer conversations.",
        );
      } finally {
        if (requestId === inboxRequest.current) setLoading(false);
      }
    },
    [loadConversation],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadInbox(debouncedQuery);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [debouncedQuery, loadInbox]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadInbox(debouncedQuery, true);
      if (selectedId) void loadConversation(selectedId, true);
    }, 45_000);
    return () => window.clearInterval(interval);
  }, [debouncedQuery, loadConversation, loadInbox, selectedId]);

  const visibleConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((conversation) =>
      [
        conversation.customerName,
        conversation.preview,
        conversation.contact.email,
        conversation.contact.phone,
        conversation.propertyLabel,
      ].some((value) => value?.toLowerCase().includes(query)),
    );
  }, [conversations, searchQuery]);

  const selected =
    selectedConversation?.id === selectedId
      ? selectedConversation
      : conversations.find((conversation) => conversation.id === selectedId) ?? null;

  const chooseConversation = useCallback(
    (conversation: CommunicationsConversation) => {
      selectedIdRef.current = conversation.id;
      setSelectedId(conversation.id);
      setSelectedConversation(conversation);
      setSendNotice(null);
      setError(null);
      setSubject("");
      setBody("");
      setSmsConsentEvidence("");
      setSmsConsentAttested(false);
      sendAttemptRef.current = null;
      if (conversation.messages === null) void loadConversation(conversation.id);
    },
    [loadConversation],
  );

  const composeBlockReason = useMemo(() => {
    if (!selected) return "Choose a conversation to send a message.";
    const provider = configuration[channel];
    if (provider.configured === false) {
      return channel === "email"
        ? "Email needs to be configured before sending."
        : "Texting needs a connected sending number before sending.";
    }
    if (channel === "email") {
      if (!selected.contact.email) return "This customer does not have an email address.";
      if (["opted_out", "unsubscribed", "suppressed"].includes(
        selected.consent.emailStatus.toLowerCase(),
      )) {
        return "This customer cannot receive email right now.";
      }
      return null;
    }
    if (!selected.contact.phone) return "This customer does not have a mobile number.";
    if (selected.consent.smsStatus.toLowerCase() !== "opted_in") {
      return "Text consent is required before sending an SMS.";
    }
    if (selected.verification.smsStatus.toLowerCase() !== "verified") {
      return "Verify this mobile number before sending a text.";
    }
    return null;
  }, [channel, configuration, selected]);

  const updateSmsConsent = useCallback(
    async (action: "record_opt_in" | "record_opt_out") => {
      if (!selected?.contact.phone || smsConsentSaving) return;
      if (
        action === "record_opt_out" &&
        !window.confirm(
          `Stop all Atlas texts to ${selected.contact.phone}? This takes effect immediately and requires fresh explicit permission to restore.`,
        )
      ) {
        return;
      }

      setSmsConsentSaving(true);
      setError(null);
      setSendNotice(null);
      try {
        const headers = new Headers(getAdminRequestHeaders());
        headers.set("Idempotency-Key", `hq-consent:${globalThis.crypto.randomUUID()}`);
        const response = await fetch(
          `/api/admin/communications/${encodeURIComponent(selected.id)}/sms-consent`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              action,
              phone: selected.contact.phone,
              evidenceNote:
                action === "record_opt_in" ? smsConsentEvidence.trim() : "",
              attested: action === "record_opt_in" && smsConsentAttested,
            }),
          },
        );
        const responseBody = (await response.json().catch(() => null)) as unknown;
        if (!response.ok) {
          const responseRecord = asRecord(responseBody);
          throw new Error(
            firstString(responseRecord, ["error", "message"]) ??
              "Text consent could not be recorded.",
          );
        }
        setSmsConsentEvidence("");
        setSmsConsentAttested(false);
        setSendNotice(
          action === "record_opt_in"
            ? "Explicit text permission recorded for this exact number."
            : "Text opt-out recorded. Atlas will block future sends to this number.",
        );
        await loadConversation(selected.id, true);
        void loadInbox(debouncedQuery, true);
      } catch (consentError) {
        setError(
          consentError instanceof Error
            ? consentError.message
            : "Text consent could not be recorded.",
        );
      } finally {
        setSmsConsentSaving(false);
      }
    },
    [
      debouncedQuery,
      loadConversation,
      loadInbox,
      selected,
      smsConsentAttested,
      smsConsentEvidence,
      smsConsentSaving,
    ],
  );

  const updateLeadStatus = useCallback(
    async (status: LeadIntakeStatus) => {
      if (!selected?.leadIntakeId || !selected.leadStatus || leadStatusSaving) {
        return;
      }
      if (
        status === "archived" &&
        !window.confirm(
          `Mark ${selected.customerName} as lost? The conversation stays available and can be reopened later.`,
        )
      ) {
        return;
      }

      setLeadStatusSaving(true);
      setError(null);
      setSendNotice(null);
      try {
        const response = await fetch(
          `/api/admin/lead-intakes/${encodeURIComponent(selected.leadIntakeId)}`,
          {
            method: "PATCH",
            headers: getAdminRequestHeaders(),
            body: JSON.stringify({ status }),
          },
        );
        const responseBody = (await response.json().catch(() => null)) as unknown;
        if (!response.ok) {
          const responseRecord = asRecord(responseBody);
          throw new Error(
            firstString(responseRecord, ["error", "message"]) ??
              "Lead status could not be updated.",
          );
        }
        setSendNotice(`Lead moved to ${formatLeadIntakeStatus(status)}.`);
        await loadConversation(selected.id, true);
        void loadInbox(debouncedQuery, true);
      } catch (statusError) {
        setError(
          statusError instanceof Error
            ? statusError.message
            : "Lead status could not be updated.",
        );
      } finally {
        setLeadStatusSaving(false);
      }
    },
    [
      debouncedQuery,
      leadStatusSaving,
      loadConversation,
      loadInbox,
      selected,
    ],
  );

  const sendMessage = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!selected || !body.trim() || composeBlockReason) return;
      setSending(true);
      setError(null);
      setSendNotice(null);
      const fingerprint = manualSendFingerprint({
        conversationId: selected.id,
        channel,
        subject,
        body,
      });
      const attempt = resolveManualSendAttempt(
        sendAttemptRef.current,
        fingerprint,
      );
      sendAttemptRef.current = attempt;
      try {
        const headers = new Headers(getAdminRequestHeaders());
        headers.set("Idempotency-Key", attempt.idempotencyKey);
        const response = await fetch(
          `/api/admin/communications/${encodeURIComponent(selected.id)}/messages`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              channel,
              ...(channel === "email" && subject.trim()
                ? { subject: subject.trim() }
                : {}),
              body: body.trim(),
            }),
          },
        );
        const responseBody = (await response.json().catch(() => null)) as unknown;
        if (!response.ok) {
          const responseRecord = asRecord(responseBody);
          throw new Error(
            firstString(responseRecord, ["error", "message"]) ??
              `Could not send the ${channel === "email" ? "email" : "text"}.`,
          );
        }
        setBody("");
        setSubject("");
        sendAttemptRef.current = null;
        setSendNotice(channel === "email" ? "Email queued for delivery." : "Text queued for delivery.");
        await loadConversation(selected.id, true);
        void loadInbox(debouncedQuery, true);
      } catch (sendError) {
        setError(
          sendError instanceof Error ? sendError.message : "Could not send this message.",
        );
      } finally {
        setSending(false);
      }
    },
    [
      body,
      channel,
      composeBlockReason,
      debouncedQuery,
      loadConversation,
      loadInbox,
      selected,
      subject,
    ],
  );

  return (
    <AmbientStage className="px-4 py-10 text-foreground sm:px-6 sm:py-12">
      <div className="relative mx-auto max-w-[90rem]">
        <HqFounderNav />

        <MotionReveal className="mb-8 mt-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className={craftEyebrow}>Atlas communications</p>
              <h1 className={`${craftHeading} mt-3 text-3xl sm:text-4xl`}>Customer inbox</h1>
              <p className="mt-4 max-w-2xl text-sm leading-[1.65] text-muted">
                One calm timeline for every website request, sent email, and
                two-way text — with consent and delivery state visible before
                you send.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ProviderBadge channel="email" configuration={configuration.email} />
              <ProviderBadge channel="sms" configuration={configuration.sms} />
              <button
                type="button"
                onClick={() => void loadInbox(debouncedQuery)}
                disabled={loading}
                className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-muted transition-colors hover:border-accent/25 hover:text-foreground disabled:opacity-50"
              >
                Refresh
              </button>
            </div>
          </div>
        </MotionReveal>

        {error ? (
          <div
            role="alert"
            className="mb-4 flex flex-col gap-3 rounded-[1.2rem] border border-red-300/15 bg-red-300/[0.055] px-4 py-3 text-sm text-red-100 sm:flex-row sm:items-center sm:justify-between"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void loadInbox(debouncedQuery)}
              className="shrink-0 text-[10px] uppercase tracking-[0.16em] text-red-100 underline decoration-red-200/30 underline-offset-4"
            >
              Try again
            </button>
          </div>
        ) : null}

        <CommunicationsLaunchReadinessPanel />
        <CommunicationsAutomationPanel configuration={configuration} />

        {loading && conversations.length === 0 ? (
          <InboxLoadingShell />
        ) : (
          <div className="grid min-h-[38rem] gap-4 lg:grid-cols-[minmax(18rem,0.78fr)_minmax(0,1.55fr)]">
            <GlassCard
              as="section"
              tone="subtle"
              padding="none"
              motion="rise"
              className="overflow-hidden"
            >
              <div className="border-b border-white/[0.06] p-4">
                <label htmlFor="communications-search" className="sr-only">
                  Search customer conversations
                </label>
                <div className="relative">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm text-muted/60"
                  >
                    ⌕
                  </span>
                  <input
                    id="communications-search"
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search name, phone, email…"
                    className={`${craftInput} pl-10`}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between px-1 text-[10px] uppercase tracking-[0.16em] text-muted/70">
                  <span>{visibleConversations.length} conversations</span>
                  <span>{conversations.reduce((total, item) => total + item.unreadCount, 0)} unread</span>
                </div>
              </div>

              <div className="max-h-[48rem] overflow-y-auto">
                {visibleConversations.length === 0 ? (
                  <EmptyConversationState filtered={Boolean(searchQuery.trim())} />
                ) : (
                  visibleConversations.map((conversation) => {
                    const active = conversation.id === selectedId;
                    return (
                      <button
                        key={conversation.id}
                        type="button"
                        onClick={() => chooseConversation(conversation)}
                        aria-pressed={active}
                        className={`group w-full border-b border-white/[0.05] px-5 py-4 text-left transition-[background-color,border-color] last:border-0 ${
                          active
                            ? "border-l-2 border-l-accent bg-accent/[0.055]"
                            : "border-l-2 border-l-transparent hover:bg-white/[0.025]"
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="min-w-0 truncate text-sm font-medium text-foreground">
                            {conversation.customerName}
                          </span>
                          <time
                            dateTime={conversation.updatedAt}
                            className="shrink-0 text-[10px] tabular-nums text-muted/70"
                          >
                            {formatTime(conversation.updatedAt)}
                          </time>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          {conversation.leadStatus ? (
                            <span className="text-[9px] uppercase tracking-[0.13em] text-accent/80">
                              {formatLeadIntakeStatus(conversation.leadStatus)}
                            </span>
                          ) : null}
                          {conversation.channels.map((itemChannel) => (
                            <span
                              key={itemChannel}
                              className="text-[9px] uppercase tracking-[0.13em] text-accent/80"
                            >
                              {itemChannel === "sms" ? "Text" : "Email"}
                            </span>
                          ))}
                          {conversation.propertyLabel ? (
                            <span className="truncate text-[10px] text-muted/55">
                              {conversation.propertyLabel}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2 flex items-center gap-3">
                          <p className="min-w-0 flex-1 truncate text-xs leading-relaxed text-muted">
                            {conversation.preview}
                          </p>
                          {conversation.unreadCount > 0 ? (
                            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-semibold text-background">
                              {conversation.unreadCount}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </GlassCard>

            <GlassCard
              as="section"
              tone="subtle"
              padding="none"
              motion="rise"
              index={1}
              className="flex min-h-[38rem] min-w-0 flex-col overflow-hidden"
            >
              {!selected ? (
                <EmptyConversationState filtered={false} />
              ) : (
                <>
                  <header className="border-b border-white/[0.06] px-5 py-5 sm:px-6">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-serif text-2xl font-light text-foreground">
                          {selected.customerName}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                          {selected.contact.email ? <span>{selected.contact.email}</span> : null}
                          {selected.contact.phone ? <span>{selected.contact.phone}</span> : null}
                          {selected.propertyLabel ? <span>{selected.propertyLabel}</span> : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-3 py-1.5 text-[9px] uppercase tracking-[0.14em] ${consentTone(
                            selected.consent.emailStatus,
                          )}`}
                        >
                          Email · {formatStatus(selected.consent.emailStatus)}
                        </span>
                        <span
                          className={`rounded-full border px-3 py-1.5 text-[9px] uppercase tracking-[0.14em] ${consentTone(
                            selected.consent.smsStatus,
                          )}`}
                        >
                          Text · {formatStatus(selected.consent.smsStatus)}
                        </span>
                      </div>
                    </div>
                  </header>

                  {selected.leadIntakeId && selected.leadStatus ? (
                    <div className="border-b border-white/[0.06] bg-accent/[0.025] px-5 py-4 sm:px-6">
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <div>
                          <p className="text-[9px] uppercase tracking-[0.17em] text-accent/80">
                            Lead pipeline
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            Keep the sale moving without leaving the conversation.
                          </p>
                        </div>
                        <div
                          role="group"
                          aria-label="Lead status"
                          className="flex max-w-full gap-1.5 overflow-x-auto pb-1"
                        >
                          {LEAD_PIPELINE.map((stage) => {
                            const active = selected.leadStatus === stage.status;
                            return (
                              <button
                                key={stage.status}
                                type="button"
                                disabled={leadStatusSaving || active}
                                onClick={() => void updateLeadStatus(stage.status)}
                                aria-pressed={active}
                                className={`min-h-9 shrink-0 rounded-full border px-3 text-[9px] uppercase tracking-[0.13em] transition-colors disabled:cursor-default ${
                                  active
                                    ? "border-accent/45 bg-accent/15 text-foreground"
                                    : "border-white/[0.08] bg-white/[0.025] text-muted hover:border-accent/25 hover:text-foreground disabled:opacity-60"
                                }`}
                              >
                                {stage.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="min-h-[20rem] flex-1 overflow-y-auto bg-black/[0.045] px-4 py-6 sm:px-6">
                    {detailLoading && selected.messages === null ? (
                      <div className="space-y-4" aria-label="Loading messages">
                        <ShimmerBlock className="ml-auto h-20 w-3/4 rounded-3xl" />
                        <ShimmerBlock className="h-24 w-2/3 rounded-3xl" />
                        <ShimmerBlock className="ml-auto h-16 w-1/2 rounded-3xl" />
                      </div>
                    ) : !selected.messages || selected.messages.length === 0 ? (
                      <div className="flex min-h-[18rem] items-center justify-center text-center">
                        <div className="max-w-sm">
                          <p className="font-serif text-xl font-light text-foreground">
                            Start the conversation
                          </p>
                          <p className="mt-2 text-sm leading-relaxed text-muted">
                            Send a personal note below. Automated confirmations
                            and incoming text replies will appear on this same
                            timeline.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <ol className="space-y-4" aria-label="Conversation messages">
                        {selected.messages.map((message) => {
                          const outbound = message.direction === "outbound";
                          const system = message.direction === "system";
                          const failed = TERMINAL_FAILURE_STATUSES.has(
                            message.status.toLowerCase(),
                          );
                          return (
                            <li
                              key={message.id}
                              className={`flex ${
                                system ? "justify-center" : outbound ? "justify-end" : "justify-start"
                              }`}
                            >
                              <article
                                className={`max-w-[88%] rounded-[1.35rem] border px-4 py-3 sm:max-w-[76%] ${
                                  system
                                    ? "border-dashed border-white/[0.08] bg-transparent text-muted"
                                    : outbound
                                    ? "border-accent/15 bg-accent/[0.08] text-foreground"
                                    : "border-white/[0.07] bg-white/[0.04] text-foreground"
                                }`}
                              >
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] uppercase tracking-[0.14em] text-muted/75">
                                  <span>{message.channel === "sms" ? "Text" : "Email"}</span>
                                  <span aria-hidden>·</span>
                                  <span>{message.direction}</span>
                                  {message.subject ? (
                                    <>
                                      <span aria-hidden>·</span>
                                      <span className="normal-case tracking-normal text-foreground/70">
                                        {message.subject}
                                      </span>
                                    </>
                                  ) : null}
                                </div>
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                                  {message.body || "No message content"}
                                </p>
                                <div className="mt-2 flex items-center justify-end gap-2 text-[9px] text-muted/65">
                                  <time dateTime={message.occurredAt}>
                                    {formatTime(message.occurredAt)}
                                  </time>
                                  <span
                                    className={failed ? "text-red-200" : "text-muted/65"}
                                  >
                                    {formatStatus(message.status)}
                                  </span>
                                </div>
                              </article>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </div>

                  <form
                    onSubmit={sendMessage}
                    className="border-t border-white/[0.06] bg-black/[0.08] p-4 sm:p-5"
                  >
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div
                        role="group"
                        aria-label="Message channel"
                        className="inline-flex w-fit rounded-full border border-white/[0.08] bg-black/20 p-1"
                      >
                        {(["email", "sms"] as const).map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => {
                              setChannel(option);
                              setSendNotice(null);
                              sendAttemptRef.current = null;
                            }}
                            aria-pressed={channel === option}
                            className={`min-h-9 rounded-full px-4 text-[10px] uppercase tracking-[0.16em] transition-colors ${
                              channel === option
                                ? "bg-accent text-background"
                                : "text-muted hover:text-foreground"
                            }`}
                          >
                            {option === "sms" ? "Text" : "Email"}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted/75">
                        {channel === "email"
                          ? selected.contact.email ?? "No email on file"
                          : selected.contact.phone ?? "No phone on file"}
                      </p>
                    </div>

                    {channel === "sms" ? (
                      <div className="mb-4 rounded-[1rem] border border-white/[0.075] bg-white/[0.025] p-4">
                        {!selected.contact.phone ? (
                          <p className="text-xs leading-relaxed text-amber-100/90">
                            Add the customer&apos;s mobile number in their HQ record,
                            then return here to record explicit permission. Adding
                            or editing a phone number never opts someone into texts.
                          </p>
                        ) : selected.consent.smsStatus.toLowerCase() === "opted_in" ? (
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-xs font-medium text-emerald-200">
                                Explicit text permission is active
                              </p>
                              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                                Atlas still verifies this exact destination before
                                every send. A customer opt-out must be recorded
                                immediately.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void updateSmsConsent("record_opt_out")}
                              disabled={smsConsentSaving}
                              className="min-h-9 shrink-0 rounded-full border border-red-300/20 bg-red-300/[0.055] px-4 text-[9px] uppercase tracking-[0.14em] text-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {smsConsentSaving ? "Recording..." : "Stop texts now"}
                            </button>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs font-medium text-amber-100">
                              {selected.consent.smsStatus.toLowerCase() === "opted_out"
                                ? "Fresh permission is required to restore texts"
                                : "Record explicit permission before texting"}
                            </p>
                            <p className="mt-1 text-[11px] leading-relaxed text-muted">
                              Phone edits do not count as consent. Describe when and
                              how this customer explicitly approved transactional
                              service texts to {selected.contact.phone}.
                            </p>
                            <label className="mt-3 block text-[10px] uppercase tracking-[0.14em] text-muted/80">
                              Consent evidence
                              <textarea
                                value={smsConsentEvidence}
                                onChange={(event) =>
                                  setSmsConsentEvidence(event.target.value)
                                }
                                maxLength={1000}
                                className={`${craftTextarea} mt-2 min-h-20`}
                                placeholder="Example: Customer explicitly agreed by phone on Aug. 2 during membership setup."
                                disabled={smsConsentSaving}
                              />
                            </label>
                            <label className="mt-3 flex items-start gap-3 text-[11px] leading-relaxed text-muted">
                              <input
                                type="checkbox"
                                checked={smsConsentAttested}
                                onChange={(event) =>
                                  setSmsConsentAttested(event.target.checked)
                                }
                                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                                disabled={smsConsentSaving}
                              />
                              <span>
                                I confirm the customer explicitly asked SqueegeeKing
                                to send transactional service texts to this exact
                                number. I am not inferring permission from the phone
                                field.
                              </span>
                            </label>
                            <button
                              type="button"
                              onClick={() => void updateSmsConsent("record_opt_in")}
                              disabled={
                                smsConsentSaving ||
                                !smsConsentAttested ||
                                smsConsentEvidence.trim().length < 12
                              }
                              className={`${craftPrimaryButton} mt-3 min-h-10 px-4 text-[10px] disabled:cursor-not-allowed disabled:opacity-45`}
                            >
                              {smsConsentSaving
                                ? "Recording..."
                                : "Record explicit permission"}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : null}

                    {channel === "email" ? (
                      <div className="mb-3">
                        <label htmlFor="communications-subject" className="sr-only">
                          Email subject
                        </label>
                        <input
                          id="communications-subject"
                          value={subject}
                          onChange={(event) => setSubject(event.target.value)}
                          className={craftInput}
                          placeholder="Email subject (optional)"
                          maxLength={200}
                          disabled={sending || Boolean(composeBlockReason)}
                        />
                      </div>
                    ) : null}

                    <label htmlFor="communications-body" className="sr-only">
                      Message
                    </label>
                    <textarea
                      id="communications-body"
                      value={body}
                      onChange={(event) => setBody(event.target.value)}
                      className={`${craftTextarea} min-h-28`}
                      placeholder={
                        channel === "email"
                          ? "Write a personal email…"
                          : "Write a text message…"
                      }
                      maxLength={channel === "sms" ? 1600 : 10_000}
                      disabled={sending || Boolean(composeBlockReason)}
                    />

                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-h-5 text-xs leading-relaxed">
                        {composeBlockReason ? (
                          <p className="text-amber-100/90">{composeBlockReason}</p>
                        ) : sendNotice ? (
                          <p className="text-emerald-200" aria-live="polite">
                            {sendNotice}
                          </p>
                        ) : channel === "sms" ? (
                          <p className="text-muted/70">
                            {body.length}/1600 · Consent verified before send
                          </p>
                        ) : (
                          <p className="text-muted/70">
                            Customer email replies go to your monitored reply-to
                            inbox.
                          </p>
                        )}
                      </div>
                      <button
                        type="submit"
                        disabled={sending || !body.trim() || Boolean(composeBlockReason)}
                        className={`${craftPrimaryButton} min-h-11 shrink-0 px-5 text-xs`}
                      >
                        {sending
                          ? "Sending…"
                          : channel === "email"
                            ? "Send email"
                            : "Send text"}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </GlassCard>
          </div>
        )}
      </div>
    </AmbientStage>
  );
}

export function CommunicationsInboxPage() {
  const [unlocked, setUnlocked] = useAdminUnlockedState();

  if (!unlocked) {
    return <AdminPinGate onUnlock={() => setUnlocked(true)} />;
  }

  return <CommunicationsInboxContent />;
}
