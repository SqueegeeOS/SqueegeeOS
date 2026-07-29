import { after, NextResponse } from "next/server";
import { getJobberClientSecret } from "@/lib/care-operations/jobber-oauth-config";
import {
  parseJobberWebhookPayload,
  recordAndProcessJobberWebhook,
} from "@/lib/integrations/jobber-webhook";
import { verifyJobberWebhookSignature } from "@/lib/integrations/webhook-signatures";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let secret: string;
  try {
    secret = getJobberClientSecret();
  } catch {
    return NextResponse.json(
      { error: "Webhook is not configured" },
      { status: 503 },
    );
  }

  const rawPayload = await request.text();
  if (
    !verifyJobberWebhookSignature({
      payload: rawPayload,
      signature: request.headers.get("x-jobber-hmac-sha256"),
      secret,
    })
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  const event = parseJobberWebhookPayload(rawPayload);
  if (!event) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  after(() => recordAndProcessJobberWebhook({ rawPayload, event }));
  return NextResponse.json({ received: true }, { status: 202 });
}
