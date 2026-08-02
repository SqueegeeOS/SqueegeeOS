import { NextResponse } from "next/server";
import {
  parseTwilioInboundForm,
  twilioFormToParams,
  verifyTwilioWebhookSignature,
} from "@/lib/communications/providers/twilio-webhooks";
import {
  recordTwilioInboundMessage,
  resolveTwilioSignatureUrl,
} from "@/lib/integrations/twilio-communications";

export const runtime = "nodejs";

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

export async function POST(request: Request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!authToken) {
    return NextResponse.json({ error: "Webhook is not configured" }, { status: 503 });
  }
  const rawPayload = await request.text();
  const form = new URLSearchParams(rawPayload);
  const verified = verifyTwilioWebhookSignature({
    authToken,
    signature: request.headers.get("x-twilio-signature"),
    url: resolveTwilioSignatureUrl(request),
    params: twilioFormToParams(form),
  });
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  const message = parseTwilioInboundForm(form);
  if (!message) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  try {
    await recordTwilioInboundMessage({ message, rawPayload });
  } catch (error) {
    console.error("[twilio-inbound] persistence failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ error: "Inbound message failed" }, { status: 500 });
  }
  return new NextResponse(EMPTY_TWIML, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}
