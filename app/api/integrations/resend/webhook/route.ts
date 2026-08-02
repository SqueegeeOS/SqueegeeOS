import { NextResponse } from "next/server";
import {
  parseResendDeliveryWebhook,
  recordResendDeliveryWebhook,
} from "@/lib/integrations/resend-webhook";
import { verifySvixWebhookSignature } from "@/lib/integrations/webhook-signatures";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook is not configured" },
      { status: 503 },
    );
  }

  const rawPayload = await request.text();
  const svixId = request.headers.get("svix-id");
  const verified = verifySvixWebhookSignature({
    payload: rawPayload,
    messageId: svixId,
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
    secret,
  });
  if (!verified || !svixId) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = parseResendDeliveryWebhook(rawPayload);
  if (!event) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    await recordResendDeliveryWebhook({ svixId, rawPayload, event });
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[resend-webhook] processing failed", {
      eventType: event.type,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
