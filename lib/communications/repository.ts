import "server-only";

import { createServiceRoleSupabaseClient } from "@/lib/persistence/supabase/client";
import {
  normalizeE164,
  normalizeEmailDestination,
} from "@/lib/communications/providers/contracts";
import type {
  CustomerCommunicationChannel,
  CustomerConsentStatus,
  CustomerContactPoint,
  CustomerContactVerificationStatus,
  CustomerConversation,
  CustomerMessage,
  CustomerMessageDeliveryStatus,
} from "@/lib/communications/types";
import type { LeadIntakeStatus } from "@/lib/acquisition/lead-record";

interface ConversationRow {
  id: string;
  homeowner_id: string | null;
  property_id: string | null;
  membership_id: string | null;
  lead_intake_id: string | null;
  subject: string | null;
  status: CustomerConversation["status"];
  assigned_to: string | null;
  provider: string | null;
  provider_thread_id: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  contact_point_id: string | null;
  automation_rule_id: string | null;
  reply_to_message_id: string | null;
  direction: CustomerMessage["direction"];
  channel: CustomerCommunicationChannel;
  provider: string | null;
  provider_message_id: string | null;
  idempotency_key: string;
  sender_address_normalized: string | null;
  recipient_address_normalized: string | null;
  recipient_address_masked: string | null;
  subject: string | null;
  body_text: string;
  delivery_status: CustomerMessageDeliveryStatus;
  scheduled_for: string | null;
  provider_event_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  failure_code: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface ContactPointRow {
  id: string;
  homeowner_id: string;
  channel: CustomerCommunicationChannel;
  address_normalized: string;
  address_masked: string | null;
  is_primary: boolean;
  verification_status: CustomerContactVerificationStatus;
  verified_at: string | null;
  consent_status: CustomerConsentStatus;
  consent_source: string | null;
  consent_recorded_at: string | null;
  opt_out_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface HomeownerRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
}

interface LeadRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  service_address: string;
  status: LeadIntakeStatus;
  sms_consent_status: CustomerConsentStatus | null;
  sms_consent_recorded_at: string | null;
  sms_verified_at: string | null;
  email_delivery_status: "active" | "bounced" | "complained" | null;
  email_delivery_status_recorded_at: string | null;
}

interface PropertyRow {
  id: string;
  name: string | null;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
}

interface VerifiedInboundSmsRow {
  conversation_id: string;
  sender_address_normalized: string | null;
}

export interface CommunicationDestination {
  address: string;
  contactPointId: string | null;
  consentStatus: CustomerConsentStatus;
  verificationStatus: CustomerContactVerificationStatus;
}

export interface CommunicationConversationContext {
  conversation: CustomerConversation;
  customerName: string;
  propertyLabel: string | null;
  leadStatus: LeadIntakeStatus | null;
  email: CommunicationDestination | null;
  sms: CommunicationDestination | null;
}

export interface CommunicationDeliveryUpdate {
  customerMessageId?: string | null;
  provider: string;
  providerMessageId?: string | null;
  deliveryStatus: CustomerMessageDeliveryStatus;
  occurredAt?: string | null;
  failureCode?: string | null;
}

export interface TwilioInboundContactResolution {
  status: "resolved" | "ambiguous" | "not_found" | "invalid";
  normalizedPhone: string | null;
  conversationId: string | null;
  homeownerId: string | null;
  leadIntakeId: string | null;
  contactPointId: string | null;
}

interface LeadConversationCandidate {
  id: string;
  leadIntakeId: string;
}

export function selectSoleMessagedLeadConversation(
  leadIntakeIds: string[],
  conversations: LeadConversationCandidate[],
  outboundConversationIds: string[],
): LeadConversationCandidate | null {
  const candidateLeadIds = new Set(leadIntakeIds);
  const conversationById = new Map(
    conversations
      .filter((conversation) => candidateLeadIds.has(conversation.leadIntakeId))
      .map((conversation) => [conversation.id, conversation]),
  );
  const messagedLeadIds = new Set<string>();
  let newestConversation: LeadConversationCandidate | null = null;

  for (const conversationId of outboundConversationIds) {
    const conversation = conversationById.get(conversationId);
    if (!conversation) continue;
    newestConversation ??= conversation;
    messagedLeadIds.add(conversation.leadIntakeId);
  }

  return messagedLeadIds.size === 1 ? newestConversation : null;
}

const CONVERSATION_SELECT =
  "id, homeowner_id, property_id, membership_id, lead_intake_id, subject, status, assigned_to, provider, provider_thread_id, last_message_at, created_at, updated_at";
const MESSAGE_SELECT =
  "id, conversation_id, contact_point_id, automation_rule_id, reply_to_message_id, direction, channel, provider, provider_message_id, idempotency_key, sender_address_normalized, recipient_address_normalized, recipient_address_masked, subject, body_text, delivery_status, scheduled_for, provider_event_at, sent_at, delivered_at, failure_code, metadata, created_at, updated_at";

function conversationFromRow(row: ConversationRow): CustomerConversation {
  return {
    id: row.id,
    homeownerId: row.homeowner_id,
    propertyId: row.property_id,
    membershipId: row.membership_id,
    leadIntakeId: row.lead_intake_id,
    subject: row.subject,
    status: row.status,
    assignedTo: row.assigned_to,
    provider: row.provider,
    providerThreadId: row.provider_thread_id,
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function messageFromRow(row: MessageRow): CustomerMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    contactPointId: row.contact_point_id,
    automationRuleId: row.automation_rule_id,
    replyToMessageId: row.reply_to_message_id,
    direction: row.direction,
    channel: row.channel,
    provider: row.provider,
    providerMessageId: row.provider_message_id,
    idempotencyKey: row.idempotency_key,
    senderAddressNormalized: row.sender_address_normalized,
    recipientAddressNormalized: row.recipient_address_normalized,
    recipientAddressMasked: row.recipient_address_masked,
    subject: row.subject,
    bodyText: row.body_text,
    deliveryStatus: row.delivery_status,
    scheduledFor: row.scheduled_for,
    providerEventAt: row.provider_event_at,
    sentAt: row.sent_at,
    deliveredAt: row.delivered_at,
    failureCode: row.failure_code,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function contactPointFromRow(row: ContactPointRow): CustomerContactPoint {
  return {
    id: row.id,
    homeownerId: row.homeowner_id,
    channel: row.channel,
    addressNormalized: row.address_normalized,
    addressMasked: row.address_masked,
    isPrimary: row.is_primary,
    verificationStatus: row.verification_status,
    verifiedAt: row.verified_at,
    consentStatus: row.consent_status,
    consentSource: row.consent_source,
    consentRecordedAt: row.consent_recorded_at,
    optOutReason: row.opt_out_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function databaseError(operation: string, message: string): Error {
  return new Error(`Customer communications ${operation} failed: ${message}`);
}

function propertyLabel(row: PropertyRow | undefined): string | null {
  if (!row) return null;
  const address = [row.address, row.city, row.state, row.zip]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
  return address || row.name?.trim() || null;
}

function contactPriority(point: CustomerContactPoint): number {
  return (point.isPrimary ? 4 : 0) +
    (point.verificationStatus === "verified" ? 2 : 0) +
    (point.consentStatus === "opted_in" ? 1 : 0);
}

function bestContactPoint(
  points: CustomerContactPoint[],
  channel: CustomerCommunicationChannel,
): CustomerContactPoint | null {
  return (
    points
      .filter((point) => point.channel === channel && point.verificationStatus !== "invalid")
      .sort((left, right) => {
        const priority = contactPriority(right) - contactPriority(left);
        if (priority !== 0) return priority;
        return right.updatedAt.localeCompare(left.updatedAt);
      })[0] ?? null
  );
}

/**
 * Prefer an explicitly managed email contact point. If a delivery webhook has
 * marked the homeowner's raw email invalid, preserve that suppression instead
 * of silently falling back to the same address as an unverified destination.
 */
export function resolveHomeownerEmailDestination(
  points: CustomerContactPoint[],
  homeownerEmail: string | null,
): CommunicationDestination | null {
  const preferred = bestContactPoint(points, "email");
  if (preferred) {
    return {
      address: preferred.addressNormalized,
      contactPointId: preferred.id,
      consentStatus: preferred.consentStatus,
      verificationStatus: preferred.verificationStatus,
    };
  }
  if (!homeownerEmail) return null;

  const invalidRawAddress = points.find(
    (point) =>
      point.channel === "email" &&
      point.verificationStatus === "invalid" &&
      normalizeEmailDestination(point.addressNormalized) === homeownerEmail,
  );
  if (invalidRawAddress) {
    return {
      address: homeownerEmail,
      contactPointId: invalidRawAddress.id,
      consentStatus: invalidRawAddress.consentStatus,
      verificationStatus: "invalid",
    };
  }

  return {
    address: homeownerEmail,
    contactPointId: null,
    consentStatus: "unknown",
    verificationStatus: "unverified",
  };
}

export function normalizeCustomerPhone(value: string | null | undefined): string | null {
  const direct = normalizeE164(value);
  if (direct) return direct;
  const digits = value?.replace(/\D/g, "") ?? "";
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/**
 * A managed SMS contact point is valid for outbound use only while it matches
 * the homeowner's current phone field. Editing the customer phone therefore
 * fails closed until HQ records explicit consent for that exact new number.
 */
export function resolveHomeownerSmsDestination(
  points: CustomerContactPoint[],
  homeownerPhone: string | null,
): CommunicationDestination | null {
  if (!homeownerPhone) return null;
  const exactPoint = bestContactPoint(
    points.filter(
      (point) =>
        point.channel === "sms" &&
        normalizeCustomerPhone(point.addressNormalized) === homeownerPhone,
    ),
    "sms",
  );
  return exactPoint
    ? {
        address: homeownerPhone,
        contactPointId: exactPoint.id,
        consentStatus: exactPoint.consentStatus,
        verificationStatus: exactPoint.verificationStatus,
      }
    : {
        address: homeownerPhone,
        contactPointId: null,
        consentStatus: "unknown",
        verificationStatus: "unverified",
      };
}

export function leadSmsVerificationStatus(
  conversationId: string,
  leadPhone: string,
  verifiedInboundRows: VerifiedInboundSmsRow[],
  storedVerifiedAt: string | null = null,
): CustomerContactVerificationStatus {
  if (storedVerifiedAt && !Number.isNaN(Date.parse(storedVerifiedAt))) {
    return "verified";
  }
  return verifiedInboundRows.some(
    (row) =>
      row.conversation_id === conversationId &&
      normalizeCustomerPhone(row.sender_address_normalized) === leadPhone,
  )
    ? "verified"
    : "unverified";
}

export function maskCommunicationAddress(
  channel: CustomerCommunicationChannel,
  address: string,
): string {
  if (channel === "sms") {
    const digits = address.replace(/\D/g, "");
    return digits.length >= 4 ? `***-***-${digits.slice(-4)}` : "***";
  }
  const [local, domain] = address.split("@");
  if (!local || !domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}

export async function listCommunicationConversations(
  limit = 150,
): Promise<CustomerConversation[]> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("customer_conversations")
    .select(CONVERSATION_SELECT)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 500)));

  if (error) throw databaseError("list", error.message);
  return ((data ?? []) as ConversationRow[]).map(conversationFromRow);
}

export async function getCommunicationConversation(
  conversationId: string,
): Promise<CustomerConversation | null> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("customer_conversations")
    .select(CONVERSATION_SELECT)
    .eq("id", conversationId)
    .maybeSingle();

  if (error) throw databaseError("load", error.message);
  return data ? conversationFromRow(data as ConversationRow) : null;
}

export async function ensureLeadConversation(input: {
  leadIntakeId: string;
  subject?: string | null;
}): Promise<CustomerConversation> {
  const supabase = createServiceRoleSupabaseClient();
  const existing = await supabase
    .from("customer_conversations")
    .select(CONVERSATION_SELECT)
    .eq("lead_intake_id", input.leadIntakeId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing.error) throw databaseError("load lead thread", existing.error.message);
  if (existing.data) return conversationFromRow(existing.data as ConversationRow);

  // Lead IDs are UUIDs. Reusing the lead UUID makes first-conversation creation
  // naturally idempotent even when two request handlers finish together.
  const created = await supabase
    .from("customer_conversations")
    .upsert(
      {
        id: input.leadIntakeId,
        lead_intake_id: input.leadIntakeId,
        subject: input.subject?.trim() || "Website service request",
      },
      { onConflict: "id", ignoreDuplicates: true },
    )
    .select(CONVERSATION_SELECT)
    .maybeSingle();
  if (created.error) throw databaseError("create lead thread", created.error.message);
  if (created.data) return conversationFromRow(created.data as ConversationRow);

  const raced = await getCommunicationConversation(input.leadIntakeId);
  if (!raced) throw databaseError("create lead thread", "conversation was not returned");
  return raced;
}

export async function ensureHomeownerConversation(input: {
  homeownerId: string;
  subject?: string | null;
}): Promise<CustomerConversation> {
  const supabase = createServiceRoleSupabaseClient();
  const existing = await supabase
    .from("customer_conversations")
    .select(CONVERSATION_SELECT)
    .eq("homeowner_id", input.homeownerId)
    .is("property_id", null)
    .is("membership_id", null)
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing.error) {
    throw databaseError("load homeowner thread", existing.error.message);
  }
  if (existing.data) return conversationFromRow(existing.data as ConversationRow);

  const created = await supabase
    .from("customer_conversations")
    .insert({
      homeowner_id: input.homeownerId,
      subject: input.subject?.trim() || "Customer conversation",
    })
    .select(CONVERSATION_SELECT)
    .single();
  if (created.error || !created.data) {
    throw databaseError(
      "create homeowner thread",
      created.error?.message ?? "conversation was not returned",
    );
  }
  return conversationFromRow(created.data as ConversationRow);
}

export async function loadCommunicationConversationContexts(
  conversations: CustomerConversation[],
): Promise<Map<string, CommunicationConversationContext>> {
  const contextById = new Map<string, CommunicationConversationContext>();
  if (conversations.length === 0) return contextById;

  const supabase = createServiceRoleSupabaseClient();
  const homeownerIds = [...new Set(conversations.flatMap((item) => item.homeownerId ?? []))];
  const leadIds = [...new Set(conversations.flatMap((item) => item.leadIntakeId ?? []))];
  const leadConversationIds = conversations
    .filter((item) => item.leadIntakeId)
    .map((item) => item.id);
  const propertyIds = [...new Set(conversations.flatMap((item) => item.propertyId ?? []))];

  const [
    homeownersResult,
    leadsResult,
    propertiesResult,
    contactsResult,
    verifiedInboundSmsResult,
  ] =
    await Promise.all([
      homeownerIds.length
        ? supabase.from("homeowners").select("id, full_name, email, phone").in("id", homeownerIds)
        : Promise.resolve({ data: [], error: null }),
      leadIds.length
        ? supabase
            .from("lead_intakes")
            .select("id, name, email, phone, service_address, status, sms_consent_status, sms_consent_recorded_at, sms_verified_at, email_delivery_status, email_delivery_status_recorded_at")
            .in("id", leadIds)
        : Promise.resolve({ data: [], error: null }),
      propertyIds.length
        ? supabase
            .from("properties")
            .select("id, name, address, city, state, zip")
            .in("id", propertyIds)
        : Promise.resolve({ data: [], error: null }),
      homeownerIds.length
        ? supabase.from("customer_contact_points").select("*").in("homeowner_id", homeownerIds)
        : Promise.resolve({ data: [], error: null }),
      // Twilio inbound messages enter this ledger only after the webhook route
      // validates its signature. Match both conversation and normalized number
      // so a reply to one lead can never verify another lead's destination.
      leadConversationIds.length
        ? supabase
            .from("customer_messages")
            .select("conversation_id, sender_address_normalized")
            .in("conversation_id", leadConversationIds)
            .eq("direction", "inbound")
            .eq("channel", "sms")
            .eq("provider", "twilio")
            .eq("delivery_status", "received")
            .not("provider_message_id", "is", null)
        : Promise.resolve({ data: [], error: null }),
    ]);

  for (const [operation, error] of [
    ["load homeowners", homeownersResult.error],
    ["load leads", leadsResult.error],
    ["load properties", propertiesResult.error],
    ["load contact points", contactsResult.error],
    ["load verified inbound SMS", verifiedInboundSmsResult.error],
  ] as const) {
    if (error) throw databaseError(operation, error.message);
  }

  const homeowners = new Map(
    ((homeownersResult.data ?? []) as HomeownerRow[]).map((row) => [row.id, row]),
  );
  const leads = new Map(
    ((leadsResult.data ?? []) as LeadRow[]).map((row) => [row.id, row]),
  );
  const properties = new Map(
    ((propertiesResult.data ?? []) as PropertyRow[]).map((row) => [row.id, row]),
  );
  const verifiedInboundSmsRows = (verifiedInboundSmsResult.data ?? []) as
    VerifiedInboundSmsRow[];
  const pointsByHomeowner = new Map<string, CustomerContactPoint[]>();
  for (const row of (contactsResult.data ?? []) as ContactPointRow[]) {
    const point = contactPointFromRow(row);
    const current = pointsByHomeowner.get(point.homeownerId) ?? [];
    current.push(point);
    pointsByHomeowner.set(point.homeownerId, current);
  }

  for (const conversation of conversations) {
    const homeowner = conversation.homeownerId
      ? homeowners.get(conversation.homeownerId)
      : undefined;
    const lead = conversation.leadIntakeId
      ? leads.get(conversation.leadIntakeId)
      : undefined;
    const points = conversation.homeownerId
      ? pointsByHomeowner.get(conversation.homeownerId) ?? []
      : [];
    const homeownerEmail = normalizeEmailDestination(homeowner?.email);
    const homeownerPhone = normalizeCustomerPhone(homeowner?.phone);
    const leadEmail = normalizeEmailDestination(lead?.email);
    const leadPhone = normalizeCustomerPhone(lead?.phone);

    const email: CommunicationDestination | null = homeowner
      ? resolveHomeownerEmailDestination(points, homeownerEmail)
      : leadEmail
        ? {
            address: leadEmail,
            contactPointId: null,
            consentStatus:
              lead?.email_delivery_status === "complained"
                ? "opted_out"
                : "unknown",
            verificationStatus:
              lead?.email_delivery_status === "bounced"
                ? "invalid"
                : "unverified",
          }
        : null;

    const sms: CommunicationDestination | null = homeowner
      ? resolveHomeownerSmsDestination(points, homeownerPhone)
      : leadPhone
        ? {
            address: leadPhone,
            contactPointId: null,
            consentStatus: lead?.sms_consent_status ?? "unknown",
            verificationStatus: leadSmsVerificationStatus(
              conversation.id,
              leadPhone,
              verifiedInboundSmsRows,
              lead?.sms_verified_at ?? null,
            ),
          }
        : null;

    contextById.set(conversation.id, {
      conversation,
      customerName: homeowner?.full_name?.trim() || lead?.name?.trim() || "Customer",
      propertyLabel:
        propertyLabel(
          conversation.propertyId ? properties.get(conversation.propertyId) : undefined,
        ) ?? (lead?.service_address?.trim() || null),
      leadStatus: lead?.status ?? null,
      email,
      sms,
    });
  }

  return contextById;
}

export async function loadCommunicationConversationContext(
  conversationId: string,
): Promise<CommunicationConversationContext | null> {
  const conversation = await getCommunicationConversation(conversationId);
  if (!conversation) return null;
  const contexts = await loadCommunicationConversationContexts([conversation]);
  return contexts.get(conversation.id) ?? null;
}

export async function listCommunicationMessages(
  conversationId: string,
  limit = 250,
): Promise<CustomerMessage[]> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("customer_messages")
    .select(MESSAGE_SELECT)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 1000)));
  if (error) throw databaseError("load messages", error.message);
  return ((data ?? []) as MessageRow[]).map(messageFromRow).reverse();
}

export async function listLatestCommunicationMessages(
  conversationIds: string[],
): Promise<Map<string, CustomerMessage>> {
  const latest = new Map<string, CustomerMessage>();
  if (conversationIds.length === 0) return latest;
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("customer_messages")
    .select(MESSAGE_SELECT)
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false })
    .limit(Math.min(conversationIds.length * 8, 2000));
  if (error) throw databaseError("load message previews", error.message);
  for (const row of (data ?? []) as MessageRow[]) {
    if (!latest.has(row.conversation_id)) {
      latest.set(row.conversation_id, messageFromRow(row));
    }
  }
  return latest;
}

export async function createOutboundCommunicationAttempt(input: {
  conversationId: string;
  contactPointId: string | null;
  channel: CustomerCommunicationChannel;
  provider: "resend" | "twilio";
  idempotencyKey: string;
  recipientAddress: string;
  subject?: string | null;
  body: string;
  metadata?: Record<string, unknown>;
  scheduledFor?: string | null;
}): Promise<{ message: CustomerMessage; duplicate: boolean }> {
  const supabase = createServiceRoleSupabaseClient();
  const existing = await supabase
    .from("customer_messages")
    .select(MESSAGE_SELECT)
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();
  if (existing.error) throw databaseError("load outbound attempt", existing.error.message);
  if (existing.data) {
    const message = messageFromRow(existing.data as MessageRow);
    if (message.conversationId !== input.conversationId) {
      throw databaseError("create outbound attempt", "idempotency key belongs to another conversation");
    }
    return { message, duplicate: true };
  }

  const now = new Date().toISOString();
  const created = await supabase
    .from("customer_messages")
    .insert({
      conversation_id: input.conversationId,
      contact_point_id: input.contactPointId,
      direction: "outbound",
      channel: input.channel,
      provider: input.provider,
      idempotency_key: input.idempotencyKey,
      recipient_address_normalized: input.recipientAddress,
      recipient_address_masked: maskCommunicationAddress(input.channel, input.recipientAddress),
      subject: input.subject?.trim() || null,
      body_text: input.body,
      delivery_status: input.scheduledFor ? "scheduled" : "sending",
      scheduled_for: input.scheduledFor ?? null,
      metadata: input.metadata ?? { source: "hq_manual" },
    })
    .select(MESSAGE_SELECT)
    .single();
  if (created.error || !created.data) {
    // A racing request with the same key is safe to return as the same attempt.
    const raced = await supabase
      .from("customer_messages")
      .select(MESSAGE_SELECT)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (raced.data) {
      return { message: messageFromRow(raced.data as MessageRow), duplicate: true };
    }
    throw databaseError(
      "create outbound attempt",
      created.error?.message ?? raced.error?.message ?? "message was not returned",
    );
  }

  const conversationUpdate = await supabase
    .from("customer_conversations")
    .update({ last_message_at: now })
    .eq("id", input.conversationId);
  if (conversationUpdate.error) {
    throw databaseError("update thread activity", conversationUpdate.error.message);
  }
  return { message: messageFromRow(created.data as MessageRow), duplicate: false };
}

export async function listDueScheduledCommunicationMessages(
  dueAt: string,
  limit = 100,
): Promise<CustomerMessage[]> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("customer_messages")
    .select(MESSAGE_SELECT)
    .eq("direction", "outbound")
    .eq("delivery_status", "scheduled")
    .lte("scheduled_for", dueAt)
    .order("scheduled_for", { ascending: true })
    .limit(Math.max(1, Math.min(limit, 500)));
  if (error) throw databaseError("load scheduled messages", error.message);
  return ((data ?? []) as MessageRow[]).map(messageFromRow);
}

export async function claimScheduledCommunication(
  messageId: string,
  claimedAt: string,
): Promise<CustomerMessage | null> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("customer_messages")
    .update({
      delivery_status: "sending",
      provider_event_at: claimedAt,
    })
    .eq("id", messageId)
    .eq("delivery_status", "scheduled")
    .select(MESSAGE_SELECT)
    .maybeSingle();
  if (error) throw databaseError("claim scheduled message", error.message);
  return data ? messageFromRow(data as MessageRow) : null;
}

export async function finalizeOutboundCommunicationAttempt(input: {
  messageId: string;
  providerMessageId?: string | null;
  deliveryStatus: CustomerMessageDeliveryStatus;
  failureCode?: string | null;
  occurredAt?: string | null;
}): Promise<CustomerMessage> {
  const supabase = createServiceRoleSupabaseClient();
  const eventAt = input.occurredAt ?? new Date().toISOString();
  const update: Record<string, unknown> = {
    provider_message_id: input.providerMessageId ?? null,
    delivery_status: input.deliveryStatus,
    provider_event_at: eventAt,
    failure_code: input.failureCode?.slice(0, 120) || null,
  };
  if (
    ["accepted", "sent", "delivered", "opened", "clicked", "read"].includes(
      input.deliveryStatus,
    )
  ) {
    update.sent_at = eventAt;
  }
  if (["delivered", "opened", "clicked", "read"].includes(input.deliveryStatus)) {
    update.delivered_at = eventAt;
  }

  const { data, error } = await supabase
    .from("customer_messages")
    .update(update)
    .eq("id", input.messageId)
    .select(MESSAGE_SELECT)
    .single();
  if (error || !data) {
    throw databaseError(
      "finalize outbound attempt",
      error?.message ?? "message was not returned",
    );
  }
  return messageFromRow(data as MessageRow);
}

const DELIVERY_RANK: Record<CustomerMessageDeliveryStatus, number> = {
  draft: 0,
  queued: 1,
  scheduled: 1,
  sending: 2,
  accepted: 3,
  sent: 4,
  delivery_delayed: 4,
  delivered: 5,
  opened: 5,
  clicked: 5,
  read: 5,
  received: 5,
  failed: 6,
  bounced: 6,
  complained: 6,
  cancelled: 6,
};

export function shouldApplyCommunicationDeliveryUpdate(
  current: CustomerMessageDeliveryStatus,
  next: CustomerMessageDeliveryStatus,
): boolean {
  return DELIVERY_RANK[next] >= DELIVERY_RANK[current];
}

export async function updateCommunicationDelivery(
  input: CommunicationDeliveryUpdate,
): Promise<CustomerMessage | null> {
  if (!input.customerMessageId && !input.providerMessageId) {
    throw new Error("A customer message ID or provider message ID is required");
  }
  const supabase = createServiceRoleSupabaseClient();
  let query = supabase.from("customer_messages").select(MESSAGE_SELECT);
  query = input.customerMessageId
    ? query.eq("id", input.customerMessageId)
    : query
        .eq("provider", input.provider)
        .eq("provider_message_id", input.providerMessageId!);
  const existing = await query.maybeSingle();
  if (existing.error) throw databaseError("load delivery", existing.error.message);
  if (!existing.data) return null;
  const current = messageFromRow(existing.data as MessageRow);
  if (!shouldApplyCommunicationDeliveryUpdate(current.deliveryStatus, input.deliveryStatus)) {
    return current;
  }
  return finalizeOutboundCommunicationAttempt({
    messageId: current.id,
    providerMessageId: input.providerMessageId ?? current.providerMessageId,
    deliveryStatus: input.deliveryStatus,
    failureCode: input.failureCode,
    occurredAt: input.occurredAt,
  });
}

export async function recordInboundCommunication(input: {
  conversationId: string;
  contactPointId?: string | null;
  channel: CustomerCommunicationChannel;
  provider: "resend" | "twilio";
  providerMessageId: string;
  senderAddress: string;
  recipientAddress?: string | null;
  subject?: string | null;
  body: string;
  occurredAt?: string | null;
}): Promise<{ message: CustomerMessage; duplicate: boolean }> {
  const supabase = createServiceRoleSupabaseClient();
  const idempotencyKey = `inbound:${input.provider}:${input.providerMessageId}`;
  const existing = await supabase
    .from("customer_messages")
    .select(MESSAGE_SELECT)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing.error) throw databaseError("load inbound message", existing.error.message);
  if (existing.data) {
    return { message: messageFromRow(existing.data as MessageRow), duplicate: true };
  }

  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const { data, error } = await supabase
    .from("customer_messages")
    .insert({
      conversation_id: input.conversationId,
      contact_point_id: input.contactPointId ?? null,
      direction: "inbound",
      channel: input.channel,
      provider: input.provider,
      provider_message_id: input.providerMessageId,
      idempotency_key: idempotencyKey,
      sender_address_normalized: input.senderAddress,
      recipient_address_normalized: input.recipientAddress ?? null,
      subject: input.subject?.trim() || null,
      body_text: input.body,
      delivery_status: "received",
      provider_event_at: occurredAt,
      metadata: { source: "provider_webhook" },
    })
    .select(MESSAGE_SELECT)
    .single();
  if (error || !data) {
    const raced = await supabase
      .from("customer_messages")
      .select(MESSAGE_SELECT)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (raced.data) {
      return { message: messageFromRow(raced.data as MessageRow), duplicate: true };
    }
    throw databaseError(
      "record inbound message",
      error?.message ?? raced.error?.message ?? "message was not returned",
    );
  }
  const activity = await supabase
    .from("customer_conversations")
    .update({ last_message_at: occurredAt })
    .eq("id", input.conversationId);
  if (activity.error) throw databaseError("update thread activity", activity.error.message);
  return { message: messageFromRow(data as MessageRow), duplicate: false };
}

async function genericConversationIdForHomeowner(
  homeownerId: string,
): Promise<string | null> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("customer_conversations")
    .select("id")
    .eq("homeowner_id", homeownerId)
    .is("property_id", null)
    .is("membership_id", null)
    .eq("status", "open")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw databaseError("resolve homeowner thread", error.message);
  return (data as { id?: string } | null)?.id ?? null;
}

async function conversationIdForLead(leadIntakeId: string): Promise<string | null> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("customer_conversations")
    .select("id")
    .eq("lead_intake_id", leadIntakeId)
    .eq("status", "open")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw databaseError("resolve lead thread", error.message);
  return (data as { id?: string } | null)?.id ?? null;
}

async function messagedConversationForDuplicateLeads(
  leadIntakeIds: string[],
  normalizedPhone: string,
): Promise<LeadConversationCandidate | null> {
  const supabase = createServiceRoleSupabaseClient();
  const conversationResult = await supabase
    .from("customer_conversations")
    .select("id, lead_intake_id")
    .in("lead_intake_id", leadIntakeIds)
    .eq("status", "open");
  if (conversationResult.error) {
    throw databaseError("resolve duplicate lead threads", conversationResult.error.message);
  }

  const conversations = (conversationResult.data ?? []).map((row) => ({
    id: row.id as string,
    leadIntakeId: row.lead_intake_id as string,
  }));
  if (conversations.length === 0) return null;

  const messageResult = await supabase
    .from("customer_messages")
    .select("conversation_id")
    .in(
      "conversation_id",
      conversations.map((conversation) => conversation.id),
    )
    .eq("direction", "outbound")
    .eq("channel", "sms")
    .eq("provider", "twilio")
    .eq("recipient_address_normalized", normalizedPhone)
    .in("delivery_status", [
      "accepted",
      "queued",
      "sending",
      "sent",
      "delivered",
      "read",
    ])
    .order("created_at", { ascending: false })
    .limit(200);
  if (messageResult.error) {
    throw databaseError("resolve duplicate lead messages", messageResult.error.message);
  }

  return selectSoleMessagedLeadConversation(
    leadIntakeIds,
    conversations,
    (messageResult.data ?? []).map((row) => row.conversation_id as string),
  );
}

export async function resolveTwilioInboundContact(
  rawPhone: string,
): Promise<TwilioInboundContactResolution> {
  const normalizedPhone = normalizeCustomerPhone(rawPhone);
  if (!normalizedPhone) {
    return {
      status: "invalid",
      normalizedPhone: null,
      conversationId: null,
      homeownerId: null,
      leadIntakeId: null,
      contactPointId: null,
    };
  }

  const supabase = createServiceRoleSupabaseClient();
  const pointResult = await supabase
    .from("customer_contact_points")
    .select("id, homeowner_id")
    .eq("channel", "sms")
    .eq("address_normalized", normalizedPhone)
    .maybeSingle();
  if (pointResult.error) throw databaseError("resolve inbound contact", pointResult.error.message);
  if (pointResult.data) {
    const point = pointResult.data as { id: string; homeowner_id: string };
    return {
      status: "resolved",
      normalizedPhone,
      conversationId: await genericConversationIdForHomeowner(point.homeowner_id),
      homeownerId: point.homeowner_id,
      leadIntakeId: null,
      contactPointId: point.id,
    };
  }

  const pageSize = 1_000;
  const loadHomeownerPhones = async () => {
    const rows: Array<{ id: string; phone: string }> = [];
    for (let start = 0; ; start += pageSize) {
      const result = await supabase
        .from("homeowners")
        .select("id, phone")
        .not("phone", "is", null)
        .range(start, start + pageSize - 1);
      if (result.error) {
        throw databaseError("resolve inbound homeowners", result.error.message);
      }
      const page = (result.data ?? []) as Array<{ id: string; phone: string }>;
      rows.push(...page);
      if (page.length < pageSize) return rows;
    }
  };
  const loadLeadPhones = async () => {
    const rows: Array<{ id: string; phone: string }> = [];
    for (let start = 0; ; start += pageSize) {
      const result = await supabase
        .from("lead_intakes")
        .select("id, phone")
        .not("phone", "is", null)
        .order("submitted_at", { ascending: false })
        .range(start, start + pageSize - 1);
      if (result.error) {
        throw databaseError("resolve inbound leads", result.error.message);
      }
      const page = (result.data ?? []) as Array<{ id: string; phone: string }>;
      rows.push(...page);
      if (page.length < pageSize) return rows;
    }
  };
  const [homeownerPhones, leadPhones] = await Promise.all([
    loadHomeownerPhones(),
    loadLeadPhones(),
  ]);
  const homeownerMatches = homeownerPhones
    .filter((row) => normalizeCustomerPhone(row.phone) === normalizedPhone);
  const leadMatches = leadPhones
    .filter((row) => normalizeCustomerPhone(row.phone) === normalizedPhone);

  // A converted customer commonly remains in lead history. Prefer the single
  // canonical homeowner match over its historical lead duplicate.
  if (homeownerMatches.length > 1) {
    return {
      status: "ambiguous",
      normalizedPhone,
      conversationId: null,
      homeownerId: null,
      leadIntakeId: null,
      contactPointId: null,
    };
  }

  if (homeownerMatches.length === 0 && leadMatches.length > 1) {
    const messagedConversation = await messagedConversationForDuplicateLeads(
      leadMatches.map((lead) => lead.id),
      normalizedPhone,
    );
    if (messagedConversation) {
      return {
        status: "resolved",
        normalizedPhone,
        conversationId: messagedConversation.id,
        homeownerId: null,
        leadIntakeId: messagedConversation.leadIntakeId,
        contactPointId: null,
      };
    }
    return {
      status: "ambiguous",
      normalizedPhone,
      conversationId: null,
      homeownerId: null,
      leadIntakeId: null,
      contactPointId: null,
    };
  }

  if (homeownerMatches.length === 1) {
    const homeownerId = homeownerMatches[0].id;
    return {
      status: "resolved",
      normalizedPhone,
      conversationId: await genericConversationIdForHomeowner(homeownerId),
      homeownerId,
      leadIntakeId: null,
      contactPointId: null,
    };
  }

  if (leadMatches.length === 0) {
    return {
      status: "not_found",
      normalizedPhone,
      conversationId: null,
      homeownerId: null,
      leadIntakeId: null,
      contactPointId: null,
    };
  }

  const leadIntakeId = leadMatches[0].id;
  return {
    status: "resolved",
    normalizedPhone,
    conversationId: await conversationIdForLead(leadIntakeId),
    homeownerId: null,
    leadIntakeId,
    contactPointId: null,
  };
}
