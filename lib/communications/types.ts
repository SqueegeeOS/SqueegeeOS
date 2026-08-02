export type CustomerCommunicationChannel = "email" | "sms";

export type CustomerConsentStatus = "unknown" | "opted_in" | "opted_out";

export type CustomerContactVerificationStatus =
  | "unverified"
  | "verified"
  | "invalid";

export type CustomerConversationStatus = "open" | "closed" | "archived";

export type CustomerMessageDirection = "inbound" | "outbound" | "system";

export type CustomerMessageDeliveryStatus =
  | "draft"
  | "queued"
  | "scheduled"
  | "sending"
  | "accepted"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "read"
  | "received"
  | "delivery_delayed"
  | "failed"
  | "bounced"
  | "complained"
  | "cancelled";

export type CustomerCommunicationAutomationEvent =
  | "lead_acknowledgement"
  | "visit_reminder_24h";

export type CustomerWebhookProcessingStatus =
  | "received"
  | "processed"
  | "ignored"
  | "failed";

export interface CustomerContactPoint {
  id: string;
  homeownerId: string;
  channel: CustomerCommunicationChannel;
  addressNormalized: string;
  addressMasked: string | null;
  isPrimary: boolean;
  verificationStatus: CustomerContactVerificationStatus;
  verifiedAt: string | null;
  consentStatus: CustomerConsentStatus;
  consentSource: string | null;
  consentRecordedAt: string | null;
  optOutReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Homeowner is the canonical customer identity. A conversation may be
 * provisionally lead-only until the intake is reconciled to a homeowner.
 */
export interface CustomerConversation {
  id: string;
  homeownerId: string | null;
  propertyId: string | null;
  membershipId: string | null;
  leadIntakeId: string | null;
  subject: string | null;
  status: CustomerConversationStatus;
  assignedTo: string | null;
  provider: string | null;
  providerThreadId: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerMessage {
  id: string;
  conversationId: string;
  contactPointId: string | null;
  automationRuleId: string | null;
  replyToMessageId: string | null;
  direction: CustomerMessageDirection;
  channel: CustomerCommunicationChannel;
  provider: string | null;
  providerMessageId: string | null;
  idempotencyKey: string;
  senderAddressNormalized: string | null;
  recipientAddressNormalized: string | null;
  recipientAddressMasked: string | null;
  subject: string | null;
  bodyText: string;
  deliveryStatus: CustomerMessageDeliveryStatus;
  scheduledFor: string | null;
  providerEventAt: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  failureCode: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerCommunicationAutomationRule {
  id: string;
  eventType: CustomerCommunicationAutomationEvent;
  channel: CustomerCommunicationChannel;
  enabled: boolean;
  consentRequired: boolean;
  verifiedContactRequired: boolean;
  scheduleOffsetMinutes: number;
  templateKey: string;
  configuration: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerCommunicationWebhookEvent {
  provider: string;
  providerEventId: string;
  eventType: string;
  providerMessageId: string | null;
  customerMessageId: string | null;
  occurredAt: string | null;
  payloadHash: string;
  processingStatus: CustomerWebhookProcessingStatus;
  errorCode: string | null;
  receivedAt: string;
  processedAt: string | null;
}

export interface LeadSmsConsent {
  status: CustomerConsentStatus;
  recordedAt: string | null;
}
