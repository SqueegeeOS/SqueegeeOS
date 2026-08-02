import { NextResponse } from "next/server";
import {
  twilioFormToParams,
  verifyTwilioWebhookSignature,
} from "@/lib/communications/providers/twilio-webhooks";
import {
  recordTwilioStatusCallback,
  resolveTwilioSignatureUrl,
} from "@/lib/integrations/twilio-communications";

export const runtime = "nodejs";

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
  const messageSid = form.get("MessageSid")?.trim() ?? "";
  const messageStatus = form.get("MessageStatus")?.trim() ?? "";
  if (!/^(?:SM|MM)[0-9a-fA-F]{32}$/.test(messageSid) || !messageStatus) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  await recordTwilioStatusCallback({
    messageSid,
    messageStatus,
    errorCode: form.get("ErrorCode"),
    rawPayload,
  });
  return new NextResponse(null, { status: 204 });
}
