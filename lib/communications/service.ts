import "server-only";

import { randomUUID } from "node:crypto";
import {
  getResendEmailConfigState,
  resolveResendEmailConfig,
  sendResendEmail,
} from "@/lib/communications/providers/resend-email";
import {
  getTwilioSmsConfigState,
  resolveTwilioSmsConfig,
  sendTwilioSms,
} from "@/lib/communications/providers/twilio-sms";
import {
  MAX_EMAIL_SUBJECT_LENGTH,
  MAX_EMAIL_TEXT_LENGTH,
  MAX_SMS_BODY_LENGTH,
  normalizeEmailDestination,
  normalizeEmailMailbox,
  normalizeIdempotencyKey,
  normalizeSmsBody,
  type ProviderDeliveryStatus,
  type ProviderErrorCode,
} from "@/lib/communications/providers/contracts";
import {
  claimScheduledCommunication,
  createOutboundCommunicationAttempt,
  finalizeOutboundCommunicationAttempt,
  getCommunicationConversation,
  listCommunicationConversations,
  listCommunicationMessages,
  listDueScheduledCommunicationMessages,
  listLatestCommunicationMessages,
  loadCommunicationConversationContext,
  loadCommunicationConversationContexts,
  type CommunicationConversationContext,
  type CommunicationDestination,
} from "@/lib/communications/repository";
import type {
  CustomerCommunicationChannel,
  CustomerConsentStatus,
  CustomerMessage,
  CustomerMessageDeliveryStatus,
} from "@/lib/communications/types";

export interface CommunicationsProviderView {
  configured: boolean;
  fromLabel: string | null;
  detail: string;
}

export interface CommunicationsConfigurationView {
  email: CommunicationsProviderView;
  sms: CommunicationsProviderView;
}

export interface CommunicationsMessageView {
  id: string;
  channel: CustomerCommunicationChannel;
  direction: CustomerMessage["direction"];
  body: string;
  subject: string | null;
  status: CustomerMessageDeliveryStatus;
  occurredAt: string;
}

export interface CommunicationsConversationView {
  id: string;
  customerName: string;
  preview: string;
  updatedAt: string;
  unreadCount: number;
  channels: CustomerCommunicationChannel[];
  contact: { email: string | null; phone: string | null };
  consent: { emailStatus: CustomerConsentStatus; smsStatus: CustomerConsentStatus };
  verification: {
    emailStatus: CommunicationDestination["verificationStatus"] | "unknown";
    smsStatus: CommunicationDestination["verificationStatus"] | "unknown";
  };
  propertyLabel: string | null;
  messages: CommunicationsMessageView[] | null;
}

export interface CommunicationsInboxView {
  conversations: CommunicationsConversationView[];
  selectedConversation: CommunicationsConversationView | null;
  configuration: CommunicationsConfigurationView;
}

export type OutboundCommunicationBlockCode =
  | "provider_not_configured"
  | "missing_destination"
  | "invalid_destination"
  | "email_opted_out"
  | "sms_consent_required"
  | "sms_verification_required"
  | "invalid_subject"
  | "invalid_body"
  | "invalid_idempotency_key";

export type OutboundCommunicationGate =
  | { allowed: true; destination: string; subject: string | null; body: string }
  | { allowed: false; code: OutboundCommunicationBlockCode };

export class CommunicationsServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "CommunicationsServiceError";
  }
}

function firstValidReplyTo(candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    for (const entry of candidate.split(",")) {
      const normalized = normalizeEmailDestination(entry);
      if (normalized) return normalized;
    }
  }
  return null;
}

function emailAddressFromMailbox(mailbox: string): string | null {
  const normalized = normalizeEmailMailbox(mailbox);
  if (!normalized) return null;
  return normalizeEmailDestination(normalized.match(/<([^<>]+)>$/)?.[1] ?? normalized);
}

/** A monitored, server-configured address only; customer input is never used. */
export function resolveCommunicationsReplyTo(): string | null {
  const emailConfig = resolveResendEmailConfig();
  return firstValidReplyTo([
    process.env.RESEND_COMMUNICATIONS_REPLY_TO,
    process.env.FOUNDER_NOTIFY_EMAIL,
    process.env.LEAD_NOTIFY_EMAIL,
    emailAddressFromMailbox(emailConfig.from),
  ]);
}

function maskSmsSender(value: string | null | undefined): string | null {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.length >= 4 ? `Sending number ••••${digits.slice(-4)}` : null;
}

export function getCommunicationsConfiguration(): CommunicationsConfigurationView {
  const emailConfig = resolveResendEmailConfig();
  const emailProvider = getResendEmailConfigState(emailConfig);
  const replyTo = resolveCommunicationsReplyTo();
  const emailConfigured = emailProvider.configured && Boolean(replyTo);
  const twilioConfig = resolveTwilioSmsConfig();
  const smsProvider = getTwilioSmsConfigState(twilioConfig);

  return {
    email: {
      configured: emailConfigured,
      fromLabel: emailConfig.from || null,
      detail: emailConfigured
        ? "Resend is ready for customer email."
        : emailProvider.configured
          ? "Add a monitored communications reply-to address."
          : "Connect a verified Resend sender to send email.",
    },
    sms: {
      configured: smsProvider.configured,
      fromLabel:
        maskSmsSender(twilioConfig.fromNumber) ??
        (twilioConfig.messagingServiceSid ? "Messaging service connected" : null),
      detail: smsProvider.configured
        ? "Twilio is ready; explicit customer opt-in is still required."
        : "Connect a Twilio sender and status callback to send texts.",
    },
  };
}

export function evaluateOutboundCommunicationGate(input: {
  channel: CustomerCommunicationChannel;
  destination: CommunicationDestination | null;
  providerConfigured: boolean;
  subject?: string | null;
  body: string;
  idempotencyKey: string;
  allowUnverifiedSms?: boolean;
}): OutboundCommunicationGate {
  if (!input.providerConfigured) {
    return { allowed: false, code: "provider_not_configured" };
  }
  if (!input.destination?.address.trim()) {
    return { allowed: false, code: "missing_destination" };
  }

  const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
  if (!idempotencyKey) {
    return { allowed: false, code: "invalid_idempotency_key" };
  }

  const body = input.body.trim();
  if (
    !body ||
    (input.channel === "sms"
      ? Array.from(body).length > MAX_SMS_BODY_LENGTH || !normalizeSmsBody(body)
      : body.length > MAX_EMAIL_TEXT_LENGTH)
  ) {
    return { allowed: false, code: "invalid_body" };
  }

  if (input.channel === "sms") {
    if (input.destination.consentStatus !== "opted_in") {
      return { allowed: false, code: "sms_consent_required" };
    }
    if (
      input.destination.verificationStatus !== "verified" &&
      input.allowUnverifiedSms !== true
    ) {
      return { allowed: false, code: "sms_verification_required" };
    }
    if (!/^\+[1-9]\d{7,14}$/.test(input.destination.address)) {
      return { allowed: false, code: "invalid_destination" };
    }
    return {
      allowed: true,
      destination: input.destination.address,
      subject: null,
      body,
    };
  }

  if (!normalizeEmailDestination(input.destination.address)) {
    return { allowed: false, code: "invalid_destination" };
  }
  if (input.destination.verificationStatus === "invalid") {
    return { allowed: false, code: "invalid_destination" };
  }
  if (input.destination.consentStatus === "opted_out") {
    return { allowed: false, code: "email_opted_out" };
  }
  const subject = input.subject?.trim() || "A note from SqueegeeKing";
  if (!subject || subject.length > MAX_EMAIL_SUBJECT_LENGTH || /[\r\n]/.test(subject)) {
    return { allowed: false, code: "invalid_subject" };
  }
  return {
    allowed: true,
    destination: input.destination.address,
    subject,
    body,
  };
}

export function providerStatusToCustomerDeliveryStatus(
  status: ProviderDeliveryStatus,
): CustomerMessageDeliveryStatus {
  switch (status) {
    case "accepted":
      return "accepted";
    case "queued":
      return "queued";
    case "sending":
      return "sending";
    case "sent":
      return "sent";
    case "delivered":
      return "delivered";
    case "delayed":
      return "delivery_delayed";
    case "received":
    case "receiving":
      return "received";
    case "read":
      return "read";
    case "bounced":
      return "bounced";
    case "complained":
      return "complained";
    case "canceled":
      return "cancelled";
    case "undelivered":
    case "failed":
      return "failed";
    case "opened":
      return "opened";
    case "clicked":
      return "clicked";
    case "unknown":
      return "accepted";
  }
}

function messageOccurredAt(message: CustomerMessage): string {
  return (
    message.deliveredAt ??
    message.sentAt ??
    message.providerEventAt ??
    message.scheduledFor ??
    message.createdAt
  );
}

function messageView(message: CustomerMessage): CommunicationsMessageView {
  return {
    id: message.id,
    channel: message.channel,
    direction: message.direction,
    body: message.bodyText,
    subject: message.subject,
    status: message.deliveryStatus,
    occurredAt: messageOccurredAt(message),
  };
}

function previewText(message: CustomerMessage | undefined): string {
  if (!message) return "No messages yet";
  const text = message.bodyText.replace(/\s+/g, " ").trim();
  return text.length > 150 ? `${text.slice(0, 147)}…` : text || "No messages yet";
}

function conversationView(
  context: CommunicationConversationContext,
  latest: CustomerMessage | undefined,
  messages: CustomerMessage[] | null,
): CommunicationsConversationView {
  const channels = new Set<CustomerCommunicationChannel>();
  if (context.email) channels.add("email");
  if (context.sms) channels.add("sms");
  if (latest) channels.add(latest.channel);
  for (const message of messages ?? []) channels.add(message.channel);

  return {
    id: context.conversation.id,
    customerName: context.customerName,
    preview: previewText(latest ?? messages?.at(-1)),
    updatedAt:
      context.conversation.lastMessageAt ?? latest?.createdAt ?? context.conversation.updatedAt,
    unreadCount: 0,
    channels: [...channels],
    contact: {
      email: context.email?.address ?? null,
      phone: context.sms?.address ?? null,
    },
    consent: {
      emailStatus: context.email?.consentStatus ?? "unknown",
      smsStatus: context.sms?.consentStatus ?? "unknown",
    },
    verification: {
      emailStatus: context.email?.verificationStatus ?? "unknown",
      smsStatus: context.sms?.verificationStatus ?? "unknown",
    },
    propertyLabel: context.propertyLabel,
    messages: messages?.map(messageView) ?? null,
  };
}

export async function getCommunicationsInbox(input: {
  query?: string | null;
  conversationId?: string | null;
} = {}): Promise<CommunicationsInboxView> {
  const conversations = await listCommunicationConversations();
  const contexts = await loadCommunicationConversationContexts(conversations);
  const latestByConversation = await listLatestCommunicationMessages(
    conversations.map((conversation) => conversation.id),
  );
  const query = input.query?.trim().toLowerCase() ?? "";
  const summaries = conversations
    .map((conversation) => {
      const context = contexts.get(conversation.id);
      return context
        ? conversationView(context, latestByConversation.get(conversation.id), null)
        : null;
    })
    .filter((conversation): conversation is CommunicationsConversationView => {
      if (!conversation) return false;
      if (!query) return true;
      return [
        conversation.customerName,
        conversation.preview,
        conversation.contact.email,
        conversation.contact.phone,
        conversation.propertyLabel,
      ].some((value) => value?.toLowerCase().includes(query));
    });

  let selectedConversation: CommunicationsConversationView | null = null;
  const selectedId = input.conversationId?.trim();
  if (selectedId) {
    const selectedRecord = await getCommunicationConversation(selectedId);
    if (selectedRecord) {
      const selectedContext =
        contexts.get(selectedId) ??
        (await loadCommunicationConversationContext(selectedId));
      if (selectedContext) {
        const messages = await listCommunicationMessages(selectedId);
        selectedConversation = conversationView(
          selectedContext,
          messages.at(-1),
          messages,
        );
      }
    }
  }

  return {
    conversations: summaries,
    selectedConversation,
    configuration: getCommunicationsConfiguration(),
  };
}

function blockMessage(
  code: OutboundCommunicationBlockCode,
  channel: CustomerCommunicationChannel,
): { message: string; status: number } {
  switch (code) {
    case "provider_not_configured":
      return {
        message:
          channel === "email"
            ? "Email needs to be configured before sending."
            : "Texting needs a connected Twilio sender before sending.",
        status: 503,
      };
    case "missing_destination":
      return {
        message:
          channel === "email"
            ? "This customer does not have an email address."
            : "This customer does not have a mobile number.",
        status: 422,
      };
    case "invalid_destination":
      return {
        message:
          channel === "email"
            ? "This customer's email address is not valid."
            : "This customer's phone number is not valid for texting.",
        status: 422,
      };
    case "email_opted_out":
      return { message: "This customer has opted out of email.", status: 409 };
    case "sms_consent_required":
      return { message: "Explicit text consent is required before sending an SMS.", status: 409 };
    case "sms_verification_required":
      return {
        message: "Verify this mobile number before sending a text.",
        status: 409,
      };
    case "invalid_subject":
      return { message: "Enter a valid email subject.", status: 400 };
    case "invalid_body":
      return { message: "Enter a valid message within the channel length limit.", status: 400 };
    case "invalid_idempotency_key":
      return { message: "The send request could not be safely identified.", status: 400 };
  }
}

function providerFailureMessage(
  code: ProviderErrorCode,
  channel: CustomerCommunicationChannel,
): { message: string; status: number } {
  const label = channel === "email" ? "email" : "text";
  if (code === "not_configured") {
    return { message: `${label === "email" ? "Email" : "Texting"} needs setup before sending.`, status: 503 };
  }
  if (code === "rate_limited") {
    return { message: `The ${label} provider is busy. Try again in a moment.`, status: 429 };
  }
  if (code === "invalid_destination") {
    return { message: `The customer ${label} destination is not valid.`, status: 422 };
  }
  if (["invalid_body", "invalid_subject", "invalid_reply_to", "invalid_sender"].includes(code)) {
    return { message: `The ${label} could not be sent with the current message settings.`, status: 422 };
  }
  return { message: `The ${label} provider did not accept this message.`, status: 502 };
}

async function deliverPreparedCommunication(input: {
  messageId: string;
  channel: CustomerCommunicationChannel;
  destination: string;
  subject: string | null;
  body: string;
  idempotencyKey: string;
}): Promise<CustomerMessage> {
  const providerResult =
    input.channel === "email"
      ? await sendResendEmail({
          to: input.destination,
          subject: input.subject!,
          replyTo: resolveCommunicationsReplyTo()!,
          idempotencyKey: input.idempotencyKey,
          text: input.body,
        })
      : await sendTwilioSms({ to: input.destination, body: input.body });

  if (!providerResult.ok) {
    await finalizeOutboundCommunicationAttempt({
      messageId: input.messageId,
      deliveryStatus: "failed",
      failureCode: providerResult.errorCode,
    });
    const failure = providerFailureMessage(providerResult.errorCode, input.channel);
    throw new CommunicationsServiceError(
      failure.message,
      failure.status,
      providerResult.errorCode,
    );
  }

  return finalizeOutboundCommunicationAttempt({
    messageId: input.messageId,
    providerMessageId: providerResult.providerMessageId,
    deliveryStatus: providerStatusToCustomerDeliveryStatus(providerResult.status),
  });
}

export async function sendOutboundCommunication(input: {
  conversationId: string;
  channel: CustomerCommunicationChannel;
  subject?: string | null;
  body: string;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown>;
  allowUnverifiedSms?: boolean;
}): Promise<{ message: CustomerMessage; duplicate: boolean }> {
  const context = await loadCommunicationConversationContext(input.conversationId);
  if (!context) {
    throw new CommunicationsServiceError("Conversation not found.", 404, "not_found");
  }
  const configuration = getCommunicationsConfiguration();
  const idempotencyKey =
    input.idempotencyKey?.trim() ||
    `hq:${input.conversationId}:${input.channel}:${randomUUID()}`;
  const destination = input.channel === "email" ? context.email : context.sms;
  const gate = evaluateOutboundCommunicationGate({
    channel: input.channel,
    destination,
    providerConfigured: configuration[input.channel].configured,
    subject: input.subject,
    body: input.body,
    idempotencyKey,
    allowUnverifiedSms: input.allowUnverifiedSms,
  });
  if (!gate.allowed) {
    const blocked = blockMessage(gate.code, input.channel);
    throw new CommunicationsServiceError(blocked.message, blocked.status, gate.code);
  }

  const provider = input.channel === "email" ? "resend" : "twilio";
  const attempt = await createOutboundCommunicationAttempt({
    conversationId: input.conversationId,
    contactPointId: destination?.contactPointId ?? null,
    channel: input.channel,
    provider,
    idempotencyKey,
    recipientAddress: gate.destination,
    subject: gate.subject,
    body: gate.body,
    metadata: input.metadata ?? { source: "hq_manual" },
  });
  if (attempt.duplicate) {
    if (
      ["failed", "bounced", "complained", "cancelled"].includes(
        attempt.message.deliveryStatus,
      )
    ) {
      throw new CommunicationsServiceError(
        "This safely deduplicated send already failed. Create a new send to retry.",
        409,
        "duplicate_failed_attempt",
      );
    }
    return attempt;
  }

  const message = await deliverPreparedCommunication({
    messageId: attempt.message.id,
    channel: input.channel,
    destination: gate.destination,
    subject: gate.subject,
    body: gate.body,
    idempotencyKey,
  });
  return { message, duplicate: false };
}

export async function scheduleOutboundCommunication(input: {
  conversationId: string;
  channel: CustomerCommunicationChannel;
  subject?: string | null;
  body: string;
  idempotencyKey: string;
  scheduledFor: string;
  metadata?: Record<string, unknown>;
  allowUnverifiedSms?: boolean;
}): Promise<{ message: CustomerMessage; duplicate: boolean }> {
  const scheduledFor = new Date(input.scheduledFor);
  if (!Number.isFinite(scheduledFor.getTime())) {
    throw new CommunicationsServiceError(
      "The scheduled delivery time is invalid.",
      400,
      "invalid_schedule",
    );
  }
  const context = await loadCommunicationConversationContext(input.conversationId);
  if (!context) {
    throw new CommunicationsServiceError("Conversation not found.", 404, "not_found");
  }
  const configuration = getCommunicationsConfiguration();
  const destination = input.channel === "email" ? context.email : context.sms;
  const gate = evaluateOutboundCommunicationGate({
    channel: input.channel,
    destination,
    providerConfigured: configuration[input.channel].configured,
    subject: input.subject,
    body: input.body,
    idempotencyKey: input.idempotencyKey,
    allowUnverifiedSms: input.allowUnverifiedSms,
  });
  if (!gate.allowed) {
    const blocked = blockMessage(gate.code, input.channel);
    throw new CommunicationsServiceError(blocked.message, blocked.status, gate.code);
  }
  return createOutboundCommunicationAttempt({
    conversationId: input.conversationId,
    contactPointId: destination?.contactPointId ?? null,
    channel: input.channel,
    provider: input.channel === "email" ? "resend" : "twilio",
    idempotencyKey: input.idempotencyKey,
    recipientAddress: gate.destination,
    subject: gate.subject,
    body: gate.body,
    scheduledFor: scheduledFor.toISOString(),
    metadata: input.metadata,
  });
}

export interface ScheduledCommunicationRunSummary {
  due: number;
  sent: number;
  claimedElsewhere: number;
  failed: number;
}

export async function processDueScheduledCommunications(
  now = new Date(),
): Promise<ScheduledCommunicationRunSummary> {
  const summary: ScheduledCommunicationRunSummary = {
    due: 0,
    sent: 0,
    claimedElsewhere: 0,
    failed: 0,
  };
  const due = await listDueScheduledCommunicationMessages(now.toISOString());
  summary.due = due.length;

  for (const queued of due) {
    const claimed = await claimScheduledCommunication(queued.id, now.toISOString());
    if (!claimed) {
      summary.claimedElsewhere += 1;
      continue;
    }
    try {
      const context = await loadCommunicationConversationContext(claimed.conversationId);
      if (!context) throw new Error("scheduled_conversation_missing");
      const configuration = getCommunicationsConfiguration();
      const destination = claimed.channel === "email" ? context.email : context.sms;
      const allowUnverifiedSms =
        claimed.metadata.verificationOverride === "lead_form_explicit_consent";
      const gate = evaluateOutboundCommunicationGate({
        channel: claimed.channel,
        destination,
        providerConfigured: configuration[claimed.channel].configured,
        subject: claimed.subject,
        body: claimed.bodyText,
        idempotencyKey: claimed.idempotencyKey,
        allowUnverifiedSms,
      });
      if (!gate.allowed || gate.destination !== claimed.recipientAddressNormalized) {
        const code = gate.allowed ? "destination_changed" : gate.code;
        await finalizeOutboundCommunicationAttempt({
          messageId: claimed.id,
          deliveryStatus: "failed",
          failureCode: code,
        });
        summary.failed += 1;
        continue;
      }
      await deliverPreparedCommunication({
        messageId: claimed.id,
        channel: claimed.channel,
        destination: gate.destination,
        subject: gate.subject,
        body: gate.body,
        idempotencyKey: claimed.idempotencyKey,
      });
      summary.sent += 1;
    } catch (error) {
      summary.failed += 1;
      await finalizeOutboundCommunicationAttempt({
        messageId: claimed.id,
        deliveryStatus: "failed",
        failureCode: "scheduled_delivery_exception",
      }).catch(() => null);
      console.warn("[scheduled-communications] delivery failed", {
        messageId: claimed.id,
        reason: error instanceof Error ? error.message : "unknown",
      });
    }
  }
  return summary;
}
