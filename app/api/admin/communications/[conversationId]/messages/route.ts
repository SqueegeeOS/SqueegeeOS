import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "@/lib/admin/server-auth";
import {
  CommunicationsServiceError,
  sendOutboundCommunication,
} from "@/lib/communications/service";
import type { CustomerCommunicationChannel } from "@/lib/communications/types";
import { isCloudPersistenceConnected } from "@/lib/persistence/config";
import { isServiceRoleConfigured } from "@/lib/persistence/supabase/client";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

interface SendMessageBody {
  channel?: unknown;
  subject?: unknown;
  body?: unknown;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  if (!authorizeAdminRequest(request.headers)) return unauthorized();
  if (!isCloudPersistenceConnected() || !isServiceRoleConfigured()) {
    return NextResponse.json(
      { error: "Customer communications storage is not configured." },
      { status: 503 },
    );
  }

  const { conversationId } = await context.params;
  if (!conversationId.trim() || conversationId.length > 128) {
    return NextResponse.json({ error: "Conversation ID is required." }, { status: 400 });
  }

  let payload: SendMessageBody;
  try {
    payload = (await request.json()) as SendMessageBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const channel = payload.channel;
  if (channel !== "email" && channel !== "sms") {
    return NextResponse.json({ error: "Channel must be email or sms." }, { status: 400 });
  }
  if (typeof payload.body !== "string") {
    return NextResponse.json({ error: "Message body is required." }, { status: 400 });
  }
  if (payload.subject != null && typeof payload.subject !== "string") {
    return NextResponse.json({ error: "Email subject must be text." }, { status: 400 });
  }

  try {
    const result = await sendOutboundCommunication({
      conversationId: conversationId.trim(),
      channel: channel as CustomerCommunicationChannel,
      subject: typeof payload.subject === "string" ? payload.subject : null,
      body: payload.body,
      idempotencyKey: request.headers.get("idempotency-key"),
      metadata: { source: "hq_manual" },
    });
    return NextResponse.json(
      {
        message: {
          id: result.message.id,
          channel: result.message.channel,
          direction: result.message.direction,
          subject: result.message.subject,
          body: result.message.bodyText,
          status: result.message.deliveryStatus,
          occurredAt:
            result.message.sentAt ??
            result.message.providerEventAt ??
            result.message.createdAt,
        },
        duplicate: result.duplicate,
      },
      { status: result.duplicate ? 200 : 201 },
    );
  } catch (error) {
    if (error instanceof CommunicationsServiceError) {
      console.warn("[communications] outbound blocked or failed", {
        conversationId,
        channel,
        code: error.code,
      });
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error("[communications] outbound send failed", {
      conversationId,
      channel,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "The message could not be sent. Try again in a moment." },
      { status: 500 },
    );
  }
}
